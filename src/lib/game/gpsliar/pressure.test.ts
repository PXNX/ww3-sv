import { describe, expect, it } from 'vitest';
import { FINE_COOLDOWN_S, POINTS_FINE, SANCTION_WARN_S, SPOOF_CHART_ERROR, STEP } from './config';
import type { Level, PatrolRoute } from './level';
import { levelAt } from './levels';
import { NO_LIE } from './lie';
import { inBeam, patrolPose } from './patrol';
import {
	claimedPosition,
	createGame,
	setSteer,
	step,
	toggleSpoof,
	type GameState,
	type GpsLiarEvent
} from './state';
import { currentAt, fogFactor, lightning, seaDrift, stormAt } from './weather';

function sea(overrides: Partial<Level> = {}): Level {
	return {
		id: 'test',
		width: 24,
		height: 20,
		land: 'north',
		start: { x: 12, y: 17 },
		stops: [{ x: 6, y: 4, cargo: 'herring' }],
		rocks: [],
		shallows: [],
		buoys: [],
		lighthouses: [],
		tanker: null,
		lie: NO_LIE,
		lieSeed: 1,
		fogRadius: 5,
		crossChecks: 2,
		par: 40,
		...overrides
	};
}

function run(state: GameState, seconds: number): GpsLiarEvent[] {
	const events: GpsLiarEvent[] = [];
	for (let i = 0; i < Math.round(seconds / STEP); i++) events.push(...step(state, STEP));
	return events;
}

/** A patrol that sits on the boat's position, so its sweeping beam crosses the boat every lap */
const ON_BOAT: PatrolRoute = {
	center: { x: 12, y: 17 },
	rx: 0.01,
	ry: 0.01,
	period: 1e9,
	phase: 0
};

describe('spoofer', () => {
	it('switches on and off, and drains and refills its energy', () => {
		const state = createGame(sea());
		expect(toggleSpoof(state)).toEqual([{ type: 'spoof-on' }]);
		run(state, 2);
		expect(state.spoofEnergy).toBeLessThan(0.75);
		expect(state.spoofBlend).toBe(1);
		expect(toggleSpoof(state)).toEqual([{ type: 'spoof-off', empty: false }]);
		const low = state.spoofEnergy;
		run(state, 2);
		expect(state.spoofEnergy).toBeGreaterThan(low);
	});

	it('burns out and refuses to start with too little energy', () => {
		const state = createGame(sea());
		toggleSpoof(state);
		const events = run(state, 10);
		expect(events).toContainEqual({ type: 'spoof-off', empty: true });
		expect(state.spoof).toBe(false);
		state.spoofEnergy = 0.01;
		expect(toggleSpoof(state)).toEqual([{ type: 'spoof-empty' }]);
	});

	it('makes the chart worse and the helm wander while it runs', () => {
		const state = createGame(sea());
		const error = () =>
			Math.hypot(claimedPosition(state).x - state.pos.x, claimedPosition(state).y - state.pos.y);
		expect(error()).toBeCloseTo(0);
		toggleSpoof(state);
		run(state, 1);
		expect(error()).toBeCloseTo(SPOOF_CHART_ERROR);
		let wander = 0;
		for (let i = 0; i < 300; i++) {
			step(state, STEP);
			wander = Math.max(wander, Math.abs(state.helmDrift));
		}
		expect(wander).toBeGreaterThan(0.05);
	});
});

describe('coast guard patrol', () => {
	it('has a pose on its oval and a beam that sweeps round', () => {
		const route: PatrolRoute = { center: { x: 10, y: 10 }, rx: 3, ry: 2, period: 20, phase: 0 };
		expect(patrolPose(route, 0).pos).toEqual({ x: 13, y: 10 });
		expect(patrolPose(route, 5).pos.y).toBeCloseTo(12);
		expect(patrolPose(route, 1).beam).not.toBeCloseTo(patrolPose(route, 0).beam);
	});

	it('only sees a boat inside range and cone', () => {
		const route: PatrolRoute = {
			center: { x: 10, y: 10 },
			rx: 0.001,
			ry: 0.001,
			period: 1e9,
			phase: 0
		};
		const beam = patrolPose(route, 0).beam;
		const at = (distance: number, sign: number) => ({
			x: 10 + sign * Math.cos(beam) * distance,
			y: 10 + sign * Math.sin(beam) * distance
		});
		expect(inBeam(route, 0, at(2, 1))).toBe(true);
		expect(inBeam(route, 0, at(2, -1))).toBe(false);
		expect(inBeam(route, 0, at(9, 1))).toBe(false);
	});

	it('locks on, fines and then looks away for a while', () => {
		const state = createGame(sea({ patrols: [ON_BOAT] }));
		state.score = 1000;
		const events: GpsLiarEvent[] = [];
		for (let i = 0; i < 60 * 40 && state.fines === 0; i++) events.push(...step(state, STEP));
		expect(events.some((event) => event.type === 'spotted')).toBe(true);
		expect(events).toContainEqual(expect.objectContaining({ type: 'fined', cause: 'patrol' }));
		expect(state.score).toBe(1000 - POINTS_FINE);
		expect(state.fines).toBe(1);
		expect(state.fineCooldown).toBeGreaterThan(0);
		expect(state.fineCooldown).toBeLessThanOrEqual(FINE_COOLDOWN_S);
	});

	it('never takes the score below zero', () => {
		const state = createGame(sea({ patrols: [ON_BOAT] }));
		run(state, 25);
		expect(state.score).toBe(0);
		expect(state.fines).toBeGreaterThanOrEqual(1);
	});

	it('cannot see a spoofing boat', () => {
		const state = createGame(sea({ patrols: [ON_BOAT] }));
		toggleSpoof(state);
		run(state, 4);
		expect(state.fines).toBe(0);
		expect(state.alert).toBe(0);
	});
});

describe('sanction checks', () => {
	it('fines a boat that is not spoofing and warns first', () => {
		const state = createGame(sea({ sanctionEvery: 10 }));
		state.score = 500;
		const events = run(state, 10.1);
		expect(events).toContainEqual({ type: 'sanction-warning' });
		expect(events).toContainEqual(expect.objectContaining({ type: 'fined', cause: 'sanction' }));
		expect(state.score).toBe(500 - POINTS_FINE);
	});

	it('pays a spoofing boat for passing', () => {
		const state = createGame(sea({ sanctionEvery: 10 }));
		run(state, 10 - SANCTION_WARN_S + 0.2);
		toggleSpoof(state);
		const events = run(state, SANCTION_WARN_S);
		expect(events).toContainEqual(expect.objectContaining({ type: 'sanction-pass' }));
		expect(state.sanctionsPassed).toBe(1);
		expect(state.fines).toBe(0);
	});
});

describe('fuel', () => {
	it('burns with distance, warns, and slows the boat when dry', () => {
		const state = createGame(sea({ fuelRange: 20 }));
		setSteer(state, 1, 0);
		run(state, 1);
		expect(state.fuel).toBeLessThan(1);
		state.fuel = 0.25;
		const events = run(state, 1.5);
		expect(events).toContainEqual({ type: 'fuel-low' });
		run(state, 10);
		expect(state.fuel).toBe(0);
		run(state, 3);
		expect(Math.hypot(state.vel.x, state.vel.y)).toBeLessThan(1.2);
	});

	it('is refilled at a harbour and counts in the score', () => {
		const state = createGame(sea({ fuelRange: 20 }));
		state.fuel = 0.3;
		state.pos = { x: 6, y: 4 };
		const events = step(state, STEP);
		expect(events.some((event) => event.type === 'refuel')).toBe(true);
		expect(state.phase).toBe('won');
		expect(state.breakdown?.fuel).toBeGreaterThan(0);
		expect(state.breakdown?.stops).toBe(500);
	});

	it('never runs dry on a level without a range', () => {
		const state = createGame(sea());
		setSteer(state, 1, 0);
		run(state, 5);
		expect(state.fuel).toBe(1);
	});
});

describe('turning and the sea', () => {
	it('swings the bow at a limited rate', () => {
		const state = createGame(sea());
		setSteer(state, 1, 0);
		run(state, 0.1);
		// A quarter turn needs about half a second, so after 0.1 s the bow is still near north
		expect(state.facing).toBeLessThan(-Math.PI / 4);
		expect(state.facing).toBeGreaterThan(-Math.PI / 2);
	});

	it('shoves an idle boat with the current', () => {
		const state = createGame(sea({ current: { x: 0.5, y: 0 } }));
		const startX = state.pos.x;
		run(state, 4);
		expect(state.pos.x).toBeGreaterThan(startX + 1);
	});

	it('runs a storm in and out and thickens the fog', () => {
		const storms = [{ start: 10, duration: 10 }];
		expect(stormAt(storms, 5)).toBe(0);
		expect(stormAt(storms, 15)).toBe(1);
		expect(stormAt(storms, 10.5)).toBeGreaterThan(0);
		expect(stormAt(storms, 10.5)).toBeLessThan(1);
		expect(fogFactor(1)).toBeLessThan(fogFactor(0));
		expect(lightning(0, 3)).toBe(0);
		const flashes = Array.from({ length: 400 }, (_, i) => lightning(1, i * 0.05)).filter(Boolean);
		expect(flashes.length).toBeGreaterThan(0);
	});

	it('adds the wind to the current only in a storm', () => {
		const level = { current: { x: 0.3, y: 0 }, storms: [{ start: 10, duration: 10 }] };
		expect(seaDrift(level, 2)).toEqual(currentAt(level, 2));
		const stormy = seaDrift(level, 15);
		expect(Math.hypot(stormy.x, stormy.y)).toBeGreaterThan(0.4);
	});

	it('announces storms and sounds the foghorn', () => {
		const state = createGame(sea({ storms: [{ start: 12, duration: 6 }] }));
		const types = run(state, 20).map((event) => event.type);
		expect(types).toContain('storm-warning');
		expect(types).toContain('storm-start');
		expect(types).toContain('storm-end');
		expect(types).toContain('horn');
	});
});

describe('escalation', () => {
	it('adds patrols, storms and sanction checks as the levels go on', () => {
		const first = levelAt(0);
		const last = levelAt(11);
		expect(first.patrols).toHaveLength(0);
		expect(first.sanctionEvery).toBe(0);
		expect(last.patrols).toHaveLength(3);
		expect(last.storms?.length).toBe(3);
		expect(last.sanctionEvery).toBeGreaterThan(0);
		expect(last.fuelRange).toBeGreaterThan(0);
	});
});

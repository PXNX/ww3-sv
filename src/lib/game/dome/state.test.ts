import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	BLACKOUT_MS,
	MAX_AMMO,
	RELOAD_MS,
	STARTING_LIVES,
	TARGETS,
	WASTE_PENALTY,
	WAVE_BONUS
} from './config.js';
import {
	createGame,
	rocketPosition,
	rocketValue,
	step,
	tap,
	tapMostUrgent,
	type DomeEvent,
	type DomeState,
	type Rocket
} from './state.js';
import type { Flight } from './trajectory.js';

const STEP = 1000 / 60;
const random = createRandom(3);

const HOSPITAL = TARGETS.findIndex((target) => target.kind === 'hospital');
const PLANT = TARGETS.findIndex((target) => target.kind === 'plant');
const HOUSE = TARGETS.findIndex((target) => target.kind === 'house');

function flightTo(index: number | null, flightMs = 6000, impactX?: number): Flight {
	return {
		startX: -24,
		startY: 60,
		impactX: impactX ?? (index === null ? 40 : TARGETS[index].x),
		lift: 90,
		flightMs
	};
}

/** A running wave with no scheduled rockets, so a test places exactly the ones it wants */
function emptyWave(holdOpen = true): DomeState {
	const state = createGame();
	state.phase = 'wave';
	state.wave = 1;
	// One launch far in the future keeps the wave from ending while a test looks at other things
	state.queue = holdOpen
		? [{ atMs: 1e9, kind: 'normal', flight: flightTo(null), targetIndex: null }]
		: [];
	return state;
}

function addRocket(
	state: DomeState,
	targetIndex: number | null,
	flightMs = 6000,
	elapsedMs = 0
): Rocket {
	const rocket: Rocket = {
		id: state.nextId++,
		kind: 'normal',
		flight: flightTo(targetIndex, flightMs),
		elapsedMs,
		targetIndex,
		interceptorId: null
	};
	state.rockets.push(rocket);
	return rocket;
}

/** Runs steps until the predicate holds (or time runs out) and collects every event */
function run(state: DomeState, ms: number, until?: (events: DomeEvent[]) => boolean): DomeEvent[] {
	const all: DomeEvent[] = [];
	for (let t = 0; t < ms; t += STEP) {
		const events = step(state, STEP, random);
		all.push(...events);
		if (until?.(events)) break;
	}
	return all;
}

const ofType = <T extends DomeEvent['type']>(events: DomeEvent[], type: T) =>
	events.filter((event): event is Extract<DomeEvent, { type: T }> => event.type === type);

describe('a new game', () => {
	it('starts with full hearts, a full magazine and a short lead-in before wave one', () => {
		const state = createGame();
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.ammo.loaded).toBe(MAX_AMMO);
		expect(state.score).toBe(0);
		expect(state.phase).toBe('pause');
		const events = run(state, 2000, (e) => e.some((event) => event.type === 'wave-start'));
		expect(ofType(events, 'wave-start')[0]).toMatchObject({ wave: 1 });
		expect(state.phase).toBe('wave');
		expect(state.queue.length).toBeGreaterThan(0);
	});

	it('sends the planned rockets one after another into the sky', () => {
		const state = createGame();
		run(state, 6000);
		expect(state.rockets.length + state.queue.length).toBeGreaterThan(0);
		expect(state.rockets.length).toBeGreaterThan(0);
	});
});

describe('intercepting', () => {
	it('launches an interceptor at the rocket under the tap and spends one', () => {
		const state = emptyWave();
		const rocket = addRocket(state, HOSPITAL, 6000, 1000);
		const events = tap(state, rocketPosition(rocket));
		expect(ofType(events, 'launch')).toHaveLength(1);
		expect(state.interceptors).toHaveLength(1);
		expect(state.interceptors[0].rocketId).toBe(rocket.id);
		expect(state.ammo.loaded).toBe(MAX_AMMO - 1);
	});

	it('shoots down a rocket bound for the hospital and pays its value', () => {
		const state = emptyWave();
		const rocket = addRocket(state, HOSPITAL, 6000, 800);
		tap(state, rocketPosition(rocket));
		const events = run(state, 5000, () => state.rockets.length === 0);
		const hit = ofType(events, 'intercept')[0];
		expect(hit).toMatchObject({ points: TARGETS[HOSPITAL].value, wasted: false, combo: 1 });
		expect(state.score).toBe(TARGETS[HOSPITAL].value);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.intercepts).toBe(1);
		expect(state.rockets).toHaveLength(0);
		expect(state.interceptors).toHaveLength(0);
	});

	it('charges a penalty and breaks the combo when the rocket was harmless', () => {
		const state = emptyWave();
		state.score = 100;
		state.combo = 4;
		const rocket = addRocket(state, null, 6000, 800);
		expect(rocketValue(state, rocket)).toBe(0);
		tap(state, rocketPosition(rocket));
		const events = run(state, 5000, () => state.rockets.length === 0);
		expect(ofType(events, 'intercept')[0]).toMatchObject({
			wasted: true,
			points: -WASTE_PENALTY
		});
		expect(state.score).toBe(100 - WASTE_PENALTY);
		expect(state.combo).toBe(0);
		expect(state.wasted).toBe(1);
	});

	it('never takes the score below zero', () => {
		const state = emptyWave();
		const rocket = addRocket(state, null, 6000, 800);
		tap(state, rocketPosition(rocket));
		run(state, 5000, () => state.rockets.length === 0);
		expect(state.score).toBe(0);
	});

	it('treats a rocket bound for a building already in ruins as harmless', () => {
		const state = emptyWave();
		state.ruined[HOSPITAL] = true;
		const rocket = addRocket(state, HOSPITAL, 6000, 800);
		expect(rocketValue(state, rocket)).toBe(0);
		tap(state, rocketPosition(rocket));
		const events = run(state, 5000, () => state.rockets.length === 0);
		expect(ofType(events, 'intercept')[0].wasted).toBe(true);
	});

	it('builds a combo across efficient intercepts and multiplies the points', () => {
		const state = emptyWave();
		const points: number[] = [];
		for (let i = 0; i < 3; i++) {
			const rocket = addRocket(state, HOUSE, 6000, 800);
			tap(state, rocketPosition(rocket));
			const events = run(state, 3000, () => state.rockets.length === 0);
			points.push(ofType(events, 'intercept')[0].points);
			// Let the cooldown pass and reload so the next shot can go
			run(state, RELOAD_MS, () => false);
			state.rockets = [];
		}
		expect(points).toEqual([10, 10, 15]);
		expect(state.combo).toBe(3);
		expect(state.bestCombo).toBe(3);
	});

	it('ignores a tap that is not near a rocket and keeps the interceptor', () => {
		const state = emptyWave();
		addRocket(state, HOSPITAL, 6000, 1000);
		expect(tap(state, { x: 600, y: 380 })).toEqual([]);
		expect(state.interceptors).toHaveLength(0);
		expect(state.ammo.loaded).toBe(MAX_AMMO);
	});

	it('does not chase the same rocket twice', () => {
		const state = emptyWave();
		const rocket = addRocket(state, HOSPITAL, 6000, 1000);
		tap(state, rocketPosition(rocket));
		state.ammo.cooldownMs = 0;
		expect(tap(state, rocketPosition(rocket))).toEqual([]);
		expect(state.interceptors).toHaveLength(1);
		expect(state.ammo.loaded).toBe(MAX_AMMO - 1);
	});

	it('does nothing between waves', () => {
		const state = createGame();
		expect(tap(state, { x: 100, y: 100 })).toEqual([]);
		expect(tapMostUrgent(state)).toEqual([]);
	});
});

describe('ammo and cooldown in play', () => {
	it('says so when the magazine is empty and keeps the rocket free', () => {
		const state = emptyWave();
		const rocket = addRocket(state, HOSPITAL, 6000, 1000);
		state.ammo.loaded = 0;
		const events = tap(state, rocketPosition(rocket));
		expect(events).toEqual([{ type: 'no-ammo' }]);
		expect(state.interceptors).toHaveLength(0);
		expect(rocket.interceptorId).toBeNull();
	});

	it('ignores a tap during the short cooldown after a shot', () => {
		const state = emptyWave();
		const first = addRocket(state, HOSPITAL, 6000, 1000);
		const second = addRocket(state, PLANT, 6000, 1000);
		tap(state, rocketPosition(first));
		expect(tap(state, rocketPosition(second))).toEqual([]);
		run(state, 300);
		expect(ofType(tap(state, rocketPosition(second)), 'launch')).toHaveLength(1);
	});

	it('reloads an interceptor while the wave runs', () => {
		const state = emptyWave();
		addRocket(state, null, 20000, 0);
		state.ammo.loaded = 1;
		run(state, RELOAD_MS + 50);
		expect(state.ammo.loaded).toBe(2);
	});
});

describe('impacts', () => {
	it('costs the hearts of the building and leaves it in ruins', () => {
		const state = emptyWave();
		addRocket(state, HOUSE, 800, 0);
		const events = run(state, 1500, (e) => e.some((event) => event.type === 'impact'));
		expect(ofType(events, 'impact')[0]).toMatchObject({
			target: 'house',
			cost: TARGETS[HOUSE].cost
		});
		expect(state.lives).toBe(STARTING_LIVES - TARGETS[HOUSE].cost);
		expect(state.ruined[HOUSE]).toBe(true);
		expect(state.hits).toBe(1);
		expect(state.combo).toBe(0);
	});

	it('costs nothing when a rocket lands in the sea or the field', () => {
		const state = emptyWave();
		addRocket(state, null, 800, 0);
		const events = run(state, 1500, (e) => e.some((event) => event.type === 'impact'));
		expect(ofType(events, 'impact')[0]).toMatchObject({ target: null, cost: 0 });
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('costs nothing for a second rocket on a building that is already in ruins', () => {
		const state = emptyWave();
		state.ruined[HOSPITAL] = true;
		addRocket(state, HOSPITAL, 800, 0);
		const events = run(state, 1500, (e) => e.some((event) => event.type === 'impact'));
		expect(ofType(events, 'impact')[0].cost).toBe(0);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('knocks the reloader out for a while when the power plant is hit', () => {
		const state = emptyWave();
		addRocket(state, PLANT, 800, 0);
		const events = run(state, 1500, (e) => e.some((event) => event.type === 'blackout'));
		expect(ofType(events, 'blackout')).toHaveLength(1);
		expect(state.blackoutMs).toBeGreaterThan(BLACKOUT_MS - 2000);
		state.ammo.loaded = 0;
		state.ammo.reloadMs = 0;
		addRocket(state, null, 30000, 0);
		run(state, RELOAD_MS + 100);
		expect(state.ammo.loaded).toBe(0);
		run(state, RELOAD_MS);
		expect(state.ammo.loaded).toBe(1);
	});

	it('loses a chasing interceptor when its rocket lands first', () => {
		const state = emptyWave();
		const rocket = addRocket(state, HOSPITAL, 600, 300);
		tap(state, rocketPosition(rocket));
		const events = run(
			state,
			2000,
			() => state.interceptors.length === 0 && state.rockets.length === 0
		);
		expect(ofType(events, 'impact')).toHaveLength(1);
		expect(ofType(events, 'fizzle')).toHaveLength(1);
		expect(state.interceptors).toHaveLength(0);
	});

	it('ends the game when the last heart is lost', () => {
		const state = emptyWave();
		state.lives = 2;
		addRocket(state, HOSPITAL, 600, 0);
		addRocket(state, HOUSE, 700, 0);
		const events = run(state, 2000);
		expect(state.lives).toBe(0);
		expect(state.phase).toBe('over');
		expect(ofType(events, 'game-over')).toHaveLength(1);
		expect(step(state, STEP, random)).toEqual([]);
		expect(tap(state, { x: 1, y: 1 })).toEqual([]);
	});

	it('never takes the hearts below zero', () => {
		const state = emptyWave();
		state.lives = 1;
		addRocket(state, HOSPITAL, 500, 0);
		run(state, 1500);
		expect(state.lives).toBe(0);
	});
});

describe('waves', () => {
	it('clears a wave when everything is resolved, pays a bonus and heals a clean wave', () => {
		const state = emptyWave(false);
		state.lives = STARTING_LIVES - 1;
		const rocket = addRocket(state, HOUSE, 6000, 800);
		tap(state, rocketPosition(rocket));
		const events = run(state, 5000, (e) => e.some((event) => event.type === 'wave-clear'));
		const clear = ofType(events, 'wave-clear')[0];
		expect(clear).toMatchObject({ wave: 1, bonus: WAVE_BONUS, perfect: true, heartBack: true });
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.phase).toBe('pause');
		expect(state.score).toBe(TARGETS[HOUSE].value + WAVE_BONUS);
	});

	it('gives no heart for a wave with a building hit, then rebuilds it for the next wave', () => {
		const state = emptyWave(false);
		addRocket(state, HOUSE, 800, 0);
		const events = run(state, 3000, (e) => e.some((event) => event.type === 'wave-clear'));
		const clear = ofType(events, 'wave-clear')[0];
		expect(clear).toMatchObject({ perfect: false, heartBack: false });
		expect(state.lives).toBe(STARTING_LIVES - TARGETS[HOUSE].cost);
		expect(state.ruined.every((flag) => !flag)).toBe(true);
	});

	it('never heals above the starting hearts', () => {
		const state = emptyWave(false);
		addRocket(state, null, 800, 0);
		run(state, 3000, (e) => e.some((event) => event.type === 'wave-clear'));
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('starts the next wave after the pause with more rockets', () => {
		const state = createGame();
		const first = run(state, 2000, (e) => e.some((event) => event.type === 'wave-start'));
		const firstCount = ofType(first, 'wave-start')[0].count;
		// Skip the rockets of wave one: everything is resolved at once
		state.queue = [];
		state.rockets = [];
		const events = run(state, 8000, (e) => e.some((event) => event.type === 'wave-start'));
		expect(ofType(events, 'wave-clear')).toHaveLength(1);
		const next = ofType(events, 'wave-start')[0];
		expect(next.wave).toBe(2);
		expect(next.count).toBeGreaterThan(firstCount);
	});
});

describe('keyboard fallback', () => {
	it('launches at the most urgent rocket bound for a standing building', () => {
		const state = emptyWave();
		addRocket(state, null, 2000, 0);
		addRocket(state, HOUSE, 6000, 0);
		const hospital = addRocket(state, HOSPITAL, 6000, 0);
		const events = tapMostUrgent(state);
		expect(ofType(events, 'launch')).toHaveLength(1);
		expect(state.interceptors[0].rocketId).toBe(hospital.id);
	});

	it('does nothing when only harmless rockets are in the sky', () => {
		const state = emptyWave();
		addRocket(state, null, 6000, 0);
		expect(tapMostUrgent(state)).toEqual([]);
		expect(state.ammo.loaded).toBe(MAX_AMMO);
	});
});

describe('whole runs', () => {
	/** Plays a seeded run, tapping at the most urgent rocket every 200 ms when `defend` is set */
	function simulate(seed: number, defend: boolean) {
		const state = createGame();
		const rng = createRandom(seed);
		let ms = 0;
		while (state.phase !== 'over' && ms < 900_000) {
			step(state, STEP, rng);
			ms += STEP;
			if (defend && Math.floor(ms / STEP) % 12 === 0) tapMostUrgent(state);
		}
		return state;
	}

	it('loses an undefended city within the first waves', () => {
		for (let seed = 1; seed <= 5; seed++) {
			const state = simulate(seed, false);
			expect(state.phase).toBe('over');
			expect(state.wave).toBeLessThanOrEqual(3);
			expect(state.score).toBeLessThanOrEqual(40);
		}
	});

	it('lets a sharp defender last for several waves but not forever', () => {
		for (let seed = 1; seed <= 5; seed++) {
			const state = simulate(seed, true);
			expect(state.phase).toBe('over');
			expect(state.wave).toBeGreaterThanOrEqual(6);
			expect(state.wave).toBeLessThan(40);
			expect(state.intercepts).toBeGreaterThan(30);
		}
	});
});

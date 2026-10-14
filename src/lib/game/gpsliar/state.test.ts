import { describe, expect, it } from 'vitest';
import {
	ANCHOR_CHAIN,
	BOAT_MAX_SPEED,
	BOAT_RADIUS,
	COAST_DEPTH,
	CROSS_CHECK_S,
	INVULNERABLE_S,
	PORT_RADIUS,
	POINTS_NO_CROSS_CHECK,
	POINTS_PER_HEART,
	POINTS_PER_STOP,
	SHALLOWS_SPEED_FACTOR,
	STARTING_HEARTS,
	STEP
} from './config';
import type { Level } from './level';
import { NO_LIE } from './lie';
import {
	claimedPosition,
	createGame,
	crossCheck,
	heading,
	nextStop,
	setSteer,
	solids,
	starsFor,
	step,
	type GameState,
	type GpsLiarEvent
} from './state';
import { tankerPose } from './tanker';

/** A small hand-made sea, land to the north: start at the bottom, two harbours up top, one rock between */
function sea(overrides: Partial<Level> = {}): Level {
	return {
		id: 'test',
		width: 24,
		height: 20,
		land: 'north',
		start: { x: 12, y: 17 },
		stops: [
			{ x: 6, y: 4, cargo: 'herring' },
			{ x: 18, y: 4, cargo: 'stones' }
		],
		rocks: [{ x: 12, y: 12, r: 0.6 }],
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

/** Moves the boat and lets one step pass, so deliveries and collisions are checked there */
function placeAt(state: GameState, x: number, y: number) {
	state.pos = { x, y };
	state.vel = { x: 0, y: 0 };
}

describe('createGame', () => {
	it('starts at the start with full hearts and the level checks', () => {
		const state = createGame(sea());
		expect(state.pos).toEqual({ x: 12, y: 17 });
		expect(state.hearts).toBe(STARTING_HEARTS);
		expect(state.crossChecksLeft).toBe(2);
		expect(state.delivered).toBe(0);
		expect(state.phase).toBe('play');
		expect(nextStop(state)?.cargo).toBe('herring');
	});
});

describe('sailing', () => {
	it('accelerates toward the steered direction up to the top speed', () => {
		const state = createGame(sea());
		setSteer(state, 0, -1);
		run(state, 0.2);
		expect(state.vel.y).toBeLessThan(0);
		expect(Math.abs(state.vel.y)).toBeLessThan(BOAT_MAX_SPEED);
		run(state, 1);
		expect(state.vel.y).toBeCloseTo(-BOAT_MAX_SPEED);
		expect(state.pos.y).toBeLessThan(17);
	});

	it('is not faster on a diagonal', () => {
		const state = createGame(sea());
		setSteer(state, 1, -1);
		expect(Math.hypot(state.steer.x, state.steer.y)).toBeCloseTo(1);
		run(state, 1.5);
		expect(Math.hypot(state.vel.x, state.vel.y)).toBeCloseTo(BOAT_MAX_SPEED);
	});

	it('glides to a stop when the steering is let go', () => {
		const state = createGame(sea());
		setSteer(state, 1, 0);
		run(state, 1);
		setSteer(state, 0, 0);
		run(state, 3);
		expect(Math.hypot(state.vel.x, state.vel.y)).toBeLessThan(0.05);
	});

	it('is slowed by shallows and speeds up again outside', () => {
		const state = createGame(sea({ shallows: [{ x: 12, y: 17, r: 1.5 }] }));
		setSteer(state, 0, 1);
		run(state, 0.5);
		expect(state.inShallows).toBe(true);
		expect(Math.hypot(state.vel.x, state.vel.y)).toBeLessThanOrEqual(
			BOAT_MAX_SPEED * SHALLOWS_SPEED_FACTOR + 1e-9
		);
		placeAt(state, 6, 10);
		setSteer(state, 1, 0);
		run(state, 1.5);
		expect(state.inShallows).toBe(false);
		expect(state.vel.x).toBeCloseTo(BOAT_MAX_SPEED);
	});

	it('cannot sail onto the coast or off the map', () => {
		const state = createGame(sea());
		setSteer(state, 0, -1);
		run(state, 8);
		expect(state.pos.y).toBeGreaterThanOrEqual(COAST_DEPTH + BOAT_RADIUS - 1e-9);
		setSteer(state, 1, 1);
		placeAt(state, 12, 17);
		run(state, 12);
		expect(state.pos.x).toBeLessThanOrEqual(24 - BOAT_RADIUS + 1e-9);
		expect(state.pos.y).toBeLessThanOrEqual(20 - BOAT_RADIUS + 1e-9);
	});

	it('reports its heading in degrees from north', () => {
		const state = createGame(sea());
		expect(heading(state)).toBeNull();
		state.vel = { x: 0, y: -2 };
		expect(heading(state)).toBe(0);
		state.vel = { x: 2, y: 0 };
		expect(heading(state)).toBe(90);
		state.vel = { x: 0, y: 2 };
		expect(heading(state)).toBe(180);
		state.vel = { x: -2, y: 0 };
		expect(heading(state)).toBe(270);
	});
});

describe('hazards', () => {
	it('costs a heart on a rock, shoves the boat back and grants grace', () => {
		const state = createGame(sea());
		placeAt(state, 12, 12.5);
		const events = step(state, STEP);
		expect(events).toContainEqual(expect.objectContaining({ type: 'hit', cause: 'rock' }));
		expect(state.hearts).toBe(STARTING_HEARTS - 1);
		expect(state.invulnerable).toBeCloseTo(INVULNERABLE_S, 1);
		expect(Math.hypot(state.pos.x - 12, state.pos.y - 12)).toBeGreaterThanOrEqual(
			0.6 + BOAT_RADIUS - 1e-9
		);
		expect(state.vel.y).toBeGreaterThan(0);
	});

	it('only bumps during the grace period', () => {
		const state = createGame(sea());
		placeAt(state, 12, 12.5);
		step(state, STEP);
		placeAt(state, 12, 12.5);
		const events = step(state, STEP);
		expect(events.map((event) => event.type)).toEqual(['bump']);
		expect(state.hearts).toBe(STARTING_HEARTS - 1);
	});

	it('can hurt again once the grace period is over', () => {
		const state = createGame(sea());
		placeAt(state, 12, 12.5);
		step(state, STEP);
		run(state, INVULNERABLE_S + 0.1);
		placeAt(state, 12, 12.5);
		step(state, STEP);
		expect(state.hearts).toBe(STARTING_HEARTS - 2);
	});

	it('ends the run when the last heart is gone', () => {
		const state = createGame(sea());
		state.hearts = 1;
		placeAt(state, 12, 12.5);
		const events = step(state, STEP);
		expect(events.map((event) => event.type)).toEqual(['hit', 'game-over']);
		expect(state.phase).toBe('over');
		expect(step(state, STEP)).toEqual([]);
	});

	it('hits a lighthouse islet like a rock', () => {
		const state = createGame(sea({ rocks: [], lighthouses: [{ x: 8, y: 12, flashes: 2 }] }));
		placeAt(state, 8, 12.5);
		expect(step(state, STEP)).toContainEqual(
			expect.objectContaining({ type: 'hit', cause: 'lighthouse' })
		);
	});

	it('is hurt by the tanker and by its dragging anchor', () => {
		const route = { from: { x: 6, y: 10 }, to: { x: 18, y: 10 } };
		const level = sea({ rocks: [], tanker: route });
		const hull = createGame(level);
		const pose = tankerPose(route, STEP);
		placeAt(hull, pose.hull.x, pose.hull.y + 0.5);
		expect(step(hull, STEP)).toContainEqual(
			expect.objectContaining({ type: 'hit', cause: 'tanker' })
		);

		const anchor = createGame(level);
		placeAt(anchor, pose.anchor.x, pose.anchor.y + 0.1);
		expect(step(anchor, STEP)).toContainEqual(
			expect.objectContaining({ type: 'hit', cause: 'anchor' })
		);
		expect(pose.hull.x - pose.anchor.x).toBeCloseTo(ANCHOR_CHAIN);
	});

	it('lists the tanker only when the level has one, at its place for the time', () => {
		expect(solids(sea(), 0).map((solid) => solid.cause)).toEqual(['rock']);
		const route = { from: { x: 6, y: 10 }, to: { x: 18, y: 10 } };
		const list = solids(sea({ tanker: route }), 5);
		expect(list.map((solid) => solid.cause)).toEqual(['rock', 'tanker', 'anchor']);
		expect(list[1].x).toBeGreaterThan(6);
	});
});

describe('deliveries', () => {
	it('unloads at the next harbour and then asks for the one after', () => {
		const state = createGame(sea());
		placeAt(state, 6, 4 + PORT_RADIUS - 0.1);
		const events = step(state, STEP);
		expect(events).toContainEqual(
			expect.objectContaining({ type: 'deliver', cargo: 'herring', index: 1 })
		);
		expect(state.delivered).toBe(1);
		expect(state.score).toBe(POINTS_PER_STOP);
		expect(nextStop(state)?.cargo).toBe('stones');
	});

	it('ignores the harbours that are not next', () => {
		const state = createGame(sea());
		placeAt(state, 18, 4);
		step(state, STEP);
		expect(state.delivered).toBe(0);
	});

	it('wins after the last harbour and pays for hearts and a clean record', () => {
		const state = createGame(sea());
		placeAt(state, 6, 4);
		step(state, STEP);
		placeAt(state, 18, 4);
		const events = step(state, STEP);
		expect(state.phase).toBe('won');
		expect(events).toContainEqual({ type: 'win', stars: 3 });
		const underPar = Math.floor(40 - state.time);
		expect(state.score).toBe(
			2 * POINTS_PER_STOP +
				underPar * 10 +
				STARTING_HEARTS * POINTS_PER_HEART +
				POINTS_NO_CROSS_CHECK
		);
		expect(step(state, STEP)).toEqual([]);
	});

	it('gives one star for delivering, one for par and one for no cross-checks', () => {
		const slow = createGame(sea({ par: 1 }));
		slow.time = 5;
		slow.crossChecksUsed = 1;
		expect(starsFor(slow)).toBe(1);
		slow.crossChecksUsed = 0;
		expect(starsFor(slow)).toBe(2);
		slow.time = 0.5;
		slow.crossChecksUsed = 1;
		expect(starsFor(slow)).toBe(2);
		slow.crossChecksUsed = 0;
		expect(starsFor(slow)).toBe(3);
	});

	it('pays no no-cross-check bonus after a cross-check', () => {
		const state = createGame(sea({ stops: [{ x: 6, y: 4, cargo: 'herring' }] }));
		crossCheck(state);
		placeAt(state, 6, 4);
		step(state, STEP);
		expect(state.stars).toBe(2);
		expect(state.score).toBe(
			POINTS_PER_STOP + Math.floor(40 - state.time) * 10 + STARTING_HEARTS * POINTS_PER_HEART
		);
	});
});

describe('cross-check', () => {
	it('shows the truth for a few seconds and uses up a check', () => {
		const state = createGame(sea());
		expect(crossCheck(state)).toEqual([{ type: 'cross-check' }]);
		expect(state.crossChecksLeft).toBe(1);
		expect(state.crossChecksUsed).toBe(1);
		expect(state.reveal).toBeCloseTo(CROSS_CHECK_S);
		run(state, CROSS_CHECK_S + 0.1);
		expect(state.reveal).toBe(0);
	});

	it('does not use a second check while one is showing', () => {
		const state = createGame(sea());
		crossCheck(state);
		expect(crossCheck(state)).toEqual([]);
		expect(state.crossChecksLeft).toBe(1);
	});

	it('says so when there are none left', () => {
		const state = createGame(sea({ crossChecks: 0 }));
		expect(crossCheck(state)).toEqual([{ type: 'cross-check-empty' }]);
		expect(state.crossChecksUsed).toBe(0);
	});

	it('does nothing once the level is over', () => {
		const state = createGame(sea());
		state.phase = 'over';
		expect(crossCheck(state)).toEqual([]);
	});
});

describe('the lie', () => {
	it('shows the true position when the GPS does not lie', () => {
		const state = createGame(sea());
		expect(claimedPosition(state)).toEqual(state.pos);
	});

	it('shows a wrong position when it does, and grows the error with time', () => {
		const lie = { ...NO_LIE, base: 1, growth: 0.5, max: 4 };
		const state = createGame(sea({ lie }));
		const error = () =>
			Math.hypot(claimedPosition(state).x - state.pos.x, claimedPosition(state).y - state.pos.y);
		expect(error()).toBeCloseTo(1);
		run(state, 2);
		expect(error()).toBeCloseTo(2);
	});

	it('reports when the position jumps', () => {
		const lie = { ...NO_LIE, base: 1, max: 5, jumpEvery: 2, jumpSize: 1 };
		const state = createGame(sea({ lie }));
		const events = run(state, 2.1);
		expect(events.filter((event) => event.type === 'lie-jump')).toHaveLength(1);
	});
});

describe('facing', () => {
	it('turns the bow where the boat goes and keeps it while still', () => {
		const state = createGame(sea());
		expect(state.facing).toBeCloseTo(-Math.PI / 2);
		setSteer(state, 1, 0);
		run(state, 1);
		expect(state.facing).toBeCloseTo(0);
		setSteer(state, 0, 0);
		run(state, 5);
		expect(state.facing).toBeCloseTo(0);
	});
});

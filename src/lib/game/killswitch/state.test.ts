import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	BOAT_Y,
	FENCE_CHARGE,
	FENCE_MS,
	LAKE_Y,
	OFFLINE_MS,
	REFINERY_X,
	ROAD_Y,
	STARTING_LIVES,
	WORLD_WIDTH,
	createGame,
	droneSpeed,
	multiplier,
	placeFence,
	segmentsIntersect,
	spawnInterval,
	step,
	tap,
	type KillState,
	type Target
} from './state';

const random = createRandom(7);

/** Puts a target straight into the game, bypassing the spawner */
function add(state: KillState, init: Partial<Target> & { civilian: boolean }): Target {
	const target: Target = {
		id: state.nextId++,
		kind: init.civilian ? 'van' : 'drone',
		x: 200,
		y: 120,
		prevX: init.x ?? 200,
		prevY: init.y ?? 120,
		vx: 0,
		vy: 0,
		state: 'flying',
		stateMs: 0,
		spin: 0,
		...init
	};
	state.targets.push(target);
	return target;
}

/** A quiet game: nothing spawns and no post fires during the test */
function quiet(): KillState {
	const state = createGame();
	state.spawnMs = 1e9;
	state.postMs = 1e9;
	return state;
}

function run(state: KillState, ms: number) {
	const events = [];
	for (let spent = 0; spent < ms; spent += 20) events.push(...step(state, 20, random));
	return events;
}

describe('scoring', () => {
	it('raises the multiplier every five clean cuts, up to five', () => {
		expect(multiplier(0)).toBe(1);
		expect(multiplier(4)).toBe(1);
		expect(multiplier(5)).toBe(2);
		expect(multiplier(19)).toBe(4);
		expect(multiplier(20)).toBe(5);
		expect(multiplier(500)).toBe(5);
	});

	it('gets tighter and faster over time', () => {
		expect(spawnInterval(60000)).toBeLessThan(spawnInterval(0));
		expect(spawnInterval(10 * 60000)).toBe(520);
		expect(droneSpeed(60000, 'drone')).toBeGreaterThan(droneSpeed(0, 'drone'));
		expect(droneSpeed(0, 'fast')).toBeGreaterThan(droneSpeed(0, 'drone'));
	});
});

describe('tapping', () => {
	it('cuts a drone, scores it and drops it into the lake', () => {
		const state = quiet();
		add(state, { civilian: false, x: 200, y: 120 });
		const events = tap(state, 205, 124);
		expect(events).toMatchObject([{ type: 'cut', points: 10, multiplier: 1 }]);
		expect(state.score).toBe(10);
		expect(state.streak).toBe(1);
		expect(state.targets[0].state).toBe('falling');

		const later = run(state, 2000);
		expect(later.some((event) => event.type === 'splash')).toBe(true);
		expect(state.targets).toHaveLength(0);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('ignores a tap that hits nothing', () => {
		const state = quiet();
		add(state, { civilian: false, x: 200, y: 120 });
		expect(tap(state, 400, 300)).toEqual([{ type: 'miss', x: 400, y: 300 }]);
		expect(state.score).toBe(0);
		expect(state.targets[0].state).toBe('flying');
	});

	it('picks the closest target when two overlap', () => {
		const state = quiet();
		const far = add(state, { civilian: false, x: 220, y: 120 });
		const near = add(state, { civilian: false, x: 205, y: 120 });
		tap(state, 200, 120);
		expect(near.state).toBe('falling');
		expect(far.state).toBe('flying');
	});

	it('costs a heart and the streak to cut a civilian', () => {
		const state = quiet();
		state.streak = 7;
		add(state, { civilian: true, kind: 'bus', x: 300, y: ROAD_Y });
		const events = tap(state, 300, ROAD_Y);
		expect(events[0]).toMatchObject({ type: 'civilian-cut', kind: 'bus' });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.streak).toBe(0);
		expect(state.targets[0].state).toBe('stalled');
		expect(tap(state, 300, ROAD_Y)[0].type).toBe('miss');
	});

	it('doubles the points while a boost post is on', () => {
		const state = quiet();
		state.boostMs = 5000;
		add(state, { civilian: false, x: 200, y: 120 });
		tap(state, 200, 120);
		expect(state.score).toBe(20);
	});

	it('does nothing once the game is over', () => {
		const state = quiet();
		state.over = true;
		add(state, { civilian: false, x: 200, y: 120 });
		expect(tap(state, 200, 120)).toEqual([]);
		expect(step(state, 20, random)).toEqual([]);
	});
});

describe('the refinery', () => {
	it('loses a heart when a drone gets through, and the game ends on the third', () => {
		const state = quiet();
		state.streak = 3;
		add(state, { civilian: false, x: REFINERY_X - 1, y: 200, vx: 100 });
		const events = run(state, 100);
		expect(events.some((event) => event.type === 'refinery-hit')).toBe(true);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.streak).toBe(0);
		expect(state.targets).toHaveLength(0);

		add(state, { civilian: false, x: REFINERY_X - 1, y: 200, vx: 100 });
		add(state, { civilian: false, x: REFINERY_X - 1, y: 220, vx: 100 });
		const final = run(state, 100);
		expect(state.over).toBe(true);
		expect(final.filter((event) => event.type === 'game-over')).toHaveLength(1);
	});

	it('lets civilians drive and sail off the map without a penalty', () => {
		const state = quiet();
		add(state, { civilian: true, kind: 'boat', x: WORLD_WIDTH + 55, y: BOAT_Y, vx: 100 });
		add(state, { civilian: true, kind: 'van', x: 10, y: ROAD_Y, vx: -400 });
		run(state, 600);
		expect(state.targets).toHaveLength(0);
		expect(state.lives).toBe(STARTING_LIVES);
	});
});

describe('geofence', () => {
	it('charges with clean cuts and stays charged until placed', () => {
		const state = quiet();
		for (let i = 0; i < FENCE_CHARGE; i++) {
			add(state, { civilian: false, x: 200 + i * 80, y: 120 });
		}
		const events = [];
		for (let i = 0; i < FENCE_CHARGE; i++) events.push(...tap(state, 200 + i * 80, 120));
		expect(state.charge).toBe(FENCE_CHARGE);
		expect(events.filter((event) => event.type === 'fence-ready')).toHaveLength(1);
	});

	it('refuses to be placed before it is charged or when the line is too short', () => {
		const state = quiet();
		expect(placeFence(state, 300, 50, 300, 250)).toEqual([]);
		state.charge = FENCE_CHARGE;
		expect(placeFence(state, 300, 50, 310, 60)).toEqual([]);
		expect(state.fence).toBeNull();
		expect(placeFence(state, 300, 50, 300, 250)).toEqual([{ type: 'fence-placed' }]);
		expect(state.charge).toBe(0);
		// One fence at a time
		state.charge = FENCE_CHARGE;
		expect(placeFence(state, 100, 50, 100, 250)).toEqual([]);
	});

	it('cuts drones that cross it, even fast ones, and leaves civilians alone', () => {
		const state = quiet();
		state.charge = FENCE_CHARGE;
		placeFence(state, 300, 50, 300, 250);
		const drone = add(state, { civilian: false, x: 280, y: 120, vx: 900 });
		const van = add(state, { civilian: true, kind: 'van', x: 280, y: 130, vx: 900 });
		const events = run(state, 100);
		expect(drone.state).toBe('falling');
		expect(van.state).toBe('flying');
		expect(events.find((event) => event.type === 'cut')).toMatchObject({ fenced: true });
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('expires after a while', () => {
		const state = quiet();
		state.charge = FENCE_CHARGE;
		placeFence(state, 300, 50, 300, 250);
		const events = run(state, FENCE_MS + 100);
		expect(state.fence).toBeNull();
		expect(events.some((event) => event.type === 'fence-expired')).toBe(true);
	});

	it('detects crossing segments', () => {
		const a = { x: 0, y: 0 };
		expect(segmentsIntersect(a, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
		expect(segmentsIntersect(a, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
	});
});

describe('posts', () => {
	function postGame(kind: 'purge' | 'rush' | 'boost') {
		const state = quiet();
		state.postMs = 1;
		// pickOne takes the item at floor(random * 3): 0 purge, 1 rush, 2 boost
		const value = { purge: 0.1, rush: 0.4, boost: 0.8 }[kind];
		return { state, rng: () => value };
	}

	it('rush floods the roads with civilians for a while', () => {
		const { state, rng } = postGame('rush');
		step(state, 20, rng);
		expect(state.rushMs).toBeGreaterThan(0);
	});

	it('boost doubles the score for a while', () => {
		const { state, rng } = postGame('boost');
		step(state, 20, rng);
		expect(state.boostMs).toBeGreaterThan(0);
	});

	it('purge cuts every drone for a few points and takes the civilian links offline', () => {
		const { state, rng } = postGame('purge');
		const drone = add(state, { civilian: false, x: 100, y: 100 });
		const van = add(state, { civilian: true, kind: 'van', x: 200, y: ROAD_Y });
		const events = step(state, 20, rng);
		expect(events[0]).toEqual({ type: 'post', kind: 'purge' });
		expect(drone.state).toBe('falling');
		expect(van.state).toBe('offline');
		expect(state.score).toBe(5);
		expect(state.streak).toBe(0);
		expect(state.charge).toBe(0);
	});

	it('restoring an offline vehicle pays and builds the streak', () => {
		const state = quiet();
		const van = add(state, { civilian: true, kind: 'van', x: 200, y: ROAD_Y, state: 'offline' });
		const events = tap(state, 200, ROAD_Y);
		expect(events[0]).toMatchObject({ type: 'restored', points: 30 });
		expect(van.state).toBe('flying');
		expect(state.streak).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('a purge costs one heart, however many vehicles crash', () => {
		const { state, rng } = postGame('purge');
		add(state, { civilian: true, kind: 'van', x: 200, y: ROAD_Y });
		add(state, { civilian: true, kind: 'bus', x: 300, y: ROAD_Y });
		step(state, 20, rng);
		const events = run(state, OFFLINE_MS + 100);
		expect(events.filter((event) => event.type === 'civilian-crash')).toHaveLength(2);
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('a purge saved in time costs nothing', () => {
		const { state, rng } = postGame('purge');
		add(state, { civilian: true, kind: 'van', x: 200, y: ROAD_Y });
		step(state, 20, rng);
		tap(state, state.targets[0].x, ROAD_Y);
		run(state, OFFLINE_MS + 100);
		expect(state.lives).toBe(STARTING_LIVES);
	});
});

describe('spawning', () => {
	it('starts with drones only, then mixes in civilians', () => {
		const state = createGame();
		state.postMs = 1e9;
		const rng = createRandom(3);
		for (let spent = 0; spent < 5000; spent += 20) step(state, 20, rng);
		expect(state.targets.length + state.cuts).toBeGreaterThan(0);
		expect(state.targets.every((target) => !target.civilian)).toBe(true);

		const long = createGame();
		long.postMs = 1e9;
		long.timeMs = 20000;
		const civilians = new Set<boolean>();
		for (let spent = 0; spent < 60000 && civilians.size < 1; spent += 20) {
			step(long, 20, createRandom(spent));
			long.lives = STARTING_LIVES;
			long.over = false;
			if (long.targets.some((target) => target.civilian)) civilians.add(true);
		}
		expect(civilians.has(true)).toBe(true);
	});

	it('keeps drones on the sky and aims them at the refinery', () => {
		const state = createGame();
		state.postMs = 1e9;
		state.spawnMs = 0;
		step(state, 20, createRandom(11));
		const drone = state.targets[0];
		expect(drone.civilian).toBe(false);
		expect(drone.y).toBeLessThan(LAKE_Y);
		expect(drone.vx).toBeGreaterThan(0);
	});
});

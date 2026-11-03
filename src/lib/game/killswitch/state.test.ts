import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	BOAT_Y,
	ENERGY_COST,
	ENERGY_MAX,
	FENCE_CHARGE,
	FENCE_MS,
	OFFLINE_MS,
	REFINERY_X,
	ROAD_Y,
	STARTING_LIVES,
	WAVE_COUNT,
	WORLD_WIDTH,
	accuracy,
	availablePosts,
	createGame,
	droneSpeed,
	isDroneKind,
	multiplier,
	placeFence,
	planWave,
	segmentsIntersect,
	spawnInterval,
	starsFor,
	step,
	tap,
	waveThreats,
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
		hp: 1,
		flashMs: 0,
		...init
	};
	state.targets.push(target);
	return target;
}

/** A quiet game in the middle of wave 3: nothing spawns, no post fires and the wave never ends */
function quiet(): KillState {
	const state = createGame();
	state.wave = 3;
	state.phase = 'wave';
	state.pending = [{ atMs: 1e12, kind: 'drone', y: 100, aim: 200, left: true }];
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
		expect(spawnInterval(6)).toBeLessThan(spawnInterval(1));
		expect(spawnInterval(40)).toBe(620);
		expect(droneSpeed(6, 'drone')).toBeGreaterThan(droneSpeed(1, 'drone'));
		expect(droneSpeed(1, 'fast')).toBeGreaterThan(droneSpeed(1, 'drone'));
		expect(droneSpeed(1, 'hardened')).toBeLessThan(droneSpeed(1, 'drone'));
		expect(waveThreats(WAVE_COUNT)).toBeGreaterThan(waveThreats(1));
	});
});

describe('tapping', () => {
	it('cuts a drone, scores it and drops it into the lake', () => {
		const state = quiet();
		add(state, { civilian: false, x: 200, y: 120 });
		const events = tap(state, 220, 124);
		expect(events).toMatchObject([{ type: 'cut', points: 10, multiplier: 1, precise: false }]);
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
		tap(state, 225, 120);
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
	function postGame(kind: 'purge' | 'rush' | 'boost' | 'unlimited') {
		const state = quiet();
		state.postMs = 1;
		// pickOne takes the item at floor(random * 4): purge, rush, boost, unlimited
		const value = { purge: 0.1, rush: 0.35, boost: 0.6, unlimited: 0.9 }[kind];
		return { state, rng: () => value };
	}

	it('rush floods the roads with civilians for a while', () => {
		const { state, rng } = postGame('rush');
		const before = state.pending.length;
		step(state, 20, rng);
		expect(state.rushMs).toBeGreaterThan(0);
		expect(state.pending.length).toBe(before + 6);
		expect(state.pending.every((spawn) => !isDroneKind(spawn.kind) || spawn.atMs >= 1e12)).toBe(
			true
		);
	});

	it('the unlimited plan refills the energy and makes cuts free for a while', () => {
		const { state, rng } = postGame('unlimited');
		state.energy = 0;
		step(state, 20, rng);
		expect(state.unlimitedMs).toBeGreaterThan(0);
		expect(state.energy).toBeGreaterThanOrEqual(ENERGY_MAX - 1);
		add(state, { civilian: false, x: 200, y: 120 });
		tap(state, 200, 120);
		expect(state.energy).toBeGreaterThanOrEqual(ENERGY_MAX - 1);
	});

	it('hands out only gifts in the first waves', () => {
		expect(availablePosts(2)).toEqual(['boost', 'unlimited']);
		expect(availablePosts(3)).toContain('purge');
		expect(availablePosts(3)).toContain('rush');
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

describe('energy and precision', () => {
	it('spends energy per cut and refuses to cut without it, sparing civilians', () => {
		const state = quiet();
		state.energy = ENERGY_COST - 1;
		const drone = add(state, { civilian: false, x: 200, y: 120 });
		const van = add(state, { civilian: true, kind: 'van', x: 300, y: ROAD_Y });
		expect(tap(state, 200, 120)).toMatchObject([{ type: 'no-energy' }]);
		expect(tap(state, 300, ROAD_Y)).toMatchObject([{ type: 'no-energy' }]);
		expect(drone.state).toBe('flying');
		expect(van.state).toBe('flying');
		expect(state.lives).toBe(STARTING_LIVES);
		run(state, 200);
		expect(tap(state, 200, 120)[0].type).toBe('cut');
	});

	it('refills over time and never goes above the maximum', () => {
		const state = quiet();
		state.energy = 0;
		run(state, 1000);
		expect(state.energy).toBeGreaterThan(20);
		run(state, 10000);
		expect(state.energy).toBe(ENERGY_MAX);
	});

	it('pays extra for a tap dead centre and gives half the energy back', () => {
		const state = quiet();
		add(state, { civilian: false, x: 200, y: 120 });
		add(state, { civilian: false, x: 400, y: 120 });
		const precise = tap(state, 201, 121);
		expect(precise[0]).toMatchObject({ type: 'cut', precise: true, points: 15 });
		expect(state.energy).toBe(ENERGY_MAX - ENERGY_COST / 2);
		const sloppy = tap(state, 400 + 30, 120);
		expect(sloppy[0]).toMatchObject({ type: 'cut', precise: false, points: 10 });
		expect(state.perfects).toBe(1);
	});

	it('is forgiving: extra slop catches a tap just outside the drone', () => {
		const state = quiet();
		add(state, { civilian: false, x: 200, y: 120 });
		expect(tap(state, 200 + 50, 120)[0].type).toBe('miss');
		expect(tap(state, 200 + 50, 120, 12)[0].type).toBe('cut');
		expect(accuracy(state)).toBeCloseTo(0.5);
	});

	it('announces a combo when the multiplier rises', () => {
		const state = quiet();
		state.streak = 4;
		add(state, { civilian: false, x: 200, y: 120 });
		const events = tap(state, 200, 120);
		expect(events.some((event) => event.type === 'combo' && event.multiplier === 2)).toBe(true);
	});
});

describe('drone kinds', () => {
	it('hardened drones shrug off the first cut and fall on the second', () => {
		const state = quiet();
		const hardened = add(state, { civilian: false, kind: 'hardened', hp: 2, x: 200, y: 120 });
		expect(tap(state, 200, 120)[0].type).toBe('shield');
		expect(hardened.state).toBe('flying');
		expect(hardened.flashMs).toBeGreaterThan(0);
		expect(state.score).toBe(0);
		const events = tap(state, 200, 120);
		expect(events[0]).toMatchObject({ type: 'cut', kind: 'hardened' });
		expect(hardened.state).toBe('falling');
		expect(state.score).toBe(25 + 5);
	});

	it('the geofence cuts a hardened drone in one go', () => {
		const state = quiet();
		state.charge = FENCE_CHARGE;
		placeFence(state, 300, 50, 300, 250);
		const hardened = add(state, {
			civilian: false,
			kind: 'hardened',
			hp: 2,
			x: 290,
			y: 120,
			vx: 600
		});
		run(state, 100);
		expect(hardened.state).toBe('falling');
	});

	it('a helicopter flies in the sky and is a civilian: cutting it costs a heart', () => {
		const state = quiet();
		add(state, { civilian: true, kind: 'heli', x: 200, y: 120 });
		expect(tap(state, 200, 120)[0]).toMatchObject({ type: 'civilian-cut', kind: 'heli' });
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('the tap goes to whichever target is nearest its own centre', () => {
		const state = quiet();
		const drone = add(state, { civilian: false, x: 210, y: 120 });
		add(state, { civilian: true, kind: 'heli', x: 190, y: 120 });
		tap(state, 207, 120);
		expect(drone.state).toBe('falling');
	});
});

describe('waves', () => {
	it('plans bigger and denser waves with new kinds introduced one by one', () => {
		const kinds = (wave: number) => new Set(planWave(wave, createRandom(wave)).map((s) => s.kind));
		expect([...kinds(1)]).toEqual(['drone']);
		expect(kinds(2).has('van')).toBe(true);
		expect(kinds(3).has('fast')).toBe(true);
		expect(kinds(4).has('swarm')).toBe(true);
		expect(kinds(5).has('heli')).toBe(true);
		expect(kinds(6).has('hardened')).toBe(true);
		const count = (wave: number) =>
			planWave(wave, createRandom(1)).filter((s) => isDroneKind(s.kind)).length;
		expect(count(1)).toBe(waveThreats(1));
		expect(count(8)).toBe(waveThreats(8));
		const span = (spawns: { atMs: number }[]) => spawns[spawns.length - 1].atMs / spawns.length;
		expect(span(planWave(8, createRandom(9)))).toBeLessThan(span(planWave(1, createRandom(9))));
	});

	it('keeps drones in the sky', () => {
		for (const spawn of planWave(8, createRandom(2))) {
			if (!isDroneKind(spawn.kind)) continue;
			expect(spawn.y).toBeGreaterThanOrEqual(54);
			expect(spawn.y).toBeLessThanOrEqual(240);
		}
	});

	it('starts wave one after a short break and sends its drones in', () => {
		const state = createGame();
		state.postMs = 1e9;
		const events = run(state, 2000);
		expect(events.find((event) => event.type === 'wave-start')).toMatchObject({
			wave: 1,
			intro: null
		});
		expect(state.phase).toBe('wave');
		run(state, 4000);
		const drone = state.targets.find((target) => !target.civilian);
		expect(drone?.vx).toBeGreaterThan(0);
		expect(state.targets.every((target) => !target.civilian)).toBe(true);
	});

	it('clears a wave with a bonus once everything is sent and cut, then takes a break', () => {
		const state = createGame();
		state.postMs = 1e9;
		state.wave = 1;
		state.phase = 'wave';
		state.pending = [];
		const events = run(state, 40);
		expect(events.find((event) => event.type === 'wave-clear')).toMatchObject({
			wave: 1,
			bonus: 150,
			flawless: true
		});
		expect(state.phase).toBe('break');
		expect(state.score).toBe(150);
		const next = run(state, 3000);
		expect(next.some((event) => event.type === 'wave-start' && event.wave === 2)).toBe(true);
	});

	it('gives no flawless bonus when a heart was lost, and waits for drones in flight', () => {
		const state = quiet();
		state.pending = [];
		state.waveHeartLost = true;
		const drone = add(state, { civilian: false, x: 100, y: 100 });
		expect(run(state, 100).some((event) => event.type === 'wave-clear')).toBe(false);
		drone.state = 'falling';
		const events = run(state, 100);
		expect(events.find((event) => event.type === 'wave-clear')).toMatchObject({
			bonus: 150,
			flawless: false
		});
	});

	it('wins after the last wave', () => {
		const state = quiet();
		state.wave = WAVE_COUNT;
		state.pending = [];
		const events = run(state, 40);
		expect(events.some((event) => event.type === 'victory')).toBe(true);
		expect(state.over).toBe(true);
		expect(state.won).toBe(true);
	});

	it('rates a win with stars by hearts left, and a loss with none', () => {
		expect(starsFor({ won: true, lives: 3 })).toBe(3);
		expect(starsFor({ won: true, lives: 2 })).toBe(2);
		expect(starsFor({ won: true, lives: 1 })).toBe(1);
		expect(starsFor({ won: false, lives: 3 })).toBe(0);
	});

	it('holds posts back until wave two', () => {
		const state = createGame();
		state.postMs = 1;
		state.wave = 1;
		state.phase = 'wave';
		state.pending = [{ atMs: 1e12, kind: 'drone', y: 100, aim: 200, left: true }];
		expect(run(state, 200).some((event) => event.type === 'post')).toBe(false);
		state.wave = 2;
		expect(run(state, 200).some((event) => event.type === 'post')).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom, type Random } from '#lib/game/random.js';
import {
	BALLOON_X,
	CEILING_Y,
	DISTANCE_PER_POINT,
	FINALE_MS,
	FLOOR_Y,
	FUEL_BURN_PER_SECOND,
	HEART_BONUS,
	INVULNERABLE_MS,
	JET_FIRST_MS,
	JET_WARN_MS,
	PHOTO_DWELL_MS,
	PHOTO_POINTS,
	PUFF_REFILL,
	STARTING_LIVES,
	TRACK_LENGTH
} from './config.js';
import {
	createGame,
	isBurning,
	missilePosition,
	scoreOf,
	screenX,
	setBurner,
	step,
	type BalloonEvent,
	type BalloonState
} from './state.js';
import { chunkOf, layerCentre, layerOf, windAt, windPattern } from './wind.js';

const STEP = 1000 / 60;

/** A run with an empty sky and no jets, so each test adds only what it is about */
function newGame(seed = 5) {
	const random = createRandom(seed);
	const state = createGame(random, seed);
	state.course = { hazards: [], puffs: [], pois: [] };
	state.nextJetMs = Infinity;
	return { state, random };
}

function run(state: BalloonState, random: Random, ms: number): BalloonEvent[] {
	const events: BalloonEvent[] = [];
	for (let t = 0; t < ms && state.phase !== 'over'; t += STEP) {
		events.push(...step(state, STEP, random));
	}
	return events;
}

/** Runs while holding the balloon at one layer, as a player who tracks the layer would */
function runPinned(state: BalloonState, random: Random, layer: number, ms: number) {
	const events: BalloonEvent[] = [];
	for (let t = 0; t < ms && state.phase !== 'over'; t += STEP) {
		state.y = layerCentre(layer);
		state.vy = 0;
		events.push(...step(state, STEP, random));
	}
	return events;
}

describe('flying', () => {
	it('starts mid-sky with a full tank and all hearts', () => {
		const { state } = newGame();
		expect(state.phase).toBe('fly');
		expect(layerOf(state.y)).toBe(2);
		expect(state.fuel).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.score).toBe(0);
	});

	it('rises while the burner burns, drains fuel, and sinks when released', () => {
		const { state, random } = newGame();
		const start = state.y;
		setBurner(state, true);
		run(state, random, 600);
		expect(state.y).toBeLessThan(start);
		expect(state.fuel).toBeCloseTo(1 - FUEL_BURN_PER_SECOND * 0.6, 1);
		const high = state.y;
		const fuel = state.fuel;
		setBurner(state, false);
		run(state, random, 2500);
		expect(state.y).toBeGreaterThan(high);
		expect(state.fuel).toBe(fuel);
	});

	it('stays between the ceiling and the floor', () => {
		const { state, random } = newGame();
		setBurner(state, true);
		for (let i = 0; i < 400; i++) {
			state.fuel = 1;
			step(state, STEP, random);
		}
		expect(state.y).toBe(CEILING_Y);
		setBurner(state, false);
		run(state, random, 8000);
		expect(state.y).toBe(FLOOR_Y);
	});

	it('cannot burn without fuel', () => {
		const { state, random } = newGame();
		state.fuel = 0;
		setBurner(state, true);
		expect(isBurning(state)).toBe(false);
		const start = state.y;
		run(state, random, 500);
		expect(state.y).toBeGreaterThan(start);
	});

	it('is carried by the wind of the layer it floats in', () => {
		const { state, random } = newGame();
		const wind = windAt(state.seed, 0, layerCentre(3));
		expect(wind).toBeGreaterThan(0);
		runPinned(state, random, 3, STEP);
		expect(state.wind).toBe(wind);
		expect(state.progress).toBeCloseTo(wind / 60, 5);
	});

	it('is pushed back by a headwind, but never past the start of the track', () => {
		const { state, random } = newGame();
		const headwind = windPattern(state.seed, 0).findIndex((speed) => speed < 0);
		runPinned(state, random, headwind, 500);
		expect(state.progress).toBe(0);
		state.progress = 300;
		state.distance = 300;
		runPinned(state, random, headwind, 500);
		expect(state.progress).toBeLessThan(300);
		expect(state.distance).toBe(300);
	});

	it('scores the distance reached, so drifting back costs nothing', () => {
		const { state, random } = newGame();
		runPinned(state, random, 3, 2000);
		const reached = state.distance;
		expect(reached).toBeGreaterThan(100);
		expect(state.score).toBe(Math.floor(reached / DISTANCE_PER_POINT));
		const headwind = windPattern(state.seed, chunkOf(state.progress)).findIndex(
			(speed) => speed < 0
		);
		runPinned(state, random, headwind, 500);
		expect(state.distance).toBe(reached);
		expect(scoreOf(state)).toBe(Math.floor(reached / DISTANCE_PER_POINT));
	});
});

describe('hazards', () => {
	function place(state: BalloonState, kind: 'crow' | 'cloud' | 'kite', ahead: number) {
		state.course.hazards = [
			{
				kind,
				x: state.progress + ahead,
				baseY: state.y,
				y: state.y,
				radius: 20,
				phase: 0,
				active: true,
				spent: false
			}
		];
	}

	it('costs a heart on contact, once, and grants a grace period', () => {
		const { state, random } = newGame();
		place(state, 'cloud', 10);
		const events = run(state, random, 100);
		expect(events.filter((event) => event.type === 'hit')).toHaveLength(1);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.invulnerableMs).toBeGreaterThan(0);
		expect(state.invulnerableMs).toBeLessThanOrEqual(INVULNERABLE_MS);
		expect(state.course.hazards[0].spent).toBe(true);
	});

	it('does not hurt during the grace period', () => {
		const { state, random } = newGame();
		state.invulnerableMs = 1000;
		place(state, 'kite', 10);
		const events = run(state, random, 100);
		expect(events.some((event) => event.type === 'hit')).toBe(false);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('wakes a hazard only when it is about to come on screen, and then flies crows west', () => {
		const { state, random } = newGame();
		place(state, 'crow', 5000);
		state.course.hazards[0].active = false;
		step(state, STEP, random);
		expect(state.course.hazards[0].active).toBe(false);
		state.course.hazards[0].x = state.progress + 400;
		const startX = state.course.hazards[0].x;
		step(state, STEP, random);
		expect(state.course.hazards[0].active).toBe(true);
		expect(state.course.hazards[0].x).toBeLessThan(startX);
	});

	it('ends the run when the last heart is lost', () => {
		const { state, random } = newGame();
		state.lives = 1;
		place(state, 'cloud', 10);
		const events = run(state, random, 200);
		expect(state.phase).toBe('over');
		expect(state.finished).toBe(false);
		expect(events.at(-1)).toEqual({ type: 'game-over', finished: false });
		expect(step(state, STEP, random)).toEqual([]);
	});
});

describe('patrol jets', () => {
	it('does not send the first jet before the grace time', () => {
		expect(createGame(createRandom(9), 9).nextJetMs).toBe(JET_FIRST_MS);
	});

	it('warns first and then hits a balloon that stays in its layer', () => {
		const { state } = newGame();
		state.nextJetMs = 1;
		const layerOne = () => 0.25;
		const events = runPinned(state, layerOne, 1, JET_WARN_MS - 100);
		expect(events).toContainEqual({ type: 'jet-warning', layer: 1 });
		expect(state.lives).toBe(STARTING_LIVES);
		events.push(...runPinned(state, layerOne, 1, 2000));
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(events).toContainEqual({ type: 'hit', kind: 'jet' });
	});

	it('misses a balloon that left the layer during the warning', () => {
		const { state } = newGame();
		state.nextJetMs = 1;
		const layerZero = () => 0.01;
		runPinned(state, layerZero, 4, JET_WARN_MS + 2500);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.jets).toHaveLength(0);
	});
});

describe('puffs and photos', () => {
	it('refills the tank from a hot-air puff, capped at full', () => {
		const { state, random } = newGame();
		state.fuel = 0.4;
		state.course.puffs = [{ x: state.progress + 5, y: state.y, taken: false }];
		const events = run(state, random, 100);
		expect(events.filter((event) => event.type === 'puff')).toHaveLength(1);
		expect(state.fuel).toBeCloseTo(0.4 + PUFF_REFILL, 5);
		state.fuel = 0.9;
		state.course.puffs = [{ x: state.progress + 5, y: state.y, taken: false }];
		run(state, random, 100);
		expect(state.fuel).toBe(1);
	});

	it('snaps a photo after hovering over a point of interest long enough', () => {
		const { state, random } = newGame();
		const slow = windPattern(state.seed, 0).indexOf(12);
		state.course.pois = [{ kind: 'lake', x: 30, photographed: false, dwellMs: 0 }];
		const events = runPinned(state, random, slow, PHOTO_DWELL_MS * 3);
		expect(events.filter((event) => event.type === 'photo')).toEqual([
			{ type: 'photo', poi: 'lake', points: PHOTO_POINTS }
		]);
		expect(state.photos).toBe(1);
		expect(state.score).toBe(PHOTO_POINTS + Math.floor(state.distance / DISTANCE_PER_POINT));
	});

	it('takes no photo when a fast wind carries the balloon past too quickly', () => {
		const { state, random } = newGame();
		const fast = windPattern(state.seed, 0).indexOf(108);
		state.course.pois = [{ kind: 'farm', x: 60, photographed: false, dwellMs: 0 }];
		runPinned(state, random, fast, 2000);
		expect(state.progress).toBeGreaterThan(150);
		expect(state.photos).toBe(0);
		expect(state.course.pois[0].photographed).toBe(false);
	});
});

describe('the east coast', () => {
	it('launches the missile at the end of the track and pays a bonus per heart left', () => {
		const { state, random } = newGame();
		state.lives = 2;
		state.progress = TRACK_LENGTH - 1;
		state.distance = TRACK_LENGTH - 1;
		const pattern = windPattern(state.seed, chunkOf(TRACK_LENGTH - 1));
		const fast = pattern.indexOf(Math.max(...pattern));
		const first = runPinned(state, random, fast, 100);
		expect(first).toContainEqual({ type: 'finish' });
		expect(state.phase).toBe('finale');
		expect(state.finished).toBe(true);
		expect(state.progress).toBe(TRACK_LENGTH);
		const rest = run(state, random, FINALE_MS + 100);
		expect(rest).toContainEqual({ type: 'popped', bonus: 2 * HEART_BONUS });
		expect(rest.at(-1)).toEqual({ type: 'game-over', finished: true });
		expect(state.phase).toBe('over');
		expect(state.score).toBe(Math.floor(TRACK_LENGTH / DISTANCE_PER_POINT) + 2 * HEART_BONUS);
	});

	it('ignores the burner during the finale and flies the missile in from the coast', () => {
		const { state, random } = newGame();
		state.phase = 'finale';
		setBurner(state, true);
		expect(state.burning).toBe(false);
		const far = missilePosition(state);
		run(state, random, FINALE_MS / 2);
		expect(missilePosition(state).x).toBeLessThan(far.x);
		run(state, random, FINALE_MS);
		expect(missilePosition(state).x).toBeCloseTo(BALLOON_X, 5);
	});

	it('maps track positions to screen columns around the balloon', () => {
		const { state } = newGame();
		state.progress = 1000;
		expect(screenX(state, 1000)).toBe(BALLOON_X);
		expect(screenX(state, 1100)).toBe(BALLOON_X + 100);
	});
});

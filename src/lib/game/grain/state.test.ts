import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CHAIN_MS,
	CHAIN_STEP,
	CORRIDOR_MARGIN,
	INVULN_MS,
	MILESTONE_M,
	MINE_RADIUS,
	NEAR_MISS,
	POINTS_BUOY,
	POINTS_CRATE,
	POINTS_MILESTONE,
	POINTS_NEAR,
	SHIP_RADIUS,
	SHIP_Y,
	STARTING_LIVES,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from './config.js';
import {
	addAt,
	clampShipX,
	corridor,
	createGame,
	finalScore,
	multiplier,
	nudge,
	spawnInterval,
	speedAt,
	steerTo,
	step,
	type GrainState
} from './state.js';

const random = createRandom(7);

/** A quiet game: the spawner never fires during the test */
function quiet(): GrainState {
	const state = createGame();
	state.spawnMs = 1e9;
	return state;
}

/** Runs the step and returns the events of the first hit */
function hitOnce(state: GrainState) {
	const events = step(state, 16, random);
	return events.find((event) => event.type === 'hit');
}

describe('grain corridor', () => {
	it('starts centred with three hearts and no hazards', () => {
		const state = createGame();
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.shipX).toBe(WORLD_WIDTH / 2);
		expect(state.targetX).toBe(WORLD_WIDTH / 2);
		expect(state.distance).toBe(0);
		expect(state.entities).toHaveLength(0);
		expect(state.over).toBe(false);
	});

	it('keeps the ship inside the channel', () => {
		const state = createGame();
		const { left, right } = corridor(0);

		steerTo(state, -500);
		expect(state.targetX).toBe(left + SHIP_RADIUS);
		steerTo(state, WORLD_WIDTH + 500);
		expect(state.targetX).toBe(right - SHIP_RADIUS);

		state.targetX = WORLD_WIDTH / 2;
		nudge(state, 1);
		expect(state.targetX).toBeGreaterThan(WORLD_WIDTH / 2);
		nudge(state, -1);
		nudge(state, -1);
		expect(state.targetX).toBeLessThan(WORLD_WIDTH / 2);

		expect(clampShipX(state, -50)).toBeGreaterThanOrEqual(left + SHIP_RADIUS);
		expect(clampShipX(state, 5000)).toBeLessThanOrEqual(right - SHIP_RADIUS);
	});

	it('narrows the corridor as the run goes on, but never past the walls', () => {
		const start = corridor(0);
		const later = corridor(3000);
		const end = corridor(10000);
		expect(start).toEqual({ left: CORRIDOR_MARGIN, right: WORLD_WIDTH - CORRIDOR_MARGIN });
		expect(later.left).toBeGreaterThan(start.left);
		expect(later.right).toBeLessThan(start.right);
		expect(end.left).toBeGreaterThan(later.left);
		expect(end.left).toBeLessThan(end.right);
	});

	it('starts relaxed and tightens the speed and the spawns, then caps both', () => {
		expect(speedAt(0)).toBe(95);
		expect(speedAt(1000)).toBe(150);
		expect(speedAt(100000)).toBe(250);
		expect(spawnInterval(0)).toBe(1050);
		expect(spawnInterval(10000)).toBe(360);
	});

	it('sails forward, scores by distance and speeds up', () => {
		const state = quiet();
		step(state, 1000, random);
		expect(state.distance).toBeCloseTo(95, 5);
		expect(state.score).toBeCloseTo(95, 5);
		expect(state.speed).toBeCloseTo(95, 5);

		state.distance = 1000;
		step(state, 1000, random);
		expect(state.distance).toBeCloseTo(1150, 5);
		expect(state.speed).toBeCloseTo(150, 5);
	});

	it('multiplies the cargo chain in steps of four crates, up to five', () => {
		expect(multiplier(0)).toBe(1);
		expect(multiplier(CHAIN_STEP - 1)).toBe(1);
		expect(multiplier(CHAIN_STEP)).toBe(2);
		expect(multiplier(CHAIN_STEP * 4)).toBe(5);
		expect(multiplier(1000)).toBe(5);
	});

	it('a mine costs a heart, starts the flashing and is gone', () => {
		const state = quiet();
		addAt(state, 'mine', state.shipX, SHIP_Y);

		const hit = hitOnce(state);
		expect(hit).toMatchObject({ type: 'hit', hazard: 'mine', lives: STARTING_LIVES - 1 });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.invulnMs).toBe(INVULN_MS);
		expect(state.entities).toHaveLength(0);
		expect(state.over).toBe(false);
	});

	it('ignores hazards while the ship is still flashing', () => {
		const state = quiet();
		addAt(state, 'mine', state.shipX, SHIP_Y);
		hitOnce(state);
		expect(state.lives).toBe(2);

		addAt(state, 'drone', state.shipX, SHIP_Y);
		step(state, 100, random);
		expect(state.lives).toBe(2);
		expect(state.entities).toHaveLength(1);

		state.invulnMs = 0;
		step(state, 16, random);
		expect(state.lives).toBe(1);
	});

	it('ends the run on the third hit, once', () => {
		const state = quiet();
		const events = [];
		for (let i = 0; i < STARTING_LIVES; i++) {
			state.invulnMs = 0;
			addAt(state, 'mine', state.shipX, SHIP_Y);
			events.push(...step(state, 16, random));
		}
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
		expect(events.filter((event) => event.type === 'game-over')).toHaveLength(1);
		expect(step(state, 1000, random)).toEqual([]);
	});

	it('collects a crate, builds the chain and pays the multiplier', () => {
		const state = quiet();
		addAt(state, 'crate', state.shipX, SHIP_Y);
		const events = step(state, 16, random);
		expect(events).toContainEqual(
			expect.objectContaining({ type: 'crate', points: POINTS_CRATE, multiplier: 1 })
		);
		expect(state.crates).toBe(1);
		expect(state.chain).toBe(1);
		expect(state.chainMs).toBe(CHAIN_MS);
		expect(state.score).toBeGreaterThanOrEqual(POINTS_CRATE);

		state.chain = CHAIN_STEP - 1;
		addAt(state, 'crate', state.shipX, SHIP_Y);
		const second = step(state, 16, random).find((event) => event.type === 'crate');
		expect(second).toMatchObject({
			type: 'crate',
			points: POINTS_CRATE * 2,
			multiplier: 2
		});
		expect(state.chain).toBe(CHAIN_STEP);
		expect(state.bestChain).toBe(CHAIN_STEP);
	});

	it('breaks the chain when no crate arrives in time', () => {
		const state = quiet();
		addAt(state, 'crate', state.shipX, SHIP_Y);
		step(state, 16, random);
		expect(state.chain).toBe(1);

		step(state, CHAIN_MS + 100, random);
		expect(state.chain).toBe(0);
		expect(state.chainMs).toBe(0);
	});

	it('a repair buoy gives a heart back, or pays out when the hold is full', () => {
		const state = quiet();
		state.lives = 2;
		addAt(state, 'buoy', state.shipX, SHIP_Y);
		const healed = step(state, 16, random).find((event) => event.type === 'buoy');
		expect(healed).toMatchObject({ type: 'buoy', healed: true });
		expect(state.lives).toBe(STARTING_LIVES);

		const before = state.score;
		addAt(state, 'buoy', state.shipX, SHIP_Y);
		const paid = step(state, 16, random).find((event) => event.type === 'buoy');
		expect(paid).toMatchObject({ type: 'buoy', healed: false, points: POINTS_BUOY });
		expect(state.score).toBeGreaterThanOrEqual(before + POINTS_BUOY);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('pays a near miss once when a hazard slips past the hull', () => {
		const state = quiet();
		const gap = MINE_RADIUS + SHIP_RADIUS + 12;
		const mine = addAt(state, 'mine', state.shipX + gap, SHIP_Y - 10);
		mine.vy = 100;

		const events = step(state, 200, random);
		expect(events).toContainEqual(
			expect.objectContaining({ type: 'near-miss', points: POINTS_NEAR })
		);
		expect(state.nearMisses).toBe(1);
		expect(mine.grazed).toBe(true);

		const again = step(state, 100, random);
		expect(again.filter((event) => event.type === 'near-miss')).toHaveLength(0);
		expect(state.nearMisses).toBe(1);
	});

	it('does not pay a near miss for a hazard that hits', () => {
		const state = quiet();
		addAt(state, 'mine', state.shipX, SHIP_Y - 10);
		const events = step(state, 200, random);
		expect(events.some((event) => event.type === 'near-miss')).toBe(false);
		expect(state.nearMisses).toBe(0);
	});

	it('pays a port bonus every kilometre', () => {
		const state = quiet();
		state.distance = MILESTONE_M - 50;
		state.nextMilestone = MILESTONE_M;

		const events = step(state, 1000, random);
		const milestone = events.find((event) => event.type === 'milestone');
		expect(milestone).toMatchObject({
			type: 'milestone',
			distance: MILESTONE_M,
			points: POINTS_MILESTONE
		});
		expect(state.nextMilestone).toBe(MILESTONE_M * 2);
		expect(state.score).toBeGreaterThanOrEqual(POINTS_MILESTONE);
	});

	it('spawns crates and hazards, and drops what leaves the screen', () => {
		const state = createGame();
		// A ship that cannot sink, so the spawner keeps running for the whole sample
		state.lives = 99;
		const spawnRandom = createRandom(11);
		for (let i = 0; i < 600; i++) step(state, 1000 / 60, spawnRandom);

		expect(state.entities.length).toBeGreaterThan(0);
		expect(state.entities.some((entity) => entity.kind === 'crate')).toBe(true);
		expect(
			state.entities.some((entity) => entity.kind === 'mine' || entity.kind === 'drone')
		).toBe(true);
		for (const entity of state.entities) {
			expect(entity.y).toBeGreaterThanOrEqual(-30);
			expect(entity.y).toBeLessThanOrEqual(WORLD_HEIGHT + 50);
		}

		const below = addAt(state, 'crate', 200, WORLD_HEIGHT + 60);
		step(state, 16, spawnRandom);
		expect(state.entities.some((entity) => entity.id === below.id)).toBe(false);
	});

	it('is deterministic for a given seed', () => {
		const play = (seed: number) => {
			const state = createGame();
			const rng = createRandom(seed);
			for (let i = 0; i < 600; i++) step(state, 1000 / 60, rng);
			return state;
		};
		const a = play(42);
		const b = play(42);
		expect(b.distance).toBe(a.distance);
		expect(b.score).toBe(a.score);
		expect(b.lives).toBe(a.lives);
		expect(b.entities.map((entity) => [entity.id, entity.kind, entity.x, entity.y])).toEqual(
			a.entities.map((entity) => [entity.id, entity.kind, entity.x, entity.y])
		);
	});

	it('reports a whole-number final score', () => {
		const state = quiet();
		state.score = 123.9;
		expect(finalScore(state)).toBe(123);
		state.score = -5;
		expect(finalScore(state)).toBe(0);
	});
});

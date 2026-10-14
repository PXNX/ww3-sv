import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { FIELD_WIDTH, LOCK_MS, STARTING_LIVES, WAFER_BONUS } from './config';
import { createRam, type RamState } from './ram';
import { HEART_RESET, SHORTAGE_MAX, reliefForTier } from './shortage';
import { topLayer } from './stacker';
import {
	createGame,
	dropLayer,
	moveModules,
	shortagePercent,
	stepGame,
	type ChipFabState
} from './state';

const STEP = 1000 / 60;

/** Moves the sliding layer exactly over the tower, so the next drop is perfect */
function aim(state: ChipFabState, offset = 0) {
	state.stacker.slab.x = topLayer(state.stacker).left + offset;
}

function unlock(state: ChipFabState) {
	state.lockMs = 0;
}

function ramWith(rows: number[][], supply = 5): RamState {
	let id = 1;
	return {
		board: rows.map((row) => row.map((tier) => (tier === 0 ? null : { id: id++, tier }))),
		supply,
		quality: 0,
		nextId: 100,
		moves: 0,
		highestTier: Math.max(...rows.flat())
	};
}

describe('a new run', () => {
	it('starts on level 1 in the stacker with full hearts and no shortage', () => {
		const state = createGame(createRandom(1));
		expect(state.level).toBe(1);
		expect(state.stage).toBe('stack');
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.shortage).toBe(0);
		expect(state.over).toBe(false);
	});
});

describe('stepGame', () => {
	it('raises the shortage over time and slides the layer', () => {
		const random = createRandom(1);
		const state = createGame(random);
		const x = state.stacker.slab.x;
		for (let i = 0; i < 60; i++) stepGame(state, STEP);
		expect(state.shortage).toBeGreaterThan(1);
		expect(state.stacker.slab.x).not.toBe(x);
		expect(state.levelMs).toBeCloseTo(1000, 0);
	});

	it('freezes while input is locked after a stage change', () => {
		const state = createGame(createRandom(1));
		state.lockMs = 100;
		stepGame(state, 60);
		expect(state.shortage).toBe(0);
		expect(state.lockMs).toBe(40);
		stepGame(state, 60);
		expect(state.lockMs).toBe(0);
		stepGame(state, STEP);
		expect(state.shortage).toBeGreaterThan(0);
	});

	it('costs a heart when the meter fills, and the meter falls back', () => {
		const state = createGame(createRandom(1));
		state.shortage = SHORTAGE_MAX - 0.01;
		const events = stepGame(state, STEP);
		expect(events).toContainEqual({ type: 'shortage-hit', lives: STARTING_LIVES - 1 });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.shortage).toBe(HEART_RESET);
		expect(state.over).toBe(false);
	});

	it('ends the run when the last heart goes', () => {
		const state = createGame(createRandom(1));
		state.lives = 1;
		state.shortage = SHORTAGE_MAX;
		const events = stepGame(state, STEP);
		expect(events.map((event) => event.type)).toEqual(['shortage-hit', 'game-over']);
		expect(state.over).toBe(true);
		expect(state.lives).toBe(0);
		// Nothing moves once it is over
		const shortage = state.shortage;
		expect(stepGame(state, 1000)).toEqual([]);
		expect(state.shortage).toBe(shortage);
	});

	it('loses every heart eventually if the player does nothing', () => {
		const state = createGame(createRandom(1));
		let guard = 0;
		while (!state.over && guard++ < 60 * 60 * 20) stepGame(state, STEP);
		expect(state.over).toBe(true);
		expect(state.lives).toBe(0);
	});

	it('reports the shortage as a whole percentage', () => {
		const state = createGame(createRandom(1));
		state.shortage = 41.6;
		expect(shortagePercent(state)).toBe(42);
	});
});

describe('Stage A to Stage B', () => {
	it('scores a perfect drop and eases the shortage a little', () => {
		const random = createRandom(2);
		const state = createGame(random);
		state.shortage = 20;
		aim(state);
		const events = dropLayer(state, random);
		expect(events[0]).toMatchObject({ type: 'drop', kind: 'perfect', layer: 1 });
		expect(state.score).toBeGreaterThan(0);
		expect(state.shortage).toBeLessThan(20);
	});

	it('trims a sloppy drop without ending the stage', () => {
		const random = createRandom(2);
		const state = createGame(random);
		aim(state, 12);
		const events = dropLayer(state, random);
		expect(events[0]).toMatchObject({ type: 'drop', kind: 'trim' });
		expect(state.stage).toBe('stack');
		expect(topLayer(state.stacker).width).toBeLessThan(46);
	});

	it('a miss ends the stage and hands a minimum supply to Stage B', () => {
		const random = createRandom(2);
		const state = createGame(random);
		state.stacker.layers[0] = { left: FIELD_WIDTH - 10, width: 10 };
		state.stacker.slab = { x: 0, width: 10, dir: 1 };
		const events = dropLayer(state, random);
		expect(events.map((event) => event.type)).toEqual(['drop', 'wafer', 'stage']);
		expect(events[1]).toMatchObject({ type: 'wafer', layers: 0, finished: false });
		expect(state.stage).toBe('merge');
		expect(state.ram.supply).toBeGreaterThan(0);
		expect(state.lockMs).toBe(LOCK_MS);
	});

	it('finishing the wafer pays a bonus and a big relief, then Stage B gets a bigger supply', () => {
		const random = createRandom(3);
		const state = createGame(random);
		state.stacker.target = 3;
		state.shortage = 50;
		for (let i = 0; i < 3; i++) {
			unlock(state);
			aim(state);
			dropLayer(state, random);
		}
		expect(state.stage).toBe('merge');
		expect(state.score).toBeGreaterThanOrEqual(WAFER_BONUS);
		expect(state.shortage).toBeLessThan(40);
		expect(state.ram.supply).toBe(3 * 4 + 3 * 4);
		expect(state.ram.quality).toBe(1);
	});

	it('ignores drops and moves in the wrong stage or while locked', () => {
		const random = createRandom(2);
		const state = createGame(random);
		expect(moveModules(state, 'left', random)).toEqual([]);
		state.lockMs = 500;
		aim(state);
		expect(dropLayer(state, random)).toEqual([]);
		expect(state.stacker.layers).toHaveLength(1);
	});
});

describe('Stage B', () => {
	function inMerge(rows: number[][], supply = 5) {
		const random = createRandom(4);
		const state = createGame(random);
		state.stage = 'merge';
		state.ram = ramWith(rows, supply);
		return { state, random };
	}

	it('a merge scores points', () => {
		const { state, random } = inMerge([
			[1, 1, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		const events = moveModules(state, 'left', random);
		expect(events[0]).toMatchObject({ type: 'merge', tier: 2, relief: 0 });
		expect(state.score).toBe(4);
	});

	it('high-tier output lowers the shortage', () => {
		const { state, random } = inMerge([
			[3, 3, 0, 0],
			[1, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		state.shortage = 60;
		const events = moveModules(state, 'left', random);
		expect(events[0]).toMatchObject({ type: 'merge', tier: 4, relief: reliefForTier(4) });
		expect(state.shortage).toBe(60 - reliefForTier(4));
		expect(state.highestTier).toBe(4);
	});

	it('a plain slide is reported as such and does not ease the shortage', () => {
		const { state, random } = inMerge([
			[0, 1, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		state.shortage = 30;
		const events = moveModules(state, 'left', random);
		expect(events).toEqual([{ type: 'slide' }]);
		expect(state.shortage).toBe(30);
	});

	it('a move that changes nothing is ignored', () => {
		const { state, random } = inMerge([
			[1, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		expect(moveModules(state, 'left', random)).toEqual([]);
		expect(state.ram.moves).toBe(0);
	});

	it('finishing the stage starts the next, harder level', () => {
		const { state, random } = inMerge(
			[
				[1, 1, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			0
		);
		const events = moveModules(state, 'left', random);
		const types = events.map((event) => event.type);
		expect(types).toEqual(['merge', 'level', 'stage']);
		expect(state.level).toBe(2);
		expect(state.stage).toBe('stack');
		expect(state.levelsCleared).toBe(1);
		expect(state.levelMs).toBe(0);
		expect(state.lockMs).toBe(LOCK_MS);
		expect(state.stacker.layers).toHaveLength(1);
		expect(state.stacker.speed).toBeGreaterThan(42);
	});

	it('a fresh board from createRam has modules to play with', () => {
		const ram = createRam(createRandom(1), 12, 0);
		expect(ram.supply).toBe(12);
	});
});

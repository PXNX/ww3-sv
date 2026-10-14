import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	MAX_TIER,
	canMerge,
	canMove,
	createRam,
	emptyBoard,
	highestModuleTier,
	isRamDone,
	moduleGb,
	moduleLabel,
	moveRam,
	slide,
	type Board,
	type RamState
} from './ram';

/** Builds a board from tiers; 0 is an empty cell and ids count up from 1 in reading order */
function boardOf(rows: number[][]): Board {
	let id = 1;
	return rows.map((row) => row.map((tier) => (tier === 0 ? null : { id: id++, tier })));
}

const tiers = (board: Board) => board.map((row) => row.map((cell) => cell?.tier ?? 0));

function stateOf(rows: number[][], supply = 5, quality = 0): RamState {
	const board = boardOf(rows);
	return {
		board,
		supply,
		quality,
		nextId: 100,
		moves: 0,
		highestTier: highestModuleTier(board)
	};
}

describe('module sizes', () => {
	it('doubles from 4 GB and switches to TB', () => {
		expect([1, 2, 3, 4, 5].map(moduleGb)).toEqual([4, 8, 16, 32, 64]);
		expect(moduleLabel(1)).toBe('4 GB');
		expect(moduleLabel(3)).toBe('16 GB');
		expect(moduleLabel(8)).toBe('512 GB');
		expect(moduleLabel(MAX_TIER)).toBe('1 TB');
	});
});

describe('slide', () => {
	it('slides modules against the wall', () => {
		const result = slide(
			boardOf([
				[0, 1, 0, 2],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([1, 2, 0, 0]);
		expect(result.changed).toBe(true);
		expect(result.merges).toEqual([]);
	});

	it('merges two equal modules into the next size', () => {
		const result = slide(
			boardOf([
				[1, 1, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([2, 0, 0, 0]);
		expect(result.merges).toHaveLength(1);
		expect(result.merges[0]).toMatchObject({ row: 0, col: 0, tier: 2, keptId: 1, absorbedId: 2 });
	});

	it('merges each module at most once per move: 4 4 4 4 becomes 8 8', () => {
		const result = slide(
			boardOf([
				[1, 1, 1, 1],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([2, 2, 0, 0]);
	});

	it('resolves from the wall outward: three in a row leave the far one alone', () => {
		const left = slide(
			boardOf([
				[1, 1, 1, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(left.board)[0]).toEqual([2, 1, 0, 0]);
		const right = slide(
			boardOf([
				[1, 1, 1, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'right'
		);
		expect(tiers(right.board)[0]).toEqual([0, 0, 1, 2]);
	});

	it('does not chain a fresh merge into the next module', () => {
		const result = slide(
			boardOf([
				[1, 1, 2, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([2, 2, 0, 0]);
	});

	it('never merges different sizes', () => {
		const result = slide(
			boardOf([
				[1, 2, 1, 2],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([1, 2, 1, 2]);
		expect(result.changed).toBe(false);
	});

	it('works in all four directions', () => {
		const rows = [
			[1, 0, 0, 1],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[1, 0, 0, 1]
		];
		expect(tiers(slide(boardOf(rows), 'up').board)).toEqual([
			[2, 0, 0, 2],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		expect(tiers(slide(boardOf(rows), 'down').board)[3]).toEqual([2, 0, 0, 2]);
		expect(tiers(slide(boardOf(rows), 'left').board)[0]).toEqual([2, 0, 0, 0]);
		expect(tiers(slide(boardOf(rows), 'right').board)[0]).toEqual([0, 0, 0, 2]);
	});

	it('stops merging at the top size', () => {
		const result = slide(
			boardOf([
				[MAX_TIER, MAX_TIER, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			]),
			'left'
		);
		expect(tiers(result.board)[0]).toEqual([MAX_TIER, MAX_TIER, 0, 0]);
		expect(result.merges).toEqual([]);
	});

	it('does not change the board it was given', () => {
		const board = boardOf([
			[1, 1, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0],
			[0, 0, 0, 0]
		]);
		slide(board, 'left');
		expect(tiers(board)[0]).toEqual([1, 1, 0, 0]);
	});
});

describe('moveRam', () => {
	it('spends one module of supply per move and drops it in an empty cell', () => {
		const state = stateOf(
			[
				[1, 1, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			3
		);
		const outcome = moveRam(state, 'left', createRandom(1));
		expect(outcome.changed).toBe(true);
		expect(outcome.state.supply).toBe(2);
		expect(outcome.spawned).not.toBeNull();
		const count = outcome.state.board.flat().filter(Boolean).length;
		expect(count).toBe(2);
		expect(outcome.state.moves).toBe(1);
	});

	it('does nothing, and costs nothing, when the move changes nothing', () => {
		const state = stateOf(
			[
				[1, 2, 1, 2],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			3
		);
		const outcome = moveRam(state, 'up', createRandom(1));
		expect(outcome.changed).toBe(false);
		expect(outcome.state).toBe(state);
		expect(outcome.state.supply).toBe(3);
	});

	it('stops spawning when the supply is empty', () => {
		const state = stateOf(
			[
				[1, 1, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			0
		);
		const outcome = moveRam(state, 'left', createRandom(1));
		expect(outcome.spawned).toBeNull();
		expect(outcome.state.board.flat().filter(Boolean)).toHaveLength(1);
	});

	it('scores new module values and a combo bonus', () => {
		const state = stateOf(
			[
				[1, 1, 2, 2],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			0
		);
		const outcome = moveRam(state, 'left', createRandom(1));
		// 2^2 + 2^3 for the two new modules, plus 10 for the second merge
		expect(outcome.points).toBe(4 + 8 + 10);
		expect(outcome.state.highestTier).toBe(3);
	});

	it('spawns bigger modules more often for a better wafer, only 4 GB or 8 GB', () => {
		const seen = (quality: number) => {
			const random = createRandom(3);
			let bigger = 0;
			for (let i = 0; i < 400; i++) {
				const state = stateOf(
					[
						[1, 0, 0, 0],
						[0, 0, 0, 0],
						[0, 0, 0, 0],
						[0, 0, 0, 0]
					],
					1,
					quality
				);
				const outcome = moveRam(state, 'right', random);
				expect([1, 2]).toContain(outcome.spawned!.tier);
				if (outcome.spawned!.tier === 2) bigger++;
			}
			return bigger;
		};
		expect(seen(1)).toBeGreaterThan(seen(0));
	});

	it('is deterministic for a seed', () => {
		const run = () => {
			const random = createRandom(42);
			let state = createRam(random, 20, 0.5);
			for (const direction of ['left', 'up', 'right', 'down', 'left', 'up'] as const) {
				state = moveRam(state, direction, random).state;
			}
			return tiers(state.board);
		};
		expect(run()).toEqual(run());
	});
});

describe('createRam', () => {
	it('starts with two 4 GB modules and the given supply', () => {
		const state = createRam(createRandom(8), 30, 0.4);
		expect(state.board.flat().filter(Boolean)).toHaveLength(2);
		expect(state.highestTier).toBe(1);
		expect(state.supply).toBe(30);
		expect(state.quality).toBe(0.4);
	});
});

describe('end of the stage', () => {
	const jammed = [
		[1, 2, 1, 2],
		[2, 1, 2, 1],
		[1, 2, 1, 2],
		[2, 1, 2, 1]
	];

	it('knows a jammed board', () => {
		expect(canMove(boardOf(jammed))).toBe(false);
		expect(isRamDone(stateOf(jammed, 10))).toBe(true);
	});

	it('is not over while a merge is possible, even with an empty supply', () => {
		const state = stateOf(
			[
				[1, 1, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0],
				[0, 0, 0, 0]
			],
			0
		);
		expect(canMerge(state.board)).toBe(true);
		expect(isRamDone(state)).toBe(false);
	});

	it('is over when the supply is empty and only plain slides are left', () => {
		const state = stateOf(
			[
				[1, 0, 0, 0],
				[0, 2, 0, 0],
				[0, 0, 3, 0],
				[0, 0, 0, 0]
			],
			0
		);
		expect(canMove(state.board)).toBe(true);
		expect(canMerge(state.board)).toBe(false);
		expect(isRamDone(state)).toBe(true);
	});

	it('is not over while supply remains and the board can still move', () => {
		const state = stateOf(
			[
				[1, 0, 0, 0],
				[0, 2, 0, 0],
				[0, 0, 3, 0],
				[0, 0, 0, 0]
			],
			4
		);
		expect(isRamDone(state)).toBe(false);
		expect(
			emptyBoard()
				.flat()
				.every((cell) => cell === null)
		).toBe(true);
	});
});

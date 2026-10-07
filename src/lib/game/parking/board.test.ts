import { describe, expect, it } from 'vitest';
import {
	cellsOf,
	createPuzzle,
	isSolved,
	occupancy,
	slideRange,
	starsFor,
	validateLevel,
	withMove,
	type Level
} from './board';

/**
 *   0 1 2 3 4
 * 0 . . A . .      A: vertical ship in column 2 (rows 0-1)
 * 1 . . A . #      #: rock
 * 2 T T . B B      T: tanker, B: horizontal ship
 * 3 . . . . .
 * 4 . . . . .
 */
const level: Level = {
	id: 'test',
	tier: 'easy',
	width: 5,
	height: 5,
	par: 2,
	tanker: { row: 2, col: 0, length: 2 },
	ships: [
		{ axis: 'v', length: 2, row: 0, col: 2 },
		{ axis: 'h', length: 2, row: 2, col: 3 }
	],
	rocks: [[1, 4]]
};

describe('createPuzzle', () => {
	it('puts the tanker first and reads positions along each axis', () => {
		const puzzle = createPuzzle(level);
		expect(puzzle.pieces.map((piece) => piece.isTanker)).toEqual([true, false, false]);
		expect(puzzle.start).toEqual([0, 0, 3]);
		expect(puzzle.pieces[1]).toMatchObject({ axis: 'v', line: 2, length: 2 });
		expect(puzzle.pieces[2]).toMatchObject({ axis: 'h', line: 2, length: 2 });
	});
});

describe('cellsOf and occupancy', () => {
	it('lists the covered cells and marks rocks', () => {
		const puzzle = createPuzzle(level);
		expect(cellsOf(puzzle.pieces[1], 0)).toEqual([
			[0, 2],
			[1, 2]
		]);
		const grid = occupancy(puzzle, puzzle.start);
		expect(grid[2 * 5 + 0]).toBe(0);
		expect(grid[1 * 5 + 2]).toBe(1);
		expect(grid[1 * 5 + 4]).toBe(-2);
		expect(grid[4 * 5 + 4]).toBe(-1);
	});
});

describe('slideRange', () => {
	const puzzle = createPuzzle(level);

	it('stops at neighbouring ships and the board edge', () => {
		// The tanker can slide into the free cell (2,2) but not into the ship at (2,3)
		expect(slideRange(puzzle, puzzle.start, 0)).toEqual({ min: 0, max: 1 });
		// The vertical ship in column 2 can slide from the top edge down to the bottom edge
		expect(slideRange(puzzle, puzzle.start, 1)).toEqual({ min: 0, max: 3 });
	});

	it('is stopped by other ships and cannot jump over them', () => {
		// The horizontal ship may take the free cell (2,2) next to it, nothing more
		expect(slideRange(puzzle, puzzle.start, 2)).toEqual({ min: 2, max: 3 });
		// With the vertical ship dropped into the tanker's row the tanker cannot move at all
		const blocked = withMove(puzzle.start, 1, 1);
		expect(slideRange(puzzle, blocked, 0)).toEqual({ min: 0, max: 0 });
	});

	it('treats a rock as a wall for vertical movement as well', () => {
		const rocky = createPuzzle({ ...level, ships: [{ axis: 'v', length: 2, row: 2, col: 4 }] });
		// The rock at (1,4) sits right above the ship
		expect(slideRange(rocky, rocky.start, 1)).toEqual({ min: 2, max: 3 });
	});
});

describe('isSolved', () => {
	it('is true once the tanker touches the right edge', () => {
		const puzzle = createPuzzle(level);
		expect(isSolved(puzzle, puzzle.start)).toBe(false);
		expect(isSolved(puzzle, withMove(puzzle.start, 0, 3))).toBe(true);
	});
});

describe('withMove', () => {
	it('copies instead of mutating', () => {
		const start = [0, 0, 3];
		expect(withMove(start, 2, 2)).toEqual([0, 0, 2]);
		expect(start).toEqual([0, 0, 3]);
	});
});

describe('starsFor', () => {
	it('gives three stars at par, two within half again, one otherwise', () => {
		expect(starsFor(5, 5)).toBe(3);
		expect(starsFor(4, 5)).toBe(3);
		expect(starsFor(6, 5)).toBe(2);
		expect(starsFor(8, 5)).toBe(2);
		expect(starsFor(9, 5)).toBe(1);
		// At least two extra moves still count as two stars on tiny pars
		expect(starsFor(4, 2)).toBe(2);
		expect(starsFor(5, 2)).toBe(1);
		expect(starsFor(30, 20)).toBe(2);
		expect(starsFor(31, 20)).toBe(1);
	});
});

describe('validateLevel', () => {
	it('accepts a well formed level', () => {
		expect(validateLevel(level)).toEqual([]);
	});

	it('reports overlaps, ships outside the board and bad sizes', () => {
		const overlap = { ...level, rocks: [[2, 0]] as [number, number][] };
		expect(validateLevel(overlap).join()).toContain('overlaps');
		const outside = { ...level, ships: [{ axis: 'h' as const, length: 3, row: 0, col: 3 }] };
		expect(validateLevel(outside).join()).toContain('outside the board');
		expect(validateLevel({ ...level, width: 2 }).join()).toContain('not valid');
		expect(validateLevel({ ...level, par: 0 }).join()).toContain('par');
		const tooLong = { ...level, ships: [{ axis: 'v' as const, length: 4, row: 0, col: 0 }] };
		expect(validateLevel(tooLong).join()).toContain('2 or 3 long');
	});
});

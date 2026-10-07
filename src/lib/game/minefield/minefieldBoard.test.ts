import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { hasMineFreeRoute } from './channelPathfinding';
import { DIFFICULTIES, DIFFICULTY_IDS } from './difficulty';
import { cellIndex, neighborIndices } from './grid';
import {
	boardWithMines,
	canChord,
	chord,
	countFlags,
	countMines,
	countRevealedSafe,
	createBoard,
	mineCountFor,
	minesRemaining,
	placeMines,
	revealCell,
	toggleFlag,
	type Board
} from './minefieldBoard';

/*
 * Five columns by four rows, mines marked M:
 *   . . . . .
 *   . M . . .
 *   . . . . M
 *   . . . . .
 */
const MINES = [6, 14];
const sample = () => boardWithMines(5, 4, MINES);

function revealedIndices(board: Board): number[] {
	return board.cells.flatMap((cell, index) => (cell.state === 'revealed' ? [index] : []));
}

describe('createBoard', () => {
	it('starts with hidden water and no mines', () => {
		const board = createBoard(10, 8);
		expect(board.cells).toHaveLength(80);
		expect(board.minesPlaced).toBe(false);
		expect(board.cells.every((cell) => cell.state === 'hidden' && !cell.mine)).toBe(true);
	});
});

describe('mineCountFor', () => {
	it('matches the density of each difficulty level', () => {
		const counts = DIFFICULTY_IDS.map((id) => {
			const { columns, rows, mineDensity } = DIFFICULTIES[id];
			return mineCountFor(columns, rows, mineDensity);
		});
		expect(counts).toEqual([6, 12, 21]);
	});

	it('always leaves room for the safe area around the first tap', () => {
		expect(mineCountFor(3, 3, 0.5)).toBe(0);
		expect(mineCountFor(4, 4, 1)).toBe(7);
	});
});

describe('sonar numbers', () => {
	it('count the mines in the eight surrounding cells', () => {
		const board = sample();
		for (let index = 0; index < board.cells.length; index++) {
			const expected = neighborIndices(board, index).filter((next) => MINES.includes(next)).length;
			expect(board.cells[index].adjacent, `cell ${index}`).toBe(expected);
		}
		expect(board.cells.map((cell) => cell.adjacent)).toEqual([
			1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1
		]);
	});
});

describe('placeMines', () => {
	it('never places a mine on or next to the first tapped cell', () => {
		for (const id of DIFFICULTY_IDS) {
			const { columns, rows, mineDensity } = DIFFICULTIES[id];
			const count = mineCountFor(columns, rows, mineDensity);
			for (let seed = 1; seed <= 150; seed++) {
				const random = createRandom(seed);
				const board = createBoard(columns, rows);
				const first = seed % board.cells.length;
				const placed = placeMines(board, first, count, random);

				expect(countMines(placed)).toBe(count);
				for (const index of neighborIndices(placed, first, true)) {
					expect(placed.cells[index].mine, `${id} seed ${seed} cell ${index}`).toBe(false);
				}
				expect(placed.cells[first].adjacent).toBe(0);
			}
		}
	});

	it('handles first taps in corners and on edges', () => {
		const board = createBoard(8, 6);
		const corners = [0, 7, cellIndex(board, 0, 5), cellIndex(board, 7, 5), cellIndex(board, 3, 0)];
		for (const first of corners) {
			const placed = placeMines(board, first, 20, createRandom(first + 3));
			expect(countMines(placed)).toBe(20);
			expect(neighborIndices(placed, first, true).some((index) => placed.cells[index].mine)).toBe(
				false
			);
		}
	});

	it('always leaves a mine-free route from west to east', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const { columns, rows, mineDensity } = DIFFICULTIES.hard;
			const board = createBoard(columns, rows);
			const placed = placeMines(
				board,
				seed % board.cells.length,
				mineCountFor(columns, rows, mineDensity),
				createRandom(seed)
			);
			expect(hasMineFreeRoute(placed), `seed ${seed}`).toBe(true);
		}
	});

	it('is deterministic for a seed and varies between seeds', () => {
		const board = createBoard(10, 8);
		const layout = (seed: number) =>
			placeMines(board, 44, 12, createRandom(seed)).cells.map((cell) => cell.mine);
		expect(layout(7)).toEqual(layout(7));
		expect(layout(7)).not.toEqual(layout(8));
	});

	it('does not modify the board it was given', () => {
		const board = createBoard(10, 8);
		placeMines(board, 0, 12, createRandom(1));
		expect(board.minesPlaced).toBe(false);
		expect(countMines(board)).toBe(0);
	});

	it('makes the first reveal open an area', () => {
		const board = placeMines(createBoard(10, 8), 35, 12, createRandom(99));
		const { revealed, detonated } = revealCell(board, 35);
		expect(detonated).toEqual([]);
		expect(revealed.length).toBeGreaterThanOrEqual(9);
	});
});

describe('revealCell', () => {
	it('reveals only the cell when it shows a number', () => {
		const { board, revealed, detonated } = revealCell(sample(), 0);
		expect(revealed).toEqual([0]);
		expect(detonated).toEqual([]);
		expect(revealedIndices(board)).toEqual([0]);
	});

	it('flood reveals from a zero and stops at the numbers around it', () => {
		const { board, revealed } = revealCell(sample(), 3);
		expect([...revealed].sort((a, b) => a - b)).toEqual([2, 3, 4, 7, 8, 9]);
		expect(revealedIndices(board)).toEqual([2, 3, 4, 7, 8, 9]);
	});

	it('floods across connected zeros', () => {
		const { board } = revealCell(sample(), 15);
		expect(revealedIndices(board)).toEqual([10, 11, 12, 13, 15, 16, 17, 18]);
	});

	it('never reveals mines or buoy flags during a flood', () => {
		const flagged = toggleFlag(sample(), 2);
		const { board } = revealCell(flagged, 3);
		expect(board.cells[2].state).toBe('flagged');
		expect(board.cells.filter((cell) => cell.mine).every((cell) => cell.state === 'hidden')).toBe(
			true
		);
	});

	it('detonates a mine and marks it', () => {
		const { board, revealed, detonated } = revealCell(sample(), 6);
		expect(detonated).toEqual([6]);
		expect(revealed).toEqual([]);
		expect(board.cells[6].state).toBe('detonated');
		expect(board.cells[6].mine).toBe(true);
	});

	it('ignores revealed, flagged and detonated cells', () => {
		const once = revealCell(sample(), 0).board;
		expect(revealCell(once, 0).board).toBe(once);
		const flagged = toggleFlag(sample(), 6);
		expect(revealCell(flagged, 6).detonated).toEqual([]);
		const exploded = revealCell(sample(), 6).board;
		expect(revealCell(exploded, 6).detonated).toEqual([]);
	});

	it('does not modify the board it was given', () => {
		const board = sample();
		revealCell(board, 3);
		revealCell(board, 6);
		expect(board.cells.every((cell) => cell.state === 'hidden')).toBe(true);
	});
});

describe('toggleFlag', () => {
	it('places and removes a buoy on hidden water only', () => {
		const flagged = toggleFlag(sample(), 6);
		expect(flagged.cells[6].state).toBe('flagged');
		expect(toggleFlag(flagged, 6).cells[6].state).toBe('hidden');
		const revealed = revealCell(sample(), 0).board;
		expect(toggleFlag(revealed, 0)).toBe(revealed);
	});
});

describe('chord', () => {
	it('reveals the other neighbors when the buoys match the number', () => {
		const board = toggleFlag(revealCell(sample(), 0).board, 6);
		expect(canChord(board, 0)).toBe(true);
		const { board: after, revealed, detonated } = chord(board, 0);
		expect([...revealed].sort((a, b) => a - b)).toEqual([1, 5]);
		expect(detonated).toEqual([]);
		expect(after.cells[6].state).toBe('flagged');
	});

	it('does nothing while the buoy count does not match', () => {
		const board = revealCell(sample(), 0).board;
		expect(canChord(board, 0)).toBe(false);
		expect(chord(board, 0).board).toBe(board);
	});

	it('counts detonated mines like buoys', () => {
		const board = revealCell(revealCell(sample(), 6).board, 0).board;
		expect(chord(board, 0).revealed.sort((a, b) => a - b)).toEqual([1, 5]);
	});

	it('detonates a mine hidden next to a misplaced buoy', () => {
		const board = toggleFlag(revealCell(sample(), 0).board, 1);
		const { board: after, revealed, detonated } = chord(board, 0);
		expect(detonated).toEqual([6]);
		expect(revealed).toEqual([5]);
		expect(after.cells[6].state).toBe('detonated');
	});

	it('does not chord zeros, hidden cells or fully cleared numbers', () => {
		const opened = revealCell(sample(), 3).board;
		expect(canChord(opened, 3)).toBe(false);
		expect(canChord(sample(), 0)).toBe(false);
		const cleared = chord(toggleFlag(revealCell(sample(), 0).board, 6), 0).board;
		expect(canChord(cleared, 0)).toBe(false);
	});
});

describe('counters', () => {
	it('separates correct from misplaced buoys', () => {
		const board = toggleFlag(toggleFlag(toggleFlag(sample(), 6), 14), 0);
		expect(countFlags(board)).toEqual({ correct: 2, wrong: 1 });
	});

	it('counts revealed safe water and the mines left to find', () => {
		let board = revealCell(sample(), 3).board;
		expect(countRevealedSafe(board)).toBe(6);
		expect(minesRemaining(board, 2)).toBe(2);
		board = toggleFlag(board, 14);
		expect(minesRemaining(board, 2)).toBe(1);
		board = revealCell(board, 6).board;
		expect(minesRemaining(board, 2)).toBe(0);
		board = toggleFlag(board, 0);
		expect(minesRemaining(board, 2)).toBe(-1);
	});
});

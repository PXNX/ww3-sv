import { describe, expect, it } from 'vitest';
import { boardWithMines, countMines, revealCell, toggleFlag } from './minefieldBoard';
import { canDeploySubmarine, submarineSweep, sweepArea } from './submarineSweep';

/*
 * Five by five, mines marked M:
 *   . . . . .
 *   . M . M .
 *   . . M . .
 *   . . . . .
 *   . . . . M
 */
const sample = () => boardWithMines(5, 5, [6, 8, 12, 24]);

describe('canDeploySubmarine', () => {
	it('allows hidden water and buoys, but not revealed or detonated cells', () => {
		const board = sample();
		expect(canDeploySubmarine(board, 0)).toBe(true);
		expect(canDeploySubmarine(toggleFlag(board, 0), 0)).toBe(true);
		expect(canDeploySubmarine(revealCell(board, 0).board, 0)).toBe(false);
		expect(canDeploySubmarine(revealCell(board, 6).board, 6)).toBe(false);
		expect(canDeploySubmarine(board, 99)).toBe(false);
	});
});

describe('sweepArea', () => {
	it('covers three by three cells, clipped at the edges', () => {
		const board = sample();
		expect(sweepArea(board, 12)).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
		expect(sweepArea(board, 0)).toEqual([0, 1, 5, 6]);
		expect(sweepArea(board, 22)).toEqual([16, 17, 18, 21, 22, 23]);
	});
});

describe('submarineSweep', () => {
	it('defuses every mine in the area and leaves the others', () => {
		const { board, defused } = submarineSweep(sample(), 12);
		expect(defused).toEqual([6, 8, 12]);
		expect(countMines(board)).toBe(1);
		expect(board.cells[24].mine).toBe(true);
		for (const index of defused) {
			expect(board.cells[index]).toMatchObject({ mine: false, defused: true, state: 'revealed' });
		}
	});

	it('recomputes the sonar numbers and floods from new zeros', () => {
		const { board, revealed } = submarineSweep(sample(), 12);
		// Only the last mine is left, so everything else opens up
		expect(revealed).toHaveLength(24);
		expect(board.cells[24].state).toBe('hidden');
		expect(board.cells[0].adjacent).toBe(0);
		expect(board.cells[18].adjacent).toBe(1);
		expect(board.cells[23].adjacent).toBe(1);
	});

	it('clears only the clipped area in a corner', () => {
		const { board, defused, revealed } = submarineSweep(sample(), 0);
		expect(defused).toEqual([6]);
		for (const index of [0, 1, 5, 6]) expect(revealed).toContain(index);
		expect(board.cells[6].adjacent).toBe(1);
		// The flood from the new zeros stops at numbers next to the remaining mines
		expect(board.cells[7]).toMatchObject({ adjacent: 2, state: 'revealed' });
		expect(board.cells[3].state).toBe('hidden');
		expect(board.cells[8]).toMatchObject({ mine: true, state: 'hidden' });
	});

	it('collects buoys in the area and reveals the water under them', () => {
		const flagged = toggleFlag(toggleFlag(sample(), 6), 1);
		const { board } = submarineSweep(flagged, 0);
		expect(board.cells[6].state).toBe('revealed');
		expect(board.cells[1].state).toBe('revealed');
	});

	it('leaves detonated mines as they are', () => {
		const exploded = revealCell(sample(), 6).board;
		const { board, defused } = submarineSweep(exploded, 12);
		expect(defused).toEqual([8, 12]);
		expect(board.cells[6]).toMatchObject({ mine: true, state: 'detonated', defused: false });
	});

	it('does nothing on a cell that is already revealed', () => {
		const opened = revealCell(sample(), 0).board;
		const result = submarineSweep(opened, 0);
		expect(result.board).toBe(opened);
		expect(result.defused).toEqual([]);
		expect(result.revealed).toEqual([]);
	});

	it('does not modify the board it was given', () => {
		const board = sample();
		submarineSweep(board, 12);
		expect(countMines(board)).toBe(4);
		expect(board.cells.every((cell) => cell.state === 'hidden')).toBe(true);
	});
});

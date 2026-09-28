/*
 * Mine-removal submarine (requirements Section 3): sent to an unrevealed cell, it defuses every
 * mine in the surrounding three-by-three area and reveals the resulting sonar numbers.
 */
import { neighborIndices } from './grid';
import { floodReveal, withSonarNumbers, type Board } from './minefieldBoard';

export interface SweepResult {
	board: Board;
	/** Cells whose mine was removed */
	defused: number[];
	/** Cells that became revealed safe water, including flood reveals from new zeros */
	revealed: number[];
}

/** Submarines only go to water that has not been revealed yet (buoy flags are fine) */
export function canDeploySubmarine(board: Board, index: number): boolean {
	const state = board.cells[index]?.state;
	return state === 'hidden' || state === 'flagged';
}

/** The three-by-three area around a cell, clipped at the edges of the board */
export function sweepArea(board: Board, index: number): number[] {
	return neighborIndices(board, index, true);
}

export function submarineSweep(board: Board, index: number): SweepResult {
	if (!canDeploySubmarine(board, index)) return { board, defused: [], revealed: [] };

	const area = sweepArea(board, index);
	const cells = board.cells.map((cell) => ({ ...cell }));
	const defused: number[] = [];
	for (const next of area) {
		const cell = cells[next];
		// Mines that already went off stay as wreckage
		if (cell.state === 'detonated') continue;
		if (cell.mine) {
			cell.mine = false;
			cell.defused = true;
			defused.push(next);
		}
		// The area is now known to be safe, so its buoys are collected
		if (cell.state === 'flagged') cell.state = 'hidden';
	}

	const swept = withSonarNumbers(board, cells);
	const { board: result, revealed } = floodReveal(swept, area);
	return { board: result, defused, revealed };
}

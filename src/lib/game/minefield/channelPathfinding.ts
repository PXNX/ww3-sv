/*
 * Win detection: a breadth-first search from the western edge to the eastern edge. Ships need
 * an edge to pass between two cells, so only orthogonal steps count (touching corners do not).
 */
import { cellPosition, orthogonalNeighborIndices, type GridSize } from './grid';
import type { Board, Cell } from './minefieldBoard';

/**
 * Shortest west-to-east route over cells for which passable() is true, as a list of cell
 * indices from the western edge to the eastern edge, or null if there is none.
 */
export function findWestEastPath(
	size: GridSize,
	passable: (index: number) => boolean
): number[] | null {
	const parent = new Map<number, number | null>();
	const queue: number[] = [];

	for (let row = 0; row < size.rows; row++) {
		const index = row * size.columns;
		if (passable(index)) {
			parent.set(index, null);
			queue.push(index);
		}
	}

	for (let head = 0; head < queue.length; head++) {
		const current = queue[head];
		if (cellPosition(size, current).column === size.columns - 1) {
			const path: number[] = [];
			for (let step: number | null = current; step !== null; step = parent.get(step) ?? null) {
				path.push(step);
			}
			return path.reverse();
		}
		for (const next of orthogonalNeighborIndices(size, current)) {
			if (parent.has(next) || !passable(next)) continue;
			parent.set(next, current);
			queue.push(next);
		}
	}
	return null;
}

/** Revealed safe water, including cells whose mine a submarine has defused */
export function isChannelCell(cell: Cell): boolean {
	return cell.state === 'revealed' && !cell.mine;
}

/** The revealed channel that wins the game, or null while the strait is still blocked */
export function findChannel(board: Board): number[] | null {
	return findWestEastPath(board, (index) => isChannelCell(board.cells[index]));
}

/** Whether any mine-free route exists at all, revealed or not (used to keep boards winnable) */
export function hasMineFreeRoute(board: Board): boolean {
	return findWestEastPath(board, (index) => !board.cells[index].mine) !== null;
}

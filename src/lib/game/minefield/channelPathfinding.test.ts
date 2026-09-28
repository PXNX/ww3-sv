import { describe, expect, it } from 'vitest';
import { findChannel, findWestEastPath, hasMineFreeRoute } from './channelPathfinding';
import { cellPosition, orthogonalNeighborIndices } from './grid';
import { boardWithMines, createBoard, type Board, type CellState } from './minefieldBoard';

/** Builds a board from rows of characters: . hidden, o revealed, f flagged, x detonated mine */
function fromRows(rows: string[]): Board {
	const columns = rows[0].length;
	const board = createBoard(columns, rows.length);
	const states: Record<string, CellState> = {
		'.': 'hidden',
		o: 'revealed',
		f: 'flagged',
		x: 'detonated'
	};
	const cells = rows.flatMap((row) =>
		[...row].map((char) => ({
			mine: char === 'x',
			state: states[char],
			adjacent: 0,
			defused: false
		}))
	);
	return { ...board, cells, minesPlaced: true };
}

function expectValidChannel(board: Board, path: number[] | null) {
	expect(path).not.toBeNull();
	const route = path!;
	expect(cellPosition(board, route[0]).column).toBe(0);
	expect(cellPosition(board, route[route.length - 1]).column).toBe(board.columns - 1);
	for (let step = 1; step < route.length; step++) {
		expect(orthogonalNeighborIndices(board, route[step - 1])).toContain(route[step]);
	}
	expect(new Set(route).size).toBe(route.length);
}

describe('findChannel', () => {
	it('finds nothing on an untouched board', () => {
		expect(findChannel(createBoard(10, 8))).toBeNull();
	});

	it('finds a straight channel across one row', () => {
		const board = fromRows(['....', 'oooo', '....']);
		const path = findChannel(board);
		expectValidChannel(board, path);
		expect(path).toEqual([4, 5, 6, 7]);
	});

	it('follows a winding channel and returns a shortest route', () => {
		const board = fromRows(['oo...', '.o.oo', '.ooo.', 'ooooo']);
		const path = findChannel(board);
		expectValidChannel(board, path);
		expect(path).toHaveLength(5);
	});

	it('finds the only route through a maze', () => {
		const board = fromRows(['ooo.o', '..o.o', 'o.ooo', 'o....']);
		const path = findChannel(board);
		expectValidChannel(board, path);
		expect(path).toEqual([0, 1, 2, 7, 12, 13, 14]);
	});

	it('does not sail through cells that only touch at a corner', () => {
		expect(findChannel(fromRows(['oo..', '..oo']))).toBeNull();
	});

	it('is blocked by hidden water, buoys and detonated mines', () => {
		expect(findChannel(fromRows(['oo.o']))).toBeNull();
		expect(findChannel(fromRows(['oofo']))).toBeNull();
		expect(findChannel(fromRows(['ooxo']))).toBeNull();
	});

	it('uses water a submarine has cleared', () => {
		const board = fromRows(['oooo']);
		const cells = board.cells.map((cell, index) =>
			index === 2 ? { ...cell, defused: true } : cell
		);
		expect(findChannel({ ...board, cells })).toEqual([0, 1, 2, 3]);
	});

	it('works on a board that is a single column wide', () => {
		expect(findChannel(fromRows(['.', 'o', '.']))).toEqual([1]);
	});
});

describe('findWestEastPath', () => {
	it('uses any passability rule', () => {
		const size = { columns: 3, rows: 2 };
		expect(findWestEastPath(size, () => true)).toEqual([0, 1, 2]);
		expect(findWestEastPath(size, (index) => index !== 1)).toEqual([3, 4, 5]);
		expect(findWestEastPath(size, (index) => index % 3 !== 1)).toBeNull();
	});
});

describe('hasMineFreeRoute', () => {
	it('detects a wall of mines from north to south', () => {
		// A diagonal wall still blocks ships, because they cannot pass between corners
		expect(hasMineFreeRoute(boardWithMines(4, 3, [2, 5, 8]))).toBe(false);
		expect(hasMineFreeRoute(boardWithMines(4, 3, [1, 5, 11]))).toBe(true);
		expect(hasMineFreeRoute(boardWithMines(4, 3, []))).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import {
	canRally,
	COLS,
	createBoard,
	flipsFor,
	holdRally,
	LAYOUT,
	neighborCount,
	rallyTiles,
	swingOrder,
	tally,
	type Board,
	type Side
} from './board';

const at = (row: number, col: number) => row * COLS + col;

/** A board where every land tile is empty, for hand-built lines */
function emptyBoard(): Board {
	const board = createBoard();
	for (const cell of board.cells) cell.owner = null;
	return board;
}

function set(board: Board, row: number, col: number, owner: Side) {
	board.cells[at(row, col)].owner = owner;
}

describe('createBoard', () => {
	it('has a 2 by 2 cross in the middle and 55 land tiles', () => {
		const board = createBoard();
		expect(tally(board)).toEqual({ you: 2, rival: 2, free: 51, total: 55 });
		expect(board.cells[at(3, 3)].owner).toBe('rival');
		expect(board.cells[at(3, 4)].owner).toBe('you');
	});

	it('names every land tile once and keeps the sea unnamed', () => {
		const names = LAYOUT.flat().filter((name) => name !== null);
		expect(new Set(names).size).toBe(names.length);
		expect(LAYOUT.every((row) => row.length === COLS)).toBe(true);
		expect(createBoard().cells[at(0, 0)].name).toBeNull();
	});
});

describe('flipsFor', () => {
	it('flips a run of rival tiles that ends at one of yours', () => {
		const board = emptyBoard();
		set(board, 3, 1, 'rival');
		set(board, 3, 2, 'rival');
		set(board, 3, 3, 'you');
		expect(flipsFor(board, at(3, 0), 'you')).toEqual([at(3, 1), at(3, 2)]);
	});

	it('does not flip a run that ends at an empty tile, the sea or the edge', () => {
		const board = emptyBoard();
		set(board, 3, 1, 'rival');
		set(board, 3, 2, 'rival');
		expect(flipsFor(board, at(3, 0), 'you')).toEqual([]);
		// Row 2 ends at the edge of the grid: nothing to anchor
		const edge = emptyBoard();
		set(edge, 2, 1, 'rival');
		set(edge, 2, 2, 'rival');
		expect(flipsFor(edge, at(2, 0), 'you')).toEqual([]);
		// Sea breaks the line: (0,5) is sea, so the rival tile at (1,4) has no anchor behind it
		const sea = emptyBoard();
		set(sea, 1, 4, 'rival');
		expect(flipsFor(sea, at(2, 3), 'you')).toEqual([]);
	});

	it('flips in several directions at once, and diagonals count', () => {
		const board = emptyBoard();
		set(board, 3, 4, 'rival');
		set(board, 3, 5, 'you');
		set(board, 4, 3, 'rival');
		set(board, 5, 3, 'you');
		set(board, 4, 4, 'rival');
		set(board, 5, 5, 'you');
		expect(flipsFor(board, at(3, 3), 'you').sort((a, b) => a - b)).toEqual([
			at(3, 4),
			at(4, 3),
			at(4, 4)
		]);
	});

	it('is symmetric for the rival', () => {
		const board = emptyBoard();
		set(board, 5, 2, 'you');
		set(board, 5, 3, 'rival');
		expect(flipsFor(board, at(5, 1), 'rival')).toEqual([at(5, 2)]);
		expect(flipsFor(board, at(5, 1), 'you')).toEqual([]);
	});

	it('returns nothing for occupied, sea and blocked tiles', () => {
		const board = createBoard();
		expect(flipsFor(board, at(3, 3), 'you')).toEqual([]);
		expect(flipsFor(board, at(0, 0), 'you')).toEqual([]);
		board.cells[at(3, 2)].blocked = 1;
		expect(canRally(board, at(3, 2))).toBe(false);
		expect(flipsFor(board, at(3, 2), 'you')).toEqual([]);
	});

	it('stops at blocked and frozen tiles in the line', () => {
		const board = emptyBoard();
		set(board, 3, 1, 'rival');
		set(board, 3, 2, 'rival');
		set(board, 3, 3, 'you');
		board.cells[at(3, 2)].blocked = 2;
		expect(flipsFor(board, at(3, 0), 'you')).toEqual([]);
		board.cells[at(3, 2)].blocked = 0;
		// A frozen rival tile is immune
		board.cells[at(3, 2)].frozen = 1;
		expect(flipsFor(board, at(3, 0), 'you')).toEqual([]);
		// A frozen rally of yours cannot anchor the line
		board.cells[at(3, 2)].frozen = 0;
		board.cells[at(3, 3)].frozen = 1;
		expect(flipsFor(board, at(3, 0), 'you')).toEqual([]);
	});
});

describe('holdRally', () => {
	it('claims the tile and flips the lines', () => {
		const board = emptyBoard();
		set(board, 3, 1, 'rival');
		set(board, 3, 2, 'you');
		expect(holdRally(board, at(3, 0), 'you')).toEqual([at(3, 1)]);
		expect(board.cells[at(3, 0)].owner).toBe('you');
		expect(board.cells[at(3, 1)].owner).toBe('you');
		expect(tally(board)).toMatchObject({ you: 3, rival: 0 });
	});

	it('may flip nothing, and refuses an illegal tile without changing the board', () => {
		const board = createBoard();
		expect(holdRally(board, at(0, 2), 'you')).toEqual([]);
		expect(board.cells[at(0, 2)].owner).toBe('you');
		expect(holdRally(board, at(3, 3), 'you')).toBeNull();
		expect(board.cells[at(3, 3)].owner).toBe('rival');
	});
});

describe('helpers', () => {
	it('lists the free tiles', () => {
		const board = createBoard();
		expect(rallyTiles(board)).toHaveLength(51);
		board.cells[at(2, 2)].blocked = 1;
		expect(rallyTiles(board)).toHaveLength(50);
	});

	it('counts land neighbours, fewer on the edge of the map', () => {
		const board = createBoard();
		expect(neighborCount(board, at(3, 3))).toBe(8);
		expect(neighborCount(board, at(0, 2))).toBeLessThan(8);
	});

	it('sweeps the swing from west to east over every land tile', () => {
		const order = swingOrder(createBoard());
		expect(order).toHaveLength(55);
		const columns = order.map((index) => index % COLS);
		expect(columns).toEqual([...columns].sort((a, b) => a - b));
	});
});

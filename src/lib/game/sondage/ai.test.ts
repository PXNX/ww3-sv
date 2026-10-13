import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { chooseMove } from './ai';
import { canRally, COLS, createBoard, flipsFor, rallyTiles, type Board } from './board';

const at = (row: number, col: number) => row * COLS + col;

function emptyBoard(): Board {
	const board = createBoard();
	for (const cell of board.cells) cell.owner = null;
	return board;
}

describe('chooseMove (La Candidate)', () => {
	it('takes the rally that flips the most tiles', () => {
		const board = emptyBoard();
		// Option A at (3,0) flips one tile; option B at (5,0)... flips three along the row
		board.cells[at(3, 1)].owner = 'you';
		board.cells[at(3, 2)].owner = 'rival';
		board.cells[at(4, 3)].owner = 'you';
		board.cells[at(4, 4)].owner = 'you';
		board.cells[at(4, 5)].owner = 'you';
		board.cells[at(4, 6)].owner = 'rival';
		const move = chooseMove(board, 'rival', createRandom(1));
		expect(move?.index).toBe(at(4, 2));
		expect(move?.flips).toEqual([at(4, 3), at(4, 4), at(4, 5)]);
	});

	it('never picks an occupied, blocked or sea tile', () => {
		const board = createBoard();
		board.cells[at(2, 2)].blocked = 2;
		for (let seed = 1; seed <= 25; seed++) {
			const move = chooseMove(board, 'rival', createRandom(seed));
			expect(move).not.toBeNull();
			expect(canRally(board, move!.index)).toBe(true);
			expect(move!.flips).toEqual(flipsFor(board, move!.index, 'rival'));
		}
	});

	it('is deterministic for a seed', () => {
		const board = createBoard();
		expect(chooseMove(board, 'rival', createRandom(9))).toEqual(
			chooseMove(board, 'rival', createRandom(9))
		);
	});

	it('prefers an edge tile when nothing flips', () => {
		const board = emptyBoard();
		board.cells[at(4, 4)].owner = 'you';
		const move = chooseMove(board, 'rival', createRandom(3));
		expect(move?.flips).toEqual([]);
		// The safest tile is the one with the fewest neighbours: the island of Corse
		expect(board.cells[move!.index].name).toBe('Corse');
	});

	it('fluffs her lines now and then, but only on a legal tile', () => {
		const board = createBoard();
		for (let seed = 1; seed <= 25; seed++) {
			const move = chooseMove(board, 'rival', createRandom(seed), 1);
			expect(move?.gaffe).toBe(true);
			expect(canRally(board, move!.index)).toBe(true);
		}
		expect(chooseMove(board, 'rival', createRandom(1), 0)?.gaffe).toBe(false);
		// The chance roll decides: below it she fumbles, at or above it she plays her best move
		expect(chooseMove(board, 'rival', () => 0.1, 0.25)?.gaffe).toBe(true);
		expect(chooseMove(board, 'rival', () => 0.5, 0.25)?.gaffe).toBe(false);
	});

	it('returns null when no rally can be held', () => {
		const board = createBoard();
		for (const index of rallyTiles(board)) board.cells[index].owner = 'you';
		expect(chooseMove(board, 'rival', createRandom(1))).toBeNull();
	});
});

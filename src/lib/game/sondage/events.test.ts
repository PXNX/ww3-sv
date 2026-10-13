import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { COLS, createBoard, flipsFor, isLand } from './board';
import {
	applyEvent,
	EVENT_CHANCE,
	rollEvent,
	SCANDAL_ROUNDS,
	STRIKE_ROUNDS,
	tickEvents,
	type BoardEvent
} from './events';

const at = (row: number, col: number) => row * COLS + col;

/** A random source that returns the given values in turn, then keeps returning the last */
function script(...values: number[]) {
	let i = 0;
	return () => values[Math.min(i++, values.length - 1)];
}

describe('rollEvent', () => {
	it('never fires in the first round', () => {
		const board = createBoard();
		for (let seed = 1; seed <= 50; seed++) {
			expect(rollEvent(board, 1, createRandom(seed))).toBeNull();
		}
	});

	it('is quiet when the chance roll misses', () => {
		expect(rollEvent(createBoard(), 5, script(EVENT_CHANCE))).toBeNull();
	});

	it('rolls both kinds over many rounds, always on a legal tile', () => {
		const board = createBoard();
		const kinds = new Set<string>();
		const random = createRandom(42);
		for (let round = 2; round < 400; round++) {
			const event = rollEvent(board, 2 + (round % 12), random);
			if (!event) continue;
			kinds.add(event.kind);
			expect(isLand(board.cells[event.tile])).toBe(true);
			if (event.kind === 'scandal') {
				expect(board.cells[event.tile].owner).toBe(event.side);
			}
		}
		expect(kinds).toEqual(new Set(['scandal', 'strike']));
	});

	it('aims a scandal at the leader most of the time', () => {
		const board = createBoard();
		board.cells[at(3, 1)].owner = 'rival';
		board.cells[at(3, 2)].owner = 'rival';
		// chance roll passes, kind roll picks the scandal, side roll below the leader chance
		const hit = rollEvent(board, 3, script(0, 0, 0.1, 0));
		expect(hit).toMatchObject({ kind: 'scandal', side: 'rival' });
		// side roll above the chance: the trailing side is hit
		const trailing = rollEvent(board, 3, script(0, 0, 0.9, 0));
		expect(trailing).toMatchObject({ kind: 'scandal', side: 'you' });
	});

	it('picks a strike for the other kind roll and never hits the sea', () => {
		const board = createBoard();
		const event = rollEvent(board, 3, script(0, 0.99, 0));
		expect(event?.kind).toBe('strike');
		expect(isLand(board.cells[event!.tile])).toBe(true);
	});

	it('falls back to a strike when the side has no free rally to freeze', () => {
		const board = createBoard();
		for (const cell of board.cells) if (cell.owner === 'you') cell.frozen = 1;
		// the player leads on a tie, so the scandal aims at the player first
		const event = rollEvent(board, 3, script(0, 0, 0.1, 0));
		expect(event?.kind).toBe('strike');
	});
});

describe('applyEvent and tickEvents', () => {
	it('freezes a rally for one round, then thaws it', () => {
		const board = createBoard();
		const event: BoardEvent = { kind: 'scandal', tile: at(3, 4), side: 'you' };
		applyEvent(board, event);
		expect(board.cells[at(3, 4)].frozen).toBe(SCANDAL_ROUNDS);
		expect(tickEvents(board)).toEqual({ thawed: [at(3, 4)], reopened: [] });
		expect(board.cells[at(3, 4)].frozen).toBe(0);
	});

	it('blocks a département for two rounds, then reopens it', () => {
		const board = createBoard();
		applyEvent(board, { kind: 'strike', tile: at(2, 2) });
		expect(board.cells[at(2, 2)].blocked).toBe(STRIKE_ROUNDS);
		expect(tickEvents(board)).toEqual({ thawed: [], reopened: [] });
		expect(board.cells[at(2, 2)].blocked).toBe(1);
		expect(tickEvents(board).reopened).toEqual([at(2, 2)]);
		expect(board.cells[at(2, 2)].blocked).toBe(0);
	});

	it('changes what a rally can flip while it lasts', () => {
		const board = createBoard();
		// Yonne (3,3) rival, Côte-d'Or (3,4) you: a rival rally at (3,5) flips Côte-d'Or? needs (3,3) as anchor
		expect(flipsFor(board, at(3, 5), 'rival')).toEqual([at(3, 4)]);
		applyEvent(board, { kind: 'scandal', tile: at(3, 3), side: 'rival' });
		expect(flipsFor(board, at(3, 5), 'rival')).toEqual([]);
		tickEvents(board);
		expect(flipsFor(board, at(3, 5), 'rival')).toEqual([at(3, 4)]);
	});
});

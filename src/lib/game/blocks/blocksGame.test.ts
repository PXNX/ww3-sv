import { describe, expect, it } from 'vitest';
import { createHighscores } from '$lib/services/highscore';
import { createStore, type KeyValueStorage } from '$lib/services/storage';
import { BLOCKS_BEST_KEY, BlocksGame } from '$lib/stores/blocksGame.svelte';
import { boardFromRows, legalAnchors } from './board';
import { pieceById } from './pieces';

function memoryScores() {
	const data = new Map<string, string>();
	const storage: KeyValueStorage = {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
	return createHighscores(createStore(storage));
}

/** Plays the first legal move of the first piece that fits; returns false when nothing fits */
function playFirstFit(game: BlocksGame): boolean {
	for (const [index, piece] of game.tray.entries()) {
		if (!piece) continue;
		const [anchor] = legalAnchors(game.board, piece);
		if (!anchor) continue;
		game.select(index);
		return game.place(anchor[0], anchor[1]) === 'placed';
	}
	return false;
}

describe('Block Puzzle game', () => {
	it('starts with three pieces and nothing selected', () => {
		const game = new BlocksGame({ scores: memoryScores(), seed: 1 });
		expect(game.tray).toHaveLength(3);
		expect(game.selected).toBeNull();
		expect(game.over).toBe(false);
		expect(game.place(0, 0)).toBe('no-selection');
	});

	it('places the selected piece, scores it, and empties its tray slot', () => {
		const game = new BlocksGame({ scores: memoryScores(), seed: 2 });
		const piece = game.tray[1]!;
		game.select(1);
		expect(game.preview(0, 0)).toMatchObject({ legal: true, anchor: [0, 0] });
		expect(game.place(0, 0)).toBe('placed');
		expect(game.score).toBe(piece.cells.length);
		expect(game.tray[1]).toBeNull();
		expect(game.selected).toBeNull();
		expect(game.piecesPlaced).toBe(1);
	});

	it('refuses an overlapping placement and keeps the selection', () => {
		const board = boardFromRows([
			'X.......',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........'
		]);
		const game = new BlocksGame({ scores: memoryScores(), seed: 3, board });
		game.tray = [game.tray[0], pieceById('square-2')!, game.tray[2]];
		game.select(1);
		const before = game.board;
		expect(game.preview(0, 0)?.legal).toBe(false);
		expect(game.place(0, 0)).toBe('blocked');
		expect(game.board).toBe(before);
		expect(game.selected).toBe(1);
	});

	it('refills the tray once all three pieces are placed', () => {
		const game = new BlocksGame({ scores: memoryScores(), seed: 4 });
		for (let i = 0; i < 3; i++) expect(playFirstFit(game)).toBe(true);
		expect(game.tray.every((piece) => piece !== null)).toBe(true);
	});

	it('clears a line and reports it', () => {
		const board = boardFromRows([
			'XXXXXX..',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........'
		]);
		const game = new BlocksGame({ scores: memoryScores(), seed: 5, board });
		// Force a two-cell line into the tray so the clear is certain
		game.tray = [game.tray[0], pieceById('line-2-h')!, null];
		game.select(1);
		expect(game.preview(0, 6)?.clears).toHaveLength(8);
		expect(game.place(0, 6)).toBe('placed');
		expect(game.feedback).toMatchObject({ lines: 1, points: 10, streak: 1 });
		expect(game.linesCleared).toBe(1);
		expect(game.fill).toBe(0);
	});

	it('ends when nothing fits and records the personal best', () => {
		const scores = memoryScores();
		const game = new BlocksGame({ scores, seed: 6 });
		for (let moves = 0; moves < 5000 && !game.over; moves++) {
			if (!playFirstFit(game)) break;
		}
		expect(game.over).toBe(true);
		expect(game.score).toBeGreaterThan(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(BLOCKS_BEST_KEY)).toBe(game.score);
		expect(game.place(0, 0)).toBe('no-selection');

		game.newGame(7);
		expect(game.over).toBe(false);
		expect(game.score).toBe(0);
		expect(game.best).toBe(scores.get(BLOCKS_BEST_KEY));
	});
});

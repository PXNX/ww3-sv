import { describe, expect, it } from 'vitest';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { BLOCKS_BEST_KEY, BlocksGame } from '#lib/stores/blocksGame.svelte.js';
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

	it('builds a cascade and pays extra for the second clear in a row', () => {
		const board = boardFromRows([
			'XXXXXX..',
			'XXXXXX..',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........'
		]);
		const game = new BlocksGame({ scores: memoryScores(), seed: 8, board });
		game.tray = [pieceById('line-2-h')!, pieceById('line-2-h')!, pieceById('line-2-v')!];
		expect(game.nextCascadePoints).toBe(0);

		game.select(0);
		expect(game.place(0, 6)).toBe('placed');
		expect(game.cascade).toBe(1);
		// A first clear pays nothing extra, but it opens the second tier for the next clear
		const promised = game.nextCascadePoints;
		expect(promised).toBeGreaterThan(0);

		game.select(1);
		expect(game.place(1, 6)).toBe('placed');
		expect(game.cascade).toBe(2);
		expect(game.feedback).toMatchObject({ cascade: 2, cascadeBonus: promised });
		expect(game.nextCascadePoints).toBeGreaterThan(promised);
	});

	it('resets the cascade on a placement that clears nothing', () => {
		const board = boardFromRows([
			'XXXXXX..',
			'XXXXXX..',
			'........',
			'........',
			'........',
			'........',
			'........',
			'........'
		]);
		const game = new BlocksGame({ scores: memoryScores(), seed: 9, board });
		game.tray = [pieceById('line-2-h')!, pieceById('line-2-v')!, pieceById('line-2-h')!];

		game.select(0);
		game.place(0, 6);
		expect(game.cascade).toBe(1);

		game.select(1);
		expect(game.place(2, 0)).toBe('placed');
		expect(game.cascade).toBe(0);

		game.select(2);
		game.place(1, 6);
		expect(game.cascade).toBe(1);
	});

	it('completes an objective and adds its bonus to the score', () => {
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
		const game = new BlocksGame({ scores: memoryScores(), seed: 10, board });
		game.tray = [pieceById('line-2-h')!, null, null];
		game.objectives = [
			{ id: 'lines', target: 1, bonus: 120, progress: 0, done: false },
			{ id: 'pieces', target: 25, bonus: 100, progress: 0, done: false },
			{ id: 'combo', target: 3, bonus: 100, progress: 0, done: false }
		];

		game.select(0);
		expect(game.place(0, 6)).toBe('placed');
		expect(game.objectivesDone).toBe(1);
		expect(game.objectivePoints).toBe(120);
		// Two placed cells, one line, and the objective bonus
		expect(game.score).toBe(2 + 10 + 120);
		expect(game.feedback?.objectives.map((objective) => objective.id)).toEqual(['lines']);
	});

	it('plays without objectives, dealing the same pieces for the same seed', () => {
		const withObjectives = new BlocksGame({ scores: memoryScores(), seed: 11 });
		const game = new BlocksGame({ scores: memoryScores(), seed: 11, objectives: false });
		expect(game.objectives).toEqual([]);
		expect(game.tray.map((piece) => piece?.id)).toEqual(
			withObjectives.tray.map((piece) => piece?.id)
		);

		// A line clear pays its points and nothing more, and a new game stays without objectives
		game.board = boardFromRows(['XXXXXX..', ...Array.from({ length: 7 }, () => '........')]);
		game.tray = [pieceById('line-2-h')!, null, null];
		game.select(0);
		expect(game.place(0, 6)).toBe('placed');
		expect(game.score).toBe(2 + 10);
		expect(game.objectivePoints).toBe(0);
		game.newGame(12);
		expect(game.objectives).toEqual([]);
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

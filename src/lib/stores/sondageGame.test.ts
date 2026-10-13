import { describe, expect, it } from 'vitest';
import { COLS, rallyTiles } from '#lib/game/sondage/board.js';
import { TOTAL_ROUNDS } from '#lib/game/sondage/rules.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { RIVAL_DELAY_MS, SCORE_KEY, SondageGame } from './sondageGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame(seed = 7, gaffeChance = 0) {
	const scores = createHighscores(createStore(memoryStorage()));
	const game = new SondageGame({ scores: () => scores, seed: () => seed, gaffeChance });
	return { game, scores };
}

/** Lets La Candidate take her turn */
function rivalAnswers(game: SondageGame) {
	game.update(RIVAL_DELAY_MS);
}

const at = (row: number, col: number) => row * COLS + col;

describe('SondageGame', () => {
	it('waits for the start button and ignores taps before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		expect(game.rally(at(2, 2))).toBe(false);
	});

	it('plays a round: your rally, a beat, then La Candidate answers', () => {
		const { game } = newGame();
		game.start();
		expect(game.counts).toMatchObject({ you: 2, rival: 2 });
		expect(game.rally(at(2, 2))).toBe(true);
		expect(game.phase).toBe('rival');
		expect(game.counts.you).toBeGreaterThanOrEqual(3);
		// Taps are ignored while she thinks
		expect(game.rally(at(2, 5))).toBe(false);
		game.update(RIVAL_DELAY_MS - 100);
		expect(game.phase).toBe('rival');
		game.update(100);
		expect(game.phase).toBe('you');
		expect(game.round).toBe(2);
		expect(game.last?.side).toBe('rival');
	});

	it('flips the lines of a legal rally and counts them', () => {
		const { game } = newGame();
		game.start();
		// The Othello opening: you hold (3,4) and (4,3), so a rally at (4,5) flips (4,4) between them
		expect(game.hints[at(4, 5)]).toBe(1);
		game.rally(at(4, 5));
		expect(game.cells[at(4, 4)].owner).toBe('you');
		expect(game.flips).toBe(1);
		expect(game.counts).toMatchObject({ you: 4, rival: 1 });
		expect(game.score).toBe(4 * 10 + 1 * 3);
	});

	it('rejects occupied and blocked tiles with no change', () => {
		const { game } = newGame();
		game.start();
		expect(game.rally(at(3, 3))).toBe(false);
		game.board.cells[at(2, 2)].blocked = 2;
		expect(game.rally(at(2, 2))).toBe(false);
		expect(game.phase).toBe('you');
	});

	it('freezes the clock while paused', () => {
		const { game } = newGame();
		game.start();
		game.rally(at(2, 2));
		game.pause();
		game.update(5000);
		expect(game.phase).toBe('rival');
		game.resume();
		rivalAnswers(game);
		expect(game.phase).toBe('you');
	});

	it('ends in an election result and keeps the best score', () => {
		const { game, scores } = newGame(3);
		game.loadBest();
		expect(game.best).toBeNull();
		game.start();
		for (let guard = 0; guard < 400 && game.status === 'playing'; guard++) {
			if (game.phase === 'you') {
				// A modest player: take the free tile with the most flips
				const tiles = rallyTiles(game.board);
				tiles.sort((a, b) => game.hints[b] - game.hints[a]);
				game.rally(tiles[0]);
			} else {
				rivalAnswers(game);
			}
		}
		expect(game.status).toBe('over');
		expect(game.outcome).not.toBeNull();
		expect(game.round).toBeLessThanOrEqual(TOTAL_ROUNDS);
		expect(game.finalCells.length).toBe(game.cells.length);
		expect(game.score).toBeGreaterThan(0);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.isNewBest).toBe(true);
	});

	it('lets the rival win before the last round by crossing the majority', () => {
		const { game } = newGame();
		game.start();
		// Hand her the map: 27 tiles, so her next rally crosses the threshold of 28
		let rival = 0;
		game.board.cells.forEach((cell, index) => {
			if (cell.name === null || index === at(0, 2)) return;
			cell.owner = rival < 27 ? 'rival' : null;
			rival += 1;
		});
		game.board.cells[at(0, 2)].owner = 'you';
		game.rally(at(8, 7));
		rivalAnswers(game);
		expect(game.status).toBe('over');
		expect(game.outcome).toMatchObject({ winner: 'rival', reason: 'majority', early: true });
		expect(game.mood).toBe('smug');
	});

	it('is reproducible for a seed', () => {
		const run = () => {
			const { game } = newGame(11);
			game.start();
			game.rally(at(2, 2));
			rivalAnswers(game);
			return [game.last, game.counts, game.event];
		};
		expect(run()).toEqual(run());
	});

	it('has messages in every language', () => {
		expect(missingMessages(['sondage_', 'mode_sondage_'])).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { FEEDBACK_MS, GAME_OVER_FEEDBACK_MS, STARTING_MOOD } from '#lib/game/redsquare/config.js';
import { slotMs } from '#lib/game/redsquare/timing.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { SCORE_KEY, RedSquareGame } from './redsquareGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new RedSquareGame({ scores: () => scores, seed: () => 7 }), scores };
}

/** Puts the column in the middle of its band */
function aim(game: RedSquareGame) {
	game.state.elapsedMs = game.state.slotMs * game.state.window.centre;
}

/** Cues cleanly, then waits out the verdict so the next column is dealt */
function cleanHit(game: RedSquareGame) {
	aim(game);
	game.cue();
	game.update(FEEDBACK_MS + 10);
}

describe('RedSquareGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.cue();
		game.update(60_000);
		expect(game.score).toBe(0);
		expect(game.mood).toBe(STARTING_MOOD);
		expect(game.hits).toBe(0);
	});

	it('scores a clean cue and shows a toast', () => {
		const { game } = newGame();
		game.start();
		aim(game);
		game.cue();
		expect(game.score).toBeGreaterThan(0);
		expect(game.streak).toBe(1);
		expect(game.hits).toBe(1);
		expect(game.toast).not.toBeNull();
		expect(game.phase).toBe('feedback');
	});

	it('costs a mood point for a missed slot and flashes the field', () => {
		const { game } = newGame();
		game.start();
		game.update(slotMs(1) + 10);
		expect(game.mood).toBe(STARTING_MOOD - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.last?.kind).toBe('missed');
	});

	it('moves the marker and keeps it inside the square', () => {
		const { game } = newGame();
		game.start();
		game.update(slotMs(1) / 2);
		expect(game.marker).toBeGreaterThan(0.4);
		expect(game.marker).toBeLessThan(0.6);
		game.update(slotMs(1));
		expect(game.marker).toBeLessThanOrEqual(1);
	});

	it('does not run while paused', () => {
		const { game } = newGame();
		game.start();
		game.pause();
		expect(game.status).toBe('paused');
		game.update(60_000);
		game.cue();
		expect(game.mood).toBe(STARTING_MOOD);
		expect(game.score).toBe(0);
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('announces the next wave with fewer interceptors', () => {
		const { game } = newGame();
		game.start();
		for (let i = 0; i < 4; i++) cleanHit(game);
		expect(game.wave).toBe(2);
		expect(game.waveNote).not.toBeNull();
		expect(game.interceptors).toBeLessThan(12);
	});

	it('ends the parade, submits the best score and can be restarted', () => {
		const { game, scores } = newGame();
		game.start();
		cleanHit(game);
		for (let i = 0; i < STARTING_MOOD; i++) {
			game.update(slotMs(game.wave) + 10);
			game.update(GAME_OVER_FEEDBACK_MS + 10);
		}
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.best).toBe(game.score);
		expect(game.bestStreakEver).toBe(1);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.score).toBe(0);
		expect(game.mood).toBe(STARTING_MOOD);
		expect(game.isNewBest).toBe(false);
	});

	it('does not touch the best when the new score is lower', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 999_999);
		game.start();
		for (let i = 0; i < STARTING_MOOD; i++) {
			game.update(slotMs(game.wave) + 10);
			game.update(GAME_OVER_FEEDBACK_MS + 10);
		}
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(scores.get(SCORE_KEY)).toBe(999_999);
	});
});

describe('messages', () => {
	it('has every red square string in every language', () => {
		expect(missingMessages(['redsquare_', 'mode_redsquare_'])).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { GAME_OVER_FEEDBACK_MS, STARTING_LIVES } from '#lib/game/veto/config.js';
import { RESOLUTION_COUNT, resolutionKey } from '#lib/game/veto/resolutions.js';
import { windowMs } from '#lib/game/veto/timing.js';
import { ACTIONS, type Action } from '#lib/game/veto/vote.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { loadMessages, missingMessages } from '#lib/testing/messages.js';
import { SCORE_KEY, VetoGame } from './vetoGame.svelte';

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
	return { game: new VetoGame({ scores: () => scores, seed: () => 7 }), scores };
}

const wrong = (game: VetoGame): Action => ACTIONS.find((action) => action !== game.expected)!;

describe('VetoGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.vote(game.expected);
		game.update(60_000);
		expect(game.score).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.state.timeouts).toBe(0);
	});

	it('scores a correct vote and shows a toast', () => {
		const { game } = newGame();
		game.start();
		game.vote(game.expected);
		expect(game.score).toBeGreaterThan(0);
		expect(game.streak).toBe(1);
		expect(game.toast).not.toBeNull();
		expect(game.phase).toBe('feedback');
	});

	it('costs a heart for a wrong vote and flashes the field', () => {
		const { game } = newGame();
		game.start();
		game.vote(wrong(game));
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.last?.kind).toBe('wrong');
	});

	it('costs a heart when the clock runs out and counts the clock down', () => {
		const { game } = newGame();
		game.start();
		game.update(windowMs(0) / 2);
		expect(game.clock).toBeCloseTo(0.5, 1);
		game.update(windowMs(0));
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.last?.kind).toBe('timeout');
	});

	it('slams the veto stamp with a shake on a correct veto only', () => {
		const { game } = newGame();
		game.start();
		let stamped = false;
		for (let i = 0; i < 80 && game.status === 'playing'; i++) {
			const wasVeto = game.expected === 'veto';
			const shakes = game.shakeCount;
			game.vote(game.expected);
			if (wasVeto) {
				stamped = true;
				expect(game.stamp).not.toBeNull();
				expect(game.stamp?.tieBreak).toBe(game.tieBreak);
				expect(game.shakeCount).toBe(shakes + 1);
				expect(game.shakePower).toBe(game.tieBreak ? 2 : 1);
			} else {
				expect(game.shakeCount).toBe(shakes);
			}
			game.update(10_000);
			expect(game.stamp).toBeNull();
		}
		expect(stamped).toBe(true);
	});

	it('does not stamp a wrong veto', () => {
		const { game } = newGame();
		game.start();
		while (game.expected === 'veto') {
			game.vote('veto');
			game.update(10_000);
		}
		const shakes = game.shakeCount;
		game.vote('veto');
		expect(game.stamp).toBeNull();
		expect(game.shakeCount).toBe(shakes);
	});

	it('does not run while paused', () => {
		const { game } = newGame();
		game.start();
		game.pause();
		expect(game.status).toBe('paused');
		game.update(60_000);
		game.vote(game.expected);
		expect(game.score).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('speeds up with a streak and announces it', () => {
		const { game } = newGame();
		game.start();
		for (let i = 0; i < 3; i++) {
			game.vote(game.expected);
			if (i < 2) game.update(10_000);
		}
		expect(game.pace).toBe(1);
		expect(game.paceNote).not.toBeNull();
		game.update(10_000);
		expect(game.state.windowMs).toBeLessThan(windowMs(0));
	});

	it('ends the game, submits the best score and streak, and can be restarted', () => {
		const { game, scores } = newGame();
		game.start();
		game.vote(game.expected);
		game.update(10_000);
		for (let i = 0; i < STARTING_LIVES; i++) {
			game.vote(wrong(game));
			game.update(GAME_OVER_FEEDBACK_MS + 10_000);
		}
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.best).toBe(game.score);
		expect(game.bestStreakEver).toBe(1);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.score).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.isNewBest).toBe(false);
	});

	it('does not touch the best when the new score is lower', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 999_999);
		game.start();
		for (let i = 0; i < STARTING_LIVES; i++) {
			game.vote(wrong(game));
			game.update(GAME_OVER_FEEDBACK_MS + 10_000);
		}
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(scores.get(SCORE_KEY)).toBe(999_999);
	});
});

describe('messages', () => {
	it('has every veto string in every language', () => {
		expect(missingMessages(['veto_', 'mode_veto_'])).toEqual([]);
	});

	it('has a translated text for every draft resolution', () => {
		const english = loadMessages('en');
		for (let i = 0; i < RESOLUTION_COUNT; i++) {
			expect(english[resolutionKey(i)], resolutionKey(i)).toBeTruthy();
		}
		expect(english[resolutionKey(RESOLUTION_COUNT)]).toBeUndefined();
	});
});

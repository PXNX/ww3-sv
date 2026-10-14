import { describe, expect, it } from 'vitest';
import { endPoint } from '#lib/game/suez/body.js';
import { QUEUE_CAPACITY, STARTING_LIVES, levelParams } from '#lib/game/suez/config.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { SuezGame } from './suezGame.svelte';

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
	return { game: new SuezGame({ scores: () => scores, seed: () => 7 }), scores };
}

const STEP = 1000 / 60;

function play(game: SuezGame, ms: number) {
	for (let t = 0; t < ms && game.status === 'playing'; t += STEP) game.update(STEP);
}

describe('SuezGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		const bow = endPoint(game.state.body, 'bow');
		expect(game.press(1, bow.x, bow.y, 'mouse')).toEqual({ kind: 'none' });
		game.update(5000);
		expect(game.state.queue.waiting).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.stuckPercent).toBe(100);
	});

	it('runs only while playing and drops the held ends on pause', () => {
		const { game } = newGame();
		game.start();
		const bow = endPoint(game.state.body, 'bow');
		expect(game.press(1, bow.x, bow.y, 'touch').kind).toBe('grab');
		play(game, 500);
		game.pause();
		expect(game.status).toBe('paused');
		expect(game.state.holds).toEqual([]);
		const clock = game.clockMs;
		play(game, 500);
		expect(game.clockMs).toBe(clock);
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('shows the queue and the excavator in the page state', () => {
		const { game } = newGame();
		game.start();
		play(game, levelParams(1).queueIntervalMs + 100);
		expect(game.waiting).toBe(1);
		expect(game.excavatorWait).toBe(0);
		expect(game.press(1, 50, 500, 'touch').kind).toBe('dig');
		expect(game.excavatorWait).toBeGreaterThan(0);
		expect(game.press(2, 50, 400, 'touch')).toEqual({ kind: 'cooldown' });
	});

	it('loses hearts when the queue overflows and ends the run with a saved best', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.score = 340;
		game.state.canalsCleared = 2;
		play(game, 10 * 60 * 1000);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.hurtCount).toBe(STARTING_LIVES);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(340);
		expect(scores.get(['suez', 'score'])).toBe(340);
		expect(scores.get(['suez', 'canals'])).toBe(2);
		expect(QUEUE_CAPACITY).toBeGreaterThan(0);
	});

	it('does not mark a lower score as a new best', () => {
		const { game, scores } = newGame();
		scores.submit(['suez', 'score'], 1000);
		game.start();
		play(game, 10 * 60 * 1000);
		expect(game.isNewBest).toBe(false);
		expect(game.best).toBe(1000);
	});

	it('starts a fresh run on retry', () => {
		const { game } = newGame();
		game.start();
		play(game, 10 * 60 * 1000);
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.level).toBe(1);
		expect(game.effects).toEqual([]);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['suez_', 'mode_suez_'])).toEqual([]);
	});
});

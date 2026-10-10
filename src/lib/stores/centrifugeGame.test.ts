import { describe, expect, it } from 'vitest';
import { BANNER_COUNT, STARTING_LIVES } from '#lib/game/centrifuge/config.js';
import { startDrift } from '#lib/game/centrifuge/dial.js';
import { createScheduler } from '#lib/game/centrifuge/scares.js';
import { createRandom } from '#lib/game/random.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { BANNER_TEXTS } from '#lib/components/centrifugeText.js';
import { CentrifugeGame, SCORE_KEY } from './centrifugeGame.svelte';

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
	const game = new CentrifugeGame({ scores: () => scores, seed: () => 7 });
	return { game, scores };
}

/** Real milliseconds of play in the fixed steps the page loop uses */
function play(game: CentrifugeGame, seconds: number) {
	for (let t = 0; t < seconds * 1000 && game.status === 'playing'; t += 50) game.update(50);
}

/** A running game with no scares and no drift due, so a test sets up exactly what it needs */
function quietRun() {
	const made = newGame();
	made.game.start();
	made.game.state.scheduler = createScheduler(1e9);
	made.game.state.driftInMs = 1e9;
	return made;
}

describe('CentrifugeGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.update(1000);
		game.press();
		expect(game.state.timeMs).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('runs only while playing', () => {
		const { game } = newGame();
		game.start();
		play(game, 2);
		const time = game.state.timeMs;
		expect(time).toBeGreaterThan(1500);
		game.pause();
		play(game, 2);
		expect(game.state.timeMs).toBe(time);
		game.resume();
		play(game, 1);
		expect(game.state.timeMs).toBeGreaterThan(time);
	});

	it('shows the scares that are on and drops them when they end', () => {
		const { game } = newGame();
		game.start();
		play(game, 3);
		expect(game.scares.length).toBeGreaterThan(0);
		play(game, 8);
		const ids = new Set(game.state.scheduler.active.map((scare) => scare.id));
		expect(game.scares.every((scare) => ids.has(scare.id))).toBe(true);
	});

	it('costs a heart and flashes the field when the player presses with the dial calm', () => {
		const { game } = quietRun();
		game.press();
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.startled).toBe(true);
		expect(game.popups.map((popup) => popup.kind)).toEqual(['overreact']);
		play(game, 2);
		expect(game.startled).toBe(false);
		expect(game.popups).toHaveLength(0);
	});

	it('scores a quick fix of a real drift and shows the multiplier', () => {
		const { game } = quietRun();
		startDrift(game.state.dial, createRandom(1), 0);
		for (let t = 0; t < 5000 && !game.outOfBand; t += 50) game.update(50);
		expect(game.outOfBand).toBe(true);
		game.press();
		expect(game.score).toBeGreaterThanOrEqual(40);
		expect(game.fixes).toBe(1);
		expect(game.streak).toBe(1);
		expect(game.outOfBand).toBe(false);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('ends the run when the hearts are gone and keeps the best score', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.scheduler = createScheduler(1e9);
		game.state.score = 120;
		game.state.lives = 1;
		game.press();
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(120);
		expect(game.best).toBe(120);
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.score).toBe(0);
		expect(game.scares).toHaveLength(0);
	});

	it('is deterministic for one seed', () => {
		const run = () => {
			const { game } = newGame();
			game.start();
			play(game, 30);
			return [game.state.scheduler.nextId, game.dialValue.toFixed(6), game.state.driftInMs];
		};
		expect(run()).toEqual(run());
	});

	it('has a banner text for every banner variant', () => {
		expect(BANNER_TEXTS).toHaveLength(BANNER_COUNT);
	});
});

describe('Centrifuge messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['centrifuge_', 'mode_centrifuge_'])).toEqual([]);
	});
});

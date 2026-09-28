import { describe, expect, it } from 'vitest';
import { makeObstacle } from '$lib/game/convoy/runnerStep';
import { createHighscores } from '$lib/services/highscore';
import { createStore, type KeyValueStorage } from '$lib/services/storage';
import { ConvoyGame } from './convoyGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const STEP = 1000 / 60;

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new ConvoyGame({ scores: () => scores, seed: () => 99 }), scores };
}

/** Puts a wall of mines directly ahead, one per hull point, so the run ends quickly */
function sinkSoon(game: ConvoyGame) {
	game.runner = {
		...game.runner,
		nextSpawnAt: Number.POSITIVE_INFINITY,
		invulnerableMs: 0,
		hull: 1,
		obstacles: [makeObstacle(1, 'mine', game.runner.lane, game.runner.distance + 1)]
	};
}

describe('ConvoyGame', () => {
	it('only moves while running', () => {
		const { game } = newGame();
		game.update(STEP);
		expect(game.runner.distance).toBe(0);
		game.start();
		game.update(STEP);
		expect(game.runner.distance).toBeGreaterThan(0);
		game.pause();
		const distance = game.runner.distance;
		game.update(STEP);
		game.steer(1);
		expect(game.runner.distance).toBe(distance);
		expect(game.runner.lane).toBe(1);
		game.togglePause();
		expect(game.status).toBe('running');
	});

	it('ends the run, submits the best and allows a retry', () => {
		const { game, scores } = newGame();
		game.start();
		for (let i = 0; i < 120; i++) game.update(STEP);
		game.runner = { ...game.runner, distance: 50 };
		sinkSoon(game);
		for (let i = 0; i < 120 && game.status === 'running'; i++) game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.hull).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['convoy', 'score'])).toBe(game.score);
		expect(scores.get(['convoy', 'distance'])).toBe(game.distance);

		game.start();
		expect(game.status).toBe('running');
		expect(game.hull).toBe(3);
		expect(game.score).toBe(0);
		expect(game.isNewBest).toBe(false);
	});

	it('shakes the screen on a hit unless reduced motion is on', () => {
		for (const reducedMotion of [false, true]) {
			const scores = createHighscores(createStore(memoryStorage()));
			const game = new ConvoyGame({ reducedMotion, scores: () => scores, seed: () => 1 });
			game.start();
			sinkSoon(game);
			game.runner = { ...game.runner, hull: 3 };
			let shook = false;
			for (let i = 0; i < 60; i++) {
				game.update(STEP);
				shook ||= game.shakeMs > 0;
			}
			expect(game.hull).toBe(2);
			expect(shook).toBe(!reducedMotion);
		}
	});
});

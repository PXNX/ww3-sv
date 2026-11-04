import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import type { SliderEvent } from '#lib/game/slider/state.js';
import { SLIDER_BEST_KEY, SliderGame } from './sliderGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame(events: SliderEvent[] = []) {
	const scores = createHighscores(createStore(memoryStorage()));
	const game = new SliderGame({
		scores: () => scores,
		random: createRandom(3),
		onEvent: (event) => events.push(event)
	});
	return { game, scores };
}

describe('SliderGame', () => {
	it('does not advance while paused', () => {
		const { game } = newGame();
		game.pause();
		game.frame(0.1);
		expect(game.state.elapsed).toBe(0);
		game.resume();
		game.frame(0.1);
		expect(game.state.elapsed).toBeGreaterThan(0);
	});

	it('reports events, saves the best score and flags a new best when the run ends', () => {
		const events: SliderEvent[] = [];
		const { game, scores } = newGame(events);
		game.state.score = 120;
		game.forfeit();
		expect(game.over).toBe(true);
		expect(events.some((event) => event.type === 'end')).toBe(true);
		expect(scores.get(SLIDER_BEST_KEY)).toBe(120);
		expect(game.isNewBest).toBe(true);
	});

	it('restarts into a fresh run', () => {
		const { game } = newGame();
		game.forfeit();
		game.start();
		expect(game.over).toBe(false);
		expect(game.state.elapsed).toBe(0);
	});

	it('has every message in all locales', () => {
		expect(missingMessages(['slider_', 'mode_slider_'])).toEqual([]);
	});
});

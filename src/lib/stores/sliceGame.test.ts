import { describe, expect, it } from 'vitest';
import { STARTING_LIVES, THREATS } from '#lib/game/slice/config.js';
import type { Flyer } from '#lib/game/slice/state.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { SliceGame } from './sliceGame.svelte';

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
	return { game: new SliceGame({ scores: () => scores, seed: () => 7 }), scores };
}

function park(game: SliceGame, kind: Flyer['kind'], x: number, y: number) {
	game.state.flyers.push({
		kind,
		x,
		y,
		vx: 0,
		vy: 0,
		gravity: 0,
		angle: 0,
		phase: 0,
		id: game.state.nextId++,
		ageMs: 0
	});
}

describe('SliceGame', () => {
	it('only simulates while playing', () => {
		const { game } = newGame();
		game.update(STEP);
		expect(game.state.timeMs).toBe(0);
		game.start();
		game.update(STEP);
		expect(game.state.timeMs).toBeGreaterThan(0);
		game.pause();
		const time = game.state.timeMs;
		game.update(STEP);
		expect(game.state.timeMs).toBe(time);
		game.togglePause();
		expect(game.status).toBe('playing');
	});

	it('ignores swipes unless playing', () => {
		const { game } = newGame();
		park(game, 'geran', 100, 200);
		game.pointerDown(60, 200);
		game.pointerMove(140, 200);
		expect(game.score).toBe(0);
		game.start();
		park(game, 'geran', 100, 200);
		game.pause();
		game.pointerDown(60, 200);
		game.pointerMove(140, 200);
		expect(game.score).toBe(0);
	});

	it('slices with pointer events right away and shows effects that then fade', () => {
		const { game } = newGame();
		game.start();
		game.state.spawner.nextMs = Infinity;
		park(game, 'kinzhal', 100, 200);
		game.pointerDown(50, 200);
		expect(game.score).toBe(0);
		game.pointerMove(150, 200);
		expect(game.score).toBe(THREATS.kinzhal.points);
		expect(game.sliced).toBe(1);
		expect(game.effects.map((effect) => effect.kind).sort()).toEqual(['popup', 'puff']);
		for (let i = 0; i < 120; i++) game.update(STEP);
		expect(game.effects).toHaveLength(0);
	});

	it('costs a heart for a decoy', () => {
		const { game } = newGame();
		game.start();
		game.state.spawner.nextMs = Infinity;
		park(game, 'balloon', 100, 200);
		game.pointerDown(50, 200);
		game.pointerMove(150, 200);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.decoysHit).toBe(1);
		expect(game.hurtCount).toBe(1);
	});

	it('ends the game on the last heart, keeping the best score and combo', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.spawner.nextMs = Infinity;
		game.state.lives = 1;
		park(game, 'geran', 60, 200);
		park(game, 'geran', 120, 200);
		park(game, 'tanker', 200, 200);
		game.pointerDown(20, 200);
		game.pointerMove(260, 200);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['slice', 'score'])).toBe(game.score);
		expect(scores.get(['slice', 'combo'])).toBe(2);
		game.loadBest();
		expect(game.best).toBe(game.score);
		expect(game.bestComboEver).toBe(2);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.score).toBe(0);
		expect(game.isNewBest).toBe(false);
	});

	it('loses hearts to threats that get away', () => {
		const { game } = newGame();
		game.start();
		game.state.spawner.nextMs = Infinity;
		park(game, 'geran', 100, 700);
		game.state.flyers[0].vy = 10;
		game.update(STEP);
		expect(game.missed).toBe(1);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.effects.some((effect) => effect.kind === 'splash')).toBe(true);
	});
});

describe('Radar Slice messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['slice_', 'mode_slice_'])).toEqual([]);
	});
});

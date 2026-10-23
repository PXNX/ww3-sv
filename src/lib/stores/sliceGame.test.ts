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

	it('revives a finished run with one heart and a clear sky, keeping the score', () => {
		const { game } = newGame();
		game.revive();
		expect(game.status).toBe('ready');
		game.start();
		game.revive();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);

		game.state.spawner.nextMs = 0;
		game.state.lives = 1;
		park(game, 'kinzhal', 60, 200);
		park(game, 'balloon', 200, 200);
		park(game, 'geran', 400, 200);
		game.pointerDown(20, 200);
		game.pointerMove(240, 200);
		expect(game.status).toBe('over');
		const score = game.score;
		const time = game.state.timeMs;
		expect(score).toBe(THREATS.kinzhal.points);

		game.revive();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(1);
		expect(game.score).toBe(score);
		expect(game.sliced).toBe(1);
		expect(game.decoysHit).toBe(1);
		expect(game.state.timeMs).toBe(time);
		expect(game.state.flyers).toHaveLength(0);
		expect(game.state.trail.points).toHaveLength(0);
		expect(game.state.spawner.nextMs).toBeGreaterThan(0);
		// The grace period: nothing is launched on the very next step
		game.update(STEP);
		expect(game.state.flyers).toHaveLength(0);
		expect(game.status).toBe('playing');
	});

	it('can revive the same run again and keeps it a new best when it ends', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.spawner.nextMs = Infinity;
		for (let round = 1; round <= 2; round++) {
			game.state.lives = 1;
			park(game, 'kinzhal', 60, 200);
			park(game, 'balloon', 200, 200);
			game.pointerDown(20, 200);
			game.pointerMove(240, 200);
			expect(game.status).toBe('over');
			expect(game.isNewBest).toBe(true);
			expect(scores.get(['slice', 'score'])).toBe(THREATS.kinzhal.points * round);
			game.revive();
			expect(game.status).toBe('playing');
		}

		// Ending again without scoring more still reports the run's best
		park(game, 'balloon', 100, 200);
		game.pointerDown(60, 200);
		game.pointerMove(140, 200);
		expect(game.status).toBe('over');
		expect(game.score).toBe(THREATS.kinzhal.points * 2);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(game.score);

		game.start();
		expect(game.isNewBest).toBe(false);
		expect(game.score).toBe(0);
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

import { describe, expect, it } from 'vitest';
import { STARTING_LIVES } from '#lib/game/chipfab/config.js';
import { topLayer } from '#lib/game/chipfab/stacker.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { ChipFabGame } from './chipfabGame.svelte';

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
	return { game: new ChipFabGame({ scores: () => scores, seed: () => 7 }), scores };
}

const STEP = 1000 / 60;

function play(game: ChipFabGame, ms: number) {
	for (let t = 0; t < ms && game.status === 'playing'; t += STEP) game.update(STEP);
}

describe('ChipFabGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.drop();
		game.update(5000);
		expect(game.state.stacker.layers).toHaveLength(1);
		expect(game.shortage).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('runs only while playing', () => {
		const { game } = newGame();
		game.start();
		play(game, 500);
		const shortage = game.state.shortage;
		expect(shortage).toBeGreaterThan(0);
		game.pause();
		expect(game.status).toBe('paused');
		game.update(2000);
		expect(game.state.shortage).toBe(shortage);
		game.drop();
		expect(game.state.stacker.layers).toHaveLength(1);
		game.togglePause();
		expect(game.status).toBe('playing');
	});

	it('stacks a layer on a drop and shows a perfect one to The Jacket', () => {
		const { game } = newGame();
		game.start();
		for (let i = 0; i < 3; i++) {
			game.state.stacker.slab.x = topLayer(game.state.stacker).left;
			game.drop();
		}
		expect(game.layers).toBe(3);
		expect(game.score).toBeGreaterThan(0);
		expect(game.reaction).toBe('cheers');
		expect(game.pose).toBe('cheers');
		expect(game.toast?.text).toBeTruthy();
	});

	it('moves on to Stage B after a miss and then slides modules', () => {
		const { game } = newGame();
		game.start();
		game.state.stacker.layers[0] = { left: 90, width: 10 };
		game.state.stacker.slab = { x: 0, width: 10, dir: 1 };
		game.drop();
		expect(game.stage).toBe('merge');
		expect(game.supply).toBeGreaterThan(0);
		// The stage change locks input for a moment
		game.move('left');
		expect(game.state.ram.moves).toBe(0);
		play(game, 1000);
		for (const direction of ['left', 'up', 'right', 'down'] as const) game.move(direction);
		expect(game.state.ram.moves).toBeGreaterThan(0);
		expect(game.board.flat().filter(Boolean).length).toBeGreaterThan(0);
	});

	it('The Jacket sulks when the shortage is high', () => {
		const { game } = newGame();
		game.start();
		game.state.shortage = 90;
		game.update(STEP);
		expect(game.pose).toBe('sulks');
	});

	it('loses a heart when the meter fills and ends the run on the last one', () => {
		const { game, scores } = newGame();
		game.start();
		let hearts = 0;
		let lives = game.lives;
		for (let t = 0; t < 60 * 60 * 20 && game.status === 'playing'; t++) {
			game.update(STEP);
			if (game.lives < lives) hearts++;
			lives = game.lives;
		}
		expect(hearts).toBe(STARTING_LIVES);
		expect(game.status).toBe('over');
		expect(game.hurtCount).toBe(STARTING_LIVES);
		expect(scores.get(['chipfab', 'level'])).toBe(1);
	});

	it('saves a new best score', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.stacker.slab.x = topLayer(game.state.stacker).left;
		game.drop();
		game.state.shortage = 100;
		game.state.lives = 1;
		game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(game.score);
		expect(scores.get(['chipfab', 'score'])).toBe(game.score);
	});

	it('does not mark a lower score as a new best', () => {
		const { game, scores } = newGame();
		scores.submit(['chipfab', 'score'], 100000);
		game.start();
		play(game, 10 * 60 * 1000);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(game.best).toBe(100000);
	});

	it('starts a fresh run on retry', () => {
		const { game } = newGame();
		game.start();
		play(game, 10 * 60 * 1000);
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.level).toBe(1);
		expect(game.stage).toBe('stack');
		expect(game.effects).toEqual([]);
		expect(game.reaction).toBeNull();
	});

	it('has messages in every language', () => {
		expect(missingMessages(['chipfab_', 'mode_chipfab_'])).toEqual([]);
	});
});

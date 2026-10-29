import { describe, expect, it } from 'vitest';
import { LEVEL_NAMES } from '#lib/components/venezuelaText.js';
import { STARTING_HEARTS, STEP, VIEW_W } from '#lib/game/venezuela/config.js';
import { LEVEL_IDS } from '#lib/game/venezuela/levels.js';
import { flagBox } from '#lib/game/venezuela/world.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { VenezuelaGame, highscoreParts } from './venezuelaGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const STEP_MS = STEP * 1000;

function newGame(storage = memoryStorage()) {
	const store = createStore(storage);
	const scores = createHighscores(store);
	return { game: new VenezuelaGame({ scores: () => scores, store: () => store }), scores, storage };
}

function run(game: VenezuelaGame, steps: number) {
	for (let i = 0; i < steps; i++) game.update(STEP_MS);
}

/** Puts the player on the flag of the open level and steps once */
function finish(game: VenezuelaGame) {
	const box = flagBox(game.world.level);
	game.world.player.x = box.x;
	game.world.player.y = game.world.level.goal.y + 1 - game.world.player.h;
	game.update(STEP_MS);
}

describe('VenezuelaGame', () => {
	it('starts on the level select with only the first level open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.isUnlocked(0)).toBe(true);
		expect(game.isUnlocked(1)).toBe(false);
	});

	it('does not open a locked level', () => {
		const { game } = newGame();
		game.openLevel(1);
		expect(game.screen).toBe('select');
	});

	it('opens a level on the ready screen and only runs after start', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.screen).toBe('play');
		expect(game.status).toBe('ready');
		const time = game.world.time;
		run(game, 10);
		expect(game.world.time).toBe(time);
		game.start();
		run(game, 10);
		expect(game.status).toBe('playing');
		expect(game.world.time).toBeGreaterThan(time);
	});

	it('runs the player with held input and jumps', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 5);
		const x = game.world.player.x;
		game.setHeld('key:ArrowRight', 'right', true);
		run(game, 30);
		expect(game.world.player.x).toBeGreaterThan(x + 1);
		game.setHeld('key:Space', 'jump', true);
		run(game, 4);
		expect(game.world.player.onGround).toBe(false);
	});

	it('ignores presses while not playing and lets go when it pauses', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.setHeld('key:ArrowRight', 'right', true);
		expect(game.input.isDown('right')).toBe(false);
		game.start();
		game.setHeld('key:ArrowRight', 'right', true);
		game.pause();
		expect(game.status).toBe('paused');
		expect(game.input.isDown('right')).toBe(false);
	});

	it('freezes while paused and continues after resume', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		game.pause();
		const time = game.world.time;
		run(game, 20);
		expect(game.world.time).toBe(time);
		game.resume();
		run(game, 5);
		expect(game.world.time).toBeGreaterThan(time);
	});

	it('wins at the flag: stars, progress, unlock, high score', () => {
		const { game, scores, storage } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		finish(game);
		expect(game.status).toBe('won');
		expect(game.stars).toBeGreaterThanOrEqual(1);
		expect(game.score).toBeGreaterThan(0);
		expect(game.isNewBest).toBe(true);
		expect(game.starsFor(LEVEL_IDS[0])).toBe(game.stars);
		expect(game.isUnlocked(1)).toBe(true);
		expect(scores.get(highscoreParts(LEVEL_IDS[0]))).toBe(game.score);
		// The progress survives a reload
		const { game: again } = newGame(storage);
		again.load();
		expect(again.isUnlocked(1)).toBe(true);
	});

	it('goes on to the next level', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		finish(game);
		game.nextLevel();
		expect(game.levelIndex).toBe(1);
		expect(game.status).toBe('ready');
	});

	it('loses when the last heart is gone and offers a retry', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		game.world.hearts = 1;
		game.world.player.y = game.world.level.height + 2;
		game.update(STEP_MS);
		expect(game.hearts).toBe(0);
		expect(game.status).toBe('over');
		game.retry();
		expect(game.status).toBe('playing');
		expect(game.hearts).toBe(STARTING_HEARTS);
		expect(game.score).toBe(0);
	});

	it('counts hurt hits for the red flash and loses a heart for a pit', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		game.world.player.y = game.world.level.height + 2;
		game.update(STEP_MS);
		expect(game.hearts).toBe(STARTING_HEARTS - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.effects.length).toBeGreaterThan(0);
	});

	it('ages out effects', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		game.world.player.y = game.world.level.height + 2;
		game.update(STEP_MS);
		expect(game.effects.length).toBeGreaterThan(0);
		run(game, 120);
		expect(game.effects).toHaveLength(0);
	});

	it('shows more of the level on a wide screen', () => {
		const narrow = newGame().game;
		narrow.openLevel(0);
		const wide = newGame().game;
		wide.setView(20);
		wide.openLevel(0);
		expect(wide.sceneExtras().viewW).toBe(20);
		expect(narrow.sceneExtras().viewW).toBe(VIEW_W);
		// Following the player, the wide view starts further left, to keep them in the middle
		for (const game of [narrow, wide]) {
			game.start();
			game.world.player.x = 40;
			game.camX = 0;
			run(game, 240);
		}
		expect(wide.camX).toBeLessThan(narrow.camX);
	});

	it('pops a booster out of a bumped block and shows its timer', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		const block = game.world.blocks[0];
		expect(game.boosts.turbo).toBe(0);
		game.world.player.x = block.x + 0.5 - game.world.player.w / 2;
		game.world.player.y = block.y + 1.05;
		game.world.player.vy = -4;
		game.world.player.onGround = false;
		run(game, 6);
		expect(block).toMatchObject({ used: true });
		expect(game.boosts.turbo).toBeGreaterThan(0);
		expect(game.effects.some((effect) => effect.kind === 'item')).toBe(true);
		run(game, 60 * 9);
		expect(game.boosts.turbo).toBe(0);
	});

	it('goes back to the select screen', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.backToSelect();
		expect(game.screen).toBe('select');
	});
});

describe('El Presidente messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['venezuela_', 'mode_venezuela_'])).toEqual([]);
	});

	it('include a name for every level', () => {
		expect(LEVEL_NAMES.length).toBeGreaterThanOrEqual(LEVEL_IDS.length);
	});
});

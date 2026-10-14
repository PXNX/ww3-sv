import { describe, expect, it } from 'vitest';
import { LEVEL_NAMES } from '#lib/components/gpsliarText.js';
import { STARTING_HEARTS, STEP } from '#lib/game/gpsliar/config.js';
import { LEVEL_IDS } from '#lib/game/gpsliar/levels.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import {
	hasPersianScript,
	loadMessages,
	messageParameters,
	missingMessages,
	locales
} from '#lib/testing/messages.js';
import { GpsLiarGame, highscoreParts } from './gpsliarGame.svelte';

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
	return { game: new GpsLiarGame({ scores: () => scores, store: () => store }), scores, storage };
}

function run(game: GpsLiarGame, steps: number) {
	for (let i = 0; i < steps; i++) game.update(STEP_MS);
}

/** Puts the boat on the next harbour and steps once */
function deliverNext(game: GpsLiarGame) {
	const stop = game.state.level.stops[game.state.delivered];
	game.state.pos = { x: stop.x, y: stop.y };
	game.update(STEP_MS);
}

/** Puts the boat on a rock and steps once */
function crash(game: GpsLiarGame) {
	const rock = game.state.level.rocks[0];
	game.state.pos = { x: rock.x, y: rock.y + 0.5 };
	game.update(STEP_MS);
}

describe('GpsLiarGame', () => {
	it('starts on the level select with only the first level open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.isUnlocked(0)).toBe(true);
		expect(game.isUnlocked(1)).toBe(false);
		expect(game.levelCount).toBe(12);
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
		expect(game.stopsTotal).toBe(1);
		expect(game.crossChecksLeft).toBe(3);
		expect(game.nextCargo).not.toBeNull();
		run(game, 10);
		expect(game.state.time).toBe(0);
		game.start();
		run(game, 10);
		expect(game.status).toBe('playing');
		expect(game.state.time).toBeGreaterThan(0);
	});

	it('steers with the keys and lets go when it pauses', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.setKey('ArrowUp', true);
		expect(game.state.steer).toEqual({ x: 0, y: 0 });
		game.start();
		const y = game.state.pos.y;
		game.setKey('ArrowUp', true);
		run(game, 30);
		expect(game.state.pos.y).toBeLessThan(y - 0.3);
		game.pause();
		expect(game.status).toBe('paused');
		expect(game.state.steer).toEqual({ x: 0, y: 0 });
	});

	it('steers toward a pointer and the keys win over it', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		game.setPointer({ x: 3, y: 0 });
		expect(game.state.steer.x).toBeCloseTo(1);
		game.setKey('ArrowDown', true);
		run(game, 1);
		expect(game.state.steer).toEqual({ x: 0, y: 1 });
		game.setKey('ArrowDown', false);
		game.setPointer(null);
		expect(game.state.steer).toEqual({ x: 0, y: 0 });
	});

	it('freezes while paused and continues after resume', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		game.pause();
		const time = game.state.time;
		run(game, 20);
		expect(game.state.time).toBe(time);
		game.resume();
		run(game, 5);
		expect(game.state.time).toBeGreaterThan(time);
	});

	it('cross-checks: uses a check, reveals the truth and shows a popup', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.crossCheck();
		expect(game.crossChecksLeft).toBe(3);
		game.start();
		game.crossCheck();
		expect(game.crossChecksLeft).toBe(2);
		expect(game.crossChecksUsed).toBe(1);
		expect(game.revealing).toBe(true);
		expect(game.effects.length).toBeGreaterThan(0);
		run(game, 200);
		expect(game.revealing).toBe(false);
	});

	it('wins at the last harbour: stars, progress, unlock, high score', () => {
		const { game, scores, storage } = newGame();
		game.openLevel(0);
		game.start();
		run(game, 3);
		deliverNext(game);
		expect(game.status).toBe('won');
		expect(game.delivered).toBe(1);
		expect(game.stars).toBe(3);
		expect(game.score).toBeGreaterThan(0);
		expect(game.isNewBest).toBe(true);
		expect(game.starsFor(LEVEL_IDS[0])).toBe(3);
		expect(game.isUnlocked(1)).toBe(true);
		expect(scores.get(highscoreParts(LEVEL_IDS[0]))).toBe(game.score);
		// The progress survives a reload
		const { game: again } = newGame(storage);
		again.load();
		expect(again.isUnlocked(1)).toBe(true);
		expect(again.starsFor(LEVEL_IDS[0])).toBe(3);
	});

	it('gives fewer stars after a cross-check', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		game.crossCheck();
		deliverNext(game);
		expect(game.status).toBe('won');
		expect(game.stars).toBe(2);
	});

	it('goes on to the next level', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		deliverNext(game);
		game.nextLevel();
		expect(game.levelIndex).toBe(1);
		expect(game.status).toBe('ready');
		expect(game.hasNextLevel).toBe(true);
	});

	it('counts hits for the red flash and shows effects, which age out', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		crash(game);
		expect(game.hearts).toBe(STARTING_HEARTS - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.effects.length).toBeGreaterThan(0);
		expect(game.sceneExtras().shake).toBeGreaterThan(0);
		run(game, 120);
		expect(game.effects).toHaveLength(0);
		expect(game.sceneExtras().shake).toBe(0);
	});

	it('does not shake the view with reduced motion', () => {
		const store = createStore(memoryStorage());
		const scores = createHighscores(store);
		const game = new GpsLiarGame({
			reducedMotion: true,
			scores: () => scores,
			store: () => store
		});
		game.openLevel(0);
		game.start();
		crash(game);
		expect(game.sceneExtras().shake).toBe(0);
	});

	it('loses when the last heart is gone and offers a retry', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.start();
		game.state.hearts = 1;
		crash(game);
		expect(game.hearts).toBe(0);
		expect(game.status).toBe('over');
		game.retry();
		expect(game.status).toBe('playing');
		expect(game.hearts).toBe(STARTING_HEARTS);
		expect(game.score).toBe(0);
		expect(game.hurtCount).toBe(0);
	});

	it('goes back to the select screen', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.backToSelect();
		expect(game.screen).toBe('select');
	});

	it('draws the final chart onto the score card', () => {
		const { game } = newGame();
		game.openLevel(0);
		const calls: string[] = [];
		const context = new Proxy(
			{},
			{
				get: (_target, name: string) => {
					if (name === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
					return () => void calls.push(name);
				},
				set: () => true
			}
		) as unknown as CanvasRenderingContext2D;
		game.drawBoard(context, 0, 0, 300);
		expect(calls).toContain('clip');
	});
});

describe('GPS Liar messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['gpsliar_', 'mode_gpsliar_'])).toEqual([]);
	});

	it('include a name for every level', () => {
		expect(LEVEL_NAMES).toHaveLength(LEVEL_IDS.length);
	});

	it('keep the same placeholders in every language', () => {
		const base = loadMessages('en');
		for (const locale of locales) {
			const messages = loadMessages(locale);
			for (const key of Object.keys(base).filter((name) => name.includes('gpsliar'))) {
				expect(messageParameters(messages[key]), `${locale}:${key}`).toEqual(
					messageParameters(base[key])
				);
			}
		}
	});

	it('are really translated into Persian', () => {
		const fa = loadMessages('fa');
		for (const key of ['mode_gpsliar_name', 'gpsliar_tutorial_goal', 'gpsliar_cameo_message']) {
			expect(hasPersianScript(fa[key]), key).toBe(true);
		}
	});
});

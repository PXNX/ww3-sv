import { describe, expect, it } from 'vitest';
import { LEVEL_NAMES } from '#lib/components/mapleText.js';
import { STARTING_HEARTS } from '#lib/game/maple/config.js';
import type { Dir } from '#lib/game/maple/level.js';
import { LEVEL_IDS } from '#lib/game/maple/levels.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import {
	hasPersianScript,
	loadMessages,
	messageParameters,
	missingMessages,
	locales
} from '#lib/testing/messages.js';
import { MapleGame, highscoreParts } from './mapleGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame(storage = memoryStorage()) {
	const store = createStore(storage);
	const scores = createHighscores(store);
	return { game: new MapleGame({ scores: () => scores, store: () => store }), scores, storage };
}

const LETTERS: Record<string, Dir | 'wait'> = {
	u: 'up',
	d: 'down',
	l: 'left',
	r: 'right',
	'.': 'wait'
};

/** Plays a route written as letters: u d l r, and a dot for a tick of waiting */
function play(game: MapleGame, route: string) {
	for (const letter of route) {
		const action = LETTERS[letter];
		if (action === 'wait') game.waitTick();
		else game.step(action);
	}
}

/** Clean runs found by the solver for the first two levels */
const LEVEL_1_RUN = 'dduurrrrrr';

describe('MapleGame', () => {
	it('starts on the level select with only the first level open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.isUnlocked(0)).toBe(true);
		expect(game.isUnlocked(1)).toBe(false);
		expect(game.levelCount).toBe(10);
	});

	it('does not open a locked level', () => {
		const { game } = newGame();
		game.openLevel(1);
		expect(game.screen).toBe('select');
		game.openLevel(-1);
		expect(game.screen).toBe('select');
	});

	it('opens a level with fresh numbers', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.screen).toBe('play');
		expect(game.status).toBe('playing');
		expect(game.hearts).toBe(STARTING_HEARTS);
		expect(game.maxHearts).toBe(STARTING_HEARTS);
		expect(game.moves).toBe(0);
		expect(game.totalBarrels).toBe(2);
		expect(game.quota).toBe(1);
		expect(game.par).toBeGreaterThan(0);
		expect(game.inTow).toBe(0);
		expect(game.score).toBe(0);
		expect(game.message).toBe('');
	});

	it('moves the cart and reacts to every step', () => {
		const { game } = newGame();
		game.openLevel(0);
		const before = game.state;
		game.step('down');
		expect(game.moves).toBe(1);
		expect(game.state).not.toBe(before);
		expect(game.state.cart[0]).toEqual({ row: 2, col: 1 });
		// A shelf is in the way: no tick
		game.step('left');
		expect(game.moves).toBe(1);
		game.waitTick();
		expect(game.moves).toBe(2);
	});

	it('announces a pickup and counts the barrels in tow', () => {
		const { game } = newGame();
		game.openLevel(0);
		play(game, 'dd');
		expect(game.inTow).toBe(1);
		expect(game.message).not.toBe('');
		expect(game.heavy).toBe(false);
	});

	it('ignores input on the select screen and after the level ended', () => {
		const { game } = newGame();
		game.step('down');
		expect(game.moves).toBe(0);
		game.openLevel(0);
		play(game, LEVEL_1_RUN);
		expect(game.status).toBe('won');
		const moves = game.moves;
		game.step('left');
		game.waitTick();
		expect(game.moves).toBe(moves);
	});

	it('wins a level: stars, progress, unlock, high score', () => {
		const { game, scores, storage } = newGame();
		game.openLevel(0);
		play(game, LEVEL_1_RUN);
		expect(game.status).toBe('won');
		expect(game.delivered).toBe(2);
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
		expect(again.bestFor(LEVEL_IDS[0])).toBe(game.score);
	});

	it('goes on to the next level, and retries the current one', () => {
		const { game } = newGame();
		game.openLevel(0);
		play(game, LEVEL_1_RUN);
		game.nextLevel();
		expect(game.levelIndex).toBe(1);
		expect(game.status).toBe('playing');
		expect(game.hasNextLevel).toBe(true);
		game.step('right');
		game.retry();
		expect(game.levelIndex).toBe(1);
		expect(game.moves).toBe(0);
		expect(game.best).toBeNull();
	});

	it('loses a heart when a moose spots the cart', () => {
		const { game } = newGame();
		game.openLevel(0);
		play(game, LEVEL_1_RUN);
		game.nextLevel();
		// Park the cart a few cells ahead of the moose, in its lane
		game.state.cart = [{ row: 3, col: 3 }];
		game.waitTick();
		expect(game.hearts).toBe(STARTING_HEARTS - 1);
		expect(game.spotted).toBe(1);
		expect(game.hurtCount).toBe(1);
		expect(game.message).not.toBe('');
		expect(game.state.cart).toEqual([game.state.level.start]);
		expect(game.state.caught).toBe(0);
	});

	it('loses when the last heart is gone, and offers a retry', () => {
		const { game, scores } = newGame();
		game.openLevel(0);
		play(game, LEVEL_1_RUN);
		game.nextLevel();
		game.state.hearts = 1;
		game.state.delivered = 1;
		game.state.cart = [{ row: 3, col: 3 }];
		game.waitTick();
		expect(game.hearts).toBe(0);
		expect(game.status).toBe('over');
		expect(scores.get(highscoreParts(LEVEL_IDS[1]))).toBe(game.score);
		const moves = game.moves;
		game.step('up');
		expect(game.moves).toBe(moves);
		game.retry();
		expect(game.status).toBe('playing');
		expect(game.hearts).toBe(STARTING_HEARTS);
		expect(game.hurtCount).toBe(0);
	});

	it('goes back to the select screen', () => {
		const { game } = newGame();
		game.openLevel(0);
		game.backToSelect();
		expect(game.screen).toBe('select');
	});

	it('draws the warehouse onto the score card', () => {
		const { game } = newGame();
		game.openLevel(0);
		const calls: string[] = [];
		const context = new Proxy(
			{},
			{
				get: (_target, name: string) => () => void calls.push(name),
				set: () => true
			}
		) as unknown as CanvasRenderingContext2D;
		game.drawBoard(context, 0, 0, 300);
		expect(calls).toContain('fillRect');
	});
});

describe('Maple Reserve Heist messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['maple_', 'mode_maple_'])).toEqual([]);
	});

	it('include a name for every level', () => {
		expect(LEVEL_NAMES).toHaveLength(LEVEL_IDS.length);
	});

	it('keep the same placeholders in every language', () => {
		const base = loadMessages('en');
		for (const locale of locales) {
			const messages = loadMessages(locale);
			for (const key of Object.keys(base).filter((name) => name.includes('maple'))) {
				expect(messageParameters(messages[key]), `${locale}:${key}`).toEqual(
					messageParameters(base[key])
				);
			}
		}
	});

	it('are really translated into Persian', () => {
		const fa = loadMessages('fa');
		for (const key of ['mode_maple_name', 'maple_tutorial_goal', 'maple_cameo_message']) {
			expect(hasPersianScript(fa[key]), key).toBe(true);
		}
	});
});

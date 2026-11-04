import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTING_LIVES, TOTAL_ROUNDS } from '#lib/game/shuffle/config.js';
import { createRandom } from '#lib/game/random.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { SHUFFLE_BEST_KEY, ShuffleGame } from './shuffleGame.svelte';

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
	return { game: new ShuffleGame({ scores, random: createRandom(11) }), scores };
}

/** Runs the round until the player may pick */
function untilGuessing(game: ShuffleGame) {
	for (let i = 0; i < 400 && game.phase !== 'guessing'; i++) vi.advanceTimersByTime(50);
	expect(game.phase).toBe('guessing');
}

function pickTanker(game: ShuffleGame) {
	untilGuessing(game);
	game.pick(game.tankerId);
}

function pickWrong(game: ShuffleGame) {
	untilGuessing(game);
	game.pick(game.ships.find((ship) => ship.id !== game.tankerId)!.id);
}

describe('shuffle game', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('waits idle until it is started, then marks the tanker', () => {
		const { game } = newGame();
		expect(game.phase).toBe('idle');
		game.start();
		expect(game.phase).toBe('reveal');
		expect(game.covered).toBe(false);
		expect(game.ships).toHaveLength(3);
		expect(game.lives).toBe(STARTING_LIVES);
		vi.advanceTimersByTime(game.config.revealMs);
		expect(game.phase).toBe('cover');
		expect(game.covered).toBe(true);
	});

	it('moves ships during the shuffle and keeps every slot filled once', () => {
		const { game } = newGame();
		game.start();
		let saw = false;
		for (let i = 0; i < 400 && game.phase !== 'guessing'; i++) {
			vi.advanceTimersByTime(25);
			if (game.move) saw = true;
		}
		expect(saw).toBe(true);
		expect(game.ships.map((s) => s.slot).sort()).toEqual([0, 1, 2]);
		expect(game.ships.some((s) => s.dark)).toBe(false);
	});

	it('scores a catch, builds a streak and starts the next round', () => {
		const { game } = newGame();
		game.start();
		pickTanker(game);
		expect(game.phase).toBe('correct');
		expect(game.score).toBeGreaterThanOrEqual(100);
		expect(game.streak).toBe(1);
		expect(game.lifted).toEqual([game.tankerId]);
		vi.advanceTimersByTime(2000);
		expect(game.round).toBe(2);
		expect(game.phase).toBe('reveal');
		pickTanker(game);
		expect(game.streak).toBe(2);
		expect(game.bestStreak).toBe(2);
		expect(game.multiplier).toBe(1.5);
	});

	it('ignores picks outside the guessing phase', () => {
		const { game } = newGame();
		game.start();
		game.pick(0);
		expect(game.phase).toBe('reveal');
		expect(game.score).toBe(0);
	});

	it('costs a life, the streak and some points for a miss, then replays the round', () => {
		const { game } = newGame();
		game.start();
		pickTanker(game);
		vi.advanceTimersByTime(2000);
		const before = game.score;
		pickWrong(game);
		expect(game.phase).toBe('wrong');
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.streak).toBe(0);
		expect(game.score).toBeLessThan(before);
		vi.advanceTimersByTime(800);
		expect(game.lifted).toContain(game.tankerId);
		vi.advanceTimersByTime(2000);
		expect(game.phase).toBe('reveal');
		expect(game.round).toBe(2);
		expect(game.attempt).toBe(2);
	});

	it('never lets the score go negative', () => {
		const { game } = newGame();
		game.start();
		pickWrong(game);
		expect(game.score).toBe(0);
	});

	it('ends the run when the lives are gone and saves the best', () => {
		const { game, scores } = newGame();
		game.start();
		pickTanker(game);
		vi.advanceTimersByTime(2000);
		for (let i = 0; i < STARTING_LIVES; i++) {
			pickWrong(game);
			vi.advanceTimersByTime(3000);
		}
		expect(game.phase).toBe('over');
		expect(game.won).toBe(false);
		expect(game.best).toBe(scores.get(SHUFFLE_BEST_KEY));
		expect(game.stars).toBe(0);
	});

	it('wins after the last round with a bonus for lives left', () => {
		const { game } = newGame();
		game.start();
		for (let round = 1; round <= TOTAL_ROUNDS; round++) {
			pickTanker(game);
			vi.advanceTimersByTime(2000);
		}
		expect(game.phase).toBe('over');
		expect(game.won).toBe(true);
		expect(game.roundsCleared).toBe(TOTAL_ROUNDS);
		expect(game.stars).toBe(3);
		expect(game.isNewBest).toBe(true);
		expect(game.score).toBeGreaterThan(750);
	});

	it('spends a satellite ping once per round for half pay', () => {
		const { game } = newGame();
		game.start();
		expect(game.ping()).toBe(false);
		untilGuessing(game);
		expect(game.ping()).toBe(true);
		expect(game.pings).toBe(0);
		expect(game.pingShip).toBe(game.tankerId);
		expect(game.ping()).toBe(false);
		game.pick(game.tankerId);
		expect(game.score).toBeLessThanOrEqual(75);
	});

	it('earns a ping back every fourth catch in a row', () => {
		const { game } = newGame();
		game.start();
		untilGuessing(game);
		game.ping();
		game.pick(game.tankerId);
		vi.advanceTimersByTime(2000);
		for (let i = 0; i < 3; i++) {
			pickTanker(game);
			vi.advanceTimersByTime(2000);
		}
		expect(game.streak).toBe(4);
		expect(game.pings).toBe(1);
	});

	it('forfeits a running game as a loss', () => {
		const { game } = newGame();
		game.start();
		game.forfeit();
		expect(game.phase).toBe('over');
		expect(game.won).toBe(false);
		vi.advanceTimersByTime(10000);
		expect(game.phase).toBe('over');
	});

	it('picks by slot', () => {
		const { game } = newGame();
		game.start();
		untilGuessing(game);
		game.pickSlot(game.ships.find((s) => s.id === game.tankerId)!.slot);
		expect(game.phase).toBe('correct');
	});
});

describe('shuffle messages', () => {
	it('has every key in every language', () => {
		expect(missingMessages(['shuffle_', 'mode_shuffle_'])).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { LEVELS } from '#lib/game/parking/levels.js';
import { solve } from '#lib/game/parking/solver.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { ParkingGame, highscoreParts } from './parkingGame.svelte';

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
	const game = new ParkingGame({ scores: createHighscores(store), storage: store });
	game.load();
	return { game, storage };
}

/** Plays the optimal solution of the open level through the store */
function playSolution(game: ParkingGame) {
	const solution = solve(game.puzzle);
	expect(solution).not.toBeNull();
	for (const step of solution?.path ?? []) {
		expect(game.move(step.piece, step.to)).toBe(true);
	}
}

describe('ParkingGame', () => {
	it('starts on the level select with only the first level open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.isUnlocked(0)).toBe(true);
		expect(game.isUnlocked(1)).toBe(false);
		game.openLevel(1);
		expect(game.screen).toBe('select');
	});

	it('opens a level with the moves at zero and nothing solved', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.screen).toBe('play');
		expect(game.moves).toBe(0);
		expect(game.won).toBe(false);
		expect(game.positions).toEqual(game.puzzle.start);
		expect(game.par).toBe(LEVELS[0].par);
	});

	it('counts one move per slide, however far it goes', () => {
		const { game } = newGame();
		game.openLevel(0);
		const solution = solve(game.puzzle);
		const first = solution?.path[0];
		expect(first).toBeDefined();
		if (!first) return;
		expect(game.move(first.piece, first.to)).toBe(true);
		expect(game.moves).toBe(1);
		expect(game.isAtStart).toBe(false);
	});

	it('refuses moves that jump over ships, leave the board or do not move', () => {
		const { game } = newGame();
		game.openLevel(0);
		const tankerRange = game.rangeOf(0);
		const start = game.positions[0];
		expect(game.move(0, start)).toBe(false);
		expect(game.move(0, tankerRange.max + 1)).toBe(false);
		expect(game.move(0, tankerRange.min - 1)).toBe(false);
		expect(game.move(0, start + 0.5)).toBe(false);
		expect(game.move(99, 0)).toBe(false);
		expect(game.moves).toBe(0);
		expect(game.positions).toEqual(game.puzzle.start);
	});

	it('undo takes a move back and off the counter', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.undo()).toBe(false);
		const first = solve(game.puzzle)?.path[0];
		if (!first) throw new Error('level 1 has no solution');
		game.move(first.piece, first.to);
		expect(game.undo()).toBe(true);
		expect(game.moves).toBe(0);
		expect(game.positions).toEqual(game.puzzle.start);
	});

	it('wins when the tanker reaches the exit and rates the level by par', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		expect(game.won).toBe(true);
		expect(game.moves).toBe(game.par);
		expect(game.stars).toBe(3);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(game.par);
		expect(game.starsFor(LEVELS[0].id)).toBe(3);
	});

	it('locks the board after a win and unlocks the next level', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		expect(game.move(0, 0)).toBe(false);
		expect(game.undo()).toBe(false);
		expect(game.isUnlocked(1)).toBe(true);
		game.nextLevel();
		expect(game.levelIndex).toBe(1);
		expect(game.won).toBe(false);
		expect(game.moves).toBe(0);
	});

	it('clears the win state when going back to the level select', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		expect(game.won).toBe(true);
		game.backToSelect();
		expect(game.screen).toBe('select');
		expect(game.won).toBe(false);
		expect(game.isUnlocked(1)).toBe(true);
	});

	it('gives fewer stars for a wasteful solution and keeps the better one', () => {
		const { game } = newGame();
		game.openLevel(0);
		// Waste moves first: slide a ship away and back, then solve from there
		const wiggle = solve(game.puzzle)?.path[0];
		if (!wiggle) throw new Error('level 1 has no solution');
		const home = game.positions[wiggle.piece];
		game.move(wiggle.piece, wiggle.to);
		game.move(wiggle.piece, home);
		game.move(wiggle.piece, wiggle.to);
		game.move(wiggle.piece, home);
		const rest = solve(game.puzzle);
		for (const step of rest?.path ?? []) game.move(step.piece, step.to);
		expect(game.won).toBe(true);
		expect(game.stars).toBeLessThan(3);
		const first = game.stars;

		game.retry();
		playSolution(game);
		expect(game.stars).toBe(3);
		expect(game.progress.stars[LEVELS[0].id]).toBe(3);
		expect(first).toBeLessThan(3);
	});

	it('remembers the fewest moves and the stars across sessions', () => {
		const first = newGame();
		first.game.openLevel(0);
		playSolution(first.game);

		const second = newGame(first.storage);
		expect(second.game.starsFor(LEVELS[0].id)).toBe(3);
		expect(second.game.bestFor(LEVELS[0].id)).toBe(LEVELS[0].par);
		expect(second.game.isUnlocked(1)).toBe(true);
		expect(highscoreParts(LEVELS[0].id)).toEqual(['parking', LEVELS[0].id, 'moves']);
	});

	it('does not offer a next level after the last one', () => {
		const { game } = newGame();
		game.levelIndex = LEVELS.length - 1;
		expect(game.hasNext).toBe(false);
		game.nextLevel();
		expect(game.levelIndex).toBe(LEVELS.length - 1);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['parking_', 'mode_parking_'])).toEqual([]);
	});
});

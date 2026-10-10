import { describe, expect, it } from 'vitest';
import { SIZE_IDS } from '#lib/game/maze/difficulty.js';
import { solve } from '#lib/game/maze/solver.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { MazeGame, highscoreParts } from './mazeGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame(storage = memoryStorage()) {
	const game = new MazeGame({ scores: createHighscores(createStore(storage)), newSeed: () => 7 });
	return { game, storage };
}

function playSolution(game: MazeGame) {
	for (const direction of solve(game.maze)!) game.move(direction);
}

describe('MazeGame', () => {
	it('starts on the size picker', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.move('right')).toBeNull();
	});

	it('opens a maze with no steps, a par and fog', () => {
		const { game } = newGame();
		game.start('medium');
		expect(game.screen).toBe('play');
		expect(game.size).toBe('medium');
		expect(game.steps).toBe(0);
		expect(game.won).toBe(false);
		expect(game.par).toBe(solve(game.maze)!.length);
		expect(game.seen.filter(Boolean).length).toBeLessThan(game.maze.width * game.maze.height);
		expect(game.needed.length).toBe(3);
	});

	it('gives every run its own maze, and the same seed the same maze', () => {
		const seeds = [1, 2, 3];
		const mazes = seeds.map((seed) => {
			const { game } = newGame();
			game.start('large', seed);
			return JSON.stringify(game.maze.doors);
		});
		expect(new Set(mazes).size).toBe(3);
		const first = newGame().game;
		first.start('large', 2);
		expect(JSON.stringify(first.maze.doors)).toBe(mazes[1]);
	});

	it('counts bumps as steps but plain walls as nothing', () => {
		const { game } = newGame();
		game.start('small', 11);
		const before = game.steps;
		// Find a direction that is a wall from the start room
		const wall = (['up', 'right', 'down', 'left'] as const).find(
			(direction, index) => game.maze.doors[game.maze.start][index] === null && direction
		)!;
		expect(game.move(wall)).toBe('wall');
		expect(game.steps).toBe(before);
		expect(game.notice).toEqual({ kind: 'wall' });
	});

	it('is won by the shortest way, with three stars and a stored best', () => {
		const { game } = newGame();
		game.start('small', 5);
		playSolution(game);
		expect(game.won).toBe(true);
		expect(game.steps).toBe(game.par);
		expect(game.stars).toBe(3);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(game.par);
		expect(game.bestFor('small')).toBe(game.par);
		expect(game.bestFor('large')).toBeNull();
		expect(game.move('up')).toBeNull();
	});

	it('keeps the best (fewest) steps per size', () => {
		const { game } = newGame();
		game.start('small', 5);
		playSolution(game);
		const best = game.steps;
		// A longer second run, one step out and back first, is no new best
		game.restart();
		const back = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
		const [first] = solve(game.maze)!;
		game.move(first);
		game.move(back[first]);
		playSolution(game);
		expect(game.won).toBe(true);
		expect(game.steps).toBeGreaterThan(best);
		expect(game.isNewBest).toBe(false);
		expect(game.bestFor('small')).toBe(best);
	});

	it('restarts the same maze and starts a new one on request', () => {
		const { game } = newGame();
		game.start('small', 5);
		const doors = game.maze.doors;
		game.move(solve(game.maze)![0]);
		game.restart();
		expect(game.steps).toBe(0);
		expect(game.maze.doors).toBe(doors);
		game.again();
		expect(game.screen).toBe('play');
		expect(game.steps).toBe(0);
	});

	it('announces pickups', () => {
		const { game } = newGame();
		game.start('small', 5);
		let announced = false;
		for (const direction of solve(game.maze)!) {
			game.move(direction);
			if (game.notice?.kind === 'pickup') announced = true;
		}
		expect(announced).toBe(true);
		expect(game.collected.length).toBe(game.needed.length);
	});

	it('keys its best by size', () => {
		for (const size of SIZE_IDS) expect(highscoreParts(size)).toEqual(['maze', size, 'steps']);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['maze_', 'mode_maze_'])).toEqual([]);
	});
});

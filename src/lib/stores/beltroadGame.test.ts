import { describe, expect, it } from 'vitest';
import { debtFor, solutionPaths, type Cell } from '#lib/game/beltroad/board.js';
import { LEVELS } from '#lib/game/beltroad/levels.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { BeltRoadGame, highscoreParts } from './beltroadGame.svelte';

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
	const game = new BeltRoadGame({ scores: createHighscores(store), storage: store });
	game.load();
	return { game, storage };
}

/** One stroke along a route, cell by cell like a pointer that visits every cell */
function stroke(game: BeltRoadGame, cells: readonly Cell[]) {
	expect(game.beginStroke(cells[0])).toBe(true);
	for (const cell of cells.slice(1)) game.dragTo(cell);
	game.endStroke();
}

/** Draws the stored solution of the open level, one stroke per route */
function playSolution(game: BeltRoadGame) {
	for (const route of solutionPaths(game.level)) stroke(game, route);
}

describe('BeltRoadGame', () => {
	it('starts on the level select with only the first level open', () => {
		const { game } = newGame();
		expect(game.screen).toBe('select');
		expect(game.isUnlocked(0)).toBe(true);
		expect(game.isUnlocked(1)).toBe(false);
		game.openLevel(1);
		expect(game.screen).toBe('select');
	});

	it('opens a level blank, with no moves and no debt', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.screen).toBe('play');
		expect(game.moves).toBe(0);
		expect(game.debt).toBe(0);
		expect(game.won).toBe(false);
		expect(game.isBlank).toBe(true);
		expect(game.covered).toBe(0);
		expect(game.cells).toBe(game.level.width * game.level.height);
		expect(game.par).toBe(game.level.pairs.length);
	});

	it('counts one move per stroke and raises the debt with it', () => {
		const { game } = newGame();
		game.openLevel(0);
		const [first] = solutionPaths(game.level);
		stroke(game, first);
		expect(game.moves).toBe(1);
		expect(game.debt).toBe(debtFor(1));
		expect(game.connected(0)).toBe(true);
		expect(game.connectedCount).toBe(1);
		expect(game.covered).toBe(first.length);
		expect(game.isBlank).toBe(false);
	});

	it('does not count a press that changes nothing', () => {
		const { game } = newGame();
		game.openLevel(0);
		// Press an empty cell: no stroke at all
		const empty = game.level.pairs.flatMap((pair) => [pair.a, pair.b]);
		const free = [0, 1, 2, 3]
			.flatMap((row) => [0, 1, 2, 3].map((col): Cell => [row, col]))
			.find((cell) => !empty.some((port) => port[0] === cell[0] && port[1] === cell[1]));
		if (!free) throw new Error('no free cell');
		expect(game.beginStroke(free)).toBe(false);
		// Press a port that has no route yet and let go: the route is just the port again
		expect(game.beginStroke(game.level.pairs[0].a)).toBe(true);
		game.endStroke();
		expect(game.moves).toBe(0);
		expect(game.activePair).toBeNull();
	});

	it('shows the route while drawing and undoes it when the stroke is cancelled', () => {
		const { game } = newGame();
		game.openLevel(0);
		const [route] = solutionPaths(game.level);
		game.beginStroke(route[0]);
		game.dragTo(route[1]);
		expect(game.activePair).toBe(0);
		expect(game.paths[0]).toHaveLength(2);
		game.cancelStroke();
		expect(game.activePair).toBeNull();
		expect(game.paths[0]).toHaveLength(0);
		expect(game.moves).toBe(0);
	});

	it('retracts a route dragged back over itself within one move', () => {
		const { game } = newGame();
		game.openLevel(0);
		const [route] = solutionPaths(game.level);
		game.beginStroke(route[0]);
		game.dragTo(route[2]);
		expect(game.paths[0]).toHaveLength(3);
		game.dragTo(route[1]);
		expect(game.paths[0]).toHaveLength(2);
		game.endStroke();
		expect(game.moves).toBe(1);
	});

	it('pressing a drawn route cuts it back to that cell, which is one move', () => {
		const { game } = newGame();
		game.openLevel(0);
		const [route] = solutionPaths(game.level);
		stroke(game, route);
		expect(game.connected(0)).toBe(true);
		expect(game.beginStroke(route[1])).toBe(true);
		game.endStroke();
		expect(game.paths[0]).toEqual(route.slice(0, 2));
		expect(game.connected(0)).toBe(false);
		expect(game.moves).toBe(2);
	});

	it('undo takes a move back and off the counter and the debt', () => {
		const { game } = newGame();
		game.openLevel(0);
		expect(game.undo()).toBe(false);
		stroke(game, solutionPaths(game.level)[0]);
		stroke(game, solutionPaths(game.level)[1]);
		expect(game.moves).toBe(2);
		expect(game.undo()).toBe(true);
		expect(game.moves).toBe(1);
		expect(game.debt).toBe(debtFor(1));
		expect(game.connected(1)).toBe(false);
		expect(game.connected(0)).toBe(true);
	});

	it('wins when the grid is full and every pair joined, and rates the level by moves', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		expect(game.won).toBe(true);
		expect(game.covered).toBe(game.cells);
		expect(game.moves).toBe(game.par);
		expect(game.stars).toBe(3);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(game.par);
		expect(game.starsFor(LEVELS[0].id)).toBe(3);
	});

	it('does not win while a cell is still empty, however many pairs are joined', () => {
		const { game } = newGame();
		game.openLevel(0);
		const routes = solutionPaths(game.level);
		for (const route of routes.slice(0, -1)) stroke(game, route);
		expect(game.won).toBe(false);
		expect(game.covered).toBeLessThan(game.cells);
	});

	it('locks the board after a win and unlocks the next level', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		expect(game.beginStroke(game.level.pairs[0].a)).toBe(false);
		expect(game.undo()).toBe(false);
		expect(game.isUnlocked(1)).toBe(true);
		game.nextLevel();
		expect(game.levelIndex).toBe(1);
		expect(game.won).toBe(false);
		expect(game.moves).toBe(0);
		expect(game.isBlank).toBe(true);
	});

	it('clears the win state when going back to the level select', () => {
		const { game } = newGame();
		game.openLevel(0);
		playSolution(game);
		game.backToSelect();
		expect(game.screen).toBe('select');
		expect(game.won).toBe(false);
		expect(game.isUnlocked(1)).toBe(true);
	});

	it('gives fewer stars for a wasteful solution and keeps the better one', () => {
		const { game } = newGame();
		game.openLevel(0);
		const routes = solutionPaths(game.level);
		// Waste moves: draw a bit of a route and clear it again by pressing its port
		for (let i = 0; i < game.par; i++) {
			stroke(game, routes[0].slice(0, 2));
			game.beginStroke(routes[0][0]);
			game.endStroke();
		}
		playSolution(game);
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
		expect(second.game.bestFor(LEVELS[0].id)).toBe(LEVELS[0].pairs.length);
		expect(second.game.isUnlocked(1)).toBe(true);
		expect(highscoreParts(LEVELS[0].id)).toEqual(['beltroad', LEVELS[0].id, 'moves']);
	});

	it('every level can be won by drawing its stored solution, one stroke per route', () => {
		const { game } = newGame();
		for (let index = 0; index < LEVELS.length; index++) {
			game.openLevel(index);
			expect(game.levelIndex).toBe(index);
			playSolution(game);
			expect(game.won, LEVELS[index].id).toBe(true);
			expect(game.moves).toBe(game.par);
			expect(game.stars).toBe(3);
		}
		expect(game.totalStars).toBe(game.maxStars);
		expect(game.hasNext).toBe(false);
	});

	it('does not offer a next level after the last one', () => {
		const { game } = newGame();
		game.levelIndex = LEVELS.length - 1;
		expect(game.hasNext).toBe(false);
		game.nextLevel();
		expect(game.levelIndex).toBe(LEVELS.length - 1);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['beltroad_', 'mode_beltroad_'])).toEqual([]);
	});
});

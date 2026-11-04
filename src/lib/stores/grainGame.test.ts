import { describe, expect, it } from 'vitest';
import { SHIPS, SHIP_Y } from '#lib/game/grain/config.js';
import { addAt } from '#lib/game/grain/state.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { GrainGame } from './grainGame.svelte';

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
	return { game: new GrainGame({ scores: () => scores, seed: () => 99 }), scores };
}

describe('GrainGame', () => {
	it('only moves while running', () => {
		const { game } = newGame();
		game.update(STEP);
		expect(game.sim.distance).toBe(0);
		game.start();
		game.update(STEP);
		expect(game.sim.distance).toBeGreaterThan(0);
		game.pause();
		const sailed = game.sim.distance;
		game.update(STEP);
		expect(game.sim.distance).toBe(sailed);
		game.resume();
		expect(game.status).toBe('running');
	});

	it('starts a run with the chosen ship and locks the choice during play', () => {
		const { game } = newGame();
		game.selectShip('bulker', false);
		expect(game.lives).toBe(SHIPS.bulker.lives);
		expect(game.holdMax).toBe(SHIPS.bulker.hold);
		game.start();
		game.selectShip('coaster', false);
		expect(game.shipId).toBe('bulker');
	});

	it('shows a wave banner at the start and turns hits into effects', () => {
		const { game } = newGame();
		game.start();
		expect(game.banner?.wave).toBe(1);
		game.sim.spawnMs = 1e9;
		addAt(game.sim, 'mine', game.sim.shipX, SHIP_Y);
		game.update(STEP);
		expect(game.lives).toBe(SHIPS.freighter.lives - 1);
		expect(game.hits).toBe(1);
		expect(game.fx.particles.length).toBeGreaterThan(0);
	});

	it('a sweep with nothing to clear keeps the charge', () => {
		const { game } = newGame();
		game.start();
		game.sim.spawnMs = 1e9;
		game.sweep();
		expect(game.sweepers).toBe(SHIPS.freighter.sweepers);
		addAt(game.sim, 'mine', game.sim.shipX, SHIP_Y - 100);
		game.sweep();
		expect(game.sweepers).toBe(SHIPS.freighter.sweepers - 1);
		expect(game.swept).toBe(1);
	});

	it('ends the run, saves the best and can go back to the ship picker', () => {
		const { game, scores } = newGame();
		game.start();
		game.sim.spawnMs = 1e9;
		game.sim.score = 500;
		game.sim.ports = 3;
		game.sim.lives = 1;
		addAt(game.sim, 'mine', game.sim.shipX, SHIP_Y);
		game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['grain', 'score'])).toBe(game.score);
		expect(scores.get(['grain', 'ports'])).toBe(3);
		expect(game.stars).toBe(1);
		game.reset();
		expect(game.status).toBe('ready');
	});
});

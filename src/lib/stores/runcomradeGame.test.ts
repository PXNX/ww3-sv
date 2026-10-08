import { describe, expect, it } from 'vitest';
import { STARTING_LIVES } from '#lib/game/runcomrade/config.js';
import {
	groundY,
	laneX,
	nearestVisible,
	scaleAt,
	RUNNER_Y
} from '#lib/game/runcomrade/projection.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { RunComradeGame } from './runcomradeGame.svelte';

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
	return { game: new RunComradeGame({ scores: () => scores, seed: () => 7 }), scores };
}

/** Starts a run on an empty course, so only what the test places happens */
function startQuiet(game: RunComradeGame) {
	game.start();
	game.state.generator.nextZ = Infinity;
	game.state.generator.nextPatchZ = Infinity;
}

describe('RunComradeGame', () => {
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
		game.command('left');
		expect(game.state.runner.lane).toBe(1);
		game.resume();
		game.command('left');
		expect(game.state.runner.lane).toBe(0);
	});

	it('shows the score and lives on the page chrome', () => {
		const { game } = newGame();
		startQuiet(game);
		for (let t = 0; t < 4000; t += STEP) game.update(STEP);
		expect(game.score).toBeGreaterThan(10);
		expect(game.distance).toBeGreaterThan(10);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('loses a heart on drone contact, flashes the field and ends the run at zero', () => {
		const { game } = newGame();
		startQuiet(game);
		game.state.drone.gap = 0;
		game.update(STEP);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.status).toBe('playing');

		game.state.lives = 1;
		game.state.drone.graceMs = 0;
		game.state.drone.gap = 0;
		game.update(STEP);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
	});

	it('mirrors the helmet boost and the rice shield for the HUD', () => {
		const { game } = newGame();
		startQuiet(game);
		game.state.field.pickups.push({ id: 1, kind: 'helmet', lane: 1, z: 0.2, taken: false });
		game.state.field.pickups.push({ id: 2, kind: 'rice', lane: 1, z: 0.4, taken: false });
		game.update(STEP);
		game.update(STEP);
		expect(game.boostLeft).toBeGreaterThan(0.9);
		expect(game.shield).toBe(true);
		expect(game.helmets).toBe(1);
		expect(game.bowls).toBe(1);
	});

	it('keeps a personal best per mode, only when beaten', () => {
		const { game, scores } = newGame();
		const finish = (distance: number) => {
			startQuiet(game);
			game.state.distance = distance;
			game.state.lives = 1;
			game.state.drone.gap = 0;
			game.update(STEP);
		};
		finish(200);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		const first = game.score;
		expect(scores.get(['runcomrade', 'score'])).toBe(first);
		expect(game.best).toBe(first);

		finish(50);
		expect(game.isNewBest).toBe(false);
		expect(game.best).toBe(first);

		finish(500);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBeGreaterThan(first);
		expect(scores.get(['runcomrade', 'distance'])).toBe(game.distance);
	});

	it('is deterministic for a seed', () => {
		const run = () => {
			const { game } = newGame();
			game.start();
			for (let t = 0; t < 20_000; t += STEP) game.update(STEP);
			return game.state.field.rows.map((row) => row.z);
		};
		expect(run()).toEqual(run());
	});

	it('buzzes the drone while playing (the sound manager itself honors the mute toggle)', async () => {
		const { soundManager } = await import('#lib/sound/soundManager.svelte.js');
		const manager = soundManager();
		const played: string[] = [];
		const original = manager.play.bind(manager);
		manager.play = (id, intensity) => {
			played.push(id);
			return original(id, intensity);
		};
		const { game } = newGame();
		startQuiet(game);
		for (let t = 0; t < 4000; t += STEP) game.update(STEP);
		expect(played).toContain('drone-buzz');
		manager.play = original;
	});

	it('plays a drone maneuver burst, panned to its lane, and never two within the throttle', async () => {
		const { soundManager } = await import('#lib/sound/soundManager.svelte.js');
		const manager = soundManager();
		const played: { id: string; intensity?: number; pan?: number }[] = [];
		const original = manager.play.bind(manager);
		manager.play = (id, intensity, pan) => {
			played.push({ id, intensity, pan });
			return original(id, intensity, pan);
		};
		const { game } = newGame();
		startQuiet(game);
		game.state.drone.gap = 11;
		// The drone follows a lane change 350 ms later. A second change right after the first burst
		// would be followed while the throttle is still running, so it must stay silent.
		game.command('left');
		for (let t = 0; t < 400; t += STEP) game.update(STEP);
		game.command('right');
		for (let t = 0; t < 700; t += STEP) game.update(STEP);
		const bursts = played.filter((entry) => entry.id === 'drone-brzzz');
		expect(game.state.drone.lane).toBe(1);
		expect(bursts).toHaveLength(1);
		expect(bursts[0].pan).toBeLessThan(0);
		expect(bursts[0].intensity).toBeGreaterThan(0);
		// once the throttle has passed, the next maneuver sounds again
		game.command('left');
		for (let t = 0; t < 600; t += STEP) game.update(STEP);
		expect(played.filter((entry) => entry.id === 'drone-brzzz')).toHaveLength(2);
		manager.play = original;
	});

	it('has messages in every language', () => {
		expect(missingMessages(['runcomrade_', 'mode_runcomrade_'])).toEqual([]);
	});
});

describe('projection', () => {
	it('keeps the runner at scale 1 and shrinks things towards the horizon', () => {
		expect(scaleAt(0)).toBe(1);
		expect(scaleAt(20)).toBeLessThan(scaleAt(5));
		expect(groundY(0)).toBe(RUNNER_Y);
		expect(groundY(40)).toBeLessThan(groundY(5));
		expect(laneX(1, 0)).toBe(laneX(1, 30));
		expect(laneX(0, 0)).toBeLessThan(laneX(1, 0));
		expect(laneX(0, 20)).toBeGreaterThan(laneX(0, 0));
	});

	it('knows how far behind the runner the bottom edge sits', () => {
		const behind = nearestVisible(560);
		expect(behind).toBeLessThan(0);
		expect(groundY(behind)).toBeCloseTo(560);
	});
});

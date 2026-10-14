import { describe, expect, it } from 'vitest';
import { MAX_AMMO, STARTING_LIVES, TARGETS, WASTE_PENALTY } from '#lib/game/dome/config.js';
import { rocketPosition, type Rocket } from '#lib/game/dome/state.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { loadMessages, missingMessages } from '#lib/testing/messages.js';
import { DomeGame, SCORE_KEY, WAVE_KEY } from './domeGame.svelte';

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
	const game = new DomeGame({ scores: () => scores, seed: () => 7 });
	return { game, scores };
}

const STEP = 1000 / 60;

function play(game: DomeGame, ms: number) {
	for (let t = 0; t < ms && game.status === 'playing'; t += STEP) game.update(STEP);
}

/** A running wave with no scheduled rockets, so a test places exactly the ones it wants */
function emptyWave(game: DomeGame) {
	game.start();
	game.state.phase = 'wave';
	game.state.wave = 1;
	game.state.queue = [
		{
			atMs: 1e9,
			kind: 'normal',
			targetIndex: null,
			flight: { startX: -24, startY: 60, impactX: 40, lift: 90, flightMs: 6000 }
		}
	];
}

function addRocket(game: DomeGame, targetIndex: number | null, flightMs = 6000): Rocket {
	const rocket: Rocket = {
		id: game.state.nextId++,
		kind: 'normal',
		flight: {
			startX: -24,
			startY: 60,
			impactX: targetIndex === null ? 40 : TARGETS[targetIndex].x,
			lift: 90,
			flightMs
		},
		elapsedMs: 600,
		targetIndex,
		interceptorId: null
	};
	game.state.rockets.push(rocket);
	return rocket;
}

describe('DomeGame', () => {
	it('waits for the start button and ignores taps before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.tapAt({ x: 100, y: 100 });
		game.update(1000);
		expect(game.state.wave).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.loaded).toBe(MAX_AMMO);
	});

	it('starts wave one after a short lead-in and puts a wave popup on screen', () => {
		const { game } = newGame();
		game.start();
		play(game, 1000);
		expect(game.wave).toBe(1);
		expect(game.effects.some((effect) => effect.kind === 'popup')).toBe(true);
	});

	it('stops everything while paused and resumes where it left off', () => {
		const { game } = newGame();
		game.start();
		play(game, 1000);
		game.pause();
		const clock = game.state.waveElapsedMs;
		game.update(1000);
		expect(game.state.waveElapsedMs).toBe(clock);
		game.tapAt({ x: 100, y: 100 });
		expect(game.status).toBe('paused');
		game.togglePause();
		expect(game.status).toBe('playing');
	});

	it('launches an interceptor on a tap, shows the ammo, and pays for a good intercept', () => {
		const { game } = newGame();
		emptyWave(game);
		const rocket = addRocket(game, 2);
		game.tapAt(rocketPosition(rocket));
		expect(game.state.interceptors).toHaveLength(1);
		expect(game.loaded).toBe(MAX_AMMO - 1);
		play(game, 4000);
		expect(game.intercepts).toBe(1);
		expect(game.score).toBe(TARGETS[2].value);
		expect(game.combo).toBe(1);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('charges for an interceptor wasted on a harmless rocket', () => {
		const { game } = newGame();
		emptyWave(game);
		game.state.score = 100;
		const rocket = addRocket(game, null);
		game.tapAt(rocketPosition(rocket));
		play(game, 4000);
		expect(game.wasted).toBe(1);
		expect(game.score).toBe(100 - WASTE_PENALTY);
	});

	it('launches at the most urgent threat from the keyboard', () => {
		const { game } = newGame();
		emptyWave(game);
		addRocket(game, null);
		const hospital = addRocket(game, 2);
		game.interceptUrgent();
		expect(game.state.interceptors[0].rocketId).toBe(hospital.id);
	});

	it('flashes and loses hearts when a building is hit, and clears popups with time', () => {
		const { game } = newGame();
		emptyWave(game);
		addRocket(game, 2, 700);
		play(game, 1500);
		expect(game.hurtCount).toBe(1);
		expect(game.lives).toBe(STARTING_LIVES - TARGETS[2].cost);
		expect(game.effects.length).toBeGreaterThan(0);
		play(game, 3000);
		expect(game.effects.length).toBe(0);
	});

	it('ends the run when the last heart is lost and keeps the bests', () => {
		const { game, scores } = newGame();
		emptyWave(game);
		game.state.score = 240;
		game.state.lives = 1;
		game.state.wave = 3;
		addRocket(game, 2, 700);
		play(game, 3000);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(240);
		expect(scores.get(WAVE_KEY)).toBe(3);
		expect(game.best).toBe(240);
		expect(game.bestWave).toBe(3);
	});

	it('does not call a lower score a new best', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 500);
		emptyWave(game);
		game.state.score = 20;
		game.state.lives = 1;
		addRocket(game, 2, 700);
		play(game, 3000);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(game.best).toBe(500);
	});

	it('starts a fresh run on retry', () => {
		const { game } = newGame();
		emptyWave(game);
		game.state.lives = 1;
		addRocket(game, 2, 700);
		play(game, 3000);
		expect(game.status).toBe('over');
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.score).toBe(0);
		expect(game.wave).toBe(0);
		expect(game.hurtCount).toBe(0);
		expect(game.effects).toEqual([]);
	});

	it('loads the stored bests', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 420);
		scores.submit(WAVE_KEY, 6);
		game.loadBest();
		expect(game.best).toBe(420);
		expect(game.bestWave).toBe(6);
	});
});

describe('Iron Dome Juggler messages', () => {
	it('has messages in every language', () => {
		expect(missingMessages(['dome_', 'mode_dome_'])).toEqual([]);
	});

	it('quotes the same values and costs the game uses', () => {
		const text = loadMessages('en').dome_tutorial_value;
		for (const target of TARGETS) {
			expect(text).toContain(String(target.value));
			expect(text).toContain(`${target.cost} heart`);
		}
		expect(loadMessages('en').dome_tutorial_harmless).toContain(String(WASTE_PENALTY));
	});
});

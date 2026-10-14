import { describe, expect, it } from 'vitest';
import { FINALE_MS, HEART_BONUS, STARTING_LIVES, TRACK_LENGTH } from '#lib/game/balloon/config.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { BalloonGame, DISTANCE_KEY, SCORE_KEY } from './balloonGame.svelte';

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
	const game = new BalloonGame({ scores: () => scores, seed: () => 7 });
	return { game, scores };
}

const STEP = 1000 / 60;

function play(game: BalloonGame, ms: number) {
	for (let t = 0; t < ms && game.status === 'playing'; t += STEP) game.update(STEP);
}

/** An empty sky and no jets, so a run is decided only by what the test sets up */
function clearSky(game: BalloonGame) {
	game.state.course = { hazards: [], puffs: [], pois: [] };
	game.state.nextJetMs = Infinity;
}

describe('BalloonGame', () => {
	it('waits for the start button and ignores the burner before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		const y = game.state.y;
		game.burner(true);
		game.update(1000);
		expect(game.state.y).toBe(y);
		expect(game.state.burning).toBe(false);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.fuelPercent).toBe(100);
	});

	it('climbs while the burner is held, drains fuel and sinks again on release', () => {
		const { game } = newGame();
		game.start();
		clearSky(game);
		const y = game.state.y;
		game.burner(true);
		expect(game.burning).toBe(true);
		play(game, 500);
		expect(game.state.y).toBeLessThan(y);
		expect(game.fuelPercent).toBeLessThan(100);
		game.burner(false);
		expect(game.burning).toBe(false);
	});

	it('lets go of the burner on pause and stops everything until resumed', () => {
		const { game } = newGame();
		game.start();
		clearSky(game);
		game.burner(true);
		play(game, 200);
		game.pause();
		expect(game.status).toBe('paused');
		expect(game.state.burning).toBe(false);
		const progress = game.state.progress;
		play(game, 500);
		game.update(500);
		expect(game.state.progress).toBe(progress);
		game.resume();
		expect(game.status).toBe('playing');
		game.togglePause();
		expect(game.status).toBe('paused');
	});

	it('flies to the east coast, pays a bonus per heart and keeps the bests', () => {
		const { game, scores } = newGame();
		game.start();
		clearSky(game);
		game.state.progress = TRACK_LENGTH - 5;
		game.state.distance = TRACK_LENGTH - 5;
		play(game, 3000 + FINALE_MS);
		expect(game.status).toBe('over');
		expect(game.finished).toBe(true);
		expect(game.finishBonus).toBe(STARTING_LIVES * HEART_BONUS);
		expect(game.score).toBeGreaterThan(STARTING_LIVES * HEART_BONUS);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(scores.get(DISTANCE_KEY)).toBe(TRACK_LENGTH);
		expect(game.progressPercent).toBe(100);
	});

	it('ends in the sky when the last heart is lost and counts the hits', () => {
		const { game } = newGame();
		game.start();
		clearSky(game);
		game.state.lives = 1;
		game.state.course.hazards = [
			{
				kind: 'cloud',
				x: game.state.progress + 10,
				baseY: game.state.y,
				y: game.state.y,
				radius: 30,
				phase: 0,
				active: true,
				spent: false
			}
		];
		play(game, 500);
		expect(game.status).toBe('over');
		expect(game.finished).toBe(false);
		expect(game.hurtCount).toBe(1);
		expect(game.lives).toBe(0);
	});

	it('shows popups and a speech bubble for a photo, then clears them with time', () => {
		const { game } = newGame();
		game.start();
		clearSky(game);
		game.state.course.pois = [{ kind: 'farm', x: 20, photographed: false, dwellMs: 0 }];
		for (let t = 0; t < 3000 && game.photos === 0; t += STEP) {
			// Hold the balloon in the slow middle layer, as a player tapping the burner would
			game.state.y = 175;
			game.state.vy = 0;
			game.update(STEP);
		}
		expect(game.photos).toBe(1);
		expect(game.effects.some((effect) => effect.kind === 'bubble')).toBe(true);
		play(game, 4000);
		expect(game.effects).toEqual([]);
	});

	it('starts a fresh run on retry', () => {
		const { game } = newGame();
		game.start();
		game.state.lives = 1;
		game.state.photos = 3;
		game.start();
		expect(game.state.lives).toBe(STARTING_LIVES);
		expect(game.state.photos).toBe(0);
		expect(game.isNewBest).toBe(false);
		expect(game.status).toBe('playing');
	});

	it('loads the stored bests', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 420);
		game.loadBest();
		expect(game.best).toBe(420);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['balloon_', 'mode_balloon_'])).toEqual([]);
	});
});

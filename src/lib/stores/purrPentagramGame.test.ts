import { describe, expect, it } from 'vitest';
import { STARTING_LIVES } from '#lib/game/purrpentagram/config.js';
import { BANNER_DELAY_MS, finaleStage } from '#lib/game/purrpentagram/finale.js';
import { seatPosition, type Point } from '#lib/game/purrpentagram/geometry.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { PurrMixer } from '#lib/sound/purrMixer.js';
import { missingMessages } from '#lib/testing/messages.js';
import { PurrPentagramGame } from './purrPentagramGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

/** Records what the game asked the mixer to do, without any audio */
class SpyMixer extends PurrMixer {
	finaleStarted = 0;
	unlocked = 0;
	disposed = false;
	override unlock() {
		this.unlocked += 1;
		return false;
	}
	override startFinale() {
		this.finaleStarted += 1;
	}
	override dispose() {
		this.disposed = true;
	}
}

const STEP = 1000 / 60;

function newGame(seed = 7) {
	const storage = createStore(memoryStorage());
	const scores = createHighscores(storage);
	const mixer = new SpyMixer();
	const game = new PurrPentagramGame({
		scores: () => scores,
		settings: () => storage,
		seed: () => seed,
		mixer,
		reducedMotion: false
	});
	return { game, scores, mixer, storage };
}

const seat = (game: PurrPentagramGame, cat: number): Point =>
	seatPosition(game.state.cats[cat].seat);

/** Drags from one cat's seat to another's, the way a finger would */
function stroke(game: PurrPentagramGame, from: number, to: number, t = 0) {
	const start = seat(game, from);
	const end = seat(game, to);
	expect(game.pointerDown(start, t)).toBe(true);
	game.pointerMove({ x: start.x + 150, y: start.y }, t + 20);
	game.pointerMove({ x: end.x, y: end.y }, t + 60);
	game.pointerUp(end);
}

describe('PurrPentagramGame', () => {
	it('waits for the player to begin, and plays from the same seed to the same ritual', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.update(STEP);
		expect(game.state.elapsedMs).toBe(0);
		expect(game.pointerDown(seat(game, 0), 0)).toBe(false);

		game.start();
		const target = [...game.state.riddle.target];
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		game.start();
		expect(game.state.riddle.target).toEqual(target);
	});

	it('wakes the audio on the first touch', () => {
		const { game, mixer } = newGame();
		game.start();
		const before = mixer.unlocked;
		game.pointerDown(seat(game, 0), 0);
		expect(mixer.unlocked).toBeGreaterThan(before);
	});

	it('pets a cat that is stroked slowly inside its circle, and the purr grows', () => {
		const { game } = newGame();
		game.start();
		const centre = seat(game, 0);
		expect(game.pointerDown({ x: centre.x - 40, y: centre.y }, 0)).toBe(true);
		let clock = 0;
		let x = -40;
		for (let i = 0; i < 180; i++) {
			clock += STEP;
			x += 3.3 * (i % 40 < 20 ? 1 : -1);
			game.pointerMove({ x: centre.x + x, y: centre.y }, clock);
			game.update(STEP);
		}
		expect(game.state.cats[0].purr).toBeGreaterThan(0.2);
		expect(game.drag).toBeNull();
		game.pointerUp({ x: centre.x + x, y: centre.y });
		expect(game.state.cats[0].stroke).toBeNull();
	});

	it('leaves petting for the star stroke when the finger drags out of the circle', () => {
		const { game } = newGame();
		game.start();
		const from = seat(game, 0);
		const to = seat(game, 1);
		game.pointerDown(from, 0);
		game.pointerMove({ x: from.x + 200, y: from.y }, 30);
		expect(game.drag).not.toBeNull();
		expect(game.state.cats[0].stroke).toBeNull();
		game.pointerMove(to, 60);
		expect(game.drag?.over).toBe(1);
		game.pointerCancel();
		expect(game.drag).toBeNull();
	});

	it('ignores a touch that lands outside every cat', () => {
		const { game } = newGame();
		game.start();
		expect(game.pointerDown({ x: 500, y: 520 }, 0)).toBe(false);
	});

	it('draws the star with the right strokes and wins, scores and keeps the best', () => {
		const { game, scores } = newGame();
		game.start();
		const { target } = game.state.riddle;
		for (let i = 0; i < 4; i++) stroke(game, target[i], target[i + 1], i * 100);
		// Five cats are joined, but the star is open until the last one goes back to the first
		expect(game.status).toBe('playing');
		expect(game.state.chain).toEqual(target);
		stroke(game, target[4], target[0], 500);
		expect(game.status).toBe('won');
		expect(game.state.closed).toBe(true);
		expect(game.score).toBeGreaterThan(0);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['purrpentagram', 'score'])).toBe(game.score);
	});

	it('costs a heart for a wrong stroke and ends the game after three', () => {
		const { game } = newGame();
		game.start();
		const { target } = game.state.riddle;
		stroke(game, target[1], target[0]);
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.notice?.kind).toBe('mistake');
		stroke(game, target[1], target[0], 200);
		stroke(game, target[1], target[0], 400);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.pointerDown(seat(game, 0), 0)).toBe(false);
	});

	it('says so, and costs nothing, when a cat is too upset to be joined', () => {
		const { game } = newGame();
		game.start();
		const { target } = game.state.riddle;
		game.state.cats[target[1]].mood = 0.05;
		stroke(game, target[0], target[1]);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.notice?.kind).toBe('not-ready');
	});

	it('lets the keyboard pet a cat and pick the cats for the star', () => {
		const { game } = newGame();
		game.start();
		const { target } = game.state.riddle;
		game.keyPet(target[0]);
		game.update(STEP);
		expect(game.state.cats[target[0]].purrTarget).toBeGreaterThan(0);

		game.keySelect(target[0]);
		expect(game.anchor).toBe(target[0]);
		game.keySelect(target[1]);
		expect(game.anchor).toBeNull();
		expect(game.state.chain).toEqual([target[0], target[1]]);
		// Once the star is under way, every pick continues from the cat it ended on
		game.keySelect(target[2]);
		expect(game.state.chain).toEqual([target[0], target[1], target[2]]);
	});

	it('stops the simulation while paused and picks it up again on resume', () => {
		const { game } = newGame();
		game.start();
		game.update(STEP);
		game.pause();
		expect(game.status).toBe('paused');
		const elapsed = game.state.elapsedMs;
		game.update(STEP);
		expect(game.state.elapsedMs).toBe(elapsed);
		expect(game.pointerDown(seat(game, 0), 0)).toBe(false);
		game.resume();
		game.update(STEP);
		expect(game.state.elapsedMs).toBeGreaterThan(elapsed);
	});

	it('runs the finale on after the win and brings in the music at the burst', () => {
		const { game, mixer } = newGame();
		game.start();
		const { target } = game.state.riddle;
		for (let i = 0; i < 4; i++) stroke(game, target[i], target[i + 1], i * 100);
		stroke(game, target[4], target[0], 500);
		expect(game.status).toBe('won');
		expect(mixer.finaleStarted).toBe(0);

		let elapsed = 0;
		while (elapsed < 3000) {
			game.update(STEP);
			elapsed += STEP;
		}
		expect(finaleStage(game.state.finaleMs).phase).toBe('igniting');
		expect(mixer.finaleStarted).toBe(0);

		while (elapsed < BANNER_DELAY_MS + 200) {
			game.update(STEP);
			elapsed += STEP;
		}
		expect(mixer.finaleStarted).toBe(1);
		// The loop keeps going, and the music is only started once
		for (let i = 0; i < 600; i++) game.update(STEP);
		expect(mixer.finaleStarted).toBe(1);
		expect(game.status).toBe('won');
	});

	it('remembers the reduce-motion setting', () => {
		const { game, storage } = newGame();
		expect(game.reducedMotion).toBe(false);
		game.setReducedMotion(true);
		expect(game.reducedMotion).toBe(true);

		const again = new PurrPentagramGame({
			settings: () => storage,
			mixer: new SpyMixer(),
			reducedMotion: false
		});
		again.load();
		expect(again.reducedMotion).toBe(true);
	});

	it('releases the audio when the page is left', () => {
		const { game, mixer } = newGame();
		game.dispose();
		expect(mixer.disposed).toBe(true);
	});

	it('has all of its messages in every language', () => {
		expect(missingMessages(['purr_', 'mode_purrpentagram_'])).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { cameoFile } from '#lib/game/energiewende/reactions.js';
import { SOURCE_IDS } from '#lib/game/energiewende/sources.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { EnergiewendeGame, SCORE_KEY } from './energiewendeGame.svelte';

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
	const game = new EnergiewendeGame({ scores: () => scores, seed: () => 7 });
	return { game, scores };
}

/** Real milliseconds of play, in the fixed steps the page loop uses */
function play(game: EnergiewendeGame, seconds: number) {
	for (let t = 0; t < seconds * 1000 && game.status === 'playing'; t += 50) game.update(50);
}

describe('EnergiewendeGame', () => {
	it('waits for the start button and shows one view per source', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		expect(game.sources.map((view) => view.id)).toEqual([...SOURCE_IDS]);
		game.update(1000);
		expect(game.state.hour).toBe(4);
	});

	it('runs the clock only while playing', () => {
		const { game } = newGame();
		game.start();
		play(game, 5);
		const hour = game.state.hour;
		expect(hour).toBeGreaterThan(5);
		game.pause();
		play(game, 5);
		expect(game.state.hour).toBe(hour);
		game.resume();
		play(game, 1);
		expect(game.state.hour).toBeGreaterThan(hour);
	});

	it('ignores slider moves while not playing', () => {
		const { game } = newGame();
		const before = game.state.targets.hydro;
		game.setTarget('hydro', 0.05);
		expect(game.state.targets.hydro).toBe(before);
		game.start();
		game.setTarget('hydro', 0.05);
		expect(game.state.targets.hydro).toBe(0.05);
		game.pause();
		game.setTarget('hydro', 0.5);
		expect(game.state.targets.hydro).toBe(0.05);
	});

	it('counts the nuclear switch-overs and turns the Critic against them', () => {
		const { game } = newGame();
		game.start();
		game.setTarget('nuclear', 0);
		game.setTarget('nuclear', 0.8);
		expect(game.flips).toBe(2);
		expect(game.woman).toBe('outraged');
		expect(game.womanReason).toBe('nuclear');
		expect(game.speaker).toBe('woman');
	});

	it('ends in a game over when the grid is left alone, and stores the bests', () => {
		const { game, scores } = newGame();
		game.start();
		// A few steady hours first, then everything off
		play(game, 10);
		for (const id of SOURCE_IDS) game.setTarget(id, 0);
		play(game, 600);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(game.blackouts).toBeGreaterThan(0);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.score).toBeGreaterThan(0);
		expect(game.isNewBest).toBe(true);
	});

	it('picks the game-over cameo from whoever was unhappier', () => {
		const { game } = newGame();
		game.start();
		game.state.grievance = { businessman: 5, woman: 1 };
		game.state.hour = 28;
		expect(game.overCameo().kind).toBe('businessman');
		game.state.grievance = { businessman: 1, woman: 20 };
		const over = game.overCameo();
		expect(over.kind).toBe('woman');
		expect(over.mood).not.toBe('calm');
		expect(cameoFile(over.kind, over.mood)).toMatch(/^energiewende-woman-/);
	});

	it('plays the same run for the same seed', () => {
		const a = newGame().game;
		const b = newGame().game;
		a.start();
		b.start();
		play(a, 60);
		play(b, 60);
		expect(a.score).toBe(b.score);
		expect(a.supply).toBe(b.supply);
	});

	it('has every message in all languages', () => {
		expect(missingMessages(['energiewende_', 'mode_energiewende_'])).toEqual([]);
	});
});

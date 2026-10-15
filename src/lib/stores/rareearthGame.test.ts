import { describe, expect, it } from 'vitest';
import {
	ELEMENT_SYMBOLS,
	elementName,
	factoryName,
	laneName,
	nodeName,
	nodeShort,
	ruleKindName,
	ruleText
} from '#lib/components/rareearthText.js';
import { LOAD_MS, STARTING_LIVES } from '#lib/game/rareearth/config.js';
import { ELEMENTS, WORLD } from '#lib/game/rareearth/graph.js';
import type { Crate } from '#lib/game/rareearth/state.js';
import type { Rule, RuleKind } from '#lib/game/rareearth/rules.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { hasPersianScript, loadMessages, missingMessages } from '#lib/testing/messages.js';
import { RareEarthGame, SCORE_KEY } from './rareearthGame.svelte';

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
	return { game: new RareEarthGame({ scores: () => scores, seed: () => 7 }), scores };
}

const STEP_MS = 50;

/** Runs the game and returns the tones of the toasts that were shown on the way */
function run(game: RareEarthGame, ms: number): string[] {
	const tones: string[] = [];
	for (let t = 0; t < ms; t += STEP_MS) {
		game.update(STEP_MS);
		if (game.toast && tones.at(-1) !== game.toast.tone + game.toast.id) {
			tones.push(game.toast.tone + game.toast.id);
		}
	}
	return tones.map((entry) => entry.replace(/[0-9]+$/, ''));
}

/** Stops the random spawns so a test controls the crates */
function quiet(game: RareEarthGame) {
	game.state.nextSpawnMs = Infinity;
}

function addCrate(game: RareEarthGame, patch: Partial<Crate> = {}) {
	const state = game.state;
	state.crates.push({
		id: state.nextCrateId++,
		element: 'neodymium',
		mine: 'm1',
		spawnedMs: state.elapsedMs,
		deadlineMs: state.elapsedMs + 60_000,
		speed: 50,
		node: 'm1',
		edge: null,
		progress: 0,
		loadMs: LOAD_MS,
		visited: [],
		tariffed: false,
		needs: [],
		...patch
	});
	game.select('m1', 1);
}

describe('RareEarthGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.update(60_000);
		game.cycle('h1');
		expect(game.state.elapsedMs).toBe(0);
		expect(game.switches.h1).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
	});

	it('starts, pauses and resumes', () => {
		const { game } = newGame();
		game.start();
		expect(game.status).toBe('playing');
		game.pause();
		expect(game.status).toBe('paused');
		game.update(5000);
		expect(game.state.elapsedMs).toBe(0);
		game.cycle('h1');
		expect(game.switches.h1).toBe(0);
		game.togglePause();
		expect(game.status).toBe('playing');
		run(game, 500);
		expect(game.state.elapsedMs).toBeGreaterThan(0);
	});

	it('turns switches by tap, by index and by drag', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.cycle('h1');
		expect(game.switches.h1).toBe(1);
		game.select('h1', 2);
		expect(game.switches.h1).toBe(2);
		game.cycle('h1', -1);
		expect(game.switches.h1).toBe(1);
		// h1 sends lanes to p0 (up), p1 (straight right) and p2 (down)
		expect(game.dragTowards('h1', 40, -40)).toBe(true);
		expect(game.switches.h1).toBe(0);
		expect(game.dragTowards('h1', 40, 40)).toBe(true);
		expect(game.switches.h1).toBe(2);
		expect(game.dragTowards('h1', -40, 0)).toBe(false);
		expect(game.switches.h1).toBe(2);
	});

	it('delivers a crate, scores and keeps the combo', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		addCrate(game);
		game.select('h1', 1);
		game.select('p1', 1);
		const tones = run(game, 12_000);
		expect(tones).toContain('good');
		expect(game.delivered).toBe(1);
		expect(game.score).toBeGreaterThan(0);
		expect(game.combo).toBe(1);
		expect(game.crates).toEqual([]);
	});

	it('loses a heart, shakes and clears the combo on a wrong delivery', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.combo = 3;
		addCrate(game, { element: 'europium' });
		game.select('h1', 1);
		game.select('p1', 1);
		const tones = run(game, 12_000);
		expect(tones).toContain('bad');
		expect(game.lives).toBe(STARTING_LIVES - 1);
		expect(game.hurtCount).toBe(1);
		expect(game.combo).toBe(0);
	});

	it('announces the first notice and lists it', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.lives = 99;
		game.state.nextSpawnMs = Infinity;
		run(game, 14_000 + STEP_MS * 3);
		expect(game.round).toBe(2);
		expect(game.rules).toHaveLength(1);
		expect(game.banner).not.toBeNull();
	});

	it('ends the run on the last heart and stores the best', () => {
		const { game, scores } = newGame();
		game.start();
		quiet(game);
		game.state.lives = 1;
		game.state.score = 120;
		addCrate(game, { element: 'europium' });
		game.select('h1', 1);
		game.select('p1', 1);
		run(game, 12_000);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(scores.get(SCORE_KEY)).toBe(120);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(120);
	});

	it('does not touch the best when the new score is lower', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 999_999);
		game.start();
		quiet(game);
		game.state.lives = 1;
		addCrate(game, { element: 'europium' });
		game.select('h1', 1);
		game.select('p1', 1);
		run(game, 12_000);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(scores.get(SCORE_KEY)).toBe(999_999);
	});

	it('starts a fresh run after a game over', () => {
		const { game } = newGame();
		game.start();
		quiet(game);
		game.state.lives = 1;
		addCrate(game, { element: 'europium' });
		game.select('h1', 1);
		game.select('p1', 1);
		run(game, 12_000);
		game.start();
		expect(game.status).toBe('playing');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.crates).toEqual([]);
		expect(game.score).toBe(0);
		expect(game.round).toBe(1);
	});

	it('plays the same game for the same seed', () => {
		const play = () => {
			const { game } = newGame();
			game.start();
			game.state.lives = 999;
			run(game, 40_000);
			return [game.score, game.delivered, game.state.nextCrateId, game.state.rules.length];
		};
		expect(play()).toEqual(play());
	});
});

describe('texts', () => {
	it('has every rareearth string in every language', () => {
		expect(missingMessages(['rareearth_', 'mode_rareearth_'])).toEqual([]);
	});

	it('names every node, element, factory and lane', () => {
		for (const id of WORLD.order) {
			expect(nodeName(WORLD, id)).toBeTruthy();
			expect(nodeShort(WORLD, id)).toBeTruthy();
		}
		for (const element of ELEMENTS) {
			expect(elementName(element)).toBeTruthy();
			expect(factoryName(element)).toBeTruthy();
			expect(ELEMENT_SYMBOLS[element]).toMatch(/^[A-Z][a-z]$/);
		}
		for (const id of Object.keys(WORLD.edges)) expect(laneName(WORLD, id)).toContain('→');
		expect(nodeName(WORLD, 'm0')).not.toBe(nodeName(WORLD, 'm1'));
	});

	it('words every kind of notice', () => {
		const base: Rule = {
			id: 1,
			kind: 'ban',
			noticeMs: 0,
			startMs: 0,
			endMs: 1,
			edge: 'h1>p1',
			limit: 3,
			used: 0,
			element: 'neodymium',
			node: 'p1'
		};
		const kinds: RuleKind[] = ['ban', 'tariff', 'quota', 'licence'];
		const texts = kinds.map((kind) => ruleText(WORLD, { ...base, kind }));
		expect(new Set(texts).size).toBe(4);
		expect(texts[2]).toContain('3');
		expect(texts[0]).toContain(laneName(WORLD, 'h1>p1'));
		expect(texts[3]).toContain(nodeName(WORLD, 'p1'));
		for (const kind of kinds) expect(ruleKindName(kind)).toBeTruthy();
	});

	it('writes the Persian texts in Persian script', () => {
		const persian = loadMessages('fa');
		for (const key of [
			'mode_rareearth_name',
			'rareearth_notice_ban',
			'rareearth_tutorial_goal',
			'rareearth_gameover_title'
		]) {
			expect(hasPersianScript(persian[key]), key).toBe(true);
		}
	});
});

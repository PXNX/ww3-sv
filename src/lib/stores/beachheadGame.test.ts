import { describe, expect, it } from 'vitest';
import { ISLAND_IDS, SKILL_ENERGY } from '#lib/game/beachhead/config.js';
import { TAKEBACK_INTERVAL_MS, controlIsland } from '#lib/game/beachhead/campaign.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { BeachheadGame } from './beachheadGame.svelte.js';

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
	const store = createStore(memoryStorage());
	return new BeachheadGame({
		scores: () => createHighscores(store),
		store: () => store,
		now: () => 1_000_000,
		random: () => 0
	});
}

function startedGame() {
	const game = newGame();
	game.load();
	game.openIsland(0);
	return game;
}

describe('BeachheadGame campaign guards', () => {
	it('does not open an island that is already under the player flag', () => {
		const game = newGame();
		game.load();
		game.campaign = controlIsland(game.campaign, ISLAND_IDS[0], 3);
		game.openIsland(0);
		expect(game.screen).toBe('base');
	});

	it('lets the enemy retake an island on the six-hour tick and posts a notice', () => {
		const game = newGame();
		game.load();
		game.campaign = {
			...controlIsland(game.campaign, ISLAND_IDS[0], 2),
			lastTakebackMs: 1_000_000 - TAKEBACK_INTERVAL_MS
		};
		game.tick();
		expect(game.isControlled(ISLAND_IDS[0])).toBe(false);
		expect(game.starsFor(ISLAND_IDS[0])).toBe(2);
		expect(game.takeoverNotice).toContain(ISLAND_IDS[0]);
		game.dismissTakeovers();
		expect(game.takeoverNotice).toEqual([]);
	});
});

describe('BeachheadGame skills', () => {
	it('arms a skill, then casts it where the island is tapped', () => {
		const game = startedGame();
		expect(game.energy).toBe(SKILL_ENERGY.start);
		expect(game.skillPrice).toBe(SKILL_ENERGY.baseCost);
		game.chooseSkill('flare');
		expect(game.selectedSkill).toBe('flare');
		game.tap(4, 4);
		expect(game.selectedSkill).toBeNull();
		expect(game.battle.flare).not.toBeNull();
		expect(game.energy).toBe(SKILL_ENERGY.start - SKILL_ENERGY.baseCost);
		expect(game.skillPrice).toBe(SKILL_ENERGY.baseCost + SKILL_ENERGY.costStep);
		expect(game.skillsUsed).toBe(1);
	});

	it('toggles a selected skill off when it is tapped twice', () => {
		const game = startedGame();
		game.chooseSkill('smoke');
		game.chooseSkill('smoke');
		expect(game.selectedSkill).toBeNull();
		expect(game.energy).toBe(SKILL_ENERGY.start);
	});

	it('replaces one armed skill with another', () => {
		const game = startedGame();
		game.chooseSkill('flare');
		game.chooseSkill('heal');
		expect(game.selectedSkill).toBe('heal');
	});

	it('will not arm a skill when the next call is too expensive', () => {
		const game = startedGame();
		game.battle.energy = game.skillPrice - 1;
		game.energy = game.battle.energy;
		game.chooseSkill('barrage');
		expect(game.selectedSkill).toBeNull();
	});

	it('starts a new island with a fresh energy pool and no armed skill', () => {
		const game = startedGame();
		game.chooseSkill('flamingo');
		game.tap(5, 5);
		expect(game.energy).toBeLessThan(SKILL_ENERGY.start);
		game.goMap();
		expect(game.selectedSkill).toBeNull();
		game.openIsland(0);
		expect(game.energy).toBe(SKILL_ENERGY.start);
		expect(game.skillPrice).toBe(SKILL_ENERGY.baseCost);
		expect(game.skillsUsed).toBe(0);
	});

	it('draws a cast ring and a cost popup for the chosen skill', () => {
		const game = startedGame();
		game.chooseSkill('heal');
		game.tap(5, 5);
		game.update(STEP);
		expect(game.effects.some((effect) => effect.kind === 'ring')).toBe(true);
		expect(
			game.effects.some(
				(effect) => effect.kind === 'float' && effect.text.includes(String(SKILL_ENERGY.baseCost))
			)
		).toBe(true);
		expect(game.battle.heal).not.toBeNull();
	});

	it('does nothing when the battle is paused', () => {
		const game = startedGame();
		game.chooseSkill('flare');
		game.pause();
		game.tap(4, 4);
		expect(game.battle.flare).toBeNull();
		expect(game.energy).toBe(SKILL_ENERGY.start);
		expect(game.selectedSkill).toBe('flare');
	});
});

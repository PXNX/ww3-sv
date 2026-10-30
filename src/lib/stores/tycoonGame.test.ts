import { describe, expect, it } from 'vitest';
import {
	ACHIEVEMENTS,
	OFFLINE_CAP_MS,
	OFFLINE_EFFICIENCY,
	PERKS,
	PRESTIGE_BONUS,
	PRESTIGE_UNIT,
	PRODUCERS,
	UPGRADES
} from '#lib/game/tycoon/config.js';
import { perkCost, producerDef, upgradeCost, upgradeDef } from '#lib/game/tycoon/economy.js';
import { SAVE_KEY } from '#lib/game/tycoon/save.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { loadMessages, missingMessages } from '#lib/testing/messages.js';
import { AUTOSAVE_MS, BEST_KEY, TycoonGame } from './tycoonGame.svelte';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

/** A Fake News wallet with a daily cap, like the career store's */
function wallet(left: number) {
	const coins = {
		coinsLeftToday: left,
		paid: 0,
		grantCoins(amount: number) {
			const granted = Math.min(amount, coins.coinsLeftToday);
			coins.coinsLeftToday -= granted;
			coins.paid += granted;
			return granted;
		}
	};
	return coins;
}

function setup(storage = memoryStorage(), start = 1_000_000, coins = wallet(150)) {
	const store = createStore(storage);
	const scores = createHighscores(store);
	const clock = { now: start };
	const game = new TycoonGame({
		store: () => store,
		scores: () => scores,
		seed: () => 7,
		now: () => clock.now,
		coins: () => coins
	});
	return { game, store, scores, clock, storage, coins };
}

describe('TycoonGame', () => {
	it('starts empty and running, with a first tap that pumps one barrel', () => {
		const { game } = setup();
		expect(game.status).toBe('playing');
		expect(game.barrels).toBe(0);
		expect(game.tap()).toBe(1);
		expect(game.barrels).toBe(1);
		expect(game.taps).toBe(1);
		expect(game.achievementIds).toContain('first_tap');
	});

	it('buys producers, which then pump on every step', () => {
		const { game } = setup();
		for (let i = 0; i < 15; i++) game.tap();
		expect(game.buy('pumpjack', 1)).toBe(1);
		expect(game.owned.pumpjack).toBe(1);
		// The taps unlocked the first achievement, so the last few are worth a little more
		expect(game.barrels).toBeLessThan(1);
		expect(game.buy('pumpjack', 1)).toBe(0);
		const before = game.barrels;
		// A pumpjack pays at the end of each one-second cycle
		game.update(900);
		expect(game.barrels).toBe(before);
		expect(game.progress.pumpjack).toBeCloseTo(0.9, 9);
		game.update(9_100);
		expect(game.barrels - before).toBeCloseTo(1, 6);
		expect(game.perSecond).toBeCloseTo(0.1, 9);
	});

	it('buys with the chosen amount and shows affordable upgrades', () => {
		const { game } = setup();
		game.state.barrels = 1000;
		game.buyAmount = 'max';
		const bought = game.buy('pumpjack');
		expect(bought).toBeGreaterThan(5);
		game.state.barrels = 500;
		game.update(0);
		expect(game.availableIds).toContain('click_bucket');
		expect(game.buyUpgrade('click_bucket')).toBe(true);
		expect(game.availableIds).not.toContain('click_bucket');
		// Buying ten pumpjacks unlocked a price discount, which leaves the taps alone
		expect(game.tapGain).toBeCloseTo(2, 9);
	});

	it('does nothing while paused, and picks up where it stopped', () => {
		const { game } = setup();
		game.state.owned.tanker = 10;
		game.pause();
		expect(game.tap()).toBe(0);
		expect(game.buy('pumpjack')).toBe(0);
		game.update(10_000);
		expect(game.barrels).toBe(0);
		game.resume();
		game.update(2000);
		expect(game.barrels).toBeCloseTo(20, 6);
	});

	it('answers a crisis and blocks taps during a protest', () => {
		const { game } = setup();
		game.state.owned.tanker = 10;
		game.state.barrels = 100_000;
		game.state.event = { kind: 'protest', remainingMs: 10_000 };
		game.update(0);
		expect(game.event?.kind).toBe('protest');
		game.choose('b');
		expect(game.event).toBeNull();
		expect(game.effects.map((effect) => effect.id)).toEqual(['protest']);
		expect(game.tap()).toBe(0);
	});

	it('nationalizes only when it pays, and keeps the points', () => {
		const { game } = setup();
		expect(game.nationalize()).toBe(false);
		game.state.runTotal = 4 * PRESTIGE_UNIT;
		game.state.barrels = 5;
		game.update(0);
		expect(game.pendingPoints).toBe(2);
		expect(game.nationalize()).toBe(true);
		expect(game.prestigePoints).toBe(2);
		expect(game.barrels).toBe(0);
		expect(game.multiplier).toBeCloseTo(1 + 2 * PRESTIGE_BONUS, 9);
	});

	it('spends points on investments that survive nationalizing', () => {
		const { game } = setup();
		game.state.prestigePoints = 3;
		game.update(0);
		expect(game.spendablePoints).toBe(3);
		expect(game.buyPerk('seed')).toBe(true);
		expect(game.buyPerk('seed')).toBe(false);
		// The points the level cost are gone
		const seed = PERKS.find((perk) => perk.id === 'seed')!;
		expect(game.spendablePoints).toBe(3 - perkCost(seed, 0));
		expect(game.prestigePoints).toBe(3 - perkCost(seed, 0));
		game.state.runTotal = PRESTIGE_UNIT;
		expect(game.nationalize()).toBe(true);
		expect(game.perks.seed).toBe(1);
		expect(game.barrels).toBe(seed.value);
		expect(game.runTotal).toBe(0);
	});
});

describe('upgrades in the shop', () => {
	it('lists the available upgrades with the cheapest first and their real prices', () => {
		const { game } = setup();
		game.state.owned.pumpjack = 600;
		game.state.owned.tanker = 300;
		game.update(0);
		const prices = game.availableIds.map((id) => game.upgradePrices[id]);
		expect(prices.length).toBeGreaterThan(5);
		expect([...prices].sort((a, b) => a - b)).toEqual(prices);
		for (const id of game.availableIds) {
			expect(game.upgradePrices[id]).toBe(upgradeCost(game.state, upgradeDef(id)!));
		}
	});
});

describe('the Fake News investment', () => {
	const fakeNews = PERKS.find((perk) => perk.id === 'fake_news')!;

	it('pays Fake News for every level bought', () => {
		const { game, coins } = setup();
		game.state.prestigePoints = 10_000;
		game.update(0);
		// The price shown is the price paid
		const price = game.perkPrices.fake_news;
		expect(price).toBe(perkCost(fakeNews, 0, game.state));
		expect(game.buyPerk('fake_news')).toBe(true);
		expect(coins.paid).toBe(fakeNews.value);
		expect(game.perks.fake_news).toBe(1);
		expect(game.prestigePoints).toBe(10_000 - price);
	});

	it('pays only what is left of the daily cap', () => {
		const { game, coins } = setup(memoryStorage(), 1_000_000, wallet(10));
		game.state.prestigePoints = 10_000;
		game.update(0);
		expect(game.buyPerk('fake_news')).toBe(true);
		expect(coins.paid).toBe(10);
	});

	it('keeps the points when the daily cap is used up', () => {
		const { game, coins } = setup(memoryStorage(), 1_000_000, wallet(0));
		game.state.prestigePoints = 10_000;
		game.update(0);
		expect(game.buyPerk('fake_news')).toBe(false);
		expect(game.perks.fake_news).toBe(0);
		expect(game.prestigePoints).toBe(10_000);
		expect(coins.paid).toBe(0);
	});
});

describe('TycoonGame persistence', () => {
	it('saves on purchases and loads the same game back', () => {
		const first = setup();
		first.game.state.barrels = 1000;
		first.game.buy('tanker', 3);
		first.game.tap();
		first.game.save();
		const second = setup(first.storage);
		second.game.load();
		expect(second.game.owned.tanker).toBe(3);
		expect(second.game.taps).toBe(1);
		expect(second.game.loaded).toBe(true);
	});

	it('saves by itself every few seconds', () => {
		const { game, storage } = setup();
		game.tap();
		expect(storage.getItem(`ww3:${SAVE_KEY}`)).toBeNull();
		for (let elapsed = 0; elapsed < AUTOSAVE_MS; elapsed += 100) game.update(100);
		expect(JSON.parse(storage.getItem(`ww3:${SAVE_KEY}`)!).taps).toBe(1);
	});

	it('credits the time between sessions, with a welcome-back report', () => {
		const first = setup(memoryStorage(), 1_000_000);
		first.game.state.owned.tanker = 10;
		first.game.save();
		const second = setup(first.storage, 1_000_000 + 600_000);
		second.game.load();
		expect(second.game.welcome?.creditedMs).toBe(600_000);
		// Ten tankers already have their first level, so they pump twice the base rate
		const rate = 10 * producerDef('tanker').baseCps * 2;
		expect(second.game.barrels).toBeCloseTo(rate * 600 * OFFLINE_EFFICIENCY, 6);
		second.game.dismissWelcome();
		expect(second.game.welcome).toBeNull();
	});

	it('caps the credited time and says so', () => {
		const first = setup(memoryStorage(), 1_000_000);
		first.game.state.owned.tanker = 10;
		first.game.save();
		const second = setup(first.storage, 1_000_000 + OFFLINE_CAP_MS * 5);
		second.game.load();
		expect(second.game.welcome?.capped).toBe(true);
		const rate = 10 * producerDef('tanker').baseCps * 2;
		expect(second.game.barrels).toBeCloseTo(rate * (OFFLINE_CAP_MS / 1000) * OFFLINE_EFFICIENCY, 3);
	});

	it('skips the report for a short absence and for nothing earned', () => {
		const first = setup(memoryStorage(), 1_000_000);
		first.game.state.owned.tanker = 10;
		first.game.save();
		const quick = setup(first.storage, 1_000_000 + 5000);
		quick.game.load();
		expect(quick.game.welcome).toBeNull();
		expect(quick.game.barrels).toBeGreaterThan(0);
		const empty = setup(memoryStorage(), 1_000_000);
		empty.game.save();
		const later = setup(empty.storage, 1_000_000 + 3_600_000);
		later.game.load();
		expect(later.game.welcome).toBeNull();
	});

	it('credits a hidden tab when it comes back', () => {
		const { game, clock } = setup();
		game.state.owned.tanker = 10;
		game.away();
		clock.now += 120_000;
		game.back();
		expect(game.welcome?.creditedMs).toBe(120_000);
		expect(game.barrels).toBeCloseTo(10 * 120 * OFFLINE_EFFICIENCY, 6);
		// Coming back twice does not credit twice
		game.back();
		expect(game.barrels).toBeCloseTo(10 * 120 * OFFLINE_EFFICIENCY, 6);
	});

	it('starts a fresh game from a corrupt save instead of crashing', () => {
		const corrupt = ['{"version":1,"barrels":', 'null', '"text"', '{"version":99}', '[1,2]'];
		for (const raw of corrupt) {
			const { game } = setup(memoryStorage({ [`ww3:${SAVE_KEY}`]: raw }));
			expect(() => game.load()).not.toThrow();
			expect(game.barrels).toBe(0);
			expect(game.loaded).toBe(true);
			expect(game.tap()).toBe(1);
		}
	});

	it('keeps the best lifetime total and survives a reset', () => {
		const { game, scores, storage } = setup();
		game.state.lifetime = 5000;
		game.state.barrels = 5000;
		game.save();
		expect(scores.get(BEST_KEY)).toBe(5000);
		expect(game.best).toBe(5000);
		game.reset();
		expect(game.barrels).toBe(0);
		expect(scores.get(BEST_KEY)).toBe(5000);
		expect(JSON.parse(storage.getItem(`ww3:${SAVE_KEY}`)!).lifetime).toBe(0);
	});

	it('works without any storage at all', () => {
		const game = new TycoonGame({
			store: () => createStore(null),
			scores: () => createHighscores(createStore(null)),
			seed: () => 1
		});
		game.load();
		game.tap();
		expect(() => game.save()).not.toThrow();
		// A critical tap may pay more than one barrel
		expect(game.barrels).toBeGreaterThanOrEqual(1);
	});
});

describe('Oil Tycoon messages', () => {
	it('has messages in every language', () => {
		expect(missingMessages(['tycoon_', 'mode_tycoon_'])).toEqual([]);
	});

	it('names every producer, upgrade and achievement the game defines', () => {
		const en = loadMessages('en');
		const missing: string[] = [];
		for (const producer of PRODUCERS) {
			for (const part of ['name', 'flavor']) {
				if (!en[`tycoon_producer_${producer.id}_${part}`]) missing.push(producer.id + part);
			}
		}
		for (const upgrade of UPGRADES) {
			if (upgrade.kind !== 'producer' && !en[`tycoon_upgrade_${upgrade.id}`])
				missing.push(upgrade.id);
		}
		for (const achievement of ACHIEVEMENTS) {
			if (!en[`tycoon_ach_name_${achievement.id}`]) missing.push(achievement.id);
		}
		expect(missing).toEqual([]);
	});
});

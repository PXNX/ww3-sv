import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	ACHIEVEMENTS,
	MAX_OWNED,
	OFFLINE_CAP_MS,
	OFFLINE_EFFICIENCY,
	PERKS,
	PRESTIGE_UNIT,
	PRODUCERS,
	STEP_MS,
	UPGRADES
} from './config.js';
import {
	critMultUpgrade,
	nextTierAt,
	perkCost,
	producerCost,
	producerDef,
	productionPerSecond,
	tapValue,
	upgradeCost
} from './economy.js';
import {
	applyOffline,
	buyPerk,
	buyProducer,
	buyUpgrade,
	canPrestige,
	checkAchievements,
	createState,
	grantProducerTiers,
	pendingPrestige,
	prestige,
	runCycles,
	stepGame,
	tap
} from './state.js';
import type { TycoonEvent } from './types.js';

const random = () => createRandom(5);
const fresh = () => createState(random());
const perkDef = (id: string) => PERKS.find((perk) => perk.id === id)!;
/** A random source that never rolls a critical tap */
const noCrit = () => 0.999;
const achievementIds = (events: TycoonEvent[]) =>
	events.flatMap((event) => (event.type === 'achievement' ? [event.id] : []));

describe('tapping', () => {
	it('pumps barrels into the bank and the totals and counts the tap', () => {
		const state = fresh();
		const { gained } = tap(state, noCrit);
		expect(gained).toBe(1);
		expect(state).toMatchObject({ barrels: 1, runTotal: 1, lifetime: 1, taps: 1 });
	});

	it('unlocks the first achievement once', () => {
		const state = fresh();
		expect(tap(state, noCrit).events).toEqual([{ type: 'achievement', id: 'first_tap' }]);
		expect(tap(state, noCrit).events).toEqual([]);
	});

	it('pays a critical tap several times over, decided by the random source', () => {
		const state = fresh();
		const expected = tapValue(state) * critMultUpgrade(state);
		const crit = tap(state, () => 0).gained;
		expect(crit).toBeCloseTo(expected, 9);
		expect(crit).toBeGreaterThan(tap(state, noCrit).gained);
	});
});

describe('maxing out producers', () => {
	it('never buys more than the most that can be owned', () => {
		const state = fresh();
		state.barrels = Infinity;
		state.owned.pumpjack = MAX_OWNED - 3;
		expect(buyProducer(state, 'pumpjack', 10).bought).toBe(3);
		expect(state.owned.pumpjack).toBe(MAX_OWNED);
		expect(buyProducer(state, 'pumpjack', 1).bought).toBe(0);
		expect(buyProducer(state, 'pumpjack', 'max').bought).toBe(0);
		expect(state.owned.pumpjack).toBe(MAX_OWNED);
	});

	it('unlocks the achievements for maxing several producers and all of them', () => {
		const state = fresh();
		const maxedIds = () =>
			ACHIEVEMENTS.filter((def) => def.kind === 'maxed').flatMap((def) =>
				state.achievements.includes(def.id) ? [def.id] : []
			);
		for (const [index, producer] of PRODUCERS.entries()) {
			state.owned[producer.id] = MAX_OWNED;
			checkAchievements(state);
			if (index === 3) expect(maxedIds()).toEqual([]);
			if (index === 4) expect(maxedIds()).toEqual(['maxed_5']);
			if (index === PRODUCERS.length - 2) expect(maxedIds()).not.toContain('maxed_all');
		}
		expect(maxedIds()).toEqual(['maxed_5', 'maxed_10', 'maxed_25', 'maxed_all']);
	});
});

describe('upgrade prices', () => {
	it('charges exactly the price shown, which grows with the producers owned', () => {
		const state = fresh();
		const upgrade = UPGRADES.find((def) => def.id === 'click_bucket')!;
		expect(upgradeCost(state, upgrade)).toBe(upgrade.cost);
		state.owned.pumpjack = 500;
		const price = upgradeCost(state, upgrade);
		expect(price).toBe(Math.ceil(upgrade.cost * 1.5));
		state.barrels = price - 1;
		expect(buyUpgrade(state, upgrade.id).bought).toBe(false);
		state.barrels = price + 7;
		expect(buyUpgrade(state, upgrade.id).bought).toBe(true);
		expect(state.barrels).toBe(7);
	});
});

describe('buying', () => {
	it('costs the curve price and refuses when the bank is short', () => {
		const state = fresh();
		state.barrels = 14;
		expect(buyProducer(state, 'pumpjack').bought).toBe(0);
		expect(state.barrels).toBe(14);
		state.barrels = 20;
		expect(buyProducer(state, 'pumpjack').bought).toBe(1);
		expect(state.owned.pumpjack).toBe(1);
		expect(state.barrels).toBe(5);
	});

	it('buys batches and the maximum', () => {
		const state = fresh();
		state.barrels = 1000;
		const cost10 = producerCost(producerDef('pumpjack'), 0, 10);
		expect(buyProducer(state, 'pumpjack', 10).bought).toBe(10);
		expect(state.barrels).toBeCloseTo(1000 - cost10, 9);
		expect(buyProducer(state, 'tanker', 'max').bought).toBeGreaterThan(0);
		expect(state.barrels).toBeGreaterThanOrEqual(0);
		expect(buyProducer(state, 'pumpjack', 1_000_000).bought).toBe(0);
	});

	it('buys an upgrade once, only when unlocked and affordable', () => {
		const state = fresh();
		state.barrels = 1e6;
		expect(buyUpgrade(state, 'tanker_1').bought).toBe(false);
		expect(buyUpgrade(state, 'no_such_upgrade').bought).toBe(false);
		expect(buyUpgrade(state, 'click_bucket').bought).toBe(true);
		expect(buyUpgrade(state, 'click_bucket').bought).toBe(false);
		expect(state.barrels).toBe(1e6 - 100);
		expect(tapValue(state)).toBe(2);
		state.barrels = 0;
		expect(buyUpgrade(state, 'click_valve').bought).toBe(false);
	});

	it("levels a producer up to its next tier with 'next'", () => {
		const state = fresh();
		state.barrels = 1e9;
		expect(nextTierAt('pumpjack', 0)).toBe(5);
		const { bought, events } = buyProducer(state, 'pumpjack', 'next');
		expect(bought).toBe(5);
		expect(state.owned.pumpjack).toBe(5);
		expect(state.upgrades).toContain('pumpjack_1');
		expect(events).toContainEqual({ type: 'levelup', producer: 'pumpjack', tier: 1 });
		// The next tap of "next" reaches the following tier, not the whole way
		expect(buyProducer(state, 'pumpjack', 'next').bought).toBe(5);
		expect(state.owned.pumpjack).toBe(10);
		expect(state.upgrades).toContain('pumpjack_2');
	});

	it('grants every tier the owned units already earned and never charges for it', () => {
		const state = fresh();
		state.owned.pumpjack = 25;
		state.barrels = 0;
		const events = grantProducerTiers(state, 'pumpjack');
		expect(events.map((event) => event.type)).toEqual(['levelup', 'levelup', 'levelup']);
		expect(state.upgrades).toEqual(['pumpjack_1', 'pumpjack_2', 'pumpjack_3']);
		expect(state.barrels).toBe(0);
		// A second call changes nothing
		expect(grantProducerTiers(state, 'pumpjack')).toEqual([]);
	});
});

describe('production tick', () => {
	it('earns output times elapsed time over whole cycles, however finely it is stepped', () => {
		const a = fresh();
		a.owned.tanker = 9;
		const b = fresh();
		b.owned.tanker = 9;
		// Keep crises away; nine tankers stay below the first stacking achievement
		a.nextEventMs = b.nextEventMs = 1e12;
		const rng = random();
		for (let i = 0; i < 100; i++) stepGame(a, STEP_MS, rng);
		stepGame(b, 100 * STEP_MS, rng);
		expect(a.barrels).toBeCloseTo(90, 6);
		expect(a.barrels).toBeCloseTo(b.barrels, 6);
		expect(a.runTotal).toBeCloseTo(a.barrels, 9);
		expect(a.lifetime).toBeCloseTo(a.barrels, 9);
	});

	it('earns nothing with nothing owned', () => {
		const state = fresh();
		stepGame(state, 60_000, random());
		expect(state.barrels).toBe(0);
	});
});

describe('production cycles', () => {
	it('pays a cycle out in one go when it ends', () => {
		const state = fresh();
		state.owned.refinery = 2;
		const cycle = producerDef('refinery').cycleMs;
		expect(runCycles(state, cycle - 1)).toBe(0);
		expect(state.barrels).toBe(0);
		expect(state.pending.refinery).toBeGreaterThan(0);
		const paid = runCycles(state, 1);
		expect(paid).toBeCloseTo((2 * 8 * cycle) / 1000, 9);
		expect(state.barrels).toBeCloseTo(paid, 9);
		expect(state.progress.refinery).toBe(0);
		expect(state.pending.refinery).toBe(0);
	});

	it('pays several cycles when a long step covers them', () => {
		const state = fresh();
		state.owned.pumpjack = 10;
		expect(runCycles(state, 3_500)).toBeCloseTo(3, 9);
		expect(state.progress.pumpjack).toBeCloseTo(500, 9);
	});

	it('stands still while a sanction cuts the producer', () => {
		const state = fresh();
		state.owned.tanker = 1;
		runCycles(state, 1000);
		state.effects.push({
			id: 'sanctioned',
			remainingMs: 5000,
			durationMs: 5000,
			prodMult: 1,
			clickMult: 1,
			producer: 'tanker'
		});
		expect(runCycles(state, 5000)).toBe(0);
		expect(state.progress.tanker).toBe(1000);
	});

	it('ends a cycle at once when a speed bonus made it shorter than its progress', () => {
		const state = fresh();
		state.owned.summit = 1;
		runCycles(state, 15_000);
		state.perks.speed = 10;
		expect(runCycles(state, STEP_MS)).toBeGreaterThan(0);
	});
});

describe('nationalization shop', () => {
	it('buys a level with spare points, up to the maximum', () => {
		const state = fresh();
		expect(buyPerk(state, 'tap').bought).toBe(false);
		state.prestigePoints = 100;
		expect(buyPerk(state, 'tap').bought).toBe(true);
		expect(state.perks.tap).toBe(1);
		// The points the level cost are gone from the balance
		expect(state.prestigePoints).toBe(100 - perkCost(perkDef('tap'), 0));
		state.perks.growth = 5;
		expect(buyPerk(state, 'growth').bought).toBe(false);
	});

	it('unlocks the investor achievement', () => {
		const state = fresh();
		state.prestigePoints = 1000;
		const ids: string[] = [];
		for (let i = 0; i < 10; i++) ids.push(...achievementIds(buyPerk(state, 'output').events));
		// Other achievements for fewer levels unlock on the way, each exactly once
		expect(ids).toContain('investor');
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('offline progress', () => {
	it('credits the calm output at the offline rate', () => {
		const state = fresh();
		state.owned.tanker = 10;
		const { report } = applyOffline(state, 60_000, random());
		expect(report.creditedMs).toBe(60_000);
		expect(report.capped).toBe(false);
		expect(report.barrels).toBeCloseTo(10 * 60 * OFFLINE_EFFICIENCY, 6);
		expect(state.barrels).toBeCloseTo(report.barrels, 9);
		expect(state.lifetime).toBeCloseTo(report.barrels, 9);
	});

	it('stops crediting at the cap', () => {
		const a = fresh();
		a.owned.tanker = 10;
		const b = fresh();
		b.owned.tanker = 10;
		const atCap = applyOffline(a, OFFLINE_CAP_MS, random());
		const wayPast = applyOffline(b, OFFLINE_CAP_MS * 20, random());
		expect(atCap.report.capped).toBe(false);
		expect(wayPast.report.capped).toBe(true);
		expect(wayPast.report.creditedMs).toBe(OFFLINE_CAP_MS);
		expect(wayPast.report.barrels).toBeCloseTo(atCap.report.barrels, 6);
		expect(atCap.report.barrels).toBeCloseTo(10 * (OFFLINE_CAP_MS / 1000) * OFFLINE_EFFICIENCY, 6);
	});

	it('credits nothing for a clock that ran backwards or a nonsense time', () => {
		const state = fresh();
		state.owned.tanker = 10;
		expect(applyOffline(state, -5000, random()).report.barrels).toBe(0);
		expect(applyOffline(state, Number.NaN, random()).report.barrels).toBe(0);
		expect(applyOffline(state, Infinity, random()).report.barrels).toBe(0);
		expect(state.barrels).toBe(0);
	});

	it('drops a crisis in progress and leaves a quiet time afterwards', () => {
		const state = fresh();
		state.owned.tanker = 10;
		state.event = { kind: 'protest', remainingMs: 5000 };
		state.effects.push({
			id: 'leak',
			remainingMs: 9000,
			durationMs: 9000,
			prodMult: 0.2,
			clickMult: 1
		});
		const { report } = applyOffline(state, 10_000, random());
		expect(state.event).toBeNull();
		expect(state.effects).toEqual([]);
		expect(state.nextEventMs).toBeGreaterThanOrEqual(20_000);
		// The calm output, not the leaking output, is what counts
		expect(report.barrels).toBeCloseTo(10 * 10 * OFFLINE_EFFICIENCY, 6);
	});

	it('unlocks achievements the offline time earned', () => {
		const state = fresh();
		state.owned.summit = 100;
		const { events } = applyOffline(state, OFFLINE_CAP_MS, random());
		expect(achievementIds(events)).toContain('giga');
	});
});

describe('prestige', () => {
	it('is not possible before a run is big enough', () => {
		const state = fresh();
		state.runTotal = PRESTIGE_UNIT - 1;
		expect(canPrestige(state)).toBe(false);
		expect(prestige(state, random())).toEqual([]);
		expect(state.prestiges).toBe(0);
	});

	it('turns the run into points and starts over, keeping what is permanent', () => {
		const state = fresh();
		state.owned.pumpjack = 40;
		state.upgrades.push('click_bucket');
		state.barrels = 5e6;
		state.runTotal = 9 * PRESTIGE_UNIT;
		state.lifetime = 12 * PRESTIGE_UNIT;
		state.taps = 77;
		state.achievements.push('first_tap');
		state.event = { kind: 'spike', remainingMs: 4000 };
		expect(pendingPrestige(state)).toBe(3);
		const events = prestige(state, random());
		expect(events[0]).toEqual({ type: 'prestige', points: 3 });
		expect(state.prestigePoints).toBe(3);
		expect(state.prestiges).toBe(1);
		expect(state.barrels).toBe(0);
		expect(state.runTotal).toBe(0);
		expect(Object.values(state.owned).every((count) => count === 0)).toBe(true);
		expect(state.upgrades).toEqual([]);
		expect(state.event).toBeNull();
		expect(state.lifetime).toBe(12 * PRESTIGE_UNIT);
		expect(state.taps).toBe(77);
		expect(state.achievements).toContain('first_tap');
		expect(state.achievements).toContain('nationalised');
	});

	it('makes the next run faster by the permanent multiplier', () => {
		const state = fresh();
		state.owned.tanker = 10;
		const before = productionPerSecond(state);
		state.runTotal = 100 * PRESTIGE_UNIT;
		prestige(state, random());
		state.owned.tanker = 10;
		// 10 points are +50 percent, the achievement adds a little on top
		expect(productionPerSecond(state)).toBeGreaterThan(before * 1.5);
		expect(productionPerSecond(state)).toBeLessThan(before * 1.6);
	});

	it('keeps the investments and starts the run with the start money', () => {
		const state = fresh();
		state.prestigePoints = 50;
		state.perks.seed = 2;
		state.owned.tanker = 3;
		runCycles(state, 1000);
		state.runTotal = PRESTIGE_UNIT;
		prestige(state, random());
		expect(state.perks.seed).toBe(2);
		expect(state.barrels).toBe(perkDef('seed').value * 10);
		expect(state.runTotal).toBe(0);
		expect(state.progress.tanker).toBe(0);
		expect(state.pending.tanker).toBe(0);
	});

	it('adds up over several restarts, each paying for its own run only', () => {
		const state = fresh();
		state.runTotal = 4 * PRESTIGE_UNIT;
		prestige(state, random());
		expect(pendingPrestige(state)).toBe(0);
		state.runTotal = 4 * PRESTIGE_UNIT;
		prestige(state, random());
		expect(state.prestigePoints).toBe(4);
		expect(state.prestiges).toBe(2);
	});
});

describe('achievements', () => {
	it('have unique ids', () => {
		expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(
			ACHIEVEMENTS.length
		);
	});

	it('unlock once, and only when their condition holds', () => {
		const state = fresh();
		state.lifetime = 2_000_000;
		state.owned.pumpjack = 10;
		const first = achievementIds(checkAchievements(state));
		expect(first).toEqual(expect.arrayContaining(['kilo', 'mega', 'stack']));
		expect(first).not.toContain('giga');
		expect(checkAchievements(state)).toEqual([]);
	});

	it('count upgrades, crises and diversification', () => {
		const state = fresh();
		for (const upgrade of UPGRADES.slice(0, 10)) state.upgrades.push(upgrade.id);
		state.eventsHandled = 10;
		state.sanctionsEvaded = 3;
		for (const id of Object.keys(state.owned) as (keyof typeof state.owned)[]) state.owned[id] = 1;
		expect(achievementIds(checkAchievements(state))).toEqual(
			expect.arrayContaining(['paper_trail', 'crisis_manager', 'loophole', 'diversified'])
		);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	ACHIEVEMENTS,
	COST_GROWTH,
	MAX_OWNED,
	OFFLINE_EFFICIENCY,
	PERKS,
	PRODUCERS,
	UPGRADES,
	type PerkId
} from './config.js';
import {
	achievementBonus,
	availablePoints,
	availableUpgrades,
	calmProduction,
	cycleMs,
	globalMultiplier,
	maxAffordable,
	nextTierAt,
	offlineEfficiency,
	perkCost,
	pointsSpent,
	prestigeGain,
	prestigeMultiplier,
	pricing,
	producerCost,
	producerDef,
	producerOutput,
	productionPerSecond,
	seedBarrels,
	speedMultiplier,
	tapValue,
	unitOutput,
	critChanceUpgrade,
	critMultUpgrade
} from './economy.js';
import { createState } from './state.js';

const pumpjack = producerDef('pumpjack');
const tanker = producerDef('tanker');
const fresh = () => createState(createRandom(1));
/** What one level of a shop investment is worth, so the tests follow the balancing */
const perkValue = (id: PerkId) => PERKS.find((perk) => perk.id === id)!.value;

describe('cost curve', () => {
	it('starts at the base price and grows 15 percent per unit owned', () => {
		expect(producerCost(pumpjack, 0)).toBe(15);
		expect(producerCost(pumpjack, 1)).toBe(Math.ceil(15 * COST_GROWTH));
		expect(producerCost(tanker, 10)).toBe(Math.ceil(100 * COST_GROWTH ** 10));
	});

	it('prices a batch as the sum of its single purchases', () => {
		for (const owned of [0, 3, 17]) {
			let sum = 0;
			for (let i = 0; i < 10; i++) sum += pumpjack.baseCost * COST_GROWTH ** (owned + i);
			expect(producerCost(pumpjack, owned, 10)).toBe(Math.ceil(sum));
		}
		expect(producerCost(pumpjack, 5, 0)).toBe(0);
	});

	it('is strictly increasing for every producer', () => {
		for (const def of PRODUCERS) {
			for (let owned = 0; owned < 60; owned++) {
				expect(producerCost(def, owned + 1)).toBeGreaterThan(producerCost(def, owned));
			}
		}
	});

	it('keeps every producer dearer and stronger than the one before, at a steady rate', () => {
		for (let i = 1; i < PRODUCERS.length; i++) {
			const [before, def] = [PRODUCERS[i - 1], PRODUCERS[i]];
			expect(def.baseCost, def.id).toBeGreaterThan(before.baseCost);
			expect(def.baseCps, def.id).toBeGreaterThan(before.baseCps);
			// No jumps, and from the fifth producer on the price rises faster than the output
			const costStep = def.baseCost / before.baseCost;
			const cpsStep = def.baseCps / before.baseCps;
			expect(costStep, def.id).toBeLessThan(20);
			expect(cpsStep, def.id).toBeLessThan(12);
			if (i >= 4) expect(cpsStep, def.id).toBeLessThan(costStep);
		}
	});

	it('finds the largest affordable batch exactly', () => {
		for (const owned of [0, 4, 30]) {
			for (const budget of [0, 14, 15, 100, 5_000, 123_456, 9e9]) {
				const count = maxAffordable(pumpjack, owned, budget);
				expect(producerCost(pumpjack, owned, count)).toBeLessThanOrEqual(budget);
				if (count > 0 || budget >= producerCost(pumpjack, owned, 1)) {
					expect(producerCost(pumpjack, owned, count + 1)).toBeGreaterThan(budget);
				}
			}
		}
	});

	it('never lets the count pass the cap or go non-finite', () => {
		expect(maxAffordable(pumpjack, MAX_OWNED - 2, 1e300)).toBeLessThanOrEqual(2);
		expect(maxAffordable(pumpjack, 0, Number.NaN)).toBe(0);
		expect(maxAffordable(pumpjack, 0, -5)).toBe(0);
		expect(producerCost(pumpjack, 99_999)).toBe(Infinity);
		expect(maxAffordable(pumpjack, 99_999, 1e300)).toBe(0);
	});
});

describe('production', () => {
	it('is zero with nothing owned and sums the producers', () => {
		const state = fresh();
		expect(productionPerSecond(state)).toBe(0);
		state.owned.pumpjack = 10;
		state.owned.tanker = 2;
		expect(productionPerSecond(state)).toBeCloseTo(10 * 0.1 + 2 * 1, 9);
	});

	it('doubles a producer with each of its tier upgrades', () => {
		const state = fresh();
		state.owned.tanker = 10;
		state.upgrades.push('tanker_1');
		// Every upgrade owned slows production by 2%
		expect(producerOutput(state, 'tanker')).toBeCloseTo(20 * 0.98, 9);
		state.upgrades.push('tanker_2');
		expect(producerOutput(state, 'tanker')).toBeCloseTo(40 * 0.98 ** 2, 9);
		expect(producerOutput(state, 'pumpjack')).toBe(0);
	});

	it('applies prestige, achievement and shop boosts and global upgrades to everything', () => {
		const state = fresh();
		state.owned.pumpjack = 10;
		state.prestigePoints = 10;
		// Two output boosts (+2% and +3%) and a tap boost that does not touch the output
		state.achievements = ['kilo', 'mega', 'first_tap'];
		state.perks.output = 2;
		state.upgrades.push('global_regulator');
		const expected = 1.5 * 1.05 * (1 + 2 * perkValue('output')) * 1.25;
		expect(globalMultiplier(state)).toBeCloseTo(expected, 9);
		expect(productionPerSecond(state)).toBeCloseTo(1 * expected * 0.98, 9);
	});

	it('pays 5% more overall production once a producer reaches its last level', () => {
		const state = fresh();
		expect(globalMultiplier(state)).toBe(1);
		state.owned.pumpjack = 999;
		expect(globalMultiplier(state)).toBe(1);
		state.owned.pumpjack = 1000;
		expect(globalMultiplier(state)).toBeCloseTo(1.05, 9);
	});

	it('lets crisis effects cut one producer or scale the output, but not calm production', () => {
		const state = fresh();
		state.owned.pumpjack = 10;
		state.owned.tanker = 10;
		state.effects.push({
			id: 'sanctioned',
			remainingMs: 1000,
			durationMs: 1000,
			prodMult: 1,
			clickMult: 1,
			producer: 'tanker'
		});
		expect(productionPerSecond(state)).toBeCloseTo(1, 9);
		state.effects.push({
			id: 'leak',
			remainingMs: 1000,
			durationMs: 1000,
			prodMult: 0.5,
			clickMult: 1
		});
		expect(productionPerSecond(state)).toBeCloseTo(0.5, 9);
		expect(calmProduction(state)).toBeCloseTo(11, 9);
	});

	it('turns a tap into more with click upgrades, a share of output and no crisis block', () => {
		const state = fresh();
		expect(tapValue(state)).toBe(1);
		state.upgrades.push('click_bucket', 'click_valve');
		expect(tapValue(state)).toBe(4);
		state.owned.tanker = 100;
		state.upgrades.push('clickcps_hands');
		// Hundred tankers own the first three levels (5, 10 and 25 units)
		expect(tapValue(state)).toBeCloseTo(4 + 0.01 * 100 * 0.98 ** 3, 9);
		state.effects.push({
			id: 'protest',
			remainingMs: 1000,
			durationMs: 1000,
			prodMult: 1,
			clickMult: 0
		});
		expect(tapValue(state)).toBe(0);
	});
});

describe('upgrades', () => {
	it('have unique ids and positive costs', () => {
		expect(new Set(UPGRADES.map((upgrade) => upgrade.id)).size).toBe(UPGRADES.length);
		for (const upgrade of UPGRADES) expect(upgrade.cost).toBeGreaterThan(0);
	});

	it('unlock by what is owned, and disappear once bought', () => {
		const state = fresh();
		const ids = () => availableUpgrades(state).map((upgrade) => upgrade.id);
		expect(ids()).toContain('click_bucket');
		state.upgrades.push('click_bucket');
		expect(ids()).not.toContain('click_bucket');
		// Producer levels are earned with the owned count, never sold in the shop
		state.owned.pumpjack = 5;
		expect(ids()).not.toContain('pumpjack_1');
		expect(nextTierAt('pumpjack', 0)).toBe(5);
		expect(nextTierAt('pumpjack', 5)).toBe(10);
		expect(nextTierAt('pumpjack', 25)).toBe(50);
	});
});

describe('prestige math', () => {
	it('pays nothing below the threshold and the square root of the run above it', () => {
		expect(prestigeGain(0)).toBe(0);
		expect(prestigeGain(999_999)).toBe(0);
		expect(prestigeGain(1_000_000)).toBe(1);
		expect(prestigeGain(4_000_000)).toBe(2);
		expect(prestigeGain(1e10)).toBe(100);
		expect(prestigeGain(Number.NaN)).toBe(0);
	});

	it('never pays less for a longer run', () => {
		let last = 0;
		for (let exp = 5; exp < 20; exp += 0.5) {
			const gain = prestigeGain(10 ** exp);
			expect(gain).toBeGreaterThanOrEqual(last);
			last = gain;
		}
	});

	it('adds five percent per point', () => {
		expect(prestigeMultiplier(0)).toBe(1);
		expect(prestigeMultiplier(10)).toBeCloseTo(1.5, 9);
		expect(prestigeMultiplier(-3)).toBe(1);
	});
});

describe('production cycles and speed', () => {
	it('makes the bigger producers take longer', () => {
		for (let i = 1; i < PRODUCERS.length; i++) {
			expect(PRODUCERS[i].cycleMs).toBeGreaterThan(PRODUCERS[i - 1].cycleMs);
		}
	});

	it('shortens the cycles with speed boosts, which raises the output by as much', () => {
		const state = fresh();
		state.owned.tanker = 10;
		const before = productionPerSecond(state);
		state.perks.speed = 5;
		state.achievements.push('flow');
		const speed = (1 + 5 * perkValue('speed')) * 1.05;
		expect(speedMultiplier(state)).toBeCloseTo(speed, 9);
		expect(cycleMs(state, 'tanker')).toBeCloseTo(tanker.cycleMs / speed, 9);
		expect(productionPerSecond(state)).toBeCloseTo(before * speed, 9);
		// What one cycle pays stays the same
		expect((unitOutput(state, 'tanker') * cycleMs(state, 'tanker')) / 1000).toBeCloseTo(
			(tanker.baseCps * tanker.cycleMs) / 1000,
			9
		);
	});

	it('adds 2% speed per speed upgrade, which costs no slowdown of its own', () => {
		const state = fresh();
		expect(speedMultiplier(state)).toBe(1);
		state.upgrades.push('speed_compressor');
		expect(speedMultiplier(state)).toBeCloseTo(1.02, 9);
		state.upgrades.push('speed_overdrive');
		expect(speedMultiplier(state)).toBeCloseTo(1.02 ** 2, 9);
		// Every other upgrade still slows the cycles by 2%
		state.upgrades.push('click_bucket');
		expect(speedMultiplier(state)).toBeCloseTo(1.02 ** 2 * 0.98, 9);
	});

	it('prices the speed upgrades above every other upgrade in the shop', () => {
		const shop = UPGRADES.filter((upgrade) => upgrade.kind !== 'producer');
		const others = shop.filter((upgrade) => upgrade.kind !== 'speed');
		const dearest = Math.max(...others.map((upgrade) => upgrade.cost));
		const speeds = shop.filter((upgrade) => upgrade.kind === 'speed');
		expect(speeds).toHaveLength(3);
		for (const upgrade of speeds) {
			expect(upgrade.value).toBeCloseTo(1.02, 9);
			expect(upgrade.cost).toBeGreaterThan(dearest);
		}
	});
});

describe('achievement boosts', () => {
	it('add up per kind and only count when unlocked', () => {
		const state = fresh();
		expect(achievementBonus(state, 'tap')).toBe(0);
		state.achievements = ['first_tap', 'tapper', 'kilo'];
		expect(achievementBonus(state, 'tap')).toBeCloseTo(0.15, 9);
		expect(achievementBonus(state, 'output')).toBeCloseTo(0.02, 9);
		expect(tapValue(state)).toBeCloseTo(1.15 * 1.02, 9);
	});

	it('boost a single producer', () => {
		const state = fresh();
		state.owned.shadowfleet = 1;
		state.owned.paperwork = 1;
		const fleet = producerOutput(state, 'shadowfleet');
		const paper = producerOutput(state, 'paperwork');
		state.achievements = ['loophole'];
		expect(producerOutput(state, 'shadowfleet')).toBeCloseTo(fleet * 1.25, 6);
		expect(producerOutput(state, 'paperwork')).toBeCloseTo(paper, 6);
	});

	it('discount producer prices', () => {
		const state = fresh();
		state.achievements = ['stack', 'hoard'];
		expect(pricing(state).factor).toBeCloseTo(0.95, 9);
		expect(producerCost(tanker, 0, 1, pricing(state))).toBe(95);
	});

	it('all grant a boost', () => {
		for (const achievement of ACHIEVEMENTS) expect(achievement.reward.value).toBeGreaterThan(0);
	});
});

describe('critical taps and the shop', () => {
	it('raises the chance and the bonus of a critical tap with the investments', () => {
		const state = fresh();
		const chance = critChanceUpgrade(state);
		const bonus = critMultUpgrade(state);
		state.perks.crit_chance = 3;
		state.perks.crit_mult = 4;
		expect(critChanceUpgrade(state)).toBeCloseTo(chance + 3 * perkValue('crit_chance'), 9);
		expect(critMultUpgrade(state)).toBeCloseTo(bonus + 4 * perkValue('crit_mult'), 9);
	});

	it('never lets the chance pass 95 percent', () => {
		const state = fresh();
		state.perks.crit_chance = 10;
		state.upgrades.push('crit_chance');
		expect(critChanceUpgrade(state)).toBeLessThanOrEqual(0.95);
	});
});

describe('nationalization shop', () => {
	it('never makes a level cheaper than the one before', () => {
		for (const perk of PERKS) {
			for (let level = 1; level < perk.maxLevel; level++) {
				expect(perkCost(perk, level)).toBeGreaterThanOrEqual(perkCost(perk, level - 1));
			}
		}
	});

	it('adds up what the bought levels cost, and offers the balance as it stands', () => {
		const state = fresh();
		state.prestigePoints = 10;
		state.perks.output = 2;
		state.perks.growth = 1;
		const output = PERKS.find((perk) => perk.id === 'output')!;
		const growth = PERKS.find((perk) => perk.id === 'growth')!;
		expect(pointsSpent(state.perks)).toBe(
			perkCost(output, 0) + perkCost(output, 1) + perkCost(growth, 0)
		);
		// Spent points leave the balance when a level is bought, so nothing more is taken off here
		expect(availablePoints(state)).toBe(10);
		state.prestigePoints = -3;
		expect(availablePoints(state)).toBe(0);
	});

	it('flattens the price curve', () => {
		const state = fresh();
		state.perks.growth = 3;
		const flat = pricing(state);
		expect(flat.growth).toBeCloseTo(COST_GROWTH - 3 * perkValue('growth'), 9);
		expect(producerCost(tanker, 10, 1, flat)).toBeLessThan(producerCost(tanker, 10));
		const count = maxAffordable(tanker, 10, 1e6, flat);
		expect(producerCost(tanker, 10, count, flat)).toBeLessThanOrEqual(1e6);
		expect(producerCost(tanker, 10, count + 1, flat)).toBeGreaterThan(1e6);
	});

	it('boosts taps, the start money and the offline rate', () => {
		const state = fresh();
		state.perks.tap = 2;
		expect(tapValue(state)).toBeCloseTo(1 + 2 * perkValue('tap'), 9);
		expect(seedBarrels(state)).toBe(0);
		state.perks.seed = 3;
		expect(seedBarrels(state)).toBe(perkValue('seed') * 100);
		state.perks.offline = 5;
		expect(offlineEfficiency(state)).toBeCloseTo(
			Math.min(1, OFFLINE_EFFICIENCY + 5 * perkValue('offline')),
			9
		);
	});
});

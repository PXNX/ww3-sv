import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { COST_GROWTH, MAX_OWNED, PRODUCERS, UPGRADES } from './config.js';
import {
	availableUpgrades,
	calmProduction,
	globalMultiplier,
	maxAffordable,
	prestigeGain,
	prestigeMultiplier,
	producerCost,
	producerDef,
	producerOutput,
	productionPerSecond,
	tapValue
} from './economy.js';
import { createState } from './state.js';

const pumpjack = producerDef('pumpjack');
const tanker = producerDef('tanker');
const fresh = () => createState(createRandom(1));

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
		expect(producerOutput(state, 'tanker')).toBeCloseTo(20, 9);
		state.upgrades.push('tanker_2');
		expect(producerOutput(state, 'tanker')).toBeCloseTo(40, 9);
		expect(producerOutput(state, 'pumpjack')).toBe(0);
	});

	it('applies prestige, achievements and global upgrades to everything', () => {
		const state = fresh();
		state.owned.pumpjack = 10;
		state.prestigePoints = 10;
		state.achievements = ['first_tap', 'tapper'];
		state.upgrades.push('global_regulator');
		const expected = 1.5 * 1.02 * 1.25;
		expect(globalMultiplier(state)).toBeCloseTo(expected, 9);
		expect(productionPerSecond(state)).toBeCloseTo(1 * expected, 9);
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
		expect(tapValue(state)).toBeCloseTo(4 + 0.01 * 100, 9);
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
		expect(ids()).not.toContain('pumpjack_1');
		state.owned.pumpjack = 5;
		expect(ids()).toContain('pumpjack_1');
		expect(ids()).not.toContain('pumpjack_2');
		state.upgrades.push('pumpjack_1');
		expect(ids()).not.toContain('pumpjack_1');
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

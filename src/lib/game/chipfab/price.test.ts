import { describe, expect, it } from 'vitest';
import { MAX_TIER, MIN_TIER, moduleGb } from './ram';
import { formatPrice, gpuPrice, modulePrice, shortageMarkup } from './price';

describe('shortage markup', () => {
	it('doubles prices at a full meter and ignores nonsense', () => {
		expect(shortageMarkup(0)).toBe(1);
		expect(shortageMarkup(100)).toBe(2);
		expect(shortageMarkup(250)).toBe(2);
		expect(shortageMarkup(-5)).toBe(1);
		expect(shortageMarkup(Number.NaN)).toBe(1);
	});
});

describe('module price', () => {
	it('rises with every tier', () => {
		for (let tier = MIN_TIER; tier < MAX_TIER; tier++) {
			expect(modulePrice(tier + 1)).toBeGreaterThan(modulePrice(tier));
		}
	});

	it('charges a premium per gigabyte for bigger modules', () => {
		const perGb = (tier: number) => modulePrice(tier) / moduleGb(tier);
		expect(perGb(6)).toBeGreaterThan(perGb(3));
		expect(perGb(3)).toBeGreaterThan(perGb(1));
	});

	it('follows the shortage', () => {
		expect(Math.abs(modulePrice(5, 100) - modulePrice(5) * 2)).toBeLessThanOrEqual(1);
	});
});

describe('GPU price', () => {
	it('climbs with the level and the shortage', () => {
		expect(gpuPrice(2)).toBeGreaterThan(gpuPrice(1));
		expect(gpuPrice(1, 50)).toBeGreaterThan(gpuPrice(1));
	});

	it('treats a bad level as level 1', () => {
		expect(gpuPrice(0)).toBe(gpuPrice(1));
		expect(gpuPrice(Number.NaN)).toBe(gpuPrice(1));
	});
});

describe('price formatting', () => {
	it('groups thousands with a dollar sign', () => {
		expect(formatPrice(2499)).toBe('$2,499');
		expect(formatPrice(87)).toBe('$87');
	});
});

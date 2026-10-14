import { describe, expect, it } from 'vitest';
import {
	HEART_RESET,
	HIGH_TIER,
	SHORTAGE_MAX,
	applyRelief,
	baseRate,
	clampShortage,
	isShortageFull,
	reliefForTier,
	shortageRate,
	tickShortage
} from './shortage';

describe('shortage curve', () => {
	it('rises faster with every level, up to a cap', () => {
		expect(baseRate(2)).toBeGreaterThan(baseRate(1));
		expect(baseRate(5)).toBeGreaterThan(baseRate(4));
		expect(baseRate(1000)).toBe(baseRate(5000));
		expect(baseRate(1000)).toBeLessThanOrEqual(6);
	});

	it('rises faster the longer a level lasts, by at most half again', () => {
		expect(shortageRate(1, 30)).toBeGreaterThan(shortageRate(1, 0));
		expect(shortageRate(1, 90)).toBeCloseTo(baseRate(1) * 1.5);
		expect(shortageRate(1, 900)).toBeCloseTo(baseRate(1) * 1.5);
		expect(shortageRate(1, -5)).toBe(baseRate(1));
	});

	it('is linear over a short tick and never leaves 0 to 100', () => {
		const rate = shortageRate(1, 0);
		expect(tickShortage(10, 1000, 1, 0)).toBeCloseTo(10 + rate);
		expect(tickShortage(99.9, 60_000, 1, 0)).toBe(SHORTAGE_MAX);
		expect(tickShortage(5, -1000, 1, 0)).toBe(5);
		expect(tickShortage(NaN, 1000, 1, 0)).toBeGreaterThanOrEqual(0);
	});

	it('takes about a minute to fill on level 1 if nothing eases it', () => {
		let value = 0;
		let seconds = 0;
		while (!isShortageFull(value) && seconds < 600) {
			value = tickShortage(value, 1000, 1, seconds);
			seconds++;
		}
		expect(seconds).toBeGreaterThan(40);
		expect(seconds).toBeLessThan(90);
	});

	it('fills quicker on a later level', () => {
		const fill = (level: number) => {
			let value = 0;
			let seconds = 0;
			while (!isShortageFull(value)) {
				value = tickShortage(value, 1000, level, seconds);
				seconds++;
			}
			return seconds;
		};
		expect(fill(5)).toBeLessThan(fill(1));
	});
});

describe('relief from high-tier output', () => {
	it('gives nothing below the high tier', () => {
		expect(reliefForTier(1)).toBe(0);
		expect(reliefForTier(HIGH_TIER - 1)).toBe(0);
		expect(reliefForTier(HIGH_TIER)).toBeGreaterThan(0);
	});

	it('grows with every tier', () => {
		for (let tier = HIGH_TIER; tier < 8; tier++) {
			expect(reliefForTier(tier + 1)).toBeGreaterThan(reliefForTier(tier));
		}
	});

	it('lowers the meter but never below zero', () => {
		expect(applyRelief(40, reliefForTier(HIGH_TIER))).toBe(40 - reliefForTier(HIGH_TIER));
		expect(applyRelief(3, 50)).toBe(0);
		expect(applyRelief(40, -10)).toBe(40);
	});

	it('beats the shortage for a good player: 32 GB modules outpace the level 1 rise', () => {
		// One 32 GB module needs 8 base modules; the meter rises about 1.4 per second
		expect(reliefForTier(4)).toBeGreaterThan(baseRate(1) * 4);
	});
});

describe('limits', () => {
	it('clamps junk to the valid range', () => {
		expect(clampShortage(-4)).toBe(0);
		expect(clampShortage(400)).toBe(SHORTAGE_MAX);
		expect(clampShortage(Infinity)).toBe(0);
	});

	it('is full exactly at the maximum and restarts lower after a heart', () => {
		expect(isShortageFull(99.99)).toBe(false);
		expect(isShortageFull(SHORTAGE_MAX)).toBe(true);
		expect(HEART_RESET).toBeLessThan(SHORTAGE_MAX);
		expect(HEART_RESET).toBeGreaterThan(0);
	});
});

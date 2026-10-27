import { describe, expect, it } from 'vitest';
import { isNearBest, NEAR_BEST_PERCENT } from './config.js';

describe('isNearBest', () => {
	it('accepts a run within the share of the previous best', () => {
		expect(isNearBest(85, 100)).toBe(true);
		expect(isNearBest(100, 100)).toBe(true);
		expect(isNearBest(9_000, 10_000)).toBe(true);
		expect(isNearBest(85_000, 100_000)).toBe(true);
	});

	it('rejects a run further away', () => {
		expect(isNearBest(84, 100)).toBe(false);
		expect(isNearBest(NEAR_BEST_PERCENT - 1, 100)).toBe(false);
	});

	it('rejects a run above the best, which is a new best instead', () => {
		expect(isNearBest(120, 100)).toBe(false);
	});

	it('needs a best and a score worth keeping', () => {
		expect(isNearBest(50, null)).toBe(false);
		expect(isNearBest(0, 100)).toBe(false);
		expect(isNearBest(0, 0)).toBe(false);
	});

	it('scales with the mode: a three-point gap at 20 is not close, at 2 000 it is', () => {
		expect(isNearBest(17, 20)).toBe(true);
		expect(isNearBest(1_997, 2_000)).toBe(true);
	});
});

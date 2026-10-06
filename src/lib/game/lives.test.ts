import { describe, expect, it } from 'vitest';
import { clampLives, heartStates, lostHearts } from './lives';

describe('clampLives', () => {
	it('keeps values inside 0..max', () => {
		expect(clampLives(2, 3)).toBe(2);
		expect(clampLives(-1, 3)).toBe(0);
		expect(clampLives(9, 3)).toBe(3);
	});

	it('rounds down and treats non-finite values as 0', () => {
		expect(clampLives(2.9, 3)).toBe(2);
		expect(clampLives(Number.NaN, 3)).toBe(0);
		expect(clampLives(Number.POSITIVE_INFINITY, 3)).toBe(0);
	});
});

describe('heartStates', () => {
	it('fills the first hearts and empties the rest', () => {
		expect(heartStates(2, 3)).toEqual(['full', 'full', 'empty']);
		expect(heartStates(3, 3)).toEqual(['full', 'full', 'full']);
		expect(heartStates(0, 3)).toEqual(['empty', 'empty', 'empty']);
	});

	it('clamps out-of-range lives and handles a zero or negative max', () => {
		expect(heartStates(5, 2)).toEqual(['full', 'full']);
		expect(heartStates(-2, 2)).toEqual(['empty', 'empty']);
		expect(heartStates(1, 0)).toEqual([]);
		expect(heartStates(1, -3)).toEqual([]);
	});
});

describe('lostHearts', () => {
	it('returns the indices of the hearts that were just lost', () => {
		expect(lostHearts(3, 2, 3)).toEqual([2]);
		expect(lostHearts(3, 0, 3)).toEqual([0, 1, 2]);
	});

	it('returns nothing when lives stay or grow (new game, extra life)', () => {
		expect(lostHearts(2, 2, 3)).toEqual([]);
		expect(lostHearts(0, 3, 3)).toEqual([]);
	});
});

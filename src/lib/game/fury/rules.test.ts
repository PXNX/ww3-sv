import { describe, expect, it } from 'vitest';
import {
	UNUSED_BIRD_BONUS,
	calculateStars,
	finalScore,
	resolveTurn,
	unusedBirdBonus
} from './rules';

describe('resolveTurn', () => {
	it('wins as soon as every dome is gone, even mid-tumble and with no birds left', () => {
		expect(resolveTurn({ domesRemaining: 0, birdsLeft: 2, settled: false })).toBe('won');
		expect(resolveTurn({ domesRemaining: 0, birdsLeft: 0, settled: true })).toBe('won');
	});

	it('waits while things are still moving', () => {
		expect(resolveTurn({ domesRemaining: 1, birdsLeft: 0, settled: false })).toBe('wait');
	});

	it('loads the next bird once settled', () => {
		expect(resolveTurn({ domesRemaining: 2, birdsLeft: 1, settled: true })).toBe('next-bird');
	});

	it('fails when out of birds with domes remaining, after settling', () => {
		expect(resolveTurn({ domesRemaining: 1, birdsLeft: 0, settled: true })).toBe('failed');
	});
});

describe('calculateStars', () => {
	const won = { won: true, birdsLeft: 0, blocksDestroyed: 0, blocksTotal: 10 };

	it('gives no stars for a lost level', () => {
		expect(calculateStars({ ...won, won: false, birdsLeft: 3, blocksDestroyed: 10 })).toBe(0);
	});

	it('gives one star for winning with nothing extra', () => {
		expect(calculateStars(won)).toBe(1);
	});

	it('adds a star for a bird left over and one for destroying half the blocks', () => {
		expect(calculateStars({ ...won, birdsLeft: 1 })).toBe(2);
		expect(calculateStars({ ...won, blocksDestroyed: 5 })).toBe(2);
		expect(calculateStars({ ...won, blocksDestroyed: 4 })).toBe(1);
		expect(calculateStars({ ...won, birdsLeft: 2, blocksDestroyed: 9 })).toBe(3);
	});

	it('treats a level without blocks as fully destroyed', () => {
		expect(calculateStars({ ...won, blocksTotal: 0 })).toBe(2);
	});
});

describe('scoring', () => {
	it('pays a bonus per unused bird', () => {
		expect(unusedBirdBonus(0)).toBe(0);
		expect(unusedBirdBonus(3)).toBe(3 * UNUSED_BIRD_BONUS);
		expect(unusedBirdBonus(-1)).toBe(0);
	});

	it('adds the bonus only for a won level', () => {
		expect(finalScore(1500, 2, true)).toBe(1500 + 2 * UNUSED_BIRD_BONUS);
		expect(finalScore(1500, 2, false)).toBe(1500);
	});
});

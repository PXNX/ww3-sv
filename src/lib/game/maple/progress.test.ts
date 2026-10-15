import { describe, expect, it } from 'vitest';
import {
	EMPTY_PROGRESS,
	isMapleProgress,
	isUnlocked,
	recordFinish,
	totalStars
} from './progress.js';

const IDS = ['a', 'b', 'c'];

describe('maple progress', () => {
	it('opens the first level, and the next one after a finish', () => {
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 0)).toBe(true);
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 1)).toBe(false);
		const next = recordFinish(EMPTY_PROGRESS, 'a', 1);
		expect(isUnlocked(next, IDS, 1)).toBe(true);
		expect(isUnlocked(next, IDS, 2)).toBe(false);
		expect(isUnlocked(next, IDS, -1)).toBe(false);
	});

	it('keeps the better star rating', () => {
		const two = recordFinish(EMPTY_PROGRESS, 'a', 2);
		expect(recordFinish(two, 'a', 1)).toBe(two);
		expect(recordFinish(two, 'a', 3).stars.a).toBe(3);
		expect(recordFinish(EMPTY_PROGRESS, 'a', 9).stars.a).toBe(3);
	});

	it('adds up the stars', () => {
		const progress = recordFinish(recordFinish(EMPTY_PROGRESS, 'a', 3), 'b', 2);
		expect(totalStars(progress, IDS)).toBe(5);
	});

	it('validates stored data', () => {
		expect(isMapleProgress(EMPTY_PROGRESS)).toBe(true);
		expect(isMapleProgress({ version: 1, stars: { a: 3 } })).toBe(true);
		expect(isMapleProgress({ version: 1, stars: { a: 4 } })).toBe(false);
		expect(isMapleProgress({ version: 2, stars: {} })).toBe(false);
		expect(isMapleProgress({ version: 1, stars: [] })).toBe(false);
		expect(isMapleProgress(null)).toBe(false);
	});
});

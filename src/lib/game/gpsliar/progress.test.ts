import { describe, expect, it } from 'vitest';
import {
	EMPTY_PROGRESS,
	isUnlocked,
	isGpsLiarProgress,
	recordFinish,
	totalStars
} from './progress';

const IDS = ['a', 'b', 'c'];

describe('progress', () => {
	it('opens only the first level at the start', () => {
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 0)).toBe(true);
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 1)).toBe(false);
		expect(isUnlocked(EMPTY_PROGRESS, IDS, -1)).toBe(false);
	});

	it('opens the next level once one is finished', () => {
		const progress = recordFinish(EMPTY_PROGRESS, 'a', 1);
		expect(isUnlocked(progress, IDS, 1)).toBe(true);
		expect(isUnlocked(progress, IDS, 2)).toBe(false);
	});

	it('keeps the better star rating only', () => {
		const two = recordFinish(EMPTY_PROGRESS, 'a', 2);
		expect(recordFinish(two, 'a', 1)).toBe(two);
		expect(recordFinish(two, 'a', 3).stars.a).toBe(3);
		expect(recordFinish(EMPTY_PROGRESS, 'a', 9).stars.a).toBe(3);
	});

	it('sums the stars', () => {
		const progress = recordFinish(recordFinish(EMPTY_PROGRESS, 'a', 3), 'b', 2);
		expect(totalStars(progress, IDS)).toBe(5);
	});

	it('validates stored data', () => {
		expect(isGpsLiarProgress(EMPTY_PROGRESS)).toBe(true);
		expect(isGpsLiarProgress({ version: 1, stars: { a: 3 } })).toBe(true);
		expect(isGpsLiarProgress({ version: 2, stars: {} })).toBe(false);
		expect(isGpsLiarProgress({ version: 1, stars: { a: 4 } })).toBe(false);
		expect(isGpsLiarProgress({ version: 1, stars: [] })).toBe(false);
		expect(isGpsLiarProgress(null)).toBe(false);
	});
});

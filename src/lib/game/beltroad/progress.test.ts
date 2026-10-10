import { describe, expect, it } from 'vitest';
import {
	EMPTY_PROGRESS,
	isBeltRoadProgress,
	isUnlocked,
	recordFinish,
	totalStars
} from './progress';

const ids = ['a', 'b', 'c'];

describe('progress', () => {
	it('keeps only the best star rating per level', () => {
		let progress = recordFinish(EMPTY_PROGRESS, 'a', 2);
		expect(progress.stars).toEqual({ a: 2 });
		progress = recordFinish(progress, 'a', 1);
		expect(progress.stars.a).toBe(2);
		progress = recordFinish(progress, 'a', 3);
		expect(progress.stars.a).toBe(3);
		expect(recordFinish(progress, 'a', 2)).toBe(progress);
	});

	it('unlocks a level once the one before it is finished', () => {
		expect(isUnlocked(EMPTY_PROGRESS, ids, 0)).toBe(true);
		expect(isUnlocked(EMPTY_PROGRESS, ids, 1)).toBe(false);
		const progress = recordFinish(EMPTY_PROGRESS, 'a', 1);
		expect(isUnlocked(progress, ids, 1)).toBe(true);
		expect(isUnlocked(progress, ids, 2)).toBe(false);
		expect(isUnlocked(progress, ids, -1)).toBe(false);
	});

	it('adds up stars', () => {
		const progress = recordFinish(recordFinish(EMPTY_PROGRESS, 'a', 3), 'c', 2);
		expect(totalStars(progress, ids)).toBe(5);
	});

	it('rejects stored data that is not valid progress', () => {
		expect(isBeltRoadProgress(EMPTY_PROGRESS)).toBe(true);
		expect(isBeltRoadProgress({ version: 1, stars: { a: 4 } })).toBe(false);
		expect(isBeltRoadProgress({ version: 2, stars: {} })).toBe(false);
		expect(isBeltRoadProgress({ version: 1, stars: [] })).toBe(false);
		expect(isBeltRoadProgress(null)).toBe(false);
	});
});

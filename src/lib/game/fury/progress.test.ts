import { describe, expect, it } from 'vitest';
import {
	EMPTY_PROGRESS,
	isFuryProgress,
	isFurySettings,
	isUnlocked,
	recordWin,
	totalStars
} from './progress';

const ids = ['level-01', 'level-02', 'level-03'];

describe('progress', () => {
	it('opens only the first level at the start', () => {
		expect(ids.map((_, index) => isUnlocked(EMPTY_PROGRESS, ids, index))).toEqual([
			true,
			false,
			false
		]);
		expect(isUnlocked(EMPTY_PROGRESS, ids, -1)).toBe(false);
	});

	it('unlocks the next level after a win and keeps the best stars', () => {
		let progress = recordWin(EMPTY_PROGRESS, 'level-01', 2);
		expect(isUnlocked(progress, ids, 1)).toBe(true);
		expect(isUnlocked(progress, ids, 2)).toBe(false);
		progress = recordWin(progress, 'level-01', 1);
		expect(progress.stars['level-01']).toBe(2);
		progress = recordWin(progress, 'level-01', 3);
		expect(progress.stars['level-01']).toBe(3);
		expect(totalStars(recordWin(progress, 'level-02', 1), ids)).toBe(4);
	});

	it('does not change the stored object', () => {
		recordWin(EMPTY_PROGRESS, 'level-01', 3);
		expect(EMPTY_PROGRESS.stars).toEqual({});
	});

	it('rejects corrupted stored data', () => {
		expect(isFuryProgress({ version: 1, stars: { 'level-01': 2 } })).toBe(true);
		expect(isFuryProgress({ version: 2, stars: {} })).toBe(false);
		expect(isFuryProgress({ version: 1, stars: { 'level-01': 7 } })).toBe(false);
		expect(isFuryProgress({ version: 1, stars: [] })).toBe(false);
		expect(isFuryProgress(null)).toBe(false);
		expect(isFurySettings({ longPreview: true })).toBe(true);
		expect(isFurySettings({ longPreview: 'yes' })).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import {
	EMPTY_PROGRESS,
	isFuryProgress,
	isFurySettings,
	isUnlocked,
	recordWin,
	totalStars,
	visibleLevelCount
} from './progress';

const ids = ['level-01', 'level-02', 'level-03'];
const idAt = (index: number) => ids[index];

describe('progress', () => {
	it('opens only the first level at the start', () => {
		expect(ids.map((_, index) => isUnlocked(EMPTY_PROGRESS, idAt, index))).toEqual([
			true,
			false,
			false
		]);
		expect(isUnlocked(EMPTY_PROGRESS, idAt, -1)).toBe(false);
	});

	it('unlocks the next level after a win and keeps the best stars', () => {
		let progress = recordWin(EMPTY_PROGRESS, 'level-01', 2);
		expect(isUnlocked(progress, idAt, 1)).toBe(true);
		expect(isUnlocked(progress, idAt, 2)).toBe(false);
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

describe('endless levels', () => {
	const idAt = (index: number) => `level-${String(index + 1).padStart(2, '0')}`;
	const winThrough = (count: number) =>
		Array.from({ length: count }).reduce<typeof EMPTY_PROGRESS>(
			(progress, _, index) => recordWin(progress, idAt(index), 1),
			EMPTY_PROGRESS
		);

	it('shows only the prepared levels until all of them are won', () => {
		expect(visibleLevelCount(EMPTY_PROGRESS, 15, idAt)).toBe(15);
		expect(visibleLevelCount(winThrough(14), 15, idAt)).toBe(15);
	});

	it('adds the next generated level after every win past the prepared ones', () => {
		expect(visibleLevelCount(winThrough(15), 15, idAt)).toBe(16);
		expect(visibleLevelCount(winThrough(16), 15, idAt)).toBe(17);
		expect(visibleLevelCount(winThrough(40), 15, idAt)).toBe(41);
	});

	it('unlocks generated levels one after the other', () => {
		const progress = winThrough(15);
		expect(isUnlocked(progress, idAt, 15)).toBe(true);
		expect(isUnlocked(progress, idAt, 16)).toBe(false);
		expect(isUnlocked(recordWin(progress, 'level-16', 2), idAt, 16)).toBe(true);
	});
});

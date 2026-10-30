import { describe, expect, it } from 'vitest';
import { GHOST_LIMIT, PAYOUT } from './config.js';
import {
	EMPTY_PROGRESS,
	isFinished,
	isSabotageProgress,
	isUnlocked,
	recordFinish,
	totalStars
} from './progress.js';
import { earnedStars, payoutFor, starCount } from './scoring.js';

const IDS = ['a', 'b', 'c'];

describe('progress', () => {
	it('opens the first job, and every next one after the previous is finished', () => {
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 0)).toBe(true);
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 1)).toBe(false);
		const progress = recordFinish(EMPTY_PROGRESS, 'a', 0);
		expect(isFinished(progress, 'a')).toBe(true);
		expect(isUnlocked(progress, IDS, 1)).toBe(true);
		expect(isUnlocked(progress, IDS, 2)).toBe(false);
	});

	it('rejects indexes outside the list', () => {
		expect(isUnlocked(EMPTY_PROGRESS, IDS, -1)).toBe(false);
		expect(isUnlocked(EMPTY_PROGRESS, IDS, 3)).toBe(false);
	});

	it('keeps the better star count and does not change the old progress object', () => {
		const first = recordFinish(EMPTY_PROGRESS, 'a', 2);
		expect(EMPTY_PROGRESS.stars).toEqual({});
		expect(recordFinish(first, 'a', 1)).toBe(first);
		expect(recordFinish(first, 'a', 3).stars.a).toBe(3);
		expect(recordFinish(first, 'b', 0).stars).toEqual({ a: 2, b: 0 });
	});

	it('clamps star counts', () => {
		expect(recordFinish(EMPTY_PROGRESS, 'a', 9).stars.a).toBe(3);
		expect(recordFinish(EMPTY_PROGRESS, 'a', -4).stars.a).toBe(0);
	});

	it('adds up the stars of the listed jobs only', () => {
		const progress = recordFinish(
			recordFinish(recordFinish(EMPTY_PROGRESS, 'a', 3), 'b', 1),
			'zzz',
			3
		);
		expect(totalStars(progress, IDS)).toBe(4);
	});

	it('validates what comes back from storage', () => {
		expect(isSabotageProgress(EMPTY_PROGRESS)).toBe(true);
		expect(isSabotageProgress({ version: 1, stars: { a: 3, b: 0 } })).toBe(true);
		expect(isSabotageProgress({ version: 2, stars: {} })).toBe(false);
		expect(isSabotageProgress({ version: 1, stars: { a: 4 } })).toBe(false);
		expect(isSabotageProgress({ version: 1, stars: { a: 1.5 } })).toBe(false);
		expect(isSabotageProgress({ version: 1, stars: [] })).toBe(false);
		expect(isSabotageProgress(null)).toBe(false);
		expect(isSabotageProgress('x')).toBe(false);
	});
});

describe('scoring', () => {
	const good = { peakSuspicion: 0.1, seconds: 40, par: 60, noiseAlarms: 0 };

	it('awards the three stars independently', () => {
		expect(earnedStars(good)).toEqual({ unseen: true, quick: true, quiet: true });
		expect(earnedStars({ ...good, peakSuspicion: GHOST_LIMIT }).unseen).toBe(false);
		expect(earnedStars({ ...good, peakSuspicion: GHOST_LIMIT - 0.01 }).unseen).toBe(true);
		expect(earnedStars({ ...good, seconds: 60 }).quick).toBe(true);
		expect(earnedStars({ ...good, seconds: 60.1 }).quick).toBe(false);
		expect(earnedStars({ ...good, noiseAlarms: 1 }).quiet).toBe(false);
	});

	it('counts stars and pays a base fee plus a bonus for each', () => {
		expect(starCount(earnedStars(good))).toBe(3);
		expect(starCount(earnedStars({ peakSuspicion: 1, seconds: 999, par: 1, noiseAlarms: 3 }))).toBe(
			0
		);
		expect(payoutFor(0)).toBe(PAYOUT.base);
		expect(payoutFor(3)).toBe(PAYOUT.base + 3 * PAYOUT.perStar);
	});
});

import { describe, expect, it } from 'vitest';
import {
	EMPTY_STATS,
	currentStreak,
	isWordleSave,
	isWordleStats,
	recordResult,
	saveKey,
	winPercent,
	type WordleSave,
	type WordleStats
} from './stats';

describe('recordResult', () => {
	it('starts a streak with a first win and counts the guesses', () => {
		const stats = recordResult(EMPTY_STATS, '2026-10-15', true, 4);
		expect(stats).toEqual({
			played: 1,
			won: 1,
			streak: 1,
			maxStreak: 1,
			lastWonDay: '2026-10-15',
			distribution: [0, 0, 0, 1, 0, 0]
		});
	});

	it('does not change the empty stats object', () => {
		recordResult(EMPTY_STATS, '2026-10-15', true, 1);
		expect(EMPTY_STATS.played).toBe(0);
		expect(EMPTY_STATS.distribution).toEqual([0, 0, 0, 0, 0, 0]);
	});

	it('continues the streak on consecutive days', () => {
		let stats = recordResult(EMPTY_STATS, '2026-10-14', true, 3);
		stats = recordResult(stats, '2026-10-15', true, 5);
		stats = recordResult(stats, '2026-10-16', true, 2);
		expect(stats.streak).toBe(3);
		expect(stats.maxStreak).toBe(3);
		expect(stats.won).toBe(3);
		expect(stats.distribution).toEqual([0, 1, 1, 0, 1, 0]);
	});

	it('continues the streak across a month and a year border', () => {
		let stats = recordResult(EMPTY_STATS, '2026-12-31', true, 3);
		stats = recordResult(stats, '2027-01-01', true, 3);
		expect(stats.streak).toBe(2);
		stats = recordResult(EMPTY_STATS, '2026-09-30', true, 3);
		stats = recordResult(stats, '2026-10-01', true, 3);
		expect(stats.streak).toBe(2);
	});

	it('restarts the streak after a missed day but keeps the best one', () => {
		let stats = recordResult(EMPTY_STATS, '2026-10-10', true, 3);
		stats = recordResult(stats, '2026-10-11', true, 3);
		stats = recordResult(stats, '2026-10-13', true, 3);
		expect(stats.streak).toBe(1);
		expect(stats.maxStreak).toBe(2);
	});

	it('ends the streak with a loss, which counts as played but not won', () => {
		let stats = recordResult(EMPTY_STATS, '2026-10-14', true, 3);
		stats = recordResult(stats, '2026-10-15', false, 6);
		expect(stats.streak).toBe(0);
		expect(stats.maxStreak).toBe(1);
		expect(stats.played).toBe(2);
		expect(stats.won).toBe(1);
		expect(stats.distribution).toEqual([0, 0, 1, 0, 0, 0]);
		// a win the next day starts again at 1
		stats = recordResult(stats, '2026-10-16', true, 4);
		expect(stats.streak).toBe(1);
		expect(stats.maxStreak).toBe(1);
	});

	it('ignores a second win recorded for the same day', () => {
		const once = recordResult(EMPTY_STATS, '2026-10-15', true, 3);
		expect(recordResult(once, '2026-10-15', true, 3)).toEqual(once);
	});

	it('ignores a guess count outside 1 to 6 in the distribution', () => {
		expect(recordResult(EMPTY_STATS, '2026-10-15', true, 7).distribution).toEqual([
			0, 0, 0, 0, 0, 0
		]);
		expect(recordResult(EMPTY_STATS, '2026-10-15', true, 0).distribution).toEqual([
			0, 0, 0, 0, 0, 0
		]);
	});
});

describe('currentStreak', () => {
	const stats: WordleStats = {
		...EMPTY_STATS,
		played: 3,
		won: 3,
		streak: 3,
		maxStreak: 3,
		lastWonDay: '2026-10-14'
	};

	it('still counts when the last win was yesterday (today may still be open)', () => {
		expect(currentStreak(stats, '2026-10-15')).toBe(3);
	});

	it('counts when the last win was today', () => {
		expect(currentStreak({ ...stats, lastWonDay: '2026-10-15' }, '2026-10-15')).toBe(3);
	});

	it('is zero once a whole day was missed', () => {
		expect(currentStreak(stats, '2026-10-16')).toBe(0);
		expect(currentStreak(stats, '2026-11-20')).toBe(0);
	});

	it('is zero for a fresh player', () => {
		expect(currentStreak(EMPTY_STATS, '2026-10-15')).toBe(0);
	});
});

describe('winPercent', () => {
	it('rounds and copes with no games', () => {
		expect(winPercent(EMPTY_STATS)).toBe(0);
		expect(winPercent({ ...EMPTY_STATS, played: 3, won: 2 })).toBe(67);
		expect(winPercent({ ...EMPTY_STATS, played: 4, won: 4 })).toBe(100);
	});
});

describe('stored values', () => {
	const save: WordleSave = {
		version: 1,
		day: '2026-10-15',
		solution: 'QUOTA',
		guesses: ['CRUDE', 'TRADE'],
		status: 'playing',
		stats: EMPTY_STATS
	};

	it('accepts a well-formed save and stats', () => {
		expect(isWordleSave(save)).toBe(true);
		expect(isWordleSave(JSON.parse(JSON.stringify(save)))).toBe(true);
		expect(isWordleStats(EMPTY_STATS)).toBe(true);
	});

	it('rejects broken saves', () => {
		expect(isWordleSave(null)).toBe(false);
		expect(isWordleSave('x')).toBe(false);
		expect(isWordleSave({ ...save, version: 2 })).toBe(false);
		expect(isWordleSave({ ...save, day: 'today' })).toBe(false);
		expect(isWordleSave({ ...save, solution: 'QUO' })).toBe(false);
		expect(isWordleSave({ ...save, guesses: ['CRUDE', 'TRAD'] })).toBe(false);
		expect(isWordleSave({ ...save, guesses: Array(7).fill('CRUDE') })).toBe(false);
		expect(isWordleSave({ ...save, status: 'done' })).toBe(false);
		expect(isWordleSave({ ...save, stats: { ...EMPTY_STATS, played: -1 } })).toBe(false);
		expect(isWordleSave({ ...save, stats: { ...EMPTY_STATS, distribution: [1, 2] } })).toBe(false);
		expect(isWordleSave({ ...save, stats: { ...EMPTY_STATS, played: 1.5 } })).toBe(false);
		expect(isWordleSave({ ...save, stats: { ...EMPTY_STATS, lastWonDay: 'x' } })).toBe(false);
	});

	it('keeps a separate save per locale', () => {
		expect(saveKey('en')).not.toBe(saveKey('de'));
		expect(saveKey('fa')).toBe('wordle:fa');
	});
});

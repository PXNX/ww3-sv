import { describe, expect, it } from 'vitest';
import { createRandom, dayKey } from '../random';
import {
	FIRST_PUZZLE_DAY,
	dailyIndex,
	dailySolution,
	daysBetween,
	formatCountdown,
	msUntilNextDay,
	practiceSolution,
	previousDay,
	puzzleNumber
} from './daily';
import { WORDLE_LOCALES } from './locales';
import { wordLists } from './words';

const noon = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);

describe('dailySolution', () => {
	it('gives the same word for the same day and locale, at any time of day', () => {
		for (const locale of WORDLE_LOCALES) {
			const { solutions } = wordLists(locale);
			const morning = dailySolution(locale, solutions, new Date(2026, 9, 15, 0, 0, 1));
			const night = dailySolution(locale, solutions, new Date(2026, 9, 15, 23, 59, 59));
			expect(morning).toBe(night);
			expect(solutions).toContain(morning);
			expect(dailySolution(locale, solutions, noon(2026, 10, 15))).toBe(morning);
		}
	});

	it('changes when the local day rolls over', () => {
		const { solutions } = wordLists('en');
		const before = new Date(2026, 9, 15, 23, 59, 59);
		const after = new Date(before.getTime() + 2000);
		expect(dayKey(before)).toBe('2026-10-15');
		expect(dayKey(after)).toBe('2026-10-16');
		expect(dailyIndex('en', solutions.length, before)).toBe(
			dailyIndex('en', solutions.length, noon(2026, 10, 15))
		);
		expect(dailyIndex('en', solutions.length, after)).toBe(
			dailyIndex('en', solutions.length, noon(2026, 10, 16))
		);
	});

	it('gives different words on different days (a spread, not one fixed word)', () => {
		for (const locale of WORDLE_LOCALES) {
			const { solutions } = wordLists(locale);
			const words = new Set<string>();
			for (let day = 1; day <= 60; day++) {
				words.add(dailySolution(locale, solutions, noon(2026, 10, day)));
			}
			expect(words.size, locale).toBeGreaterThan(40);
		}
	});

	it('gives each locale its own sequence', () => {
		const a = Array.from({ length: 30 }, (_, day) =>
			dailyIndex('en', 1000, noon(2026, 10, day + 1))
		);
		const b = Array.from({ length: 30 }, (_, day) =>
			dailyIndex('de', 1000, noon(2026, 10, day + 1))
		);
		expect(a).not.toEqual(b);
	});

	it('stays inside the list and covers it over time', () => {
		const count = 200;
		const seen = new Set<number>();
		for (let day = 0; day < 4000; day++) {
			const index = dailyIndex('en', count, new Date(2020, 0, 1 + day, 12));
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(count);
			seen.add(index);
		}
		expect(seen.size).toBeGreaterThan(count * 0.95);
	});

	it('rejects an empty list', () => {
		expect(() => dailyIndex('en', 0)).toThrow();
	});
});

describe('days and puzzle numbers', () => {
	it('finds the previous day across month and year borders', () => {
		expect(previousDay('2026-10-15')).toBe('2026-10-14');
		expect(previousDay('2026-10-01')).toBe('2026-09-30');
		expect(previousDay('2026-01-01')).toBe('2025-12-31');
		expect(previousDay('2024-03-01')).toBe('2024-02-29');
		expect(previousDay('2025-03-01')).toBe('2025-02-28');
	});

	it('returns an unreadable key unchanged', () => {
		expect(previousDay('nonsense')).toBe('nonsense');
	});

	it('counts days between keys', () => {
		expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
		expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
		expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
		expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
		expect(daysBetween('2026-03-02', '2026-03-01')).toBe(-1);
		// across the spring clock change
		expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
	});

	it('numbers the puzzles from the first day', () => {
		expect(FIRST_PUZZLE_DAY).toBe('2026-01-01');
		expect(puzzleNumber(noon(2026, 1, 1))).toBe(1);
		expect(puzzleNumber(noon(2026, 1, 2))).toBe(2);
		expect(puzzleNumber(noon(2026, 10, 15))).toBe(288);
	});
});

describe('the countdown to the next puzzle', () => {
	it('counts down to the next local midnight', () => {
		expect(msUntilNextDay(new Date(2026, 9, 15, 23, 59, 0))).toBe(60_000);
		expect(msUntilNextDay(new Date(2026, 9, 15, 0, 0, 0))).toBe(24 * 3_600_000);
		expect(msUntilNextDay(new Date(2026, 9, 15, 12, 0, 0))).toBe(12 * 3_600_000);
	});

	it('rolls over month and year ends', () => {
		expect(msUntilNextDay(new Date(2026, 11, 31, 23, 0, 0))).toBe(3_600_000);
		expect(msUntilNextDay(new Date(2026, 1, 28, 18, 0, 0))).toBe(6 * 3_600_000);
	});

	it('formats as HH:MM:SS and rounds up', () => {
		expect(formatCountdown(0)).toBe('00:00:00');
		expect(formatCountdown(1)).toBe('00:00:01');
		expect(formatCountdown(61_000)).toBe('00:01:01');
		expect(formatCountdown(3_661_000)).toBe('01:01:01');
		expect(formatCountdown(24 * 3_600_000)).toBe('24:00:00');
		expect(formatCountdown(-5)).toBe('00:00:00');
	});
});

describe('practiceSolution', () => {
	const solutions = ['AAAAA', 'BBBBB', 'CCCCC'];

	it('picks from the list with the given random', () => {
		const pick = practiceSolution(solutions, createRandom(1));
		expect(solutions).toContain(pick);
		expect(practiceSolution(solutions, createRandom(1))).toBe(pick);
	});

	it('never repeats the previous word', () => {
		const random = createRandom(7);
		let previous = 'AAAAA';
		for (let i = 0; i < 100; i++) {
			const next = practiceSolution(solutions, random, previous);
			expect(next).not.toBe(previous);
			previous = next;
		}
	});

	it('copes with a single-word list', () => {
		expect(practiceSolution(['AAAAA'], createRandom(3), 'AAAAA')).toBe('AAAAA');
	});
});

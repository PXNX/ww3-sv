/*
 * The daily puzzle: which word a given local calendar day and locale gets, the puzzle number and
 * the time left until the next one. The word comes only from the local date and the locale (through
 * dailySeed), so everybody playing in the same language gets the same word on the same day, and
 * the same call always returns the same word.
 */
import { createRandom, dailySeed, dayKey, pickOne, type Random } from '../random';
import type { WordleLocale } from './locales';

/** Puzzle number 1 is this day; later days count up from it */
export const FIRST_PUZZLE_DAY = '2026-01-01';

function parseDayKey(key: string): { year: number; month: number; day: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (!match) return null;
	return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** The day before a YYYY-MM-DD key, also across month and year borders and daylight saving */
export function previousDay(key: string): string {
	const parts = parseDayKey(key);
	if (!parts) return key;
	return dayKey(new Date(parts.year, parts.month - 1, parts.day - 1, 12));
}

/** Whole calendar days from one YYYY-MM-DD key to another (b minus a) */
export function daysBetween(a: string, b: string): number {
	const from = parseDayKey(a);
	const to = parseDayKey(b);
	if (!from || !to) return 0;
	// UTC midnights are exactly 24 hours apart, unlike local ones around a clock change
	const ms =
		Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
	return Math.round(ms / 86_400_000);
}

export function puzzleNumber(date: Date = new Date()): number {
	return daysBetween(FIRST_PUZZLE_DAY, dayKey(date)) + 1;
}

/** Index into a list of `count` solutions for a day and locale */
export function dailyIndex(locale: WordleLocale, count: number, date: Date = new Date()): number {
	if (count <= 0) throw new Error('dailyIndex needs at least one solution');
	return Math.floor(createRandom(dailySeed(`wordle-${locale}`, date))() * count);
}

export function dailySolution(
	locale: WordleLocale,
	solutions: readonly string[],
	date: Date = new Date()
): string {
	return solutions[dailyIndex(locale, solutions.length, date)];
}

/** A random word for practice, never the one that was just played */
export function practiceSolution(
	solutions: readonly string[],
	random: Random,
	previous?: string
): string {
	const pool = solutions.filter((word) => word !== previous);
	return pickOne(random, pool.length > 0 ? pool : solutions);
}

/** Milliseconds from now until the next local midnight, when the next puzzle opens */
export function msUntilNextDay(now: Date = new Date()): number {
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	return Math.max(0, next.getTime() - now.getTime());
}

/** HH:MM:SS for a countdown, rounding up so it never shows 00:00:00 before the day turns */
export function formatCountdown(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

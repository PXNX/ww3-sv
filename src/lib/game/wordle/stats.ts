/*
 * Daily-puzzle statistics and the saved state of the day, with the rules for streaks and the guess
 * distribution. Both are stored per locale (each language has its own daily word) as plain JSON, and
 * read back defensively because the stored value may be stale or tampered with.
 */
import { isFiniteNumber } from '#lib/services/storage.js';
import { previousDay } from './daily';
import { MAX_GUESSES, WORD_LENGTH, type WordleLocale } from './locales';

export interface WordleStats {
	played: number;
	won: number;
	/** Consecutive days solved, ending on lastWonDay (see currentStreak for the live value) */
	streak: number;
	maxStreak: number;
	lastWonDay: string | null;
	/** Wins by number of guesses: index 0 is solved with one guess */
	distribution: number[];
}

export const EMPTY_STATS: WordleStats = {
	played: 0,
	won: 0,
	streak: 0,
	maxStreak: 0,
	lastWonDay: null,
	distribution: Array.from({ length: MAX_GUESSES }, () => 0)
};

export type DailyStatus = 'playing' | 'won' | 'lost';

export interface WordleSave {
	version: 1;
	/** Local day (YYYY-MM-DD) the guesses belong to */
	day: string;
	/** The word of that day, kept so a later change of the word list cannot alter a running puzzle */
	solution: string;
	guesses: string[];
	status: DailyStatus;
	stats: WordleStats;
}

export function saveKey(locale: WordleLocale): string {
	return `wordle:${locale}`;
}

function isCount(value: unknown): value is number {
	return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isWordleStats(value: unknown): value is WordleStats {
	if (typeof value !== 'object' || value === null) return false;
	const stats = value as Record<string, unknown>;
	return (
		isCount(stats.played) &&
		isCount(stats.won) &&
		isCount(stats.streak) &&
		isCount(stats.maxStreak) &&
		(stats.lastWonDay === null ||
			(typeof stats.lastWonDay === 'string' && DAY.test(stats.lastWonDay))) &&
		Array.isArray(stats.distribution) &&
		stats.distribution.length === MAX_GUESSES &&
		stats.distribution.every(isCount)
	);
}

export function isWordleSave(value: unknown): value is WordleSave {
	if (typeof value !== 'object' || value === null) return false;
	const save = value as Record<string, unknown>;
	return (
		save.version === 1 &&
		typeof save.day === 'string' &&
		DAY.test(save.day) &&
		typeof save.solution === 'string' &&
		[...save.solution].length === WORD_LENGTH &&
		Array.isArray(save.guesses) &&
		save.guesses.length <= MAX_GUESSES &&
		save.guesses.every((guess) => typeof guess === 'string' && [...guess].length === WORD_LENGTH) &&
		(save.status === 'playing' || save.status === 'won' || save.status === 'lost') &&
		isWordleStats(save.stats)
	);
}

/**
 * Stats after finishing the puzzle of `day`. A win on the day after the last win continues the
 * streak, a win after a gap starts a new one at 1, and a loss ends it. Finishing the same day twice
 * is ignored, so a reload cannot count a result twice.
 */
export function recordResult(
	stats: WordleStats,
	day: string,
	won: boolean,
	guessCount: number
): WordleStats {
	if (stats.lastWonDay === day && won) return stats;
	const distribution = [...stats.distribution];
	if (won && guessCount >= 1 && guessCount <= MAX_GUESSES) distribution[guessCount - 1] += 1;

	if (!won) return { ...stats, played: stats.played + 1, streak: 0, distribution };

	const streak = stats.lastWonDay === previousDay(day) ? stats.streak + 1 : 1;
	return {
		played: stats.played + 1,
		won: stats.won + 1,
		streak,
		maxStreak: Math.max(stats.maxStreak, streak),
		lastWonDay: day,
		distribution
	};
}

/**
 * The streak to show on `today`: it still counts if the last win was today or yesterday (today's
 * puzzle may still be open), and is 0 once a whole day was missed.
 */
export function currentStreak(stats: WordleStats, today: string): number {
	if (stats.lastWonDay === today || stats.lastWonDay === previousDay(today)) return stats.streak;
	return 0;
}

export function winPercent(stats: WordleStats): number {
	return stats.played === 0 ? 0 : Math.round((stats.won / stats.played) * 100);
}

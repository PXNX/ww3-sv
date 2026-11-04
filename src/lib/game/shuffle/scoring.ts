/*
 * Shadow Fleet Shuffle scoring: a correct pick pays the round times a hundred, multiplied by the
 * streak combo and a speed bonus; a satellite ping halves it. A wrong pick costs points and a life.
 */
import { MAX_PINGS, PING_EVERY, TOTAL_ROUNDS } from './config.js';

/** Streak 1 pays x1, every further pick in a row adds a quarter, up to x3 */
export function streakMultiplier(streak: number): number {
	return Math.min(3, 1 + 0.25 * Math.max(0, streak - 1));
}

/** Up to +50% for a pick inside the first moments, fading to nothing after six seconds */
export function speedBonus(elapsedMs: number): number {
	return 0.5 * Math.max(0, 1 - Math.max(0, elapsedMs) / 6000);
}

export interface PickInput {
	round: number;
	/** Streak including this pick */
	streak: number;
	elapsedMs: number;
	pinged: boolean;
}

export function pickScore({ round, streak, elapsedMs, pinged }: PickInput): number {
	const raw = 100 * round * streakMultiplier(streak) * (1 + speedBonus(elapsedMs));
	return Math.round((raw * (pinged ? 0.5 : 1)) / 10) * 10;
}

/** A wrong pick: the sanctions evasion goes unpunished and the embarrassment costs points */
export function wrongPenalty(round: number): number {
	return 25 * round;
}

/** Bonus for sanctioning the whole fleet, per life left */
export function clearBonus(livesLeft: number): number {
	return 250 * Math.max(0, livesLeft);
}

/** Streak that earns a satellite ping (every fourth), when there is room for one */
export function earnsPing(streak: number, pings: number): boolean {
	return streak > 0 && streak % PING_EVERY === 0 && pings < MAX_PINGS;
}

/** 3 stars for sanctioning the fleet with two lives to spare, 2 for any clear, 1 for halfway */
export function starRating(won: boolean, roundsCleared: number, livesLeft: number): number {
	if (won) return livesLeft >= 2 ? 3 : 2;
	return roundsCleared >= TOTAL_ROUNDS / 2 ? 1 : 0;
}

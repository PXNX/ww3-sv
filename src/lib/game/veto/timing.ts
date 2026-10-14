/*
 * Timing windows: how long the player has for a round, how long the verdict stays up, how fast
 * an answer was, and how a streak speeds all of it up. Pure functions of the streak.
 */
import {
	BASE_FEEDBACK_MS,
	BASE_POINTS,
	BASE_WINDOW_MS,
	MIN_FEEDBACK_MS,
	MIN_WINDOW_MS,
	MULTIPLIER_MAX,
	MULTIPLIER_STREAK,
	PACE_FACTOR,
	PACE_STREAK,
	STEADY_BONUS,
	STEADY_SHARE,
	SWIFT_BONUS,
	SWIFT_SHARE
} from './config.js';

export type SpeedTier = 'swift' | 'steady' | 'late';

/** How many times the streak has sped the game up */
export function paceLevel(streak: number): number {
	return Math.floor(Math.max(0, streak) / PACE_STREAK);
}

/** The speed factor in force: 1 at the start, smaller (faster) with every speed-up */
function paceScale(streak: number): number {
	return PACE_FACTOR ** paceLevel(streak);
}

/** Milliseconds the player has to answer a round at this streak */
export function windowMs(streak: number): number {
	return Math.max(MIN_WINDOW_MS, Math.round(BASE_WINDOW_MS * paceScale(streak)));
}

/** Milliseconds the verdict stays on screen after a round at this streak */
export function feedbackMs(streak: number): number {
	return Math.max(MIN_FEEDBACK_MS, Math.round(BASE_FEEDBACK_MS * paceScale(streak)));
}

/** True once the window has fully run out */
export function isExpired(elapsedMs: number, window: number): boolean {
	return elapsedMs >= window;
}

/** Fraction of the window still left, from 1 down to 0 */
export function timeLeft(elapsedMs: number, window: number): number {
	if (window <= 0) return 0;
	return Math.min(1, Math.max(0, 1 - elapsedMs / window));
}

/** How quickly an answer came in: a swift one is within the first part of the window */
export function speedTier(elapsedMs: number, window: number): SpeedTier {
	const share = window <= 0 ? 1 : elapsedMs / window;
	if (share <= SWIFT_SHARE) return 'swift';
	if (share <= STEADY_SHARE) return 'steady';
	return 'late';
}

export function speedBonus(tier: SpeedTier): number {
	return tier === 'swift' ? SWIFT_BONUS : tier === 'steady' ? STEADY_BONUS : 0;
}

/** Score multiplier for the streak an answer reaches: x1, then one more per five in a row */
export function multiplier(streak: number): number {
	return Math.min(MULTIPLIER_MAX, 1 + Math.floor(Math.max(0, streak) / MULTIPLIER_STREAK));
}

/** Points for a correct answer that brings the streak to `streak` */
export function pointsFor(tier: SpeedTier, streak: number): number {
	return (BASE_POINTS + speedBonus(tier)) * multiplier(streak);
}

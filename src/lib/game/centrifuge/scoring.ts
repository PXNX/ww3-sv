/*
 * Scoring: staying calm through a scare and fixing a real drift quickly both pay, and a streak of
 * correct decisions raises a multiplier. An overreaction or a missed drift costs a heart and ends
 * the streak.
 */
import { clamp01 } from './config.js';

/** Correct decisions in a row per step of the multiplier, and its ceiling */
export const STREAK_STEP = 4;
export const MAX_MULTIPLIER = 5;

export function multiplierFor(streak: number): number {
	return 1 + Math.min(MAX_MULTIPLIER - 1, Math.floor(Math.max(0, streak) / STREAK_STEP));
}

/** Points for sitting through a scare of this intensity without pressing anything */
export function calmPoints(intensity: number, streak: number): number {
	return Math.round(8 + 12 * clamp01(intensity)) * multiplierFor(streak);
}

/** Reaction time up to which the full speed bonus is paid, and the time at which it has run out */
export const FAST_MS = 400;
export const SLOW_MS = 2200;

/** Points for stabilizing a real drift: more the sooner after the needle left the band */
export function fixPoints(reactionMs: number, streak: number): number {
	const speed = clamp01(1 - (reactionMs - FAST_MS) / (SLOW_MS - FAST_MS));
	return Math.round(15 + 25 * speed) * multiplierFor(streak);
}

/*
 * Combo tracking: whacks that follow each other within the combo window build a streak, and
 * every few in a row raise the score multiplier. A decoy, an empty podium, an escaped statement
 * or just waiting too long ends the streak.
 */
import { COMBO_MULTIPLIER_CAP, COMBO_STREAK_PER_LEVEL, COMBO_WINDOW_MS } from './config';

export interface Combo {
	/** Whacks in the running streak (0 when there is none) */
	streak: number;
	/** Simulation time of the last whack */
	lastMs: number;
}

export function createCombo(): Combo {
	return { streak: 0, lastMs: 0 };
}

/** Score multiplier for a streak length: x1 for the first two, then one more every few */
export function multiplierFor(streak: number): number {
	if (streak < 1) return 1;
	return Math.min(COMBO_MULTIPLIER_CAP, 1 + Math.floor(streak / COMBO_STREAK_PER_LEVEL));
}

/** Whether the streak is still alive at the given time */
export function comboActive(combo: Combo, nowMs: number): boolean {
	return combo.streak > 0 && nowMs - combo.lastMs <= COMBO_WINDOW_MS;
}

/** The multiplier the running streak has earned right now (x1 when there is none) */
export function currentMultiplier(combo: Combo, nowMs: number): number {
	return comboActive(combo, nowMs) ? multiplierFor(combo.streak) : 1;
}

/** Fraction of the window left, 1 right after a whack and 0 when the streak runs out */
export function comboTimeLeft(combo: Combo, nowMs: number): number {
	if (!comboActive(combo, nowMs)) return 0;
	return Math.max(0, 1 - (nowMs - combo.lastMs) / COMBO_WINDOW_MS);
}

/** Records a whack and returns the streak it belongs to and the multiplier to score it with */
export function registerHit(combo: Combo, nowMs: number): { streak: number; multiplier: number } {
	combo.streak = comboActive(combo, nowMs) ? combo.streak + 1 : 1;
	combo.lastMs = nowMs;
	return { streak: combo.streak, multiplier: multiplierFor(combo.streak) };
}

export function breakCombo(combo: Combo) {
	combo.streak = 0;
}

export function hitScore(basePoints: number, multiplier: number): number {
	return basePoints * multiplier;
}

/*
 * Combo scoring: threats sliced one after another in the same swipe, each within the combo
 * window of the last, form a chain. Every slice in a chain after the first adds a growing bonus.
 */
import { COMBO_CAP, COMBO_STEP, COMBO_WINDOW_MS } from './config';

export interface Combo {
	/** Length of the running chain (0 when there is none) */
	count: number;
	/** Simulation time of the last slice in the chain */
	lastMs: number;
	/** The swipe the chain belongs to */
	swipe: number;
}

export function createCombo(): Combo {
	return { count: 0, lastMs: 0, swipe: 0 };
}

/** Extra points for the nth slice of a chain: 0 for the first, then COMBO_STEP more each, capped */
export function comboBonus(chainLength: number): number {
	if (chainLength < 2) return 0;
	return (Math.min(chainLength, COMBO_CAP) - 1) * COMBO_STEP;
}

/**
 * Records a slice and returns the length of the chain it belongs to. A chain continues only in
 * the same swipe and within the window; anything else starts a new chain at 1.
 */
export function registerSlice(combo: Combo, nowMs: number, swipe: number): number {
	const continues =
		combo.count > 0 && combo.swipe === swipe && nowMs - combo.lastMs <= COMBO_WINDOW_MS;
	combo.count = continues ? combo.count + 1 : 1;
	combo.lastMs = nowMs;
	combo.swipe = swipe;
	return combo.count;
}

export function breakCombo(combo: Combo) {
	combo.count = 0;
}

/** Points for slicing a threat worth `base` as the nth slice of a chain */
export function sliceScore(base: number, chainLength: number): number {
	return base + comboBonus(chainLength);
}

/*
 * Tuning numbers for Centrifuge Spin. The dial runs from -1 to 1; the safe band is the stretch
 * around 0 where nothing needs doing, and a needle that reaches either end is a meltdown.
 */

export const STARTING_LIVES = 3;

/** Half-width of the safe band: the dial is "in band" while |value| is at most this */
export const BAND = 0.34;
/** The needle at either end of the dial: a missed drift costs a heart */
export const CRITICAL = 1;
/** Without a drift the needle never wanders past this, so leaving the band is always a real drift */
export const CALM_LIMIT = BAND * 0.92;

/** Quiet time at the start of a run before the first scare and the first drift */
export const FIRST_SCARE_MS = 2500;
export const FIRST_DRIFT_MS = 7000;
/** Run time at which the difficulty reaches its maximum */
export const RAMP_MS = 150_000;

/** Presses are ignored this long after an overreaction or a meltdown, so a panicked double tap costs one heart */
export const LOCKOUT_MS = 600;
/** Shorter pause after a correct fix */
export const FIX_LOCKOUT_MS = 250;
/** How fast the needle eases back to the middle after a fix (dial units per second) */
export const RETURN_RATE = 1.8;

/** Number of different BREAKING banner texts (centrifuge_banner_1..N in the message files) */
export const BANNER_COUNT = 8;

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 0 at the start of a run, 1 once RAMP_MS have passed */
export function difficultyAt(timeMs: number): number {
	return clamp01(timeMs / RAMP_MS);
}

/*
 * Pure helpers behind the LivesBar heart display, kept free of Svelte so they can be unit tested.
 */

export type HeartState = 'full' | 'empty';

function wholeMax(max: number): number {
	return Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
}

/** Whole number of lives clamped to 0..max; NaN and other junk count as 0. */
export function clampLives(lives: number, max: number): number {
	const value = Number.isFinite(lives) ? Math.floor(lives) : 0;
	return Math.min(wholeMax(max), Math.max(0, value));
}

/** One entry per heart, in order: the first `lives` hearts are full, the rest are lost. */
export function heartStates(lives: number, max: number): HeartState[] {
	const remaining = clampLives(lives, max);
	return Array.from({ length: wholeMax(max) }, (_, index) =>
		index < remaining ? 'full' : 'empty'
	);
}

/** Indices of hearts that were full before and are lost now (the ones that should animate). */
export function lostHearts(previous: number, next: number, max: number): number[] {
	const before = clampLives(previous, max);
	const after = clampLives(next, max);
	return Array.from({ length: Math.max(0, before - after) }, (_, offset) => after + offset);
}

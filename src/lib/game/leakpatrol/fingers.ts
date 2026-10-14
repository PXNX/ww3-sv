/*
 * Fingers on leaks. Holds are kept in the order they started; only the first MAX_FINGERS plug a
 * leak, so with a fourth finger down the oldest three still count, and when one lifts the fourth
 * takes over.
 */
import { MAX_FINGERS } from './config.js';

/** Adds a hold at the end of the list (a hold that is already there keeps its place) */
export function pressHold(held: readonly number[], id: number): number[] {
	return held.includes(id) ? [...held] : [...held, id];
}

export function releaseHold(held: readonly number[], id: number): number[] {
	return held.filter((entry) => entry !== id);
}

/** The holds that plug right now: the first few in the order they started */
export function pluggingIds(held: readonly number[], max = MAX_FINGERS): number[] {
	return held.slice(0, max);
}

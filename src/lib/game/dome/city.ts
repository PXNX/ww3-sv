/* The city layout: which building, if any, a landing point hits */
import { FIELD_START, SEA_END, TARGETS } from './config.js';

export type Ground = 'sea' | 'field' | 'city';

/** Index of the building covering column x, or null when the ground there holds none */
export function targetIndexAt(x: number): number | null {
	let best: number | null = null;
	let bestGap = Infinity;
	TARGETS.forEach((target, index) => {
		const gap = Math.abs(x - target.x);
		if (gap <= target.halfWidth && gap < bestGap) {
			best = index;
			bestGap = gap;
		}
	});
	return best;
}

/** What kind of ground lies at column x */
export function groundAt(x: number): Ground {
	if (x < SEA_END) return 'sea';
	if (x >= FIELD_START) return 'field';
	return 'city';
}

/** Points shown for a building: its value while standing, nothing once it lies in ruins */
export function standingValue(index: number | null, ruined: readonly boolean[]): number {
	if (index === null || ruined[index]) return 0;
	return TARGETS[index].value;
}

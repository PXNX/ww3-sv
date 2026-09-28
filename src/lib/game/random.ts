/*
 * Seeded random number generation, so game logic can be tested deterministically.
 * Every game-logic function takes a Random instead of calling Math.random directly.
 */

/** Returns a number in [0, 1), like Math.random */
export type Random = () => number;

/** Mulberry32: small, fast, and good enough for games */
export function createRandom(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function randomSeed(): number {
	return Math.floor(Math.random() * 4294967296);
}

/** Integer in [min, maxExclusive) */
export function randomInt(random: Random, min: number, maxExclusive: number): number {
	return min + Math.floor(random() * (maxExclusive - min));
}

export function pickOne<T>(random: Random, items: readonly T[]): T {
	if (items.length === 0) throw new Error('pickOne needs at least one item');
	return items[randomInt(random, 0, items.length)];
}

/** Picks an item with probability proportional to its weight */
export function pickWeighted<T>(random: Random, items: readonly { item: T; weight: number }[]): T {
	const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
	if (total <= 0) throw new Error('pickWeighted needs a positive total weight');
	let roll = random() * total;
	for (const entry of items) {
		roll -= Math.max(0, entry.weight);
		if (roll < 0) return entry.item;
	}
	return items[items.length - 1].item;
}

/** Returns a shuffled copy (Fisher–Yates) */
export function shuffle<T>(random: Random, items: readonly T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = randomInt(random, 0, i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

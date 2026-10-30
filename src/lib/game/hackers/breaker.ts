/* The relay stage: Lights Out on the target's alarm panel. Lit = alarm relay on. */
import { randomInt, type Random } from '#lib/game/random.js';

const CROSS = [
	[0, 0],
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
] as const;

/** Flips a relay and its four neighbours */
export function pressRelay(lights: readonly boolean[], size: number, index: number): boolean[] {
	const next = [...lights];
	const row = Math.floor(index / size);
	const col = index % size;
	for (const [dr, dc] of CROSS) {
		const r = row + dr;
		const c = col + dc;
		if (r >= 0 && r < size && c >= 0 && c < size) next[r * size + c] = !next[r * size + c];
	}
	return next;
}

export function isDark(lights: readonly boolean[]): boolean {
	return lights.every((on) => !on);
}

/** A panel that `presses` switches can put right: scrambled from dark by pressing them */
export function makePanel(random: Random, size: number, presses: number): boolean[] {
	const cells = size * size;
	const wanted = Math.min(presses, cells);
	for (let attempt = 0; attempt < 50; attempt++) {
		const chosen = new Set<number>();
		while (chosen.size < wanted) chosen.add(randomInt(random, 0, cells));
		let lights: boolean[] = Array.from({ length: cells }, () => false);
		for (const index of chosen) lights = pressRelay(lights, size, index);
		// Some sets of presses cancel out on bigger panels; try again for a real puzzle
		if (!isDark(lights)) return lights;
	}
	// Practically unreachable: a single press in the middle
	return pressRelay(
		Array.from({ length: cells }, () => false),
		size,
		Math.floor(cells / 2)
	);
}

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { isRoute, randomCut, randomHamiltonianPath } from './generate';

describe('level generation helpers', () => {
	it.each([
		[4, 4],
		[5, 5],
		[7, 5],
		[8, 8]
	])('builds a path through every cell of a %i x %i grid exactly once', (width, height) => {
		const path = randomHamiltonianPath(width, height, createRandom(width * 31 + height));
		expect(path).toHaveLength(width * height);
		expect(new Set(path.map(([row, col]) => `${row},${col}`)).size).toBe(width * height);
		expect(isRoute(path)).toBe(true);
		for (const [row, col] of path) {
			expect(row).toBeGreaterThanOrEqual(0);
			expect(row).toBeLessThan(height);
			expect(col).toBeGreaterThanOrEqual(0);
			expect(col).toBeLessThan(width);
		}
	});

	it('is deterministic for a seed and different across seeds', () => {
		const first = randomHamiltonianPath(6, 6, createRandom(1));
		expect(randomHamiltonianPath(6, 6, createRandom(1))).toEqual(first);
		expect(randomHamiltonianPath(6, 6, createRandom(2))).not.toEqual(first);
	});

	it('cuts a path into consecutive pieces of at least the minimum length', () => {
		const path = randomHamiltonianPath(6, 6, createRandom(3));
		const pieces = randomCut(path, 6, 3, createRandom(4));
		expect(pieces).toHaveLength(6);
		expect(pieces.every((piece) => piece.length >= 3)).toBe(true);
		expect(pieces.flat()).toEqual(path);
		expect(pieces.every((piece) => isRoute(piece))).toBe(true);
	});

	it('refuses to cut a path into pieces that cannot fit', () => {
		const path = randomHamiltonianPath(3, 3, createRandom(5));
		expect(() => randomCut(path, 4, 3, createRandom(6))).toThrow();
	});
});

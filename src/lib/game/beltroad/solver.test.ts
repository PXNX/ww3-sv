import { describe, expect, it } from 'vitest';
import { isSolved, type Level } from './board';
import { solve } from './solver';

const MINI: Level = {
	id: 'mini',
	tier: 'easy',
	width: 3,
	height: 3,
	pairs: [
		{ port: 'shanghai', a: [0, 0], b: [0, 2] },
		{ port: 'piraeus', a: [1, 0], b: [2, 0] }
	],
	solution: ['RR', 'RRDLL']
};

describe('solver', () => {
	it('solves a small level and covers every cell', () => {
		const result = solve(MINI);
		expect(result.count).toBe(1);
		expect(result.paths).not.toBeNull();
		expect(isSolved(MINI, result.paths ?? [])).toBe(true);
	});

	it('counts solutions up to the limit', () => {
		const tight: Level = {
			id: 'tight',
			tier: 'easy',
			width: 3,
			height: 2,
			pairs: [{ port: 'hamburg', a: [0, 0], b: [1, 0] }],
			solution: []
		};
		expect(solve(tight, { limit: 10 }).count).toBe(1);

		const loose: Level = { ...tight, width: 4, height: 3 };
		loose.pairs = [{ port: 'hamburg', a: [0, 0], b: [0, 1] }];
		const many = solve(loose, { limit: 5 });
		expect(many.count).toBeGreaterThan(1);
		expect(isSolved(loose, many.paths ?? [])).toBe(true);
	});

	it('reports no solution for a board that cannot be filled', () => {
		// 9 cells and two ports of different shade: a single line can not cover the board
		const blocked: Level = {
			...MINI,
			pairs: [{ port: 'shanghai', a: [0, 0], b: [0, 1] }],
			solution: []
		};
		const result = solve(blocked, { limit: 5 });
		expect(result.paths).toBeNull();
		expect(result.count).toBe(0);
		expect(result.exhausted).toBe(false);
	});

	it('stops at the node budget and says so', () => {
		const wide: Level = {
			id: 'wide',
			tier: 'hard',
			width: 6,
			height: 6,
			pairs: [{ port: 'hamburg', a: [0, 0], b: [5, 5] }],
			solution: []
		};
		const result = solve(wide, { limit: 1_000_000, maxNodes: 50 });
		expect(result.exhausted).toBe(true);
	});
});

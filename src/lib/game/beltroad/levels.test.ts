import { describe, expect, it } from 'vitest';
import {
	PORTS,
	TIERS,
	cellCount,
	decodeRoute,
	emptyPaths,
	isSolved,
	parFor,
	solutionPaths,
	validate,
	validateLevel,
	type Tier
} from './board';
import { LEVELS, LEVELS_PER_TIER, levelAt, tierLevels } from './levels';
import { GLYPH_COUNT, PORT_COLORS, portStyle } from './ports';
import { solve } from './solver';

describe('the level set', () => {
	it('has at least 15 levels, six in each of the three tiers, in tier order', () => {
		expect(LEVELS.length).toBeGreaterThanOrEqual(15);
		expect(LEVELS).toHaveLength(18);
		for (const tier of TIERS) expect(tierLevels(tier)).toHaveLength(LEVELS_PER_TIER);
		expect(LEVELS.map((level) => level.tier)).toEqual(
			TIERS.flatMap((tier) => Array.from({ length: LEVELS_PER_TIER }, () => tier))
		);
	});

	it('has unique ids and no duplicate layouts', () => {
		expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
		const layouts = LEVELS.map((level) =>
			JSON.stringify([level.width, level.height, level.pairs.map((pair) => [pair.a, pair.b])])
		);
		expect(new Set(layouts).size).toBe(LEVELS.length);
	});

	it('gets harder: the board never shrinks and every tier beats the one before', () => {
		const cells = LEVELS.map((level) => cellCount(level));
		expect([...cells].sort((a, b) => a - b)).toEqual(cells);
		const smallest = (tier: Tier) =>
			Math.min(...tierLevels(tier).map(({ level }) => cellCount(level)));
		const largest = (tier: Tier) =>
			Math.max(...tierLevels(tier).map(({ level }) => cellCount(level)));
		expect(largest('easy')).toBeLessThan(largest('medium'));
		expect(largest('medium')).toBeLessThan(largest('hard'));
		expect(smallest('easy')).toBeLessThan(smallest('hard'));
		const par = (index: number) => parFor(LEVELS[index]);
		expect(par(LEVELS.length - 1)).toBeGreaterThan(par(0));
	});

	it('starts with Shanghai, Piraeus and Hamburg', () => {
		expect(LEVELS[0].pairs.map((pair) => pair.port)).toEqual(['shanghai', 'piraeus', 'hamburg']);
	});

	it('clamps levelAt to the available levels', () => {
		expect(levelAt(-3)).toBe(LEVELS[0]);
		expect(levelAt(999)).toBe(LEVELS[LEVELS.length - 1]);
	});

	it('gives every port its own color and icon', () => {
		expect(new Set(Object.values(PORT_COLORS)).size).toBe(PORTS.length);
		expect(new Set(PORTS.map((port) => portStyle(port).glyph)).size).toBe(GLYPH_COUNT);
	});
});

describe.each(LEVELS.map((level) => [level.id, level] as const))('level %s', (_id, level) => {
	it('is well formed and starts unsolved', () => {
		expect(validateLevel(level)).toEqual([]);
		expect(isSolved(level, emptyPaths(level))).toBe(false);
	});

	it('has a stored solution that fills every cell, overlaps nowhere and joins every pair', () => {
		const paths = solutionPaths(level);
		const result = validate(level, paths);
		expect(result.uncovered).toEqual([]);
		expect(result.overlapping).toEqual([]);
		expect(result.unconnected).toEqual([]);
		expect(result.solved).toBe(true);
		// Every route starts at port a and ends at port b
		level.pairs.forEach((pair, index) => {
			expect(paths[index][0]).toEqual(pair.a);
			expect(paths[index].at(-1)).toEqual(pair.b);
			expect(decodeRoute(pair.a, level.solution[index]).at(-1)).toEqual(pair.b);
		});
	});

	it('is solvable: the solver finds a full solution of its own', () => {
		const result = solve(level, { limit: 2 });
		expect(result.exhausted).toBe(false);
		expect(result.count).toBeGreaterThanOrEqual(1);
		expect(isSolved(level, result.paths ?? emptyPaths(level))).toBe(true);
	});
});

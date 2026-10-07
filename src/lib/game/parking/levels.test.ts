import { describe, expect, it } from 'vitest';
import {
	TIERS,
	createPuzzle,
	isSolved,
	slideRange,
	validateLevel,
	withMove,
	type Tier
} from './board';
import { LEVELS, LEVELS_PER_TIER, levelAt, tierLevels } from './levels';
import { solve } from './solver';

describe('the level set', () => {
	it('has 30 levels, ten in each of the three tiers, in tier order', () => {
		expect(LEVELS).toHaveLength(30);
		for (const tier of TIERS) expect(tierLevels(tier)).toHaveLength(LEVELS_PER_TIER);
		expect(LEVELS.map((level) => level.tier)).toEqual(
			TIERS.flatMap((tier) => Array.from({ length: LEVELS_PER_TIER }, () => tier))
		);
	});

	it('has unique ids and no duplicate layouts', () => {
		expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
		const layouts = LEVELS.map((level) =>
			JSON.stringify([level.width, level.height, level.tanker, level.ships, level.rocks])
		);
		expect(new Set(layouts).size).toBe(LEVELS.length);
	});

	it('gets harder: par never drops within a tier and every tier beats the one before', () => {
		const pars = (tier: Tier) => tierLevels(tier).map(({ level }) => level.par);
		for (const tier of TIERS) {
			const list = pars(tier);
			expect([...list].sort((a, b) => a - b)).toEqual(list);
		}
		expect(Math.max(...pars('easy'))).toBeLessThan(Math.min(...pars('medium')));
		expect(Math.max(...pars('medium'))).toBeLessThan(Math.min(...pars('hard')));
	});

	it('clamps levelAt to the available levels', () => {
		expect(levelAt(-3)).toBe(LEVELS[0]);
		expect(levelAt(999)).toBe(LEVELS[LEVELS.length - 1]);
	});
});

describe.each(LEVELS.map((level) => [level.id, level] as const))('level %s', (_id, level) => {
	it('is well formed and starts unsolved', () => {
		const puzzle = createPuzzle(level);
		expect(validateLevel(level)).toEqual([]);
		expect(isSolved(puzzle, puzzle.start)).toBe(false);
	});

	it('is solvable in exactly its stated par', () => {
		const solution = solve(createPuzzle(level));
		expect(solution, 'no solution found').not.toBeNull();
		expect(solution?.moves).toBe(level.par);
	});

	it('has a solution that really slides ships legally into the exit', () => {
		const puzzle = createPuzzle(level);
		let positions = puzzle.start;
		for (const step of solve(puzzle)?.path ?? []) {
			const { min, max } = slideRange(puzzle, positions, step.piece);
			expect(step.to).toBeGreaterThanOrEqual(min);
			expect(step.to).toBeLessThanOrEqual(max);
			positions = withMove(positions, step.piece, step.to);
		}
		expect(isSolved(puzzle, positions)).toBe(true);
	});
});

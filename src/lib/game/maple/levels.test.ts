import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_IDS, LEVEL_SPECS, levelAt } from './levels.js';
import { isWall, sameCell } from './level.js';
import { solve } from './solver.js';
import { createGame, spottedBy } from './state.js';

describe('maple levels', () => {
	it('are ten, with unique ids', () => {
		expect(LEVELS).toHaveLength(10);
		expect(new Set(LEVEL_IDS).size).toBe(10);
		expect(levelAt(0).id).toBe(LEVEL_IDS[0]);
		expect(() => levelAt(10)).toThrow();
	});

	it('ask for at least one barrel, and mostly leave one to spare', () => {
		for (const level of LEVELS) {
			expect(level.quota, level.id).toBeGreaterThanOrEqual(1);
			expect(level.quota, level.id).toBeLessThanOrEqual(level.barrels.length);
		}
		expect(LEVELS.filter((level) => level.quota < level.barrels.length).length).toBeGreaterThan(5);
	});

	it('keep guards, barrels, start and truck on open aisle cells', () => {
		for (const level of LEVELS) {
			for (const guard of level.guards) {
				for (const cell of guard.route) {
					expect(isWall(level, cell), level.id).toBe(false);
					expect(sameCell(cell, level.start), level.id).toBe(false);
				}
			}
			for (const barrel of level.barrels) {
				expect(sameCell(barrel, level.truck), level.id).toBe(false);
				expect(sameCell(barrel, level.start), level.id).toBe(false);
			}
		}
	});

	it('start unseen, and bring in the guards and the boss gradually', () => {
		for (const level of LEVELS) expect(spottedBy(createGame(level)), level.id).toBe(-1);
		expect(LEVELS[0].guards).toHaveLength(0);
		expect(LEVELS[1].guards).toHaveLength(1);
		expect(LEVELS.some((level) => level.guards.some((guard) => guard.boss))).toBe(true);
		expect(LEVELS[9].guards.length).toBeGreaterThan(LEVELS[1].guards.length);
	});

	it('can be finished cleanly with every barrel, and par is close to the fewest moves', () => {
		for (const [index, level] of LEVELS.entries()) {
			const solution = solve(level);
			expect(solution, level.id).not.toBeNull();
			const fewest = solution?.moves ?? 0;
			expect(LEVEL_SPECS[index].par, level.id).toBeGreaterThanOrEqual(fewest);
			expect(LEVEL_SPECS[index].par, level.id).toBeLessThanOrEqual(Math.round(fewest * 1.2) + 3);
		}
	}, 60_000);
});

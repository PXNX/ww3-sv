import { describe, expect, it } from 'vitest';
import { REACH } from './config.js';
import { LEVELS, LEVEL_COUNT, LEVEL_IDS, levelAt } from './levels.js';
import { findPath, isSolid, isWalkable, reachableTiles, tileAt } from './map.js';
import { createSabotage, exposure } from './state.js';

describe('the nine jobs', () => {
	it('are nine, three per theme, with unique ids', () => {
		expect(LEVEL_COUNT).toBe(9);
		expect(new Set(LEVEL_IDS).size).toBe(9);
		for (const theme of ['power', 'depot', 'factory'] as const) {
			expect(LEVELS.filter((level) => level.theme === theme)).toHaveLength(3);
		}
	});

	it('clamps the index', () => {
		expect(levelAt(-3)).toBe(LEVELS[0]);
		expect(levelAt(99)).toBe(LEVELS[8]);
	});

	describe.each(LEVELS.map((level) => [level.id, level] as const))('%s', (_id, level) => {
		const { grid } = level;

		it('has a start, an exit, at least one target and a par time', () => {
			expect(level.targets.length).toBeGreaterThanOrEqual(1);
			expect(isWalkable(tileAt(grid, Math.floor(level.start.x), Math.floor(level.start.y)))).toBe(
				true
			);
			expect(level.par).toBeGreaterThan(20);
			expect(level.card.message.length).toBeGreaterThan(20);
		});

		it('is fenced in on every side', () => {
			for (let x = 0; x < grid.width; x++) {
				expect(isSolid(tileAt(grid, x, 0))).toBe(true);
				expect(isSolid(tileAt(grid, x, grid.height - 1))).toBe(true);
			}
			for (let y = 0; y < grid.height; y++) {
				expect(isSolid(tileAt(grid, 0, y))).toBe(true);
				expect(isSolid(tileAt(grid, grid.width - 1, y))).toBe(true);
			}
		});

		it('lets the player reach the exit and stand within reach of every target', () => {
			const reachable = reachableTiles(grid, level.start);
			expect(reachable.has(Math.floor(level.exit.y) * grid.width + Math.floor(level.exit.x))).toBe(
				true
			);
			for (const target of level.targets) {
				const near = [...reachable].some((index) => {
					const x = (index % grid.width) + 0.5;
					const y = Math.floor(index / grid.width) + 0.5;
					return Math.hypot(x - target.x, y - target.y) <= REACH;
				});
				expect(near, `target at ${target.x},${target.y}`).toBe(true);
			}
		});

		it('keeps every guard on walkable ground with routes they can walk', () => {
			for (const guard of level.guards) {
				expect(guard.route.length).toBeGreaterThanOrEqual(2);
				for (const [x, y] of guard.route)
					expect(isWalkable(tileAt(grid, x, y)), `${x},${y}`).toBe(true);
				for (let i = 1; i < guard.route.length; i++) {
					const from = { x: guard.route[i - 1][0] + 0.5, y: guard.route[i - 1][1] + 0.5 };
					const to = { x: guard.route[i][0] + 0.5, y: guard.route[i][1] + 0.5 };
					expect(findPath(grid, from, to)).not.toBeNull();
				}
			}
		});

		it('mounts sensors inside the map', () => {
			for (const sensor of level.sensors) {
				expect(sensor.at[0]).toBeGreaterThanOrEqual(0);
				expect(sensor.at[0]).toBeLessThan(grid.width);
				expect(sensor.at[1]).toBeGreaterThanOrEqual(0);
				expect(sensor.at[1]).toBeLessThan(grid.height);
				expect(sensor.range).toBeGreaterThan(0);
			}
		});

		it('starts with nobody watching the player', () => {
			const state = createSabotage(level);
			for (const guard of state.guards) expect(exposure(state, guard)).toBe(0);
			for (const sensor of state.sensors) {
				const rate = exposure(state, {
					...sensor,
					facing: sensor.angle,
					lit: sensor.kind === 'floodlight'
				});
				expect(rate).toBe(0);
			}
		});
	});

	it('gets harder: more things to avoid as the jobs go on', () => {
		const threats = LEVELS.map((level) => level.guards.length + level.sensors.length);
		expect(threats[8]).toBeGreaterThan(threats[0]);
		expect(LEVELS[8].par).toBeGreaterThan(LEVELS[0].par);
		expect(LEVELS.some((level) => level.guards.some((guard) => guard.kind === 'dog'))).toBe(true);
		expect(
			LEVELS.some((level) => level.sensors.some((sensor) => sensor.kind === 'floodlight'))
		).toBe(true);
	});
});

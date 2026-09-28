import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import {
	applySolution,
	cellCol,
	cellIndex,
	cellRow,
	computeFlow,
	connects,
	generateLayout,
	neighbor,
	stationCell,
	terminalCell
} from './pipeGrid';
import { gridFrom } from './testGrid';
import { EAST, NORTH, SOUTH, WEST } from './tiles';

// Route: down from the station, right along the middle row, down into the terminal
const SNAKE = ['s0 s1 s1', 'e0 s1 e2', 's1 s1 s0'];

describe('grid coordinates', () => {
	it('converts between cells and rows and columns', () => {
		const grid = gridFrom(SNAKE, 0, 2);
		expect(cellIndex(grid, 1, 2)).toBe(5);
		expect(cellRow(grid, 5)).toBe(1);
		expect(cellCol(grid, 5)).toBe(2);
		expect(stationCell(grid)).toBe(0);
		expect(terminalCell(grid)).toBe(8);
	});

	it('finds neighbors and stops at the edges', () => {
		const grid = gridFrom(SNAKE, 0, 2);
		expect(neighbor(grid, 4, NORTH)).toBe(1);
		expect(neighbor(grid, 4, EAST)).toBe(5);
		expect(neighbor(grid, 4, SOUTH)).toBe(7);
		expect(neighbor(grid, 4, WEST)).toBe(3);
		expect(neighbor(grid, 0, NORTH)).toBeNull();
		expect(neighbor(grid, 2, EAST)).toBeNull();
		expect(neighbor(grid, 6, WEST)).toBeNull();
		expect(neighbor(grid, 8, SOUTH)).toBeNull();
	});

	it('connects only tiles that open towards each other', () => {
		const grid = gridFrom(SNAKE, 0, 2);
		expect(connects(grid, 0, SOUTH)).toBe(true);
		expect(connects(grid, 3, NORTH)).toBe(true);
		expect(connects(grid, 0, EAST)).toBe(false);
		expect(connects(grid, 4, NORTH)).toBe(false);
	});
});

describe('flow detection', () => {
	it('follows the connected route from the station to the terminal', () => {
		const flow = computeFlow(gridFrom(SNAKE, 0, 2));
		expect(flow.reachesTerminal).toBe(true);
		expect(flow.pathLength).toBe(5);
		expect(flow.filled.flatMap((filled, cell) => (filled ? [cell] : []))).toEqual([0, 3, 4, 5, 8]);
		expect(flow.distance[8]).toBe(4);
		expect(flow.distance[1]).toBe(-1);
	});

	it('fills side branches too, without lengthening the path', () => {
		const flow = computeFlow(gridFrom(['s0 e1 s1', 'e0 x0 e2', 's1 s1 s0'], 0, 2));
		expect(flow.filled[1]).toBe(true);
		expect(flow.filled[2]).toBe(true);
		expect(flow.pathLength).toBe(5);
	});

	it('measures the shortest flowing route when there are several', () => {
		const flow = computeFlow(gridFrom(['x0 x0', 'x0 x0'], 0, 0));
		expect(flow.filled).toEqual([true, true, true, true]);
		expect(flow.pathLength).toBe(2);
	});

	it('is blocked by a broken tile', () => {
		const flow = computeFlow(gridFrom(['s0 s1 s1', 'e0 s1! e2', 's1 s1 s0'], 0, 2));
		expect(flow.reachesTerminal).toBe(false);
		expect(flow.pathLength).toBe(0);
		expect(flow.filled.flatMap((filled, cell) => (filled ? [cell] : []))).toEqual([0, 3]);
	});

	it('is blocked when the station tile is broken', () => {
		const flow = computeFlow(gridFrom(['s0! s1 s1', 'e0 s1 e2', 's1 s1 s0'], 0, 2));
		expect(flow.filled.every((filled) => !filled)).toBe(true);
	});

	it('gets nowhere when the first tile does not open towards the station', () => {
		const flow = computeFlow(gridFrom(['s1 s1 s1', 'e0 s1 e2', 's1 s1 s0'], 0, 2));
		expect(flow.filled.every((filled) => !filled)).toBe(true);
		expect(flow.reachesTerminal).toBe(false);
	});

	it('needs the last tile to open towards the terminal', () => {
		const flow = computeFlow(gridFrom(['s0 s1 s1', 'e0 s1 e2', 's1 s1 e3'], 0, 2));
		expect(flow.filled[8]).toBe(true);
		expect(flow.reachesTerminal).toBe(false);
		expect(flow.pathLength).toBe(0);
	});

	it('does not leak into a tile that does not open back', () => {
		const flow = computeFlow(gridFrom(['s0 s1 s1', 'e0 s0 e2', 's1 s1 s0'], 0, 2));
		expect(flow.filled[4]).toBe(false);
		expect(flow.reachesTerminal).toBe(false);
	});
});

describe('layout generation', () => {
	const sizes = [5, 6, 7];
	const seeds = Array.from({ length: 150 }, (_, i) => i * 7919 + 3);

	it.each(sizes)('always has a solvable route on a %i by %i board', (size) => {
		for (const seed of seeds) {
			const { grid, route, solution } = generateLayout(createRandom(seed), size, size);
			expect(grid.tiles).toHaveLength(size * size);
			expect(route[0]).toBe(stationCell(grid));
			expect(route[route.length - 1]).toBe(terminalCell(grid));
			expect(new Set(route).size).toBe(route.length);
			for (let i = 1; i < route.length; i++) {
				const step =
					Math.abs(cellRow(grid, route[i]) - cellRow(grid, route[i - 1])) +
					Math.abs(cellCol(grid, route[i]) - cellCol(grid, route[i - 1]));
				expect(step).toBe(1);
			}
			applySolution(grid, route, solution);
			const flow = computeFlow(grid);
			expect(flow.reachesTerminal, `seed ${seed}`).toBe(true);
			expect(flow.pathLength).toBeLessThanOrEqual(route.length);
		}
	});

	it.each(sizes)('never starts out already connected on a %i by %i board', (size) => {
		for (const seed of seeds) {
			const { grid } = generateLayout(createRandom(seed), size, size);
			expect(computeFlow(grid).reachesTerminal, `seed ${seed}`).toBe(false);
			expect(grid.tiles.every((tile) => !tile.broken && tile.repair === 0)).toBe(true);
		}
	});

	it('puts the station and the terminal on opposite edges', () => {
		for (const seed of seeds) {
			const { grid } = generateLayout(createRandom(seed), 6, 6);
			expect(cellRow(grid, stationCell(grid))).toBe(0);
			expect(cellRow(grid, terminalCell(grid))).toBe(5);
			expect(grid.stationCol).toBeGreaterThanOrEqual(0);
			expect(grid.terminalCol).toBeLessThan(6);
		}
	});

	it('keeps the route shorter than the whole board', () => {
		for (const seed of seeds) {
			const { route } = generateLayout(createRandom(seed), 7, 7);
			expect(route.length).toBeLessThan(49);
		}
	});

	it('is deterministic for a seed', () => {
		const a = generateLayout(createRandom(99), 6, 6);
		const b = generateLayout(createRandom(99), 6, 6);
		expect(b).toEqual(a);
		expect(generateLayout(createRandom(100), 6, 6)).not.toEqual(a);
	});

	it('rejects boards that are too small', () => {
		expect(() => generateLayout(createRandom(1), 1, 5)).toThrow();
	});
});

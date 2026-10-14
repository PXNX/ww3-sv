import { describe, expect, it } from 'vitest';
import { LEVEL_NAMES } from '#lib/components/gpsliarText.js';
import { missingMessages } from '#lib/testing/messages.js';
import { BOAT_RADIUS, PORT_RADIUS } from './config';
import { LIGHTHOUSE_RADIUS, distanceToSegment, seaBounds, type Level } from './level';
import { LEVEL_IDS, LEVEL_SPECS, levelAt } from './levels';

const CELL = 0.25;

/** Whether the boat can sail from a to b: a flood fill over a grid, with every solid grown by the hull */
function sailable(level: Level, a: { x: number; y: number }, b: { x: number; y: number }) {
	const bounds = seaBounds(level, BOAT_RADIUS);
	const solids = [
		...level.rocks,
		...level.lighthouses.map((lighthouse) => ({ ...lighthouse, r: LIGHTHOUSE_RADIUS }))
	];
	const cols = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
	const rows = Math.ceil((bounds.maxY - bounds.minY) / CELL) + 1;
	const free = (col: number, row: number) => {
		const x = bounds.minX + col * CELL;
		const y = bounds.minY + row * CELL;
		if (x > bounds.maxX || y > bounds.maxY) return false;
		return solids.every((solid) => Math.hypot(x - solid.x, y - solid.y) > solid.r + BOAT_RADIUS);
	};
	const cell = (p: { x: number; y: number }): [number, number] => [
		Math.round((p.x - bounds.minX) / CELL),
		Math.round((p.y - bounds.minY) / CELL)
	];
	const [startCol, startRow] = cell(a);
	const [goalCol, goalRow] = cell(b);
	const seen = new Set<number>([startRow * cols + startCol]);
	const queue: [number, number][] = [[startCol, startRow]];
	for (let head = 0; head < queue.length; head++) {
		const [col, row] = queue[head];
		if (Math.abs(col - goalCol) <= 1 && Math.abs(row - goalRow) <= 1) return true;
		for (const [dc, dr] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const nc = col + dc;
			const nr = row + dr;
			if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen.has(nr * cols + nc)) continue;
			if (!free(nc, nr)) continue;
			seen.add(nr * cols + nc);
			queue.push([nc, nr]);
		}
	}
	return false;
}

describe('levels', () => {
	it('has twelve levels with unique ids', () => {
		expect(LEVEL_SPECS).toHaveLength(12);
		expect(new Set(LEVEL_IDS).size).toBe(12);
	});

	it('has a translated name for every level in every language', () => {
		expect(LEVEL_NAMES).toHaveLength(LEVEL_IDS.length);
		expect(missingMessages(['gpsliar_level_'])).toEqual([]);
	});

	it('builds every level with everything its spec asks for', () => {
		LEVEL_SPECS.forEach((spec, index) => {
			const level = levelAt(index);
			expect(level.stops, spec.id).toHaveLength(spec.stops);
			expect(level.rocks, spec.id).toHaveLength(spec.rocks);
			expect(level.shallows, spec.id).toHaveLength(spec.shallows);
			expect(level.buoys, spec.id).toHaveLength(spec.buoys);
			expect(level.lighthouses, spec.id).toHaveLength(spec.lighthouses);
			expect(level.tanker !== null, spec.id).toBe(spec.tanker);
		});
	});

	it('can be sailed from the start through every harbour in order', () => {
		LEVEL_SPECS.forEach((spec, index) => {
			const level = levelAt(index);
			let from = level.start;
			for (const stop of level.stops) {
				expect(sailable(level, from, stop), `${spec.id} to ${JSON.stringify(stop)}`).toBe(true);
				from = stop;
			}
		});
	});

	it('keeps harbours out of the shallows and away from the tanker route', () => {
		LEVEL_SPECS.forEach((spec, index) => {
			const level = levelAt(index);
			for (const stop of level.stops) {
				for (const shallow of level.shallows) {
					const gap = Math.hypot(stop.x - shallow.x, stop.y - shallow.y) - shallow.r;
					expect(gap, spec.id).toBeGreaterThan(0);
				}
				if (level.tanker) {
					const gap = distanceToSegment(stop, level.tanker.from, level.tanker.to);
					expect(gap, spec.id).toBeGreaterThan(PORT_RADIUS);
				}
			}
		});
	});

	it('lies harder as the levels go on and brings in mirror and rotation late', () => {
		const lies = LEVEL_SPECS.map((spec) => spec.lie);
		expect(lies[0].mirror || lies[0].rotate !== 0).toBe(false);
		expect(lies.some((lie) => lie.jumpEvery > 0)).toBe(true);
		expect(lies.some((lie) => lie.rotate !== 0)).toBe(true);
		expect(lies.some((lie) => lie.mirror)).toBe(true);
		expect(lies[11].max).toBeGreaterThan(lies[0].max);
		expect(LEVEL_SPECS[11].fogRadius).toBeLessThan(LEVEL_SPECS[0].fogRadius);
	});

	it('clamps the level index', () => {
		expect(levelAt(-3).id).toBe(LEVEL_IDS[0]);
		expect(levelAt(99).id).toBe(LEVEL_IDS[LEVEL_IDS.length - 1]);
	});
});

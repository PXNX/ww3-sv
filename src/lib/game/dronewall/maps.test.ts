import { describe, expect, it } from 'vitest';
import {
	MAP_DEFS,
	MAP_IDS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	defenseStats,
	isTallMap,
	type Point
} from './config';
import { getMap, MAPS } from './maps';
import { createPath, distanceBetween, pointAt } from './path';
import { createGame } from './state';

function distanceToRoad(point: Point, points: readonly Point[]): number {
	let best = Infinity;
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const t = Math.max(
			0,
			Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))
		);
		best = Math.min(best, distanceBetween(point, { x: a.x + t * dx, y: a.y + t * dy }));
	}
	return best;
}

describe('maps', () => {
	it('has several maps with distinct names and looks', () => {
		expect(MAP_IDS.length).toBeGreaterThanOrEqual(4);
		expect(new Set(MAP_IDS).size).toBe(MAP_IDS.length);
		expect(new Set(MAP_DEFS.map((map) => map.theme.field)).size).toBe(MAP_DEFS.length);
		expect(getMap('nowhere' as never)).toBe(MAPS[0]);
	});

	it.each(MAP_DEFS.map((map) => map.id))(
		'%s: the road enters above the field and ends on the line',
		(id) => {
			const { points, lineY, height } = getMap(id);
			expect(lineY).toBe(height - 40);
			expect(points[0].y).toBeLessThan(0);
			expect(points[points.length - 1].y).toBe(lineY);
			for (const point of points) {
				expect(point.x).toBeGreaterThanOrEqual(0);
				expect(point.x).toBeLessThanOrEqual(WORLD_WIDTH);
				expect(point.y).toBeLessThanOrEqual(lineY);
			}
			const road = createPath(points);
			const end = pointAt(road, road.length);
			expect(end.y).toBe(lineY);
		}
	);

	it.each(MAP_DEFS.map((map) => map.id))(
		'%s: every spot is clear of the road, in reach of it and not crowded',
		(id) => {
			const { points, slots, lineY } = getMap(id);
			expect(slots.length).toBeGreaterThanOrEqual(7);
			slots.forEach((slot, index) => {
				expect(slot.x).toBeGreaterThanOrEqual(24);
				expect(slot.x).toBeLessThanOrEqual(WORLD_WIDTH - 24);
				expect(slot.y).toBeGreaterThanOrEqual(24);
				expect(slot.y).toBeLessThan(lineY - 10);
				const road = distanceToRoad(slot, points);
				// Not on the road, and close enough for the basic trench to reach it
				expect(road).toBeGreaterThanOrEqual(34);
				expect(road).toBeLessThanOrEqual(defenseStats('trench', 1).range);
				slots.slice(index + 1).forEach((other) => {
					expect(distanceBetween(slot, other)).toBeGreaterThanOrEqual(45);
				});
			});
		}
	);

	it('scatters scenery that keeps off the road, the spots and the counter corner', () => {
		for (const map of MAPS) {
			expect(map.decor.length).toBeGreaterThan(5);
			for (const prop of map.decor) {
				expect(map.theme.decor).toContain(prop.kind);
				expect(distanceToRoad(prop, map.points)).toBeGreaterThanOrEqual(36);
				for (const slot of map.slots) {
					expect(distanceBetween(slot, prop)).toBeGreaterThanOrEqual(40);
				}
				expect(prop.x > WORLD_WIDTH - 110 && prop.y < 50).toBe(false);
				expect(prop.y).toBeLessThan(map.lineY);
			}
		}
	});

	it('has plenty of maps, some of them several screens high and scrolling', () => {
		expect(MAP_IDS.length).toBeGreaterThanOrEqual(10);
		const tall = MAP_DEFS.filter(isTallMap);
		expect(tall.length).toBeGreaterThanOrEqual(3);
		for (const map of MAP_DEFS) {
			expect(map.height).toBeGreaterThanOrEqual(WORLD_HEIGHT);
			if (isTallMap(map)) {
				expect(map.height).toBeGreaterThanOrEqual(WORLD_HEIGHT * 1.5);
				// A bigger map has more spots and sends bigger crowds
				expect(map.slots.length).toBeGreaterThanOrEqual(14);
				expect(map.crowd).toBeGreaterThan(1);
			}
			expect(map.climate.length).toBeGreaterThan(0);
		}
	});

	it('scatters more scenery on a tall map', () => {
		expect(getMap('metropolis').decor.length).toBeGreaterThan(
			getMap('serpentine').decor.length * 1.8
		);
	});

	it('looks the same every time for a map', () => {
		expect(getMap('lightning').decor).toEqual(getMap('lightning').decor);
	});

	it('starts a game on the chosen map, with an empty defense for every spot', () => {
		for (const map of MAPS) {
			const state = createGame(map.id);
			expect(state.map).toBe(map);
			expect(state.defenses).toHaveLength(map.slots.length);
		}
		expect(createGame().map.id).toBe(MAP_IDS[0]);
	});
});

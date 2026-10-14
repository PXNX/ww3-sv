import { describe, expect, it } from 'vitest';
import { BOAT_RADIUS, COAST_DEPTH, PORT_RADIUS } from './config';
import {
	LIGHTHOUSE_RADIUS,
	buildLevel,
	distanceToSegment,
	landVector,
	seaBounds,
	type Level,
	type LevelSpec
} from './level';
import { NO_LIE } from './lie';

const BASE: LevelSpec = {
	id: 'test',
	seed: 7,
	width: 26,
	height: 18,
	land: 'north',
	stops: 3,
	rocks: 4,
	shallows: 2,
	buoys: 4,
	lighthouses: 3,
	tanker: true,
	lie: NO_LIE,
	fogRadius: 4.5,
	crossChecks: 3
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y);

function inside(level: Level, point: { x: number; y: number }) {
	const bounds = seaBounds(level);
	return (
		point.x >= bounds.minX &&
		point.x <= bounds.maxX &&
		point.y >= bounds.minY &&
		point.y <= bounds.maxY
	);
}

/** How far a point is from the coast, whichever side the land is on */
function coastDistance(level: Level, point: { x: number; y: number }) {
	switch (level.land) {
		case 'north':
			return point.y;
		case 'south':
			return level.height - point.y;
		case 'west':
			return point.x;
		case 'east':
			return level.width - point.x;
	}
}

describe('buildLevel', () => {
	it('builds the same sea for the same seed and another for another', () => {
		expect(buildLevel(BASE)).toEqual(buildLevel(BASE));
		expect(buildLevel({ ...BASE, seed: 8 }).rocks).not.toEqual(buildLevel(BASE).rocks);
	});

	it('places everything the spec asks for', () => {
		const level = buildLevel(BASE);
		expect(level.stops).toHaveLength(3);
		expect(level.rocks).toHaveLength(4);
		expect(level.shallows).toHaveLength(2);
		expect(level.buoys).toHaveLength(4);
		expect(level.lighthouses).toHaveLength(3);
		expect(level.tanker).not.toBeNull();
		expect(level.crossChecks).toBe(3);
	});

	it('numbers the buoys from one and gives lighthouses flash counts from one to four', () => {
		const level = buildLevel(BASE);
		expect(level.buoys.map((buoy) => buoy.number)).toEqual([1, 2, 3, 4]);
		for (const lighthouse of level.lighthouses) {
			expect(lighthouse.flashes).toBeGreaterThanOrEqual(1);
			expect(lighthouse.flashes).toBeLessThanOrEqual(4);
		}
		expect(new Set(level.lighthouses.map((lighthouse) => lighthouse.flashes)).size).toBe(3);
	});

	it('alternates herring and stones between the harbours', () => {
		const level = buildLevel(BASE);
		expect(new Set(level.stops.map((stop) => stop.cargo))).toEqual(new Set(['herring', 'stones']));
	});

	it('puts the harbours by the chosen coast and the boat on the far side, with all in the water', () => {
		for (const land of ['north', 'south', 'east', 'west'] as const) {
			const level = buildLevel({ ...BASE, land });
			expect(level.width).toBe(BASE.width);
			expect(level.height).toBe(BASE.height);
			for (const point of [level.start, ...level.stops, ...level.rocks, ...level.buoys]) {
				expect(inside(level, point), `${land} ${JSON.stringify(point)}`).toBe(true);
			}
			for (const stop of level.stops) {
				expect(coastDistance(level, stop), land).toBeLessThan(COAST_DEPTH + 3.2);
			}
			expect(coastDistance(level, level.start), land).toBeGreaterThan(10);
		}
	});

	it('keeps clear water between obstacles so the boat always fits through', () => {
		const level = buildLevel(BASE);
		const solid = [
			...level.rocks,
			...level.lighthouses.map((lighthouse) => ({ ...lighthouse, r: LIGHTHOUSE_RADIUS }))
		];
		for (let i = 0; i < solid.length; i++) {
			for (let j = i + 1; j < solid.length; j++) {
				const gap = distance(solid[i], solid[j]) - solid[i].r - solid[j].r;
				expect(gap).toBeGreaterThan(BOAT_RADIUS * 4);
			}
		}
		for (const stop of level.stops) {
			for (const rock of solid) {
				expect(distance(stop, rock) - rock.r).toBeGreaterThan(PORT_RADIUS);
			}
		}
	});

	it('keeps the harbours apart', () => {
		const level = buildLevel({ ...BASE, stops: 4, width: 34, height: 24 });
		for (let i = 0; i < level.stops.length; i++) {
			for (let j = i + 1; j < level.stops.length; j++) {
				expect(distance(level.stops[i], level.stops[j])).toBeGreaterThan(PORT_RADIUS * 2 + 0.5);
			}
		}
	});

	it('keeps the tanker route clear of rocks', () => {
		const level = buildLevel(BASE);
		const route = level.tanker!;
		for (const rock of level.rocks) {
			expect(distanceToSegment(rock, route.from, route.to)).toBeGreaterThan(rock.r + 0.9);
		}
	});

	it('sets a par time that grows with the way to sail', () => {
		const short = buildLevel({ ...BASE, stops: 1 });
		const long = buildLevel({ ...BASE, stops: 3 });
		expect(short.par).toBeGreaterThan(10);
		expect(long.par).toBeGreaterThan(short.par);
	});
});

describe('landVector', () => {
	it('points from the sea to the land', () => {
		expect(landVector('north')).toEqual({ x: 0, y: -1 });
		expect(landVector('south')).toEqual({ x: 0, y: 1 });
		expect(landVector('west')).toEqual({ x: -1, y: 0 });
		expect(landVector('east')).toEqual({ x: 1, y: 0 });
	});
});

describe('distanceToSegment', () => {
	it('measures to the nearest point of the segment', () => {
		const from = { x: 0, y: 0 };
		const to = { x: 10, y: 0 };
		expect(distanceToSegment({ x: 5, y: 3 }, from, to)).toBeCloseTo(3);
		expect(distanceToSegment({ x: -3, y: 4 }, from, to)).toBeCloseTo(5);
		expect(distanceToSegment({ x: 13, y: 4 }, from, to)).toBeCloseTo(5);
	});
});

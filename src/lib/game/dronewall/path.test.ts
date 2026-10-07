import { describe, expect, it } from 'vitest';
import { LINE_Y, PATH_POINTS, SLOTS, WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { ROAD, createPath, distanceBetween, pointAt } from './path';

describe('path', () => {
	it('adds up the segment lengths', () => {
		const path = createPath([
			{ x: 0, y: 0 },
			{ x: 30, y: 40 },
			{ x: 30, y: 140 }
		]);
		expect(path.lengths).toEqual([50, 100]);
		expect(path.starts).toEqual([0, 50]);
		expect(path.length).toBe(150);
	});

	it('needs at least two points', () => {
		expect(() => createPath([{ x: 0, y: 0 }])).toThrow();
	});

	it('walks along the segments with the right heading', () => {
		const path = createPath([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 }
		]);
		expect(pointAt(path, 0)).toEqual({ x: 0, y: 0, angle: 0 });
		expect(pointAt(path, 40)).toEqual({ x: 40, y: 0, angle: 0 });
		const corner = pointAt(path, 150);
		expect(corner.x).toBe(100);
		expect(corner.y).toBe(50);
		expect(corner.angle).toBeCloseTo(Math.PI / 2);
	});

	it('clamps before the start and past the end', () => {
		const path = createPath([
			{ x: 10, y: 10 },
			{ x: 10, y: 60 }
		]);
		expect(pointAt(path, -30)).toMatchObject({ x: 10, y: 10 });
		expect(pointAt(path, 9999)).toMatchObject({ x: 10, y: 60 });
	});

	it('is continuous across corners', () => {
		let previous = pointAt(ROAD, 0);
		for (let d = 1; d <= ROAD.length; d += 1) {
			const next = pointAt(ROAD, d);
			expect(distanceBetween(previous, next)).toBeLessThanOrEqual(1.0001);
			previous = next;
		}
	});

	it('the road ends on the line and starts above the field', () => {
		expect(pointAt(ROAD, 0).y).toBeLessThan(0);
		expect(pointAt(ROAD, ROAD.length).y).toBe(LINE_Y);
		expect(PATH_POINTS[PATH_POINTS.length - 1].y).toBe(LINE_Y);
	});

	it('keeps every slot inside the field and within reach of the road', () => {
		for (const slot of SLOTS) {
			expect(slot.x).toBeGreaterThan(0);
			expect(slot.x).toBeLessThan(WORLD_WIDTH);
			expect(slot.y).toBeGreaterThan(0);
			expect(slot.y).toBeLessThan(WORLD_HEIGHT);
			let nearest = Infinity;
			for (let d = 0; d <= ROAD.length; d += 5) {
				nearest = Math.min(nearest, distanceBetween(slot, pointAt(ROAD, d)));
			}
			// Close enough to fight, far enough that a helmet on the road never hides under a slot
			expect(nearest).toBeLessThan(90);
			expect(nearest).toBeGreaterThan(45);
		}
	});
});

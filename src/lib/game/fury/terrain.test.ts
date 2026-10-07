import { describe, expect, it } from 'vitest';
import { groundHeight, groundMax, terrainPoints, type LevelHill } from './terrain';

const hill: LevelHill = { x: 12, w: 6, h: 1.2, flat: 2 };

describe('terrain', () => {
	it('is flat without hills', () => {
		expect(groundHeight(undefined, 10)).toBe(0);
		expect(groundHeight([], 10)).toBe(0);
		expect(terrainPoints(undefined, -5, 30)).toEqual([
			{ x: -5, y: 0 },
			{ x: 30, y: 0 }
		]);
	});

	it('has a flat top, slopes that ease down, and flat ground around the hill', () => {
		expect(groundHeight([hill], 12)).toBe(1.2);
		expect(groundHeight([hill], 12.9)).toBe(1.2);
		expect(groundHeight([hill], 9)).toBe(0);
		expect(groundHeight([hill], 15)).toBe(0);
		const slope = [9.4, 9.8, 10.2, 10.6].map((x) => groundHeight([hill], x));
		for (let i = 1; i < slope.length; i++) expect(slope[i]).toBeGreaterThan(slope[i - 1]);
		expect(groundHeight([hill], 10)).toBeCloseTo(0.6);
	});

	it('finds the highest ground under a span', () => {
		expect(groundMax([hill], 5, 8)).toBe(0);
		expect(groundMax([hill], 11.5, 12.5)).toBe(1.2);
		// A span reaching over the whole hill meets the top even though both ends are on flat ground
		expect(groundMax([hill], 8, 16)).toBe(1.2);
		// A span ending on the slope meets only the slope
		const edge = groundMax([hill], 8, 10.5);
		expect(edge).toBeGreaterThan(0);
		expect(edge).toBeLessThan(1.2);
		expect(groundMax(undefined, 0, 30)).toBe(0);
	});

	it('samples the ground densely on slopes and keeps every outline point on the ground', () => {
		const points = terrainPoints([hill], -40, 70);
		expect(points[0].x).toBe(-40);
		expect(points[points.length - 1].x).toBe(70);
		for (let i = 1; i < points.length; i++) {
			expect(points[i].x).toBeGreaterThan(points[i - 1].x);
			expect(points[i].y).toBeCloseTo(groundHeight([hill], points[i].x));
		}
		const slopePoints = points.filter((point) => point.x > 9 && point.x < 15);
		expect(slopePoints.length).toBeGreaterThan(20);
	});
});

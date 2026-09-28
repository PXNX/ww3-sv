import { describe, expect, it } from 'vitest';
import { starburst } from './starburst';

function points(polygon: string): [number, number][] {
	return polygon.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]);
}

describe('starburst', () => {
	it('draws one ray and one arrowhead per ray', () => {
		const shapes = starburst(60, 60, 50, 12);
		expect(shapes.rays).toHaveLength(12);
		expect(shapes.tips).toHaveLength(12);
		expect(shapes.sparks.length).toBeGreaterThan(0);
	});

	it('keeps every point inside the requested radius', () => {
		const shapes = starburst(60, 60, 50);
		for (const polygon of [...shapes.rays, ...shapes.tips, ...shapes.sparks]) {
			for (const [x, y] of points(polygon)) {
				expect(Math.hypot(x - 60, y - 60)).toBeLessThanOrEqual(50.5);
			}
		}
	});

	it('is deterministic', () => {
		expect(starburst(10, 20, 30)).toEqual(starburst(10, 20, 30));
	});
});

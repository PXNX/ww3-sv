import { describe, expect, it } from 'vitest';
import { TRAIL_FADE_MS, TRAIL_MAX_POINTS } from './config';
import {
	addTrailPoint,
	beginSwipe,
	clearTrail,
	closestFraction,
	createTrail,
	pruneTrail,
	segmentHitsCircle,
	trailHits,
	trailSegments
} from './trail';

describe('trail points', () => {
	it('keeps only the newest points', () => {
		const trail = createTrail();
		beginSwipe(trail, { x: 0, y: 0 }, 0);
		for (let i = 1; i <= 20; i++) addTrailPoint(trail, { x: i, y: i }, i);
		expect(trail.points).toHaveLength(TRAIL_MAX_POINTS);
		expect(trail.points[trail.points.length - 1]).toMatchObject({ x: 20, y: 20 });
		expect(trail.points[0]).toMatchObject({ x: 20 - TRAIL_MAX_POINTS + 1 });
	});

	it('skips a repeated point but refreshes its time', () => {
		const trail = createTrail();
		beginSwipe(trail, { x: 5, y: 5 }, 0);
		addTrailPoint(trail, { x: 5, y: 5 }, 100);
		expect(trail.points).toHaveLength(1);
		expect(trail.points[0].t).toBe(100);
	});

	it('drops old points and starts fresh on a new swipe', () => {
		const trail = createTrail();
		beginSwipe(trail, { x: 0, y: 0 }, 0);
		addTrailPoint(trail, { x: 10, y: 0 }, 100);
		addTrailPoint(trail, { x: 20, y: 0 }, 300);
		pruneTrail(trail, 300);
		expect(trail.points.map((point) => point.x)).toEqual([10, 20]);
		pruneTrail(trail, 300 + TRAIL_FADE_MS + 1);
		expect(trail.points).toHaveLength(0);

		const before = trail.swipe;
		beginSwipe(trail, { x: 1, y: 1 }, 1000);
		expect(trail.swipe).toBe(before + 1);
		expect(trail.points).toHaveLength(1);
		clearTrail(trail);
		expect(trail.points).toHaveLength(0);
	});

	it('turns points into segments, and a single point into a tap', () => {
		const trail = createTrail();
		expect(trailSegments(trail)).toEqual([]);
		beginSwipe(trail, { x: 1, y: 2 }, 0);
		expect(trailSegments(trail)).toHaveLength(1);
		addTrailPoint(trail, { x: 3, y: 4 }, 10);
		addTrailPoint(trail, { x: 5, y: 6 }, 20);
		expect(trailSegments(trail)).toHaveLength(2);
	});
});

describe('segmentHitsCircle', () => {
	const center = { x: 50, y: 50 };

	it('hits when the segment crosses the circle', () => {
		expect(segmentHitsCircle({ x: 0, y: 50 }, { x: 100, y: 50 }, center, 10)).toBe(true);
	});

	it('hits when the segment only grazes the edge', () => {
		expect(segmentHitsCircle({ x: 0, y: 60 }, { x: 100, y: 60 }, center, 10)).toBe(true);
		expect(segmentHitsCircle({ x: 0, y: 60.01 }, { x: 100, y: 60.01 }, center, 10)).toBe(false);
	});

	it('hits when a segment lies entirely inside the circle', () => {
		expect(segmentHitsCircle({ x: 48, y: 50 }, { x: 52, y: 50 }, center, 10)).toBe(true);
	});

	it('does not hit a circle beyond the end of the segment', () => {
		expect(segmentHitsCircle({ x: 0, y: 50 }, { x: 30, y: 50 }, center, 10)).toBe(false);
		expect(segmentHitsCircle({ x: 0, y: 50 }, { x: 40, y: 50 }, center, 10)).toBe(true);
	});

	it('handles a diagonal segment and a zero-length one', () => {
		expect(segmentHitsCircle({ x: 0, y: 0 }, { x: 100, y: 100 }, center, 1)).toBe(true);
		expect(segmentHitsCircle({ x: 0, y: 100 }, { x: 100, y: 0 }, { x: 50, y: 60 }, 5)).toBe(false);
		expect(segmentHitsCircle({ x: 52, y: 50 }, { x: 52, y: 50 }, center, 10)).toBe(true);
		expect(segmentHitsCircle({ x: 80, y: 50 }, { x: 80, y: 50 }, center, 10)).toBe(false);
	});

	it('orders cuts along a segment by the closest fraction', () => {
		expect(closestFraction({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 })).toBeCloseTo(0.5);
		expect(closestFraction({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -5, y: 3 })).toBe(0);
		expect(closestFraction({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 3 })).toBe(1);
		expect(closestFraction({ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 9, y: 9 })).toBe(0);
	});
});

describe('trailHits', () => {
	const circle = (target: { x: number; y: number; r: number }) => target;

	it('returns every cut target once, in swipe order', () => {
		const trail = createTrail();
		beginSwipe(trail, { x: 0, y: 0 }, 0);
		addTrailPoint(trail, { x: 100, y: 0 }, 10);
		addTrailPoint(trail, { x: 100, y: 100 }, 20);
		const first = { x: 20, y: 0, r: 5 };
		const second = { x: 80, y: 0, r: 5 };
		const third = { x: 100, y: 60, r: 5 };
		const missed = { x: 50, y: 50, r: 5 };
		const hits = trailHits(trailSegments(trail), [third, missed, second, first], circle);
		expect(hits.map((hit) => hit.target)).toEqual([first, second, third]);
		expect(hits[0].angle).toBeCloseTo(0);
		expect(hits[2].angle).toBeCloseTo(Math.PI / 2);
	});

	it('does not count a target twice when two segments touch it', () => {
		const trail = createTrail();
		beginSwipe(trail, { x: 0, y: 0 }, 0);
		addTrailPoint(trail, { x: 50, y: 0 }, 10);
		addTrailPoint(trail, { x: 50, y: 50 }, 20);
		const corner = { x: 50, y: 0, r: 8 };
		expect(trailHits(trailSegments(trail), [corner], circle)).toHaveLength(1);
	});

	it('cuts on a tap and finds nothing on an empty trail', () => {
		const trail = createTrail();
		const target = { x: 10, y: 10, r: 6 };
		expect(trailHits(trailSegments(trail), [target], circle)).toEqual([]);
		beginSwipe(trail, { x: 12, y: 12 }, 0);
		const hits = trailHits(trailSegments(trail), [target], circle);
		expect(hits).toHaveLength(1);
		expect(hits[0].angle).toBe(0);
	});
});

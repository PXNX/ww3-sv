/*
 * The swipe trail: the last few pointer points, each with the time it was made. The trail is a
 * polyline; slicing is a segment-versus-circle test of every segment against every flyer.
 */
import { TRAIL_FADE_MS, TRAIL_MAX_POINTS } from './config';

export interface Point {
	x: number;
	y: number;
}

export interface TrailPoint extends Point {
	/** Simulation time when the pointer was here, in milliseconds */
	t: number;
}

export interface Segment {
	a: Point;
	b: Point;
}

export interface Trail {
	points: TrailPoint[];
	/** Counts up on every new swipe (pointer press) so a combo can tell swipes apart */
	swipe: number;
}

export function createTrail(): Trail {
	return { points: [], swipe: 0 };
}

/** A new swipe starts: the old trail is dropped */
export function beginSwipe(trail: Trail, point: Point, nowMs: number) {
	trail.swipe += 1;
	trail.points = [{ x: point.x, y: point.y, t: nowMs }];
}

/** Adds a pointer point, keeping only the newest TRAIL_MAX_POINTS. Repeats of a point are skipped. */
export function addTrailPoint(trail: Trail, point: Point, nowMs: number) {
	const last = trail.points[trail.points.length - 1];
	if (last && last.x === point.x && last.y === point.y) {
		last.t = nowMs;
		return;
	}
	trail.points.push({ x: point.x, y: point.y, t: nowMs });
	if (trail.points.length > TRAIL_MAX_POINTS) {
		trail.points.splice(0, trail.points.length - TRAIL_MAX_POINTS);
	}
}

/** Drops points that are older than the fade time */
export function pruneTrail(trail: Trail, nowMs: number, fadeMs = TRAIL_FADE_MS) {
	const keep = trail.points.filter((point) => nowMs - point.t <= fadeMs);
	if (keep.length !== trail.points.length) trail.points = keep;
}

export function clearTrail(trail: Trail) {
	trail.points = [];
}

/**
 * The polyline as segments, oldest first. A trail with a single point (a tap) gives one
 * zero-length segment, so tapping a flyer slices it too.
 */
export function trailSegments(trail: Trail): Segment[] {
	const { points } = trail;
	if (points.length === 0) return [];
	if (points.length === 1) return [{ a: points[0], b: points[0] }];
	const segments: Segment[] = [];
	for (let i = 1; i < points.length; i++) segments.push({ a: points[i - 1], b: points[i] });
	return segments;
}

/**
 * Where on segment a-b is closest to the center, as a fraction 0..1 (0 for a zero-length
 * segment). Also the order in which a swipe passes several flyers along one segment.
 */
export function closestFraction(a: Point, b: Point, center: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return 0;
	const t = ((center.x - a.x) * dx + (center.y - a.y) * dy) / lengthSquared;
	return Math.min(1, Math.max(0, t));
}

/** Whether segment a-b touches the circle (touching the edge counts) */
export function segmentHitsCircle(a: Point, b: Point, center: Point, radius: number): boolean {
	const t = closestFraction(a, b, center);
	const x = a.x + (b.x - a.x) * t;
	const y = a.y + (b.y - a.y) * t;
	return Math.hypot(center.x - x, center.y - y) <= radius;
}

export interface TrailHit<T> {
	target: T;
	/** Index of the segment that cut it */
	segment: number;
	/** Direction of that segment in radians (0 for a tap) */
	angle: number;
	/** Position of the cut along its segment, 0..1 */
	fraction: number;
}

/**
 * Every target the trail cuts, each once, in the order the swipe passed them (older segments
 * first, then along the segment). `circle` gives a target's center and radius.
 */
export function trailHits<T>(
	segments: readonly Segment[],
	targets: readonly T[],
	circle: (target: T) => { x: number; y: number; r: number }
): TrailHit<T>[] {
	const hits: TrailHit<T>[] = [];
	for (const target of targets) {
		const { x, y, r } = circle(target);
		for (let i = 0; i < segments.length; i++) {
			const { a, b } = segments[i];
			if (!segmentHitsCircle(a, b, { x, y }, r)) continue;
			hits.push({
				target,
				segment: i,
				angle: a.x === b.x && a.y === b.y ? 0 : Math.atan2(b.y - a.y, b.x - a.x),
				fraction: closestFraction(a, b, { x, y })
			});
			break;
		}
	}
	return hits.sort((p, q) => p.segment - q.segment || p.fraction - q.fraction);
}

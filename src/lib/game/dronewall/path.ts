/*
 * Pathing: soldiers do not steer, they only have a distance travelled along the road. These
 * helpers turn that distance into a world position and a heading.
 */
import { PATH_POINTS, type Point } from './config';

export interface Path {
	points: readonly Point[];
	/** Length of each segment */
	lengths: readonly number[];
	/** Distance from the start to the beginning of each segment */
	starts: readonly number[];
	length: number;
}

export function createPath(points: readonly Point[] = PATH_POINTS): Path {
	if (points.length < 2) throw new Error('A path needs at least two points');
	const lengths: number[] = [];
	const starts: number[] = [];
	let length = 0;
	for (let i = 0; i < points.length - 1; i++) {
		const segment = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
		starts.push(length);
		lengths.push(segment);
		length += segment;
	}
	return { points, lengths, starts, length };
}

export const ROAD = createPath();

export interface PathSample extends Point {
	/** Heading in radians (0 = right, PI / 2 = down) */
	angle: number;
}

/** Position and heading after travelling `distance` along the path (clamped to its ends) */
export function pointAt(path: Path, distance: number): PathSample {
	const d = Math.min(Math.max(distance, 0), path.length);
	let index = path.lengths.length - 1;
	for (let i = 0; i < path.lengths.length; i++) {
		if (d <= path.starts[i] + path.lengths[i]) {
			index = i;
			break;
		}
	}
	const from = path.points[index];
	const to = path.points[index + 1];
	const along = path.lengths[index] === 0 ? 0 : (d - path.starts[index]) / path.lengths[index];
	return {
		x: from.x + (to.x - from.x) * along,
		y: from.y + (to.y - from.y) * along,
		angle: Math.atan2(to.y - from.y, to.x - from.x)
	};
}

export function distanceBetween(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

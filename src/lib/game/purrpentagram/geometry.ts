/*
 * Where the five cats sit. Seats are the points of a pentagon, numbered clockwise from the top; a
 * pentagram is the closed walk that skips one seat at a time, so a ritual that is drawn in the
 * right order always turns out to be a star.
 */
import { CAT_COUNT, CAT_RADIUS, CENTER, STAR_RADIUS } from './config';

export interface Point {
	x: number;
	y: number;
}

/** Centre of a seat: seat 0 is at the top, the rest follow clockwise */
export function seatPosition(seat: number): Point {
	const angle =
		-Math.PI / 2 + (((seat % CAT_COUNT) + CAT_COUNT) % CAT_COUNT) * ((2 * Math.PI) / CAT_COUNT);
	return {
		x: CENTER.x + STAR_RADIUS * Math.cos(angle),
		y: CENTER.y + STAR_RADIUS * Math.sin(angle)
	};
}

/** The seat reached at step `step` of a star walk that starts on `start` and goes `direction` */
export function starSeat(start: number, direction: 1 | -1, step: number): number {
	return (((start + direction * 2 * step) % CAT_COUNT) + CAT_COUNT) % CAT_COUNT;
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

export function insideCircle(point: Point, centre: Point, radius = CAT_RADIUS): boolean {
	return distance(point, centre) <= radius;
}

/** Index of the centre whose circle holds the point (the nearest one when circles overlap) */
export function circleAt(
	point: Point,
	centres: readonly Point[],
	radius = CAT_RADIUS
): number | null {
	let best: number | null = null;
	let bestDistance = Infinity;
	centres.forEach((centre, index) => {
		const d = distance(point, centre);
		if (d <= radius && d < bestDistance) {
			best = index;
			bestDistance = d;
		}
	});
	return best;
}

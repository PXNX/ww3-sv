/*
 * Rocket flight paths. A rocket flies a fixed arc from its start in the sky to its landing point on
 * the ground: a straight line plus a parabolic lift, travelled in flightMs. Because the path is
 * fixed at launch, the landing point can be known in advance and drawn as a dotted trajectory.
 */
import { GROUND_Y } from './config.js';

export interface Point {
	x: number;
	y: number;
}

export interface Flight {
	startX: number;
	startY: number;
	/** Column where the rocket lands on the ground line */
	impactX: number;
	/** How far above the straight line the arc peaks at its middle, in world units */
	lift: number;
	/** Time from launch to landing */
	flightMs: number;
}

/** Progress along the path, 0 at the start and 1 at the landing */
export function flightProgress(flight: Flight, elapsedMs: number): number {
	if (flight.flightMs <= 0) return 1;
	return Math.min(1, Math.max(0, elapsedMs / flight.flightMs));
}

/** Position at progress s (0 to 1) */
export function pointAt(flight: Flight, s: number): Point {
	const t = Math.min(1, Math.max(0, s));
	return {
		x: flight.startX + (flight.impactX - flight.startX) * t,
		y: flight.startY + (GROUND_Y - flight.startY) * t - flight.lift * 4 * t * (1 - t)
	};
}

/** Where the rocket is after the given flight time (it stays on the landing point once there) */
export function flightPoint(flight: Flight, elapsedMs: number): Point {
	return pointAt(flight, flightProgress(flight, elapsedMs));
}

/** Direction the rocket is travelling in radians (0 is east, positive is clockwise on screen) */
export function flightHeading(flight: Flight, elapsedMs: number): number {
	const s = flightProgress(flight, elapsedMs);
	const dx = flight.impactX - flight.startX;
	const dy = GROUND_Y - flight.startY - flight.lift * 4 * (1 - 2 * s);
	return Math.atan2(dy, dx);
}

/** Where the rocket will land: known from the moment it is launched */
export function predictedImpact(flight: Flight): Point {
	return { x: flight.impactX, y: GROUND_Y };
}

/** Time left before the rocket lands */
export function timeToImpact(flight: Flight, elapsedMs: number): number {
	return Math.max(0, flight.flightMs - elapsedMs);
}

/** Points along the rest of the path, from the current position to the landing, for the dotted line */
export function remainingPath(flight: Flight, elapsedMs: number, samples = 24): Point[] {
	const from = flightProgress(flight, elapsedMs);
	const count = Math.max(1, Math.floor(samples));
	const points: Point[] = [];
	for (let i = 0; i <= count; i++) points.push(pointAt(flight, from + ((1 - from) * i) / count));
	return points;
}

/** The highest point of the whole path (smallest y), to keep arcs inside the picture */
export function highestPoint(flight: Flight): number {
	let top = Infinity;
	for (let i = 0; i <= 40; i++) top = Math.min(top, pointAt(flight, i / 40).y);
	return top;
}

export function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

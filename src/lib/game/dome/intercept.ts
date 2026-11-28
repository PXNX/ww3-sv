/*
 * Interceptor guidance. An interceptor launches from the battery already aimed at the point where
 * the rocket will be when it gets there, then keeps correcting its heading toward that lead point
 * every step, within a limited turn rate. It hits when it comes within INTERCEPT_RADIUS of the
 * rocket, and cannot catch one that lands before it can get there. Its speed comes from the field:
 * a taller sky has faster rockets, so its interceptors are faster too.
 */
import {
	BATTERY_X,
	BATTERY_Y,
	INTERCEPTOR_SPEED,
	INTERCEPTOR_TURN_RATE,
	INTERCEPT_RADIUS
} from './config.js';
import { distance, flightPoint, type Flight, type Point } from './trajectory.js';

export interface Interceptor {
	id: number;
	rocketId: number;
	x: number;
	y: number;
	/** Radians, 0 is east */
	heading: number;
	/** World units per second */
	speed: number;
	ageMs: number;
	/** Hit radius multiplier, from the interceptor type */
	radius: number;
}

export interface Lead {
	point: Point;
	/** Flight time the interceptor needs to reach the point */
	timeMs: number;
	/** Whether the rocket is still in the air by then (otherwise it lands first) */
	reachable: boolean;
}

/** The point to aim at so that an interceptor from `from` meets the rocket there */
export function leadPoint(
	from: Point,
	flight: Flight,
	rocketElapsedMs: number,
	speed = INTERCEPTOR_SPEED
): Lead {
	let timeMs = (distance(from, flightPoint(flight, rocketElapsedMs)) / speed) * 1000;
	let point = flightPoint(flight, rocketElapsedMs + timeMs);
	for (let i = 0; i < 4; i++) {
		timeMs = (distance(from, point) / speed) * 1000;
		point = flightPoint(flight, rocketElapsedMs + timeMs);
	}
	return { point, timeMs, reachable: rocketElapsedMs + timeMs < flight.flightMs };
}

export function launchInterceptor(
	id: number,
	rocketId: number,
	flight: Flight,
	rocketElapsedMs: number,
	from: Point = { x: BATTERY_X, y: BATTERY_Y },
	speed = INTERCEPTOR_SPEED,
	radius = 1
): Interceptor {
	const lead = leadPoint(from, flight, rocketElapsedMs, speed);
	return {
		id,
		rocketId,
		x: from.x,
		y: from.y,
		heading: Math.atan2(lead.point.y - from.y, lead.point.x - from.x),
		speed,
		ageMs: 0,
		radius
	};
}

/** Smallest signed angle that turns `from` into `to`, in -PI..PI */
export function angleDifference(from: number, to: number): number {
	let diff = (to - from) % (Math.PI * 2);
	if (diff > Math.PI) diff -= Math.PI * 2;
	if (diff < -Math.PI) diff += Math.PI * 2;
	return diff;
}

/**
 * Moves the interceptor one step toward the rocket, whose flight time is already advanced to
 * rocketElapsedMs. Returns true when it is close enough to hit.
 */
export function stepInterceptor(
	interceptor: Interceptor,
	dtMs: number,
	flight: Flight,
	rocketElapsedMs: number
): boolean {
	const dt = dtMs / 1000;
	const here = { x: interceptor.x, y: interceptor.y };
	const lead = leadPoint(here, flight, rocketElapsedMs, interceptor.speed);
	const wanted = Math.atan2(lead.point.y - here.y, lead.point.x - here.x);
	const turn = angleDifference(interceptor.heading, wanted);
	const maxTurn = INTERCEPTOR_TURN_RATE * dt;
	interceptor.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
	interceptor.x += Math.cos(interceptor.heading) * interceptor.speed * dt;
	interceptor.y += Math.sin(interceptor.heading) * interceptor.speed * dt;
	interceptor.ageMs += dtMs;
	return (
		distance(interceptor, flightPoint(flight, rocketElapsedMs)) <=
		INTERCEPT_RADIUS * interceptor.radius
	);
}

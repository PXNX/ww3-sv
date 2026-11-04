/*
 * Pure stone physics for Iceberg Curling: friction, curl, wind, drifting ice and collisions.
 * Nothing here knows about rules or rendering, so it can be tested by calling it directly.
 */
import {
	CURL,
	DRIFT_Y0,
	DRIFT_Y1,
	FRICTION,
	FRICTION_VISCOUS,
	HACK,
	MAX_ANGLE,
	MIN_POWER,
	REST_SPEED,
	SHEET_BACK,
	SHEET_L,
	SHEET_R,
	STONE_R,
	SWEEP_CURL,
	SWEEP_FRICTION,
	V_MAX,
	V_MIN
} from './config';

export interface Body {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export interface Drift {
	/** Sideways acceleration inside the lane, negative pushes left */
	ax: number;
}

export interface Conditions {
	/** Sideways acceleration of the wind */
	wind: number;
	drift: Drift | null;
	sweeping: boolean;
}

export const speedOf = (body: Body) => Math.hypot(body.vx, body.vy);

/** Launch speed for a power between 0 and 1 */
export function launchSpeed(power: number): number {
	const clamped = Math.min(1, Math.max(0, power));
	return V_MIN + (V_MAX - V_MIN) * clamped;
}

/** Velocity of a stone thrown at an angle (degrees, positive to the right of straight up) */
export function launchVelocity(angle: number, power: number): { vx: number; vy: number } {
	const rad = (clampAngle(angle) * Math.PI) / 180;
	const speed = launchSpeed(power);
	return { vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed };
}

export const clampAngle = (angle: number) => Math.min(MAX_ANGLE, Math.max(-MAX_ANGLE, angle));
export const clampPower = (power: number) => Math.min(1, Math.max(MIN_POWER, power));

/** Advances one stone: friction, curl (spin is +1 or -1), wind and drift. Returns whether it still moves. */
export function stepStone(
	stone: Body & { spin: number },
	dt: number,
	{ wind, drift, sweeping }: Conditions
): boolean {
	const speed = speedOf(stone);
	if (speed < REST_SPEED) {
		stone.vx = 0;
		stone.vy = 0;
		return false;
	}
	const ux = stone.vx / speed;
	const uy = stone.vy / speed;

	// Curl pulls sideways, more as the stone slows; sweeping straightens it
	const curl =
		CURL *
		stone.spin *
		(sweeping ? SWEEP_CURL : 1) *
		(0.45 + 0.55 * (1 - Math.min(1, speed / V_MAX)));
	// The wind and the drift fade out as the stone creeps to a halt
	const push = Math.min(1, speed / 30);
	let ax = -uy * curl + wind * push;
	const ay = ux * curl;
	if (drift && stone.y >= DRIFT_Y0 && stone.y <= DRIFT_Y1) ax += drift.ax * push;

	let vx = stone.vx + ax * dt;
	let vy = stone.vy + ay * dt;

	const friction = (FRICTION + FRICTION_VISCOUS * speed) * (sweeping ? SWEEP_FRICTION : 1);
	const next = Math.hypot(vx, vy);
	const slowed = Math.max(0, next - friction * dt);
	if (next > 0) {
		vx = (vx / next) * slowed;
		vy = (vy / next) * slowed;
	}
	stone.vx = vx;
	stone.vy = vy;
	stone.x += vx * dt;
	stone.y += vy * dt;
	if (Math.hypot(vx, vy) < REST_SPEED) {
		stone.vx = 0;
		stone.vy = 0;
		return false;
	}
	return true;
}

/** Strength of an impact from 0 to 1, for sounds, shake and vibration */
export const impactStrength = (normalSpeed: number) => Math.min(1, Math.abs(normalSpeed) / 110);

/**
 * Bounces two equal stones off each other when they overlap. Returns the impact strength, or 0 when
 * they do not touch (or are already moving apart).
 */
export function collideStones(a: Body, b: Body, restitution: number): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const distance = Math.hypot(dx, dy);
	const minimum = STONE_R * 2;
	if (distance >= minimum) return 0;
	const nx = distance > 0.0001 ? dx / distance : 0;
	const ny = distance > 0.0001 ? dy / distance : -1;
	const overlap = minimum - distance;
	a.x -= (nx * overlap) / 2;
	a.y -= (ny * overlap) / 2;
	b.x += (nx * overlap) / 2;
	b.y += (ny * overlap) / 2;
	const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
	if (relative >= 0) return 0;
	const impulse = (-(1 + restitution) * relative) / 2;
	a.vx -= impulse * nx;
	a.vy -= impulse * ny;
	b.vx += impulse * nx;
	b.vy += impulse * ny;
	return impactStrength(relative);
}

/**
 * Bounces a stone off a round obstacle that does not give way, such as a seal. The obstacle may
 * move with its own velocity (a penguin). Returns the impact strength or 0.
 */
export function collideObstacle(
	stone: Body,
	obstacle: { x: number; y: number; vx?: number; vy?: number },
	radius: number,
	restitution: number
): number {
	const dx = stone.x - obstacle.x;
	const dy = stone.y - obstacle.y;
	const distance = Math.hypot(dx, dy);
	const minimum = STONE_R + radius;
	if (distance >= minimum) return 0;
	const nx = distance > 0.0001 ? dx / distance : 0;
	const ny = distance > 0.0001 ? dy / distance : 1;
	stone.x = obstacle.x + nx * minimum;
	stone.y = obstacle.y + ny * minimum;
	const relative = (stone.vx - (obstacle.vx ?? 0)) * nx + (stone.vy - (obstacle.vy ?? 0)) * ny;
	if (relative >= 0) return 0;
	stone.vx -= (1 + restitution) * relative * nx;
	stone.vy -= (1 + restitution) * relative * ny;
	return impactStrength(relative);
}

/** Whether a stone centre is still on the slab */
export const onSheet = (stone: Body) =>
	stone.x >= SHEET_L && stone.x <= SHEET_R && stone.y >= SHEET_BACK;

export interface PathOptions extends Conditions {
	angle: number;
	power: number;
	spin: number;
}

/**
 * Where an unswept stone would go: a point every few steps from the hack until it stops. Ignores
 * other stones, seals and the penguin, which is what the aiming hint shows.
 */
export function predictPath({ angle, power, spin, wind, drift }: PathOptions, dt = 1 / 60) {
	const { vx, vy } = launchVelocity(angle, power);
	const stone = { x: HACK.x, y: HACK.y, vx, vy, spin };
	const points = [{ x: stone.x, y: stone.y }];
	for (let step = 1; step < 60 * 12; step++) {
		const moving = stepStone(stone, dt, { wind, drift, sweeping: false });
		if (step % 4 === 0 || !moving) points.push({ x: stone.x, y: stone.y });
		if (!moving || !onSheet(stone)) break;
	}
	return points;
}

/** The first part of a path, cut at a fraction of its total length */
export function trimPath(points: { x: number; y: number }[], fraction: number) {
	if (points.length < 2 || fraction >= 1) return points;
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
	}
	const limit = total * Math.max(0, fraction);
	const kept = [points[0]];
	let length = 0;
	for (let i = 1; i < points.length; i++) {
		length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		if (length > limit) break;
		kept.push(points[i]);
	}
	return kept;
}

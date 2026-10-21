/*
 * Small 2D helpers for the raid: circle collision against the cover, line of sight and swept
 * hits, so fast bullets never tunnel through a small enemy between two steps.
 */
import type { Obstacle } from './maps';

export interface Point {
	x: number;
	y: number;
}

/** Shortest distance from point c to the segment a-b */
export function segmentDistance(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSquared = dx * dx + dy * dy;
	const t =
		lengthSquared === 0
			? 0
			: Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSquared));
	return Math.hypot(ax + t * dx - cx, ay + t * dy - cy);
}

/** True if nothing solid stands between the two points */
export function lineOfSight(
	obstacles: readonly Obstacle[],
	ax: number,
	ay: number,
	bx: number,
	by: number
): boolean {
	for (const obstacle of obstacles) {
		if (segmentDistance(ax, ay, bx, by, obstacle.x, obstacle.y) < obstacle.r * 0.92) return false;
	}
	return true;
}

/** Pushes a circle out of every obstacle it overlaps and back inside the map */
export function resolveCircle(
	body: Point,
	radius: number,
	obstacles: readonly Obstacle[],
	width: number,
	height: number
) {
	for (const obstacle of obstacles) {
		const dx = body.x - obstacle.x;
		const dy = body.y - obstacle.y;
		const min = obstacle.r + radius;
		const distanceSquared = dx * dx + dy * dy;
		if (distanceSquared >= min * min) continue;
		const distance = Math.sqrt(distanceSquared);
		if (distance < 0.0001) {
			body.x = obstacle.x + min;
			continue;
		}
		body.x = obstacle.x + (dx / distance) * min;
		body.y = obstacle.y + (dy / distance) * min;
	}
	body.x = Math.max(radius, Math.min(width - radius, body.x));
	body.y = Math.max(radius, Math.min(height - radius, body.y));
}

/** True if a circle at this spot overlaps any obstacle */
export function blocked(obstacles: readonly Obstacle[], x: number, y: number, radius: number) {
	return obstacles.some(
		(obstacle) => Math.hypot(obstacle.x - x, obstacle.y - y) < obstacle.r + radius
	);
}

/**
 * Steering around cover: the direction to the goal, bent sideways around any obstacle right in
 * the way, so enemies flow around trees and wrecks instead of pressing into them.
 */
export function steer(
	obstacles: readonly Obstacle[],
	x: number,
	y: number,
	radius: number,
	dirX: number,
	dirY: number
): Point {
	let sx = dirX;
	let sy = dirY;
	for (const obstacle of obstacles) {
		const dx = x - obstacle.x;
		const dy = y - obstacle.y;
		const reach = obstacle.r + radius + 34;
		const distance = Math.hypot(dx, dy);
		if (distance >= reach || distance < 0.0001) continue;
		const awayX = dx / distance;
		const awayY = dy / distance;
		// How much the wanted direction runs into the obstacle
		const into = -(dirX * awayX + dirY * awayY);
		if (into <= 0) continue;
		// Of the two tangents, take the one closer to the wanted direction
		let tx = -awayY;
		let ty = awayX;
		if (tx * dirX + ty * dirY < 0) {
			tx = -tx;
			ty = -ty;
		}
		const weight = into * (1 - distance / reach) * 2.4;
		sx += tx * weight;
		sy += ty * weight;
	}
	const length = Math.hypot(sx, sy);
	return length < 0.0001 ? { x: 0, y: 0 } : { x: sx / length, y: sy / length };
}

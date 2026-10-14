/*
 * The GPS lie. The chart is honest, the position on it is not: the jammer adds an offset that
 * starts at a base size, grows with time, slowly drifts around and now and then jumps. Later levels
 * also mirror the position left to right or rotate it around the middle of the map. Everything is
 * deterministic for a seed, so the same level lies the same way every run.
 */
import { createRandom, type Random } from '../random.js';

export interface Vec {
	x: number;
	y: number;
}

export interface LieParams {
	/** Size of the offset at the start, in sea units */
	base: number;
	/** How much the offset grows per second, up to max */
	growth: number;
	max: number;
	/** Radians per second the offset direction turns */
	drift: number;
	/** Seconds between jumps, 0 for none, and how far a jump moves the offset */
	jumpEvery: number;
	jumpSize: number;
	/** Shows the position mirrored left to right across the middle of the map */
	mirror: boolean;
	/** Rotates the position around the middle of the map, radians */
	rotate: number;
}

export const NO_LIE: LieParams = {
	base: 0,
	growth: 0,
	max: 0,
	drift: 0,
	jumpEvery: 0,
	jumpSize: 0,
	mirror: false,
	rotate: 0
};

export interface Lie {
	params: LieParams;
	/** Middle of the map, for mirroring and rotating */
	center: Vec;
	size: number;
	angle: number;
	nextJumpIn: number;
	random: Random;
}

export function createLie(params: LieParams, center: Vec, seed: number): Lie {
	const random = createRandom(seed);
	return {
		params,
		center,
		size: params.base,
		angle: random() * Math.PI * 2,
		nextJumpIn: params.jumpEvery,
		random
	};
}

/** Advances the lie by dt seconds; true when it just jumped */
export function stepLie(lie: Lie, dt: number): boolean {
	const { params } = lie;
	lie.size = Math.min(params.max, lie.size + params.growth * dt);
	lie.angle += params.drift * dt;
	if (params.jumpEvery <= 0) return false;
	lie.nextJumpIn -= dt;
	if (lie.nextJumpIn > 0) return false;
	lie.nextJumpIn += params.jumpEvery;
	// A jump pushes the offset to a new direction and makes it bigger, never smaller than the base
	lie.angle += Math.PI * (0.5 + lie.random());
	lie.size = Math.min(params.max, Math.max(params.base, lie.size) + params.jumpSize);
	return true;
}

/** The position the GPS claims for a true position */
export function falsePosition(lie: Lie, truth: Vec): Vec {
	const { params, center } = lie;
	let x = truth.x - center.x;
	let y = truth.y - center.y;
	if (params.mirror) x = -x;
	if (params.rotate !== 0) {
		const cos = Math.cos(params.rotate);
		const sin = Math.sin(params.rotate);
		[x, y] = [x * cos - y * sin, x * sin + y * cos];
	}
	return {
		x: center.x + x + Math.cos(lie.angle) * lie.size,
		y: center.y + y + Math.sin(lie.angle) * lie.size
	};
}

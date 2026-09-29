/*
 * The two bird types of Magyar's Birds and their tap abilities. All values are in world units
 * (meters, seconds). The physics world applies these; the math here stays pure and testable.
 */
import type { Vec } from './launch';

export type BirdKind = 'flamingo' | 'pelican';

export type BirdAbility = 'split' | null;

export interface BirdSpec {
	kind: BirdKind;
	radius: number;
	density: number;
	/** Multiplies the slingshot's launch speed: heavy birds fly slower */
	speedFactor: number;
	/** Multiplies the impact impulse this bird deals before damage thresholds are applied */
	damageMultiplier: number;
	/** Multiplies gravity's pull on this bird in flight; below 1 it arcs higher and floats longer */
	gravityScale: number;
	ability: BirdAbility;
}

export const BIRD_KINDS: readonly BirdKind[] = ['flamingo', 'pelican'];

export const BIRDS: Record<BirdKind, BirdSpec> = {
	// The standard bird: tap in flight to split into three smaller flamingos
	flamingo: {
		kind: 'flamingo',
		radius: 0.42,
		density: 3,
		speedFactor: 1,
		damageMultiplier: 1,
		gravityScale: 1,
		ability: 'split'
	},
	// Heavy and hard-hitting, with no tap ability; gravity pulls on it less, so it flies a higher arc
	pelican: {
		kind: 'pelican',
		radius: 0.56,
		density: 5,
		speedFactor: 0.86,
		damageMultiplier: 2.2,
		gravityScale: 0.78,
		ability: null
	}
};

/** Radius of each of the three small flamingos after a split */
export const SPLIT_RADIUS = 0.3;
/** Angle between the split flamingos' flight directions, in radians */
export const SPLIT_SPREAD = (12 * Math.PI) / 180;
/** Sideways distance between the split flamingos, so they do not start overlapping */
export const SPLIT_GAP = 0.7;

export function isBirdKind(value: unknown): value is BirdKind {
	return typeof value === 'string' && (BIRD_KINDS as readonly string[]).includes(value);
}

function rotate(v: Vec, angle: number): Vec {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Velocities of the three split flamingos: the same speed, fanned out around the current direction */
export function splitVelocities(velocity: Vec): Vec[] {
	return [SPLIT_SPREAD, 0, -SPLIT_SPREAD].map((angle) => rotate(velocity, angle));
}

/** Start offsets of the split flamingos, perpendicular to the flight direction (upper first) */
export function splitOffsets(velocity: Vec): Vec[] {
	const speed = Math.hypot(velocity.x, velocity.y);
	const normal = speed > 1e-9 ? { x: -velocity.y / speed, y: velocity.x / speed } : { x: 0, y: 1 };
	return [1, 0, -1].map((side) => ({
		x: normal.x * side * SPLIT_GAP,
		y: normal.y * side * SPLIT_GAP
	}));
}

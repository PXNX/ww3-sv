/*
 * The three bird types of Feathered Fury and their tap abilities. All values are in world units
 * (meters, seconds). The physics world applies these; the math here stays pure and testable.
 */
import type { Vec } from './launch';

export type BirdKind = 'flamingo' | 'goose' | 'pelican';

export type BirdAbility = 'split' | 'boost' | null;

export interface BirdSpec {
	kind: BirdKind;
	radius: number;
	density: number;
	/** Multiplies the slingshot's launch speed: heavy birds fly slower */
	speedFactor: number;
	/** Multiplies the impact impulse this bird deals before damage thresholds are applied */
	damageMultiplier: number;
	ability: BirdAbility;
}

export const BIRD_KINDS: readonly BirdKind[] = ['flamingo', 'goose', 'pelican'];

export const BIRDS: Record<BirdKind, BirdSpec> = {
	// The standard bird: tap in flight to split into three smaller flamingos
	flamingo: {
		kind: 'flamingo',
		radius: 0.42,
		density: 3,
		speedFactor: 1,
		damageMultiplier: 1,
		ability: 'split'
	},
	// Tap in flight for a speed boost along the current direction
	goose: {
		kind: 'goose',
		radius: 0.4,
		density: 3,
		speedFactor: 1,
		damageMultiplier: 1.1,
		ability: 'boost'
	},
	// Heavy, slow, and hits hard, with no tap ability
	pelican: {
		kind: 'pelican',
		radius: 0.56,
		density: 5,
		speedFactor: 0.86,
		damageMultiplier: 1.7,
		ability: null
	}
};

/** Radius of each of the three small flamingos after a split */
export const SPLIT_RADIUS = 0.3;
/** Angle between the split flamingos' flight directions, in radians */
export const SPLIT_SPREAD = (12 * Math.PI) / 180;
/** Sideways distance between the split flamingos, so they do not start overlapping */
export const SPLIT_GAP = 0.7;

/** Speed multiplier of the goose boost, and the speed it can never exceed */
export const BOOST_FACTOR = 2.1;
export const BOOST_MAX_SPEED = 30;
export const BOOST_MIN_SPEED = 14;

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

/** The goose boost: faster along the same direction, at least BOOST_MIN_SPEED, capped at the maximum */
export function boostVelocity(velocity: Vec): Vec {
	const speed = Math.hypot(velocity.x, velocity.y);
	if (speed < 1e-9) return { x: BOOST_MIN_SPEED, y: 0 };
	const boosted = Math.min(BOOST_MAX_SPEED, Math.max(BOOST_MIN_SPEED, speed * BOOST_FACTOR));
	return { x: (velocity.x / speed) * boosted, y: (velocity.y / speed) * boosted };
}

/*
 * The five bird types of Magyar's Birds and their tap abilities. All values are in world units
 * (meters, seconds). The physics world applies these; the math here stays pure and testable.
 */
import type { Vec } from './launch';

export type BirdKind = 'flamingo' | 'pelican' | 'stork' | 'goose' | 'falcon';

/**
 * split: three small flamingos; dash: a burst of forward speed; egg: drops a heavy egg straight
 * down while the bird flies on; dive: swoops steeply downwards
 */
export type BirdAbility = 'split' | 'dash' | 'egg' | 'dive' | null;

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

export const BIRD_KINDS: readonly BirdKind[] = ['flamingo', 'pelican', 'stork', 'goose', 'falcon'];

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
	},
	// Light and long-legged: tap in flight for a burst of speed, to reach the far side of a field
	stork: {
		kind: 'stork',
		radius: 0.4,
		density: 3,
		speedFactor: 1,
		damageMultiplier: 1.1,
		gravityScale: 0.9,
		ability: 'dash'
	},
	// A big, solid bird that lays an egg on whatever it flies over
	goose: {
		kind: 'goose',
		radius: 0.5,
		density: 4,
		speedFactor: 0.92,
		damageMultiplier: 1.4,
		gravityScale: 1,
		ability: 'egg'
	},
	// Small, dense and fast; tap to swoop down onto a target behind cover
	falcon: {
		kind: 'falcon',
		radius: 0.34,
		density: 4,
		speedFactor: 1.08,
		damageMultiplier: 1.3,
		gravityScale: 1,
		ability: 'dive'
	}
};

/** The stork's dash multiplies its speed by this, up to the cap */
export const DASH_FACTOR = 1.7;
export const DASH_MAX_SPEED = 26;
/** The falcon's dive: angle below the horizontal, and the least speed it dives at */
export const DIVE_ANGLE = (55 * Math.PI) / 180;
export const DIVE_MIN_SPEED = 14;
export const DIVE_BOOST = 1.25;
/** The goose's egg: size, weight, and how fast it is thrown down (it keeps a bit of the bird's drift) */
export const EGG_RADIUS = 0.22;
export const EGG_DENSITY = 7;
export const EGG_DROP_SPEED = 5;
export const EGG_DRIFT = 0.2;
/** An egg hits harder than its size suggests */
export const EGG_DAMAGE_MULTIPLIER = 2.4;

/** Radius of each of the three small flamingos after a split */
export const SPLIT_RADIUS = 0.3;
/** Angle between the split flamingos' flight directions, in radians */
export const SPLIT_SPREAD = (12 * Math.PI) / 180;
/** Sideways distance between the split flamingos, so they do not start overlapping */
export const SPLIT_GAP = 0.7;

export function isBirdKind(value: unknown): value is BirdKind {
	return typeof value === 'string' && (BIRD_KINDS as readonly string[]).includes(value);
}

/** Velocity after the stork's dash: the same direction, faster */
export function dashVelocity(velocity: Vec): Vec {
	const speed = Math.hypot(velocity.x, velocity.y);
	if (speed < 1e-9) return { x: 0, y: 0 };
	const boosted = Math.min(DASH_MAX_SPEED, speed * DASH_FACTOR);
	return { x: (velocity.x / speed) * boosted, y: (velocity.y / speed) * boosted };
}

/** Velocity after the falcon's dive: always forward and steeply down, never slower than a minimum */
export function diveVelocity(velocity: Vec): Vec {
	const speed = Math.max(DIVE_MIN_SPEED, Math.hypot(velocity.x, velocity.y) * DIVE_BOOST);
	const forward = velocity.x < 0 ? -1 : 1;
	return {
		x: forward * Math.cos(DIVE_ANGLE) * speed,
		y: -Math.sin(DIVE_ANGLE) * speed
	};
}

/** Velocity of the goose's egg: thrown down faster than the bird itself, with a little forward drift */
export function eggVelocity(velocity: Vec): Vec {
	return { x: velocity.x * EGG_DRIFT, y: Math.min(velocity.y, 0) - EGG_DROP_SPEED };
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

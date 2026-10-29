/*
 * Boosters: the little extras hidden in mystery blocks. Bump a block from below and its booster is
 * yours at once: an arepa mends a heart, turbo coffee makes the presidente fast, spring boots make
 * every jump higher, and the golden mustache makes him unstoppable for a few seconds. The timed ones
 * only change the physics (physicsFor) or the hit rules in the world, so they are easy to test.
 */
import { PHYSICS, type Physics } from './config';

export type BoosterKind = 'arepa' | 'turbo' | 'boots' | 'star';
/** The boosters that run on a timer */
export type TimedBoost = Exclude<BoosterKind, 'arepa'>;

/** Which booster hides in which block character of a level */
export const BLOCK_BOOSTERS: Readonly<Record<string, BoosterKind>> = {
	A: 'arepa',
	T: 'turbo',
	B: 'boots',
	M: 'star'
};

/** Seconds each timed booster lasts */
export const BOOST_SECONDS: Readonly<Record<TimedBoost, number>> = {
	turbo: 8,
	boots: 10,
	star: 7
};

/** Seconds left of every timed booster */
export type Boosts = Record<TimedBoost, number>;

export function noBoosts(): Boosts {
	return { turbo: 0, boots: 0, star: 0 };
}

const TURBO: Partial<Physics> = {
	maxSpeed: PHYSICS.maxSpeed * 1.3,
	sprintSpeed: PHYSICS.sprintSpeed * 1.25,
	groundAccel: PHYSICS.groundAccel * 1.3,
	airAccel: PHYSICS.airAccel * 1.2,
	sprintAfter: 0.2
};

const BOOTS: Partial<Physics> = {
	jumpSpeed: PHYSICS.jumpSpeed * 1.2,
	jumpCutSpeed: PHYSICS.jumpCutSpeed * 1.2,
	airJumpSpeed: PHYSICS.airJumpSpeed * 1.18,
	stompBounce: PHYSICS.stompBounce * 1.15,
	stompBounceHeld: PHYSICS.stompBounceHeld * 1.15
};

const cache = new Map<string, Physics>();

/** The physics for the boosters running right now (the same object every step, so no allocation) */
export function physicsFor(boosts: Boosts): Physics {
	const turbo = boosts.turbo > 0;
	const boots = boosts.boots > 0;
	if (!turbo && !boots) return PHYSICS;
	const key = `${turbo}-${boots}`;
	let physics = cache.get(key);
	if (!physics) {
		physics = { ...PHYSICS, ...(turbo ? TURBO : {}), ...(boots ? BOOTS : {}) };
		cache.set(key, physics);
	}
	return physics;
}

/*
 * Petting, as pure functions of pointer samples. A stroke remembers how far the finger has
 * travelled gently and how fast it is moving now; the purr volume is a function of both, so it
 * grows the longer you keep going and collapses when the stroking turns into scrubbing.
 */
import {
	GENTLE_MAX_SPEED,
	MIN_PET_SPEED,
	PURR_RAMP_DISTANCE,
	SCRUB_SPEED,
	SPEED_SMOOTHING
} from './config';

export interface PetSample {
	x: number;
	y: number;
	/** Milliseconds, from the pointer event's time stamp */
	t: number;
}

/** What the last movement felt like to the cat */
export type PetFeel = 'idle' | 'gentle' | 'scrub';

export interface PetStroke {
	/** Gentle distance covered so far, in field units */
	distance: number;
	/** Smoothed speed in units per second */
	speed: number;
	last: PetSample | null;
	feel: PetFeel;
}

export function startStroke(): PetStroke {
	return { distance: 0, speed: 0, last: null, feel: 'idle' };
}

export function feelOf(speed: number): PetFeel {
	if (speed < MIN_PET_SPEED) return 'idle';
	return speed > SCRUB_SPEED ? 'scrub' : 'gentle';
}

/**
 * Folds one pointer sample into the stroke. Samples that arrive less than a millisecond after the
 * previous one are merged into it, so a burst of coalesced events cannot fake a huge speed.
 * Gentle movement adds to the distance; a scrub throws half of it away.
 */
export function petSample(stroke: PetStroke, sample: PetSample): PetStroke {
	const last = stroke.last;
	if (!last) return { ...stroke, last: sample };
	const dtMs = sample.t - last.t;
	if (dtMs < 1) return stroke;

	const step = Math.hypot(sample.x - last.x, sample.y - last.y);
	const instant = (step / dtMs) * 1000;
	const speed = stroke.speed + (instant - stroke.speed) * SPEED_SMOOTHING;
	const feel = feelOf(speed);
	let distance = stroke.distance;
	if (feel === 'gentle') distance += step;
	else if (feel === 'scrub') distance *= 0.5;
	return { distance, speed, last: sample, feel };
}

/** How much of full volume a stroke gets from its speed alone: 1 when gentle, 0 when still or scrubbing */
export function speedFactor(speed: number): number {
	if (speed < MIN_PET_SPEED) return 0;
	if (speed <= GENTLE_MAX_SPEED) return Math.min(1, (speed - MIN_PET_SPEED) / MIN_PET_SPEED);
	if (speed >= SCRUB_SPEED) return 0;
	return 1 - (speed - GENTLE_MAX_SPEED) / (SCRUB_SPEED - GENTLE_MAX_SPEED);
}

/**
 * The purr volume (0 to 1) for a stroke that has covered `distance` units and is moving at
 * `speed` units per second: it rises towards full volume with distance and is scaled by how
 * gentle the current speed is.
 */
export function purrVolume(distance: number, speed: number): number {
	const grown = 1 - Math.exp(-Math.max(0, distance) / PURR_RAMP_DISTANCE);
	return grown * speedFactor(speed);
}

/*
 * The dial drift model. Without a drift the needle is a mean-reverting random walk that is clamped
 * inside the safe band; scares make it twitchy (it gets close to the band edge) but never push it
 * out. A real drift pushes it steadily in one direction until it leaves the band and, if nobody
 * reacts, reaches the end of the dial.
 */
import type { Random } from '#lib/game/random.js';
import { BAND, CALM_LIMIT, CRITICAL, RETURN_RATE, clamp01, lerp } from './config.js';

export interface Drift {
	dir: 1 | -1;
	/** Dial units per second */
	speed: number;
}

export interface DialState {
	/** Needle position, -1 to 1 */
	value: number;
	drift: Drift | null;
	/** True while the needle eases back to the middle after a fix or a meltdown */
	returning: boolean;
	/** Time the current drift has spent outside the band, for the reaction bonus */
	outMs: number;
}

export type DialEvent = { type: 'band-exit' } | { type: 'critical' };

/** How hard the needle is pulled back to the middle (per second) */
const PULL = 3;
/** Needle noise without a scare, and the extra noise at full scare jitter */
const BASE_SIGMA = 0.22;
const SCARE_SIGMA = 0.95;

export function createDial(): DialState {
	return { value: 0, drift: null, returning: false, outMs: 0 };
}

export function inBand(value: number): boolean {
	return Math.abs(value) <= BAND;
}

/** The needle is in the red: outside the band while a real drift is under way */
export function isOutOfBand(dial: DialState): boolean {
	return dial.drift !== null && !inBand(dial.value);
}

/** Drifts get slower as the difficulty rises, so they creep out from under the scares */
export function driftSpeed(difficulty: number, random: Random): number {
	return lerp(0.34, 0.18, clamp01(difficulty)) * (0.85 + random() * 0.3);
}

/** Seconds a drift needs from the middle to the band edge and from the edge to the end */
export function driftTimes(speed: number): { toBandMs: number; toEndMs: number } {
	return {
		toBandMs: (BAND / speed) * 1000,
		toEndMs: ((CRITICAL - BAND) / speed) * 1000
	};
}

/** Starts a real drift in a random direction; does nothing while one is under way or the needle is returning */
export function startDrift(dial: DialState, random: Random, difficulty: number): boolean {
	if (dial.drift || dial.returning) return false;
	dial.drift = { dir: random() < 0.5 ? -1 : 1, speed: driftSpeed(difficulty, random) };
	dial.outMs = 0;
	return true;
}

/** Stops the drift and lets the needle ease back to the middle */
export function fixDial(dial: DialState): void {
	dial.drift = null;
	dial.returning = true;
	dial.outMs = 0;
}

/** Roughly standard normal noise from three uniform numbers */
function noise(random: Random): number {
	return (random() + random() + random() - 1.5) * 2;
}

/**
 * Advances the needle by dtMs. `jitter` (0 to 1) is how twitchy the active scares make it.
 * Returns the moments the needle left the band or hit the end of the dial.
 */
export function stepDial(
	dial: DialState,
	random: Random,
	dtMs: number,
	jitter: number
): DialEvent[] {
	const dt = dtMs / 1000;
	const events: DialEvent[] = [];

	if (dial.returning) {
		const step = RETURN_RATE * dt;
		dial.value = Math.abs(dial.value) <= step ? 0 : dial.value - Math.sign(dial.value) * step;
		if (Math.abs(dial.value) <= BAND * 0.5) dial.returning = false;
		return events;
	}

	if (dial.drift) {
		const wasIn = inBand(dial.value);
		dial.value += dial.drift.dir * dial.drift.speed * dt;
		if (wasIn && !inBand(dial.value)) events.push({ type: 'band-exit' });
		if (!inBand(dial.value)) dial.outMs += dtMs;
		if (Math.abs(dial.value) >= CRITICAL) {
			dial.value = Math.sign(dial.value) * CRITICAL;
			dial.drift = null;
			dial.returning = true;
			dial.outMs = 0;
			events.push({ type: 'critical' });
		}
		return events;
	}

	const sigma = BASE_SIGMA + clamp01(jitter) * SCARE_SIGMA;
	dial.value += -PULL * dial.value * dt + sigma * Math.sqrt(dt) * noise(random);
	dial.value = Math.min(CALM_LIMIT, Math.max(-CALM_LIMIT, dial.value));
	return events;
}

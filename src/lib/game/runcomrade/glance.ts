/*
 * The runner's nervous glances back at the drone: every now and then he looks over his shoulder
 * with a comic shocked face. Pure scheduling, driven by its own seeded random so it never disturbs
 * the course: the closer the drone, the more often he looks and the longer he stares.
 */
import { createRandom, type Random } from '#lib/game/random.js';

export interface Glance {
	random: Random;
	/** Time until the next glance starts */
	cooldownMs: number;
	/** Time left of the glance in progress, 0 when none */
	remainingMs: number;
	/** How long the glance in progress lasts in total */
	durationMs: number;
}

/** The very first glance comes after this long, early enough to be seen */
export const FIRST_GLANCE_MS = 4500;

export function createGlance(seed: number): Glance {
	return {
		random: createRandom((seed ^ 0x9e3779b9) >>> 0),
		cooldownMs: FIRST_GLANCE_MS,
		remainingMs: 0,
		durationMs: 0
	};
}

/** A far drone is stared at briefly, a drone on his heels for much longer */
export function glanceDurationMs(closeness: number): number {
	return 800 + 900 * Math.min(1, Math.max(0, closeness));
}

/** Pause before the next glance: irregular, and much shorter when the drone is close */
export function glanceIntervalMs(random: Random, closeness: number): number {
	const base = 5000 + random() * 5000;
	return base * (1 - 0.65 * Math.min(1, Math.max(0, closeness)));
}

/**
 * Advances the schedule. Glances are held back while `suppressed` (for example when the drone is out
 * of sight, so the glance cannot give it away). Returns true on the step a glance starts.
 */
export function stepGlance(
	glance: Glance,
	dtMs: number,
	closeness: number,
	suppressed: boolean
): boolean {
	if (glance.remainingMs > 0) {
		glance.remainingMs = Math.max(0, glance.remainingMs - dtMs);
		return false;
	}
	if (suppressed) return false;
	glance.cooldownMs -= dtMs;
	if (glance.cooldownMs > 0) return false;
	glance.durationMs = glanceDurationMs(closeness);
	glance.remainingMs = glance.durationMs;
	glance.cooldownMs = glanceIntervalMs(glance.random, closeness);
	return true;
}

/**
 * How far the head is turned, from 0 (looking ahead) to 1 (staring back): it turns quickly, holds,
 * and turns back.
 */
export function glanceAmount(glance: Glance): number {
	if (glance.remainingMs <= 0 || glance.durationMs <= 0) return 0;
	const t = 1 - glance.remainingMs / glance.durationMs;
	const edge = Math.min(1, t / 0.2, (1 - t) / 0.2);
	return edge * edge * (3 - 2 * edge);
}

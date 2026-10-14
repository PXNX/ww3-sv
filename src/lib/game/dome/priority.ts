/*
 * Priority scoring: which threat matters most, what an intercept pays, and which rocket a tap
 * means. Value is the points shown on the building the rocket will land on, nothing for a rocket
 * that lands in the sea, in a field or on a building that is already in ruins.
 */
import {
	COMBO_STEP,
	COMBO_STEP_BONUS,
	MAX_MULTIPLIER,
	TAP_RADIUS,
	TAP_TIE,
	WASTE_PENALTY
} from './config.js';

export interface Threat {
	id: number;
	/** Points at risk if the rocket lands */
	value: number;
	timeToImpactMs: number;
}

/**
 * How much it matters to deal with a threat now: points at risk, raised the less time is left.
 * A threat that lands harmlessly always scores 0.
 */
export function threatPriority(value: number, timeToImpactMs: number): number {
	if (value <= 0) return 0;
	return value * (1 + 2000 / Math.max(400, timeToImpactMs));
}

/** Threats most urgent first (ties go to the one that lands sooner, then the older rocket) */
export function rankThreats<T extends Threat>(threats: readonly T[]): T[] {
	return [...threats].sort(
		(a, b) =>
			threatPriority(b.value, b.timeToImpactMs) - threatPriority(a.value, a.timeToImpactMs) ||
			a.timeToImpactMs - b.timeToImpactMs ||
			a.id - b.id
	);
}

/** Score multiplier after `combo` efficient intercepts in a row: 1, 1, 1, 1.5, 1.5, 2, ... up to the cap */
export function comboMultiplier(combo: number): number {
	const steps = Math.floor(Math.max(0, combo - 1) / COMBO_STEP);
	return Math.min(MAX_MULTIPLIER, 1 + steps * COMBO_STEP_BONUS);
}

export interface InterceptScore {
	/** Points won (negative when the interceptor was wasted) */
	points: number;
	multiplier: number;
	wasted: boolean;
}

/** What shooting down a rocket of the given value pays, with the combo count including this hit */
export function interceptScore(value: number, comboAfter: number): InterceptScore {
	if (value <= 0) return { points: -WASTE_PENALTY, multiplier: 1, wasted: true };
	const multiplier = comboMultiplier(comboAfter);
	return { points: Math.round(value * multiplier), multiplier, wasted: false };
}

export interface Candidate {
	id: number;
	x: number;
	y: number;
	value: number;
	timeToImpactMs: number;
}

/** The rocket a tap means: the nearest one within reach, the more urgent one when two are about as near */
export function pickRocket<T extends Candidate>(
	candidates: readonly T[],
	tap: { x: number; y: number },
	radius = TAP_RADIUS
): T | null {
	const near = candidates
		.map((candidate) => ({ candidate, gap: Math.hypot(candidate.x - tap.x, candidate.y - tap.y) }))
		.filter((entry) => entry.gap <= radius)
		.sort((a, b) => a.gap - b.gap || a.candidate.id - b.candidate.id);
	if (near.length === 0) return null;
	const closest = near[0].gap;
	const tied = near
		.filter((entry) => entry.gap - closest <= TAP_TIE)
		.map((entry) => entry.candidate);
	return rankThreats(tied)[0];
}

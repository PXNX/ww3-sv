/*
 * Border Shift convoy generator. A convoy is one vehicle with a truth the player cannot see and
 * two tools that may reveal it: the papers and the camera. Both tools either show the truth or
 * nothing useful, never a lie, so a careful player can always solve the convoy in time — unless
 * the queue is faster than the paperwork.
 */
import type { Random } from '../random.js';
import {
	CLEAR_BASE,
	CLEAR_MIN,
	CLEAR_STEP,
	HITS_PER_WAVE,
	PATIENCE_BASE_MS,
	PATIENCE_MIN_MS,
	PATIENCE_STEP_MS,
	PSYOPS_BASE,
	PSYOPS_MAX,
	PSYOPS_STEP,
	VEHICLE_COUNT
} from './config.js';

export type ConvoyTruth = 'family' | 'psyops';

/** What one tool shows: the truth, or an unhelpful blur */
export type Hint = ConvoyTruth | 'unclear';

export type Tool = 'documents' | 'camera';

export interface Convoy {
	/** Index into the bordershift_vehicle_* messages */
	vehicle: number;
	truth: ConvoyTruth;
	hints: Record<Tool, Hint>;
}

/** How long a convoy waits in this shift */
export function patienceFor(wave: number): number {
	return Math.max(PATIENCE_MIN_MS, PATIENCE_BASE_MS - PATIENCE_STEP_MS * (wave - 1));
}

/** Share of convoys that are psy-ops in this shift */
export function psyopsShare(wave: number): number {
	return Math.min(PSYOPS_MAX, PSYOPS_BASE + PSYOPS_STEP * (wave - 1));
}

/** Chance a tool shows something useful in this shift */
export function clearChance(wave: number): number {
	return Math.max(CLEAR_MIN, CLEAR_BASE - CLEAR_STEP * (wave - 1));
}

/** The shift the correct-call counter has reached */
export function waveFor(correct: number): number {
	return 1 + Math.floor(correct / HITS_PER_WAVE);
}

function hintFor(random: Random, truth: ConvoyTruth, chance: number): Hint {
	return random() < chance ? truth : 'unclear';
}

/**
 * Deals one convoy. The previous vehicle is never repeated back to back, so the queue does not
 * look like a glitch.
 */
export function dealConvoy(
	random: Random,
	wave: number,
	previousVehicle: number | null = null
): Convoy {
	const offset = Math.floor(random() * (VEHICLE_COUNT - (previousVehicle === null ? 0 : 1)));
	const vehicle =
		previousVehicle === null || offset < previousVehicle ? offset : (offset + 1) % VEHICLE_COUNT;
	const truth: ConvoyTruth = random() < psyopsShare(wave) ? 'psyops' : 'family';
	const chance = clearChance(wave);
	return {
		vehicle,
		truth,
		hints: {
			documents: hintFor(random, truth, chance),
			camera: hintFor(random, truth, chance)
		}
	};
}

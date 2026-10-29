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
	TUNNEL_BASE,
	TUNNEL_MAX,
	TUNNEL_STEP,
	VEHICLE_COUNT
} from './config.js';

/**
 * A family, a staged psy-op, or a digging crew that is opening a tunnel under the post. The tunnel
 * is the neighbours' other route: the trucks at the barrier are the distraction, and waving them
 * through lets the shaft be finished with people already waiting in it.
 */
export type ConvoyTruth = 'family' | 'psyops' | 'tunnel';

/** What one tool shows: the truth, or an unhelpful blur */
export type Hint = ConvoyTruth | 'unclear';

/** The papers, the camera, and a seismic probe that only ever finds a tunnel */
export type Tool = 'documents' | 'camera' | 'ground';

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

/** Share of convoys that are a digging crew in this shift */
export function tunnelShare(wave: number): number {
	return Math.min(TUNNEL_MAX, TUNNEL_BASE + TUNNEL_STEP * (wave - 1));
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
 * The seismic probe only ever reports a tunnel: on any other convoy it says nothing, because there
 * is nothing under the road to hear. It is therefore useless on a family or a psy-op, and the price
 * of using it there is the patience it costs.
 */
function groundHint(random: Random, truth: ConvoyTruth, chance: number): Hint {
	return truth === 'tunnel' && random() < chance ? 'tunnel' : 'unclear';
}

/**
 * Deals one convoy. The previous vehicle is never repeated back to back, so the queue does not
 * look like a glitch. The tunnel share is rolled first, so a shift with more digging crews cannot
 * push the psy-op share past what the config allows.
 */
export function dealConvoy(
	random: Random,
	wave: number,
	previousVehicle: number | null = null
): Convoy {
	const offset = Math.floor(random() * (VEHICLE_COUNT - (previousVehicle === null ? 0 : 1)));
	const vehicle =
		previousVehicle === null || offset < previousVehicle ? offset : (offset + 1) % VEHICLE_COUNT;
	const roll = random();
	const tunnel = tunnelShare(wave);
	const psyops = psyopsShare(wave);
	const truth: ConvoyTruth =
		roll < tunnel ? 'tunnel' : roll < tunnel + psyops ? 'psyops' : 'family';
	const chance = clearChance(wave);
	return {
		vehicle,
		truth,
		hints: {
			documents: hintFor(random, truth, chance),
			camera: hintFor(random, truth, chance),
			ground: groundHint(random, truth, chance)
		}
	};
}

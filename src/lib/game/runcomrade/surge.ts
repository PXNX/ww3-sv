/*
 * Speed surges for Run Comrade. Every so often a tailwind picks up: the world runs 10 to 15 %
 * faster for a few seconds, the drone closes in, and then the pace settles back. The state is a
 * few numbers, the random comes from the caller, so a run stays reproducible from its seed.
 */
import type { Random } from '#lib/game/random.js';
import {
	SURGE_FIRST_MS,
	SURGE_GAP_MIN_MS,
	SURGE_GAP_SPAN_MS,
	SURGE_MIN_MS,
	SURGE_MIN_SPEED,
	SURGE_SPAN_MS,
	SURGE_SPEED_SPAN
} from './config';

export interface Surge {
	/** Time left of the current surge, 0 when the pace is normal */
	leftMs: number;
	/** Time until the next surge starts */
	nextMs: number;
	/** Speed multiplier while a surge is running; 1 between surges */
	factor: number;
}

export function createSurge(): Surge {
	return { leftMs: 0, nextMs: SURGE_FIRST_MS, factor: 1 };
}

/** The multiplier to apply to the running speed right now */
export function surgeSpeedFactor(surge: Surge): number {
	return surge.leftMs > 0 ? surge.factor : 1;
}

export interface SurgeStep {
	/** A surge just started this step */
	started: boolean;
	/** A surge just ended this step */
	ended: boolean;
}

/** Counts a surge down, or the wait down, and rolls the next one when its time has come */
export function stepSurge(surge: Surge, dtMs: number, random: Random): SurgeStep {
	if (surge.leftMs > 0) {
		surge.leftMs = Math.max(0, surge.leftMs - dtMs);
		if (surge.leftMs > 0) return { started: false, ended: false };
		surge.factor = 1;
		return { started: false, ended: true };
	}
	surge.nextMs -= dtMs;
	if (surge.nextMs > 0) return { started: false, ended: false };
	// Two rolls: how long, then how strong. A tailwind is always faster than normal running.
	surge.leftMs = SURGE_MIN_MS + random() * SURGE_SPAN_MS;
	surge.factor = SURGE_MIN_SPEED + random() * SURGE_SPEED_SPAN;
	surge.nextMs = SURGE_GAP_MIN_MS + random() * SURGE_GAP_SPAN_MS;
	return { started: true, ended: false };
}

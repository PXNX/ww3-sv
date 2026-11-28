/*
 * The tide in the canal. A slow, readable cycle: at high tide the water lifts the wedged ship, so
 * the player's pulls bite harder, but ships in the queue can come closer too, so it fills faster.
 * At low tide the queue eases off and the ship settles back into the mud.
 */
export const TIDE_CYCLE_MS = 32_000;
export type TidePhase = 'low' | 'rising' | 'high' | 'falling';

export interface Tide {
	phase: TidePhase;
	/** 0 at low water, 1 at high */
	level: number;
	/** How much a pull moves the ship, 1 at low water */
	grabStrength: number;
	/** How quickly ships join the queue, 1 at low water */
	queueRate: number;
}

export const HIGH_TIDE_GRAB = 1.35;
export const HIGH_TIDE_QUEUE = 1.3;

/** Tide at a point in the run; deterministic so a replay of the same time gives the same water */
export function tideAt(ms: number): Tide {
	const t = (((ms % TIDE_CYCLE_MS) + TIDE_CYCLE_MS) % TIDE_CYCLE_MS) / TIDE_CYCLE_MS;
	// A smooth cosine starting at low water
	const level = (1 - Math.cos(t * Math.PI * 2)) / 2;
	const phase: TidePhase =
		t < 0.125 || t >= 0.875 ? 'low' : t < 0.375 ? 'rising' : t < 0.625 ? 'high' : 'falling';
	return {
		phase,
		level,
		grabStrength: 1 + (HIGH_TIDE_GRAB - 1) * level,
		queueRate: 1 + (HIGH_TIDE_QUEUE - 1) * level
	};
}

/*
 * Chip Fab Rush tuning (roadmap 3.13). A level has two stages: Stage A stacks a silicon wafer,
 * Stage B merges memory modules made from that wafer. A shortage meter rises all the time.
 */

export const STARTING_LIVES = 3;

/** Width of the stacker field in world units; layer widths and positions use the same units */
export const FIELD_WIDTH = 100;
/** Height of one wafer layer in world units */
export const LAYER_HEIGHT = 6;
/** Width of the base layer, and the widest a layer can grow back to */
export const START_WIDTH = 46;
/** A drop overlapping the layer below by less than this misses completely */
export const MIN_OVERLAP = 0.5;
/** Consecutive perfect drops needed before the layers start to grow back */
export const REGROW_AFTER = 2;
/** How much a layer grows back on each perfect drop once the streak is long enough */
export const REGROW_BY = 1.5;

/** Modules supplied to Stage B per stacked layer, and per perfect drop on top of that */
export const SUPPLY_PER_LAYER = 4;
export const SUPPLY_PER_PERFECT = 4;
/** Extra modules for a golden layer landed perfectly */
export const SUPPLY_PER_GOLD = 6;
/** Even a wafer that fell over at once yields this many modules */
export const MIN_SUPPLY = 8;

/** Milliseconds during which input is ignored after a stage change, so a late tap cannot slip in */
export const LOCK_MS = 800;

/** How long the BREAKING news card for the next level stays up, and input stays locked */
export const CARD_MS = 3000;
/** Extra points for landing a golden HBM layer perfectly */
export const GOLD_BONUS = 150;
/** Extra shortage relief for a golden layer, on top of the perfect relief */
export const GOLD_RELIEF = 6;
/** Every perfect layer of the wafer adds this share to the points made in Stage B */
export const PERFECT_MERGE_BONUS = 0.1;
/** The most Stage B can gain from a perfect wafer */
export const PERFECT_MERGE_MAX = 0.8;

/** Points for finishing a wafer and for finishing a level, the latter times the level number */
export const WAFER_BONUS = 100;
export const LEVEL_BONUS = 25;

/** Endless mode: no level cap, map keeps going upward */
export const ENDLESS = true;
export const MICRO_MIN_MS = 13000;
export const MICRO_MAX_MS = 21000;

export interface StackerParams {
	/** How fast the sliding layer moves, in world units per second */
	speed: number;
	/** How far off (in world units) a drop may be and still snap to a perfect alignment */
	tolerance: number;
	/** Layers on top of the base needed to finish the wafer */
	layers: number;
}

/** Stage A gets faster, stricter and taller with every level */
export function stackerParams(level: number): StackerParams {
	const steps = Math.max(0, Math.floor(level) - 1);
	return {
		speed: Math.min(95, 42 + 7 * steps),
		tolerance: Math.max(1, 1.8 - 0.12 * steps),
		layers: Math.min(14, 8 + steps)
	};
}

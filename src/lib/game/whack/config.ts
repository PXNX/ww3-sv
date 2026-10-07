/*
 * Spokesperson Whack constants, all in world units. The playfield is a portrait 360 x 510 box that
 * the canvas scales to fit; y grows downwards. The backdrop fills the top, below it sits a 3 x 3
 * grid of podiums that the targets pop up behind.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 510;

export const STARTING_LIVES = 5;

export const COLUMNS = 3;
export const ROWS = 3;
export const HOLE_COUNT = COLUMNS * ROWS;

/** Top edge of the podium grid; everything above is backdrop */
export const FIELD_TOP = 162;
export const CELL_WIDTH = WORLD_WIDTH / COLUMNS;
export const CELL_HEIGHT = (WORLD_HEIGHT - FIELD_TOP) / ROWS;
/** Where a target's feet sit inside its cell, measured from the cell top */
export const BASELINE_OFFSET = 92;

export type BoardId = 'regime' | 'militant' | 'kremlin';
export const BOARD_IDS: readonly BoardId[] = ['regime', 'militant', 'kremlin'];

export function isBoardId(value: unknown): value is BoardId {
	return typeof value === 'string' && (BOARD_IDS as readonly string[]).includes(value);
}

export type TargetKind = 'spokesperson' | 'official' | 'talkinghead';
export type DecoyKind = 'journalist' | 'aidworker';
export type MoleKind = TargetKind | DecoyKind;

export interface KindSpec {
	/** Points for a whack (targets only) */
	points: number;
	/** How long the statement runs, or how long a decoy stays, before the difficulty scaling */
	lifeMs: number;
	/** Relative chance to be picked among its group */
	weight: number;
}

export const TARGETS: Readonly<Record<TargetKind, KindSpec>> = {
	spokesperson: { points: 10, lifeMs: 2600, weight: 4 },
	official: { points: 15, lifeMs: 2100, weight: 3 },
	talkinghead: { points: 25, lifeMs: 1500, weight: 2 }
};

export const DECOYS: Readonly<Record<DecoyKind, KindSpec>> = {
	journalist: { points: 0, lifeMs: 2000, weight: 1 },
	aidworker: { points: 0, lifeMs: 2000, weight: 1 }
};

export const TARGET_KINDS = Object.keys(TARGETS) as TargetKind[];
export const DECOY_KINDS = Object.keys(DECOYS) as DecoyKind[];

export function specOf(kind: MoleKind): KindSpec {
	return kind in TARGETS ? TARGETS[kind as TargetKind] : DECOYS[kind as DecoyKind];
}

export function isDecoy(kind: MoleKind): kind is DecoyKind {
	return kind in DECOYS;
}

/** Time to pop up out of the podium */
export const RISE_MS = 220;
/** A figure can be hit as soon as it has risen this far */
export const HITTABLE_RISE = 0.3;
/** Time a whacked target spends dazed before it is gone */
export const WHACKED_MS = 380;
/** Time to duck back down after the statement finished or a decoy's visit ended */
export const LEAVE_MS = 220;

/** Hits chain into a combo while each follows the last within this time */
export const COMBO_WINDOW_MS = 1100;
/** Hits in a row per step of the multiplier, and the highest multiplier */
export const COMBO_STREAK_PER_LEVEL = 3;
export const COMBO_MULTIPLIER_CAP = 5;

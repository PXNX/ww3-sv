/*
 * UN Security Council Veto tuning (roadmap 3.15). A reaction game: a silly draft resolution flashes,
 * the five permanent seats each hold up a card, and the player must tap the right action before
 * the clock runs out. Streaks make every round shorter.
 */

export const STARTING_LIVES = 3;

/** How many seats sit at the table: the five permanent members */
export const SEAT_COUNT = 5;
/** Cards that must agree to decide a round; with no such majority the veto breaks the tie */
export const MAJORITY = 3;

/** Time to answer the first round, and the floor it can never shrink below */
export const BASE_WINDOW_MS = 4200;
export const MIN_WINDOW_MS = 1300;
/** Correct answers in a row per speed-up, and how much of the window each speed-up keeps */
export const PACE_STREAK = 3;
export const PACE_FACTOR = 0.9;

/** How long the verdict stays on screen before the next round, and how short it gets at top speed */
export const BASE_FEEDBACK_MS = 900;
export const MIN_FEEDBACK_MS = 480;
/** Extra pause after the last heart is lost so the player sees the mistake */
export const GAME_OVER_FEEDBACK_MS = 1100;

/** Share of the window that still counts as a swift (fast) or steady answer */
export const SWIFT_SHARE = 0.4;
export const STEADY_SHARE = 0.75;

export const BASE_POINTS = 100;
export const SWIFT_BONUS = 60;
export const STEADY_BONUS = 25;
/** The score multiplier grows by one per this many correct answers in a row, up to the cap */
export const MULTIPLIER_STREAK = 5;
export const MULTIPLIER_MAX = 5;

/** The same resolution never comes back within this many rounds */
export const RECENT_MEMORY = 12;

/** Relative chance of each kind of round (the tie-break is the round the veto stamp settles) */
export const OUTCOME_WEIGHTS = { yes: 3, abstain: 3, veto: 2, tie: 2 } as const;
/** Relative chance that a decided round has 3, 4 or 5 matching cards */
export const MAJORITY_SIZE_WEIGHTS = [
	{ item: 3, weight: 5 },
	{ item: 4, weight: 3 },
	{ item: 5, weight: 1 }
] as const;

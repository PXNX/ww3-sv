/*
 * Border Shift tuning (improvements 5.1). One night at a Polish border post: convoys arrive, some
 * are families and some are the neighbours' psy-ops. Each convoy waits a while, inspecting the
 * papers or taking a photo costs part of that patience, and the decision is always pass or refuse.
 * A wrong call costs reputation, not lives; the night ends when the post is ashamed of itself.
 */

/** Reputation points: a wrong call costs one, and the night ends when they are gone */
export const STARTING_REPUTATION = 3;

/** How long the first convoy waits before it drives through on its own */
export const PATIENCE_BASE_MS = 9500;
export const PATIENCE_MIN_MS = 4600;
export const PATIENCE_STEP_MS = 900;

/** What one look at the papers or one photo costs on the patience clock */
export const INSPECT_MS = 1200;

/** Correct calls needed to announce the next shift, which brings a tighter queue */
export const HITS_PER_WAVE = 3;

/** Share of convoys that are psy-ops; it grows once the radio smells an invasion */
export const PSYOPS_BASE = 0.4;
export const PSYOPS_MAX = 0.62;
export const PSYOPS_STEP = 0.055;

/** Chance that a tool actually shows a useful clue instead of a fogged lens */
export const CLEAR_BASE = 0.8;
export const CLEAR_MIN = 0.52;
export const CLEAR_STEP = 0.06;

/** Points for a correct call, plus a share of the patience that is left and a streak bonus */
export const POINTS_BASE = 60;
export const POINTS_PATIENCE = 90;
export const STREAK_BONUS = 10;
export const STREAK_BONUS_MAX = 40;

/** How long the verdict stays up before the next convoy rolls in */
export const FEEDBACK_MS = 1100;
export const GAME_OVER_FEEDBACK_MS = 1400;

/** How many vehicle descriptions the generator can choose from (bordershift_vehicle_0 ... _5) */
export const VEHICLE_COUNT = 6;

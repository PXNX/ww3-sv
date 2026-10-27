/*
 * Red Square tuning. The parade is a timing game: every column has to cross the tribune while the
 * marker sits in the lit band. A miss costs the general's mood, not a life, so the first minute
 * stays playful. Later waves bring fewer interceptors and a shorter band.
 */

/** The general's mood: a missed slot costs one, and the parade ends when it runs out */
export const STARTING_MOOD = 3;

/** How long a column takes to cross the square in the first wave */
export const SLOT_BASE_MS = 2400;

/** Every wave is quicker, but never quicker than this */
export const SLOT_MIN_MS = 1100;
export const SLOT_STEP_MS = 150;

/** Share of the crossing that counts as the tribune, and how much it narrows per wave */
export const WINDOW_BASE = 0.34;
export const WINDOW_MIN = 0.14;
export const WINDOW_STEP = 0.035;

/** Where on the crossing the band sits (just past the middle, in front of the tribune) */
export const WINDOW_CENTRE = 0.6;

/** Hits needed to announce the next wave */
export const HITS_PER_WAVE = 4;

/** Scoring: a clean cue is worth the maximum, an edge-of-band cue the minimum */
export const POINTS_MAX = 100;
export const POINTS_MIN = 20;
export const POINTS_STEP = 5;

/** Every hit in a row adds a little; the bonus stops growing here */
export const STREAK_BONUS = 5;
export const STREAK_BONUS_MAX = 40;

/** How long the verdict stays on screen before the next column */
export const FEEDBACK_MS = 700;
export const GAME_OVER_FEEDBACK_MS = 1000;

/** Interceptors left in the sky, as announced by the radio */
export const INTERCEPTORS_BASE = 12;
export const INTERCEPTORS_STEP = 2;

/** How many columns the generator can choose from (redsquare_column_0 ... redsquare_column_7) */
export const COLUMN_COUNT = 8;

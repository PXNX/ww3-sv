/*
 * Gold & Cheese Vault tuning (roadmap 3.14). A memory game: pairs of treasures lie face down in a
 * vault grid, a stern banker watches every mismatch, and a ringing phone shuffles a few cards.
 */

export const STARTING_LIVES = 3;

/** Mismatches that make the banker lose his patience: the third one costs a heart */
export const EYEBROWS_PER_HEART = 3;
/** Matches in a row that make the banker lower one raised eyebrow again */
export const CALM_STREAK = 3;

/** How long a mismatched pair stays face up before it flips back, shortened on later levels */
export const REVEAL_MS = 900;
export const REVEAL_MIN_MS = 520;
export const REVEAL_STEP_MS = 40;

/** The phone rings this long before the cards are shuffled, so the player can brace for it */
export const RING_MS = 1300;
/** Milliseconds between two phone calls: a random delay from the range, shorter on later levels */
export const PHONE_DELAY_MS = { min: 9000, max: 14000 } as const;
export const PHONE_DELAY_STEP_MS = 700;
export const PHONE_DELAY_FLOOR_MS = 5000;
/** First call of a level never comes sooner than this */
export const PHONE_FIRST_MIN_MS = 6000;

/** Cards that swap places per phone call: grows slowly with the level */
export const SHUFFLE_MIN = 2;
export const SHUFFLE_MAX = 8;

/** Pause after the last pair of a level before the next vault opens */
export const LEVEL_CLEAR_MS = 1500;

/** Score */
export const POINTS_PAIR = 100;
export const POINTS_SPECIAL = 500;
export const POINTS_STREAK_STEP = 25;
export const POINTS_STREAK_MAX = 150;
export const POINTS_LEVEL = 250;
export const POINTS_FLAWLESS = 500;

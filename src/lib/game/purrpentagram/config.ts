/*
 * Purr Pentagram tuning. The field is a square of FIELD units; every position and speed in the
 * game is in those units (speeds in units per second), so the logic never depends on screen size.
 */
export const FIELD = 1000;
export const CAT_COUNT = 5;
/** Wrong strokes the cats put up with before they lose patience */
export const STARTING_LIVES = 3;

export const CENTER = { x: FIELD / 2, y: FIELD / 2 + 10 } as const;
/** Distance from the centre to each of the five pentagram points */
export const STAR_RADIUS = 335;
/** Radius of the circle around a cat: petting happens inside it, the star stroke leaves it */
export const CAT_RADIUS = 105;

// Petting: a slow stroke purrs, a scrubbing one annoys
/** Slower than this is not a stroke at all */
export const MIN_PET_SPEED = 30;
/** Up to this speed the stroke counts as gentle and keeps the purr at full strength */
export const GENTLE_MAX_SPEED = 420;
/** Faster than this is scrubbing: the cat flicks its tail or hisses */
export const SCRUB_SPEED = 820;
/** Gentle distance (units) after which the purr has reached about two thirds of its volume */
export const PURR_RAMP_DISTANCE = 900;
/** The speed estimate follows each new sample by this share, so one jittery event cannot spike it */
export const SPEED_SMOOTHING = 0.45;
/** Without a pointer sample for this long, the stroke has stopped */
export const PET_IDLE_MS = 160;
/** A scrub flicks the tail; a second one within this time makes the cat hiss */
export const SCRUB_HISS_WINDOW_MS = 2600;
/** Scrubs closer together than this count as one */
export const SCRUB_COOLDOWN_MS = 650;
export const SULK_MS = 1400;

// Mood and happiness (both 0 to 1)
export const PURR_RISE_PER_S = 1.3;
export const PURR_FALL_PER_S = 0.75;
export const HAPPINESS_PER_S = 0.085;
export const CALM_PER_S = 0.42;
export const MOOD_DRIFT_PER_S = 0.02;
/** Below this a cat is too upset to be picked for the star stroke until it has been petted */
export const UNSETTLED_MOOD = 0.35;
/** A hiding cat comes out again once its mood is back above this */
export const HIDE_RECOVER_MOOD = 0.5;
/** Happiness at which the cat shows its name tag */
export const NAME_HAPPINESS = 0.45;
/** Happiness at which the purr turns steady and the pitch gauge appears */
export const PITCH_HAPPINESS = 0.8;

// Room events
export const FIRST_EVENT_MS = 5500;
export const EVENT_GAP_MIN_MS = 6500;
export const EVENT_GAP_MAX_MS = 10500;

// Score
export const SCORE_BASE = 500;
export const SCORE_PER_HEART = 100;
export const SCORE_PER_MISTAKE = 120;
export const SCORE_TIME_MAX = 600;
export const SCORE_TIME_PER_S = 3;

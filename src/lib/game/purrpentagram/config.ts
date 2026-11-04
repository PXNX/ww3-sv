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

// Petting: keep a finger on the cat and it purrs, louder the longer you stay
/** Petting time after which the purr has reached about two thirds of its volume */
export const PURR_RAMP_MS = 1500;
/** The petting built up fades this many times faster than it grew once the finger lifts */
export const PET_FORGET_RATE = 1.5;
/** A keyboard pet counts as petting for this long, so holding the key keeps the purr going */
export const KEY_PET_MS = 160;

// Mood and happiness (both 0 to 1)
export const PURR_RISE_PER_S = 1.3;
export const PURR_FALL_PER_S = 0.75;
export const HAPPINESS_PER_S = 0.1;
export const CALM_PER_S = 0.42;
export const MOOD_DRIFT_PER_S = 0.02;
/** Below this a cat is too upset to be picked for the star stroke until it has been petted */
export const UNSETTLED_MOOD = 0.35;
/** A hiding cat comes out again once its mood is back above this */
export const HIDE_RECOVER_MOOD = 0.5;
/** Happiness at which the cat shows its name tag: its first heart */
export const NAME_HAPPINESS = 1 / 3;
/** Happiness at which the purr turns steady and the pitch gauge appears: its second heart */
export const PITCH_HAPPINESS = 2 / 3;

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

/** Set once the ritual has been completed, which unlocks the cat ears for the agent */
export const PURR_SOLVED_KEY = 'purrpentagram:solved';

// Candles: five of them burn around the rug. Light calms the cats, darkness unsettles them
export const CANDLE_COUNT = 5;
/** How fast a flame grows when it is lit and shrinks when it is put out (fraction per second) */
export const CANDLE_RISE_PER_S = 2.4;
export const CANDLE_FALL_PER_S = 3.4;
/** Wax burnt per second of burning; a candle burns for about 160 s and cannot be lit again after that */
export const CANDLE_FUEL_PER_S = 1 / 160;
/** Candle light (0 to 1) at which the room neither calms nor unsettles an idle cat */
export const LIGHT_NEUTRAL = 0.55;
/** Mood lost per second per unit of light below the neutral point, for a cat that is not being petted */
export const LIGHT_MOOD_PER_S = 0.09;
/** Distance from a candle within which a tap lights it */
export const CANDLE_TAP_RADIUS = 60;

// Omens: every room event announces itself shortly before it begins
export const OMEN_MS = 1500;
/** Every cat joined into the star makes the room this much more restless (shorter gaps, stronger fright) */
export const ESCALATION_PER_CAT = 0.1;

// Combo: correct strokes in quick succession are worth more
export const COMBO_WINDOW_MS = 14000;
export const COMBO_MAX = 5;

// Treats: an instant heart, at a price
export const TREAT_HAPPINESS = 1 / 3;
export const TREAT_MOOD = 0.25;
/** A fed cat is full and purrs up more slowly for this long */
export const SATED_MS = 9000;
export const SATED_PURR_FACTOR = 0.5;

// Score extras
export const SCORE_PER_CANDLE = 40;
export const SCORE_PER_COMBO = 30;
export const SCORE_PER_TREAT = 40;
/** Score needed for two and for three stars on the result screen */
export const STAR_TWO_SCORE = 1250;
export const STAR_THREE_SCORE = 1750;

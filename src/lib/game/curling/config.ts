/*
 * Constants for Iceberg Curling, all in world units (a 640 by 420 canvas, y grows downwards).
 * The sheet is a floating slab of Greenland ice: stones start at the hack at the bottom and slide
 * up towards the house with the realtor's "For Sale" sign. A stone whose centre leaves the slab
 * drops into the sea. Speeds are world units per second.
 */

export const WORLD_W = 640;
export const WORLD_H = 420;

export const SHEET_L = 150;
export const SHEET_R = 490;
export const SHEET_CX = 320;
/** A stone whose centre passes this line has gone off the back of the slab */
export const SHEET_BACK = 18;
export const SHEET_BOTTOM = 408;

export const HOUSE = { x: 320, y: 118 } as const;
/** Scoring rings from the inside out: a stone centre inside a ring earns its points */
export const RINGS = [
	{ r: 18, points: 10 },
	{ r: 44, points: 6 },
	{ r: 70, points: 3 },
	{ r: 96, points: 1 }
] as const;
export const HOUSE_RADIUS = RINGS[RINGS.length - 1].r;

export const HACK = { x: 320, y: 372 } as const;
export const HOG_Y = 300;

export const STONE_R = 11;
export const SEAL_R = 16;
export const PENGUIN_R = 12;

export const ENDS_TOTAL = 8;
export const STONES_PER_END = 2;
/** End points needed for one, two and three stars on an end */
export const STAR_THRESHOLDS = [5, 10, 16] as const;
export const MAX_STARS = ENDS_TOTAL * STAR_THRESHOLDS.length;

/** A stone thrown with the gamble on scores double inside the house and costs this outside it */
export const GAMBLE_MULTIPLIER = 2;
export const GAMBLE_PENALTY = 3;
export const PENGUIN_PENALTY = 3;

/** Score of a finished game: end points count ten each, then a bonus per star and for a clean ice */
export const POINT_VALUE = 10;
export const STAR_VALUE = 25;
export const CLEAN_ICE_BONUS = 100;
/** Stars needed for the game to count as won */
export const WIN_STARS = 12;

// Aiming
/** Largest throw angle away from straight up, in degrees */
export const MAX_ANGLE = 28;
export const MIN_POWER = 0.12;

// Stone physics
export const V_MIN = 40;
export const V_MAX = 175;
export const FRICTION = 26;
export const FRICTION_VISCOUS = 0.12;
export const REST_SPEED = 3;
export const CURL = 18;
/** Friction and curl while the sweepers scrub in front of the stone */
export const SWEEP_FRICTION = 0.55;
export const SWEEP_CURL = 0.35;
/** Sweep energy (0 to 1) spent per second of scrubbing */
export const SWEEP_DRAIN = 0.4;
export const STONE_RESTITUTION = 0.92;
export const SEAL_RESTITUTION = 0.6;
export const PENGUIN_RESTITUTION = 0.5;
/** Seconds after the last stone stops before the next one is offered */
export const SETTLE_DELAY = 0.5;
/** Seconds the seals take to slide onto the ice at the start of an end */
export const SEAL_ENTER_TIME = 1;

/** The drift lane: a stretch of moving ice that pushes stones sideways */
export const DRIFT_Y0 = 190;
export const DRIFT_Y1 = 252;

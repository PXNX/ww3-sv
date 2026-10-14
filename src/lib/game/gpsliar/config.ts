/*
 * GPS Liar constants. Every length is in sea units (the boat is under one unit long) and every time
 * in seconds, so the numbers read like a spec ("the boat does 3 units a second") and the renderer
 * only has to scale. The map is north-up: x grows to the east, y grows to the south.
 */

/** Sea units visible across and down the playfield, with the boat in the middle */
export const VIEW_W = 14;
export const VIEW_H = 10;

/** One fixed logic step (the loop runs at 60 steps per second) */
export const STEP = 1 / 60;

export const STARTING_HEARTS = 3;
/** Grace period after a hit, during which nothing can hurt the boat (the boat blinks) */
export const INVULNERABLE_S = 1.4;

/** Boat: a little cargo boat with momentum, so it does not turn on a coin */
export const BOAT_RADIUS = 0.34;
export const BOAT_MAX_SPEED = 3;
export const BOAT_ACCEL = 5.5;
/** Fraction of the speed lost per second with no steering (the boat glides to a stop) */
export const BOAT_DRAG = 1.6;
/** Shallows drag at the keel: the top speed is cut to this fraction */
export const SHALLOWS_SPEED_FACTOR = 0.45;
/** A rock or the tanker shoves the boat back at this speed (units per second) */
export const BUMP_SPEED = 2.6;

/** How close the boat has to get to a harbour to unload */
export const PORT_RADIUS = 0.95;

/** Lights shine through the fog, but only the blinking dot, not the lighthouse itself */
export const LIGHT_RANGE = 8;
/** Gulls drawn around the boat, all heading for land */
export const GULL_COUNT = 5;

/** Cross-check: the chart shows the true position for this long */
export const CROSS_CHECK_S = 3;

/** Flashes of a lighthouse pattern: the light is on this long, then dark, then a long pause */
export const FLASH_S = 0.28;
export const FLASH_GAP_S = 0.28;
export const PATTERN_PAUSE_S = 2.2;

/** Tanker (the shadow-fleet one that drags its anchor): hull radius, anchor radius and the chain length */
export const TANKER_RADIUS = 0.9;
export const ANCHOR_RADIUS = 0.35;
export const ANCHOR_CHAIN = 2.4;
export const TANKER_SPEED = 0.9;

/** Score: unloading, the time under par per second, the hearts left and a no-cross-check bonus */
export const POINTS_PER_STOP = 500;
export const POINTS_PER_SECOND_UNDER_PAR = 10;
export const POINTS_PER_HEART = 100;
export const POINTS_NO_CROSS_CHECK = 300;

/** Par time is a straight run through every stop at this fraction of the top speed, plus a cushion */
export const PAR_SPEED_FRACTION = 0.55;
export const PAR_CUSHION_S = 10;

/** Depth of the land strip along the coast, which the boat cannot enter */
export const COAST_DEPTH = 1.2;

/** The seagull flock: gulls cross the view toward land at this speed, over a stretch this long */
export const GULL_SPEED = 2.2;
export const GULL_SPAN = 16;

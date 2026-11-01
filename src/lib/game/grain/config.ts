/*
 * Grain Corridor tuning. World units are pixels on the 640 x 420 playfield, speeds are world
 * units per second and times are milliseconds. The simulation, the renderer and the tests all
 * read the same numbers from here.
 */

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 420;

/** Hearts at the start of a run */
export const STARTING_LIVES = 3;

/** The ship holds this line near the bottom; the sea scrolls towards it */
export const SHIP_Y = 352;
export const SHIP_RADIUS = 17;

/** The channel walls start this far in from the screen edges */
export const CORRIDOR_MARGIN = 54;
/** How far each wall moves in over a run, and how quickly */
export const CORRIDOR_SQUEEZE = 46;
export const CORRIDOR_SQUEEZE_PER_M = 0.012;

/** Collision radii */
export const MINE_RADIUS = 13;
export const DRONE_RADIUS = 16;
export const CRATE_RADIUS = 13;
export const BUOY_RADIUS = 15;

/** How close a hazard has to pass to count as a near miss */
export const NEAR_MISS = 46;

/** Milliseconds of invulnerability after a hit */
export const INVULN_MS = 1300;
/** A cargo chain breaks when no crate is collected for this long */
export const CHAIN_MS = 4200;
/** Crates per multiplier step and the cap */
export const CHAIN_STEP = 4;
export const MAX_MULTIPLIER = 5;

export const POINTS_CRATE = 25;
export const POINTS_NEAR = 5;
export const POINTS_BUOY = 50;
export const POINTS_MILESTONE = 150;

/** Metres between ports */
export const MILESTONE_M = 1000;

/** Scroll speed in metres per second, and where it stops growing */
export const START_SPEED = 95;
export const MAX_SPEED = 250;
export const SPEED_PER_M = 0.055;

/** Milliseconds between spawns, from relaxed to hectic */
export const SPAWN_START_MS = 1050;
export const SPAWN_MIN_MS = 360;
export const SPAWN_PER_M = 0.16;

/** Keyboard steering step in world units */
export const NUDGE_STEP = 46;

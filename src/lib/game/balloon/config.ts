/*
 * Wandering Balloon constants. The world is a landscape strip in unit-free world units that the
 * renderer scales to the screen. The balloon stays at a fixed screen column; the land scrolls past
 * as the wind carries it along the track from the west coast to the east coast. Altitude is the
 * screen row: the sky is cut into stacked wind layers, layer 0 at the top.
 */

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 400;
/** Top of the ground strip; everything above it is sky */
export const GROUND_Y = 352;

export const LAYER_COUNT = 5;
export const LAYER_HEIGHT = GROUND_Y / LAYER_COUNT;

/** Screen column of the balloon, and the radius of its envelope (the hit circle) */
export const BALLOON_X = 150;
export const BALLOON_RADIUS = 20;
export const CEILING_Y = 30;
export const FLOOR_Y = GROUND_Y - 34;

export const STARTING_LIVES = 3;
/** Grace period after a hit, during which nothing can hurt the balloon (the balloon blinks) */
export const INVULNERABLE_MS = 1600;

/** Length of the whole run: the missile waits at the end of the track */
export const TRACK_LENGTH = 5600;
/** The wind pattern reshuffles every chunk of track */
export const CHUNK_LENGTH = 1100;

/** One wind speed per layer in every chunk, shuffled: a fast ride, a slow one, and a headwind (track units per second) */
export const WIND_SPEEDS = [-45, 15, 55, 95, 135] as const;

/** Burner: hold to rise, release to sink. Accelerations in world units per second squared */
export const RISE_ACCEL = 260;
export const SINK_ACCEL = 120;
export const MAX_RISE = 95;
export const MAX_SINK = 70;
/** Full tank is 1; the burner drains this much per second while it burns */
export const FUEL_BURN_PER_SECOND = 0.28;
/** A hot-air puff refills this much of the tank */
export const PUFF_REFILL = 0.35;
export const PUFF_RADIUS = 16;
/** Track distance between hot-air puffs, give or take */
export const PUFF_GAP = 450;

/** Hazards are generated along the track; the gap between them shrinks so the run ramps up */
export const HAZARD_FIRST_X = 420;
export const HAZARD_GAP_START = 360;
export const HAZARD_GAP_END = 190;
/** A hazard wakes up when it is this far ahead of the balloon (just off the right edge of the screen) */
export const ACTIVATE_DISTANCE = WORLD_WIDTH - BALLOON_X + 40;

export const CROW_RADIUS = 12;
export const CROW_SPEED = 80;
export const CROW_BOB = 16;
export const CLOUD_RADIUS = 30;
export const KITE_RADIUS = 14;
export const KITE_SWAY = 10;

/** Patrol jets cross one layer: a warning arrow first, then a fast pass from right to left */
export const JET_FIRST_MS = 12000;
export const JET_GAP_START_MS = 9000;
export const JET_GAP_END_MS = 6000;
export const JET_WARN_MS = 1600;
export const JET_SPEED = 560;
export const JET_HALF_HEIGHT = 12;
export const JET_HALF_LENGTH = 34;

/** Points of interest on the ground: hover within the range for the dwell time to snap a photo */
export const POI_FIRST_X = 500;
export const POI_GAP = 650;
export const POI_END_MARGIN = 400;
export const PHOTO_RANGE = 45;
export const PHOTO_DWELL_MS = 900;
export const POI_KINDS = ['farm', 'silo', 'lake', 'stadium'] as const;

/** The missile at the east coast: how long it takes to arrive and pop the balloon */
export const FINALE_MS = 2400;

/** Score: one point per this many track units, a bonus per photo, and a bonus per heart at the coast */
export const DISTANCE_PER_POINT = 20;
export const PHOTO_POINTS = 50;
export const HEART_BONUS = 150;

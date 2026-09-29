/*
 * Convoy Runner tuning (requirements Section 4). World units: one unit is one lane width, and
 * distance along the strait is measured in the same units.
 */

export type Lane = 0 | 1 | 2 | 3 | 4;
export const LANES: readonly Lane[] = [0, 1, 2, 3, 4];
export const LANE_COUNT = LANES.length;

/** Things that float in the strait; the first four are obstacles, the last two collectibles */
export type ItemKind = 'mine' | 'gunboat' | 'drone' | 'slick' | 'barrel' | 'escort';

/** Hazards cost a hull point on contact */
export function isHazard(kind: ItemKind): boolean {
	return kind === 'mine' || kind === 'gunboat' || kind === 'drone';
}

/** Anything a fair pattern must leave a way around (oil slicks push the tanker sideways) */
export function isObstacle(kind: ItemKind): boolean {
	return isHazard(kind) || kind === 'slick';
}

/** Collision half-sizes in world units */
export const ITEM_SIZE: Record<ItemKind, { halfLength: number; halfWidth: number }> = {
	mine: { halfLength: 0.3, halfWidth: 0.3 },
	gunboat: { halfLength: 0.45, halfWidth: 0.24 },
	drone: { halfLength: 0.3, halfWidth: 0.3 },
	slick: { halfLength: 0.42, halfWidth: 0.34 },
	barrel: { halfLength: 0.24, halfWidth: 0.24 },
	escort: { halfLength: 0.32, halfWidth: 0.32 }
};

export const TANKER_HALF_LENGTH = 0.6;
export const TANKER_HALF_WIDTH = 0.27;

// Visible field: three lanes plus a sandy bank on each side, portrait shaped
export const SIDE_MARGIN = 0.25;
export const FIELD_WIDTH = LANE_COUNT + 2 * SIDE_MARGIN;
export const FIELD_HEIGHT = 6;
/** Distance of the tanker's center above the bottom edge of the field */
export const TANKER_OFFSET = 1.3;
/** How far ahead of the tanker the player can see */
export const VIEW_AHEAD = FIELD_HEIGHT - TANKER_OFFSET;

// Movement
export const LANE_CHANGE_MS = 170;
export const SLICK_SLIDE_MS = 360;
/** Overshoot of the springy lane slide (0 would be a plain ease-out) */
export const SLIDE_OVERSHOOT = 1.2;

// Speed in world units per second, ramping with distance up to a cap
export const START_SPEED = 2.4;
export const MAX_SPEED = 4.6;
export const SPEED_RAMP = 0.004;
/** Reduced motion slows the ramp down */
export const REDUCED_MOTION_RAMP_FACTOR = 0.5;

// Hull and power-ups
export const MAX_HULL = 3;
export const INVULNERABLE_MS = 1400;
export const ESCORT_INVULNERABLE_MS = 600;

// Scoring
export const POINTS_PER_UNIT = 10;
export const BARREL_POINTS = 50;
/** Picking up an escort while already escorted gives points instead */
export const ESCORT_BONUS_POINTS = 100;
export const NAUTICAL_MILES_PER_UNIT = 0.01;
/** A hazard passing within this sideways distance (in lanes) without a hit is a near miss */
export const NEAR_MISS_DISTANCE = 1.25;
export const MULTIPLIER_STEP = 0.1;
export const MAX_NEAR_MISS_STREAK = 10;

// Spawning
/** Gap between the last row of one pattern and the first row of the next */
export const PATTERN_GAP = 4.5;
/** Patterns are placed this far ahead of the tanker, before they scroll into view */
export const SPAWN_AHEAD = VIEW_AHEAD + 3;
/** Where the first pattern of a run starts, so the opening second is calm */
export const FIRST_PATTERN_AT = VIEW_AHEAD + 1.5;
/** Time a player needs to notice something new at the top of the field */
export const REACTION_MS = 400;

// Hazard behavior, as distances ahead of the tanker
export const GUNBOAT_DRIFT_START = 4.2;
export const GUNBOAT_DRIFT_END = 2.6;
/** Drones show a warning marker from this far beyond the top edge */
export const DRONE_WARNING_AHEAD = 1.5;
export const DRONE_ARRIVE_START = 3.2;
export const DRONE_ARRIVE_END = 2.4;

// Shore narrowing: every so often the banks close in for a while, then open back up. Much
// slower-paced than obstacles and lane changes, so it reads as a tide rather than a reflex test.
export const SHORE_OPEN_MIN_MS = 15000;
export const SHORE_OPEN_MAX_MS = 25000;
export const SHORE_NARROW_MIN_MS = 5000;
export const SHORE_NARROW_MAX_MS = 8000;
/** How long the banks take to slide in or out, much gentler than a lane change */
export const SHORE_TRANSITION_MS = 2200;
/** How many lanes the banks swallow during a squeeze, chosen at random each time */
export const SHORE_MIN_LANES_BLOCKED = 1;
export const SHORE_MAX_LANES_BLOCKED = 3;

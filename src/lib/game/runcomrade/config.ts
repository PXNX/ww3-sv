/*
 * Run Comrade constants. Two coordinate systems:
 *  - the course: distance runs forward in "units" (one unit is one lane width) and lanes are 0, 1, 2;
 *  - the screen: a portrait 360 x 560 box the canvas scales to fit, y grows downwards. The course
 *    is drawn in perspective behind the runner (see render.ts).
 * Times are in milliseconds, speeds in units per second.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 560;

export const STARTING_LIVES = 3;

export type Lane = 0 | 1 | 2;
export const LANES: readonly Lane[] = [0, 1, 2];
export const LANE_COUNT = LANES.length;
export const MIDDLE_LANE: Lane = 1;

/** What a lane needs from the player when an obstacle comes: jump over it, duck under it or step aside */
export type Action = 'jump' | 'duck' | 'dodge';

export type ObstacleKind = 'ditch' | 'arm' | 'mine';
export const OBSTACLE_KINDS: readonly ObstacleKind[] = ['ditch', 'arm', 'mine'];

/** Ditches are jumped, tractor arms are ducked under, mines can only be sidestepped */
export const REQUIRED_ACTION: Record<ObstacleKind, Action> = {
	ditch: 'jump',
	arm: 'duck',
	mine: 'dodge'
};

/** Half the depth of an obstacle along the course: the runner is on it within this distance */
export const OBSTACLE_HALF_DEPTH: Record<ObstacleKind, number> = {
	ditch: 0.9,
	arm: 0.6,
	mine: 0.5
};

/** A runner and an obstacle share a lane while their lane positions are closer than this */
export const LANE_OVERLAP = 0.55;

export type PickupKind = 'helmet' | 'rice';
export const PICKUP_HALF_DEPTH = 0.8;

// Runner moves
export const JUMP_MS = 620;
export const DUCK_MS = 520;
/** Time the lane position takes to slide across one lane */
export const LANE_CHANGE_MS = 130;

// Speed (units per second): starts gentle, climbs with distance, then levels off
export const BASE_SPEED = 7;
export const MAX_SPEED = 15;
export const SPEED_RAMP = 0.012;
/** After a stumble the runner is slowed to this share of its speed and recovers over SLOW_MS */
export const STUMBLE_SPEED = 0.6;
export const SLOW_MS = 1300;
/** Brief protection after a stumble so one obstacle cannot count twice */
export const STUMBLE_GRACE_MS = 700;
export const STUMBLE_ANIM_MS = 650;

// Pickups
export const BOOST_MS = 4500;
export const BOOST_SPEED = 1.45;
/** How fast the drone falls behind (units per second) while the helmet boost lasts */
export const BOOST_DRONE_PULL = 2.4;
export const PICKUP_SCORE = 25;

// Drone chase (see drone.ts)
export const DRONE_START_GAP = 9;
export const DRONE_MAX_GAP = 12;
/** Gap after the drone has been shaken off by a hit, so the runner gets a breather */
export const DRONE_RESET_GAP = 8;
export const DRONE_RECOVER_RATE = 0.55;
/** At or below this the drone has caught the runner */
export const DRONE_CONTACT_GAP = 0.6;
/** How much closer each kind of stumble lets the drone get */
export const STUMBLE_CLOSE: Record<ObstacleKind, number> = {
	ditch: 3.2,
	arm: 3.0,
	mine: 3.8
};
/** After a contact the drone cannot touch the runner again for this long */
export const CONTACT_GRACE_MS = 1400;
/** The drone stays hidden for this long after the runner leaves a tall sunflower patch */
export const HIDE_TAIL = 2;

// Course generation (see patterns.ts)
export const FIRST_ROW_Z = 30;
/** How far ahead of the runner the course is generated (at least what the screen shows) */
export const GENERATE_AHEAD = 60;
/** How far ahead of the runner the screen shows the course */
export const VIEW_AHEAD = 40;
/** Distance at which the field reaches its full density */
export const FULL_DENSITY_DISTANCE = 600;
/** Kinds appear one by one so the first stretch is easy to learn */
export const KIND_UNLOCK: Record<ObstacleKind, number> = { ditch: 0, arm: 35, mine: 70 };

// Fairness model: time the player needs between two obstacle rows
/** Time to see the next row and decide */
export const REACTION_MS = 250;
/** Time one lane change takes in the worst case */
export const LANE_COST_MS = 140;
/** A jump or duck leaves the runner unable to act again for about this long */
export const ACTION_COST_MS = Math.max(JUMP_MS, DUCK_MS);
/** The tightest gap between two obstacle rows, in time at the speed of the second row */
export const MIN_GAP_MS = 1350;
export const START_GAP_MS = 2300;

// Scoring
/** One point per unit run, counted in steps of this many */
export const SCORE_STEP = 5;

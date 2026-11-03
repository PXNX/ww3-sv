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

/** Metres between ports: one leg, one wave */
export const MILESTONE_M = 2000;

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

/** The ships a captain can take out, from nimble to heavy */
export type ShipId = 'coaster' | 'freighter' | 'bulker';

export interface ShipSpec {
	id: ShipId;
	/** Scales the scroll speed: a quick ship covers the sea (and scores) faster, with less time to react */
	speedMul: number;
	/** Hull radius for collisions */
	radius: number;
	/** Hearts at the start, and the most a repair buoy can restore */
	lives: number;
	/** Crates the hold takes before it is full */
	hold: number;
	/** How briskly the hull answers the helm (higher turns faster) */
	steer: number;
	/** Multiplier on the grain paid out at a port */
	cargoMul: number;
	/** Minesweeper charges at the start of a run */
	sweepers: number;
}

export const SHIPS: Record<ShipId, ShipSpec> = {
	coaster: {
		id: 'coaster',
		speedMul: 1.18,
		radius: 14,
		lives: 2,
		hold: 6,
		steer: 18,
		cargoMul: 1,
		sweepers: 1
	},
	freighter: {
		id: 'freighter',
		speedMul: 1,
		radius: SHIP_RADIUS,
		lives: STARTING_LIVES,
		hold: 10,
		steer: 14,
		cargoMul: 1.25,
		sweepers: 1
	},
	bulker: {
		id: 'bulker',
		speedMul: 0.86,
		radius: 21,
		lives: 4,
		hold: 16,
		steer: 9,
		cargoMul: 1.6,
		sweepers: 0
	}
};

export const SHIP_IDS: readonly ShipId[] = ['coaster', 'freighter', 'bulker'];
export const DEFAULT_SHIP: ShipId = 'freighter';

/** Points per crate in the hold when a port takes the cargo (times the ship's cargo multiplier) */
export const POINTS_DELIVERY = 18;
/** Points per mine a minesweeper clears */
export const POINTS_SWEEP = 20;

/** The most minesweeper charges a ship can carry */
export const MAX_SWEEPERS = 3;
/** A sweep clears mines this far ahead of the hull and this far to either side */
export const SWEEP_RANGE = 250;
export const SWEEP_HALF_WIDTH = 150;

export const PATROL_RADIUS = 18;
export const SWEEPER_RADIUS = 15;
/** The patrol boat is harmless and shows an arrow at the bank for this long before it sweeps across */
export const PATROL_WARN_MS = 1200;
export const PATROL_SPEED = 120;

/** Ports needed for one, two and three stars */
export const STAR_PORTS: readonly [number, number, number] = [2, 5, 9];

/** Waves from which each threat joins the sea (a wave is the leg to the next port) */
export const DRIFT_FROM_WAVE = 2;
export const CACHE_FROM_WAVE = 2;
export const PATROL_FROM_WAVE = 3;
export const FIELD_FROM_WAVE = 4;

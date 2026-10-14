/*
 * Suez Stuck constants. The world is a portrait strip of canal in world units: the canal runs
 * north to south, banks are a grid of 20-unit tiles on both sides, and a giant ship lies wedged
 * across it. The renderer scales the world to the screen, so all numbers here are unit-free.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 560;
export const TILE = 20;
export const COLS = WORLD_WIDTH / TILE;
export const ROWS = WORLD_HEIGHT / TILE;

/** The invented ship: long, narrow, green-hulled */
export const SHIP_NAME = 'EVER STUCK';
export const SHIP_LENGTH = 190;
export const SHIP_BEAM = 36;
/** Length of the pointed bow, where the hull narrows to a tip */
export const NOSE_LENGTH = 34;

export const STARTING_LIVES = 3;
/** Ships that can wait behind you before the line gives up and one captain takes the long way round */
export const QUEUE_CAPACITY = 6;

/** The physics step is split into this many substeps so nothing tunnels through a bank */
export const SUBSTEPS = 4;
/** Furthest a held end may travel in one substep (world units) */
export const MAX_MOVE_PER_SUBSTEP = 2.5;
/** Share of that speed a ship keeps while the mud holds it as tight as at the start */
export const MUD_FLOOR = 0.015;
/** A held end never lags further than this behind the finger: the grab offset is re-measured beyond it */
export const TETHER = 56;

/** A press this close to the hull (beyond its half beam) grabs the nearest free end */
export const GRAB_MARGIN = 16;
/** Touch presses in open water grab the nearest end only within this distance; a mouse always does */
export const GRAB_RADIUS = 90;

/** Penetration below this counts as touching, not stuck (world units) */
export const TOUCH_EPSILON = 0.5;
/** The ship counts as free when it could also slide this far north and south along the canal */
export const FREE_PROBE = TILE;
/** Widest angle between the ship and the canal axis that still counts as free (radians) */
export const MAX_FREE_TILT = 0.7;

/** How much bank embedding one world unit of real movement wears away */
export const LOOSEN_PER_UNIT = 0.03;
/** A pull this far ahead of the end counts as full effort */
export const EFFORT_CAP = 30;
/** Embedding worn away per second by one end pulled with full effort */
export const EFFORT_UNITS_PER_SECOND = 3;
/** Embedding worn away every time a pull swings back the other way (a wiggle) */
export const WIGGLE_UNITS = 2.5;
/** Shortest time between two counted wiggles of one end */
export const WIGGLE_MIN_GAP_MS = 120;

export const DIG_ANIMATION_MS = 700;
/** Share of the starting embedding one scoop of the excavator takes away */
export const DIG_LOOSEN = 0.18;
export const SAIL_DONE_MS = 3200;

/** Where the ship starts in every canal */
export const WEDGE_Y = 230;

export interface LevelParams {
	/** Open tiles across the canal: ever narrower, to a minimum of three */
	widthTiles: number;
	/** Most tiles a bank may creep into the channel: smooth canals first, rougher ones later */
	bankBump: number;
	/** Gap between two ships joining the queue */
	queueIntervalMs: number;
	excavatorCooldownMs: number;
}

export function levelParams(level: number): LevelParams {
	const n = Math.max(1, Math.floor(level));
	const widthTiles = Math.max(3, 8 - Math.floor(n / 2));
	return {
		widthTiles,
		// A straight ship always still fits: three open tiles remain at the narrowest
		bankBump: Math.min(Math.floor((n - 1) / 3), Math.floor((widthTiles - 3) / 2)),
		queueIntervalMs: Math.max(1500, 4200 - 280 * (n - 1)),
		excavatorCooldownMs: Math.max(4500, 8000 - 250 * (n - 1))
	};
}

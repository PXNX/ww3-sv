/*
 * Iron Dome Juggler constants. The world is a landscape strip in unit-free world units that the
 * renderer scales to the screen. Sea on the left, a small cartoon city in the middle with a
 * battery between the buildings, empty fields on the right. Rockets arc in from the sky and land
 * wherever their path ends: on a building (costs hearts), or in the sea or a field (harmless).
 */

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 400;
/** The ground line: a rocket that reaches this height has landed */
export const GROUND_Y = 336;

export const STARTING_LIVES = 5;

/** Sea covers the ground from the left edge to here; the field starts at FIELD_START */
export const SEA_END = 118;
export const FIELD_START = 478;

/** The battery: interceptors leave from this point */
export const BATTERY_X = 326;
export const BATTERY_Y = GROUND_Y - 22;

export type TargetKind = 'house' | 'hospital' | 'plant';

export interface TargetSpec {
	kind: TargetKind;
	/** Centre column of the building */
	x: number;
	/** Half the width the building covers: an impact within this distance of x hits it */
	halfWidth: number;
	/** Points shown on the building, and what an intercept of a rocket bound for it pays */
	value: number;
	/** Hearts lost when a rocket lands on it while it is standing */
	cost: number;
	/** How often a rocket is aimed at it, relative to the other buildings */
	weight: number;
}

/** The city, west to east. Values and costs rise together: the hospital matters most. */
export const TARGETS: readonly TargetSpec[] = [
	{ kind: 'house', x: 158, halfWidth: 22, value: 10, cost: 1, weight: 3 },
	{ kind: 'house', x: 208, halfWidth: 22, value: 10, cost: 1, weight: 3 },
	{ kind: 'hospital', x: 272, halfWidth: 32, value: 50, cost: 3, weight: 2 },
	{ kind: 'plant', x: 392, halfWidth: 34, value: 30, cost: 2, weight: 2 },
	{ kind: 'house', x: 448, halfWidth: 20, value: 10, cost: 1, weight: 3 }
];

/** Interceptor magazine: how many are loaded, how long one takes to reload, and the pause between shots */
export const MAX_AMMO = 4;
export const RELOAD_MS = 1900;
export const SHOT_COOLDOWN_MS = 220;
/** A hit on the power plant knocks the reloader out: reloading is this many times slower for a while */
export const BLACKOUT_MS = 6000;
export const BLACKOUT_RELOAD_FACTOR = 2;

/** Interceptor flight (world units per second, radians per second) */
export const INTERCEPTOR_SPEED = 400;
export const INTERCEPTOR_TURN_RATE = 6;
export const INTERCEPTOR_LIFETIME_MS = 4200;
export const INTERCEPT_RADIUS = 16;

/** A tap counts as aiming at a rocket when it lands within this distance of it */
export const TAP_RADIUS = 38;
/** Two rockets this close to a tap count as equally near, so the more valuable one wins */
export const TAP_TIE = 7;

/** Scoring */
export const WASTE_PENALTY = 20;
export const WAVE_BONUS = 10;
export const COMBO_STEP = 2;
export const COMBO_STEP_BONUS = 0.5;
export const MAX_MULTIPLIER = 4;

/** Waves */
export const WAVE_PAUSE_MS = 2200;
export const FIRST_SPAWN_MS = 700;
/** Share of rockets aimed at nothing valuable (sea and field) */
export const HARMLESS_SHARE_START = 0.3;
export const HARMLESS_SHARE_END = 0.5;
export const FAST_SHARE_START = 0;
export const FAST_SHARE_END = 0.3;
export const FAST_FACTOR = 0.62;

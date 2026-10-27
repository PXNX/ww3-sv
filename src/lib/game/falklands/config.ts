/*
 * Falklands tuning (improvements 5.1). A turn-based race across the South Atlantic: each day the
 * task force picks a speed, the weather decides whether sprinting is allowed and what the fuel
 * costs, and the other fleet keeps coming. Diplomacy takes seven days of talks and scores lower,
 * which is the joke: the war is the fast path.
 */

/** Sea zones between the task force and the islands */
export const DISTANCE = 12;

/** Fuel at the start of the run, in percent */
export const START_FUEL = 70;

export const SLOW_ZONES = 1;
export const CRUISE_ZONES = 2;
export const FLANK_ZONES = 3;

export const FUEL_SLOW = 5;
export const FUEL_CRUISE = 9;
export const FUEL_FLANK = 15;

/** A storm makes every move cost this much extra fuel */
export const STORM_EXTRA_FUEL = 4;

/** The other fleet starts this many zones out and takes one zone per day */
export const ENEMY_START = 3;
export const ENEMY_STEP = 1;

/** Days of talks needed before the deal can be signed */
export const DIPLOMACY_TARGET = 7;

/** How many days of weather are generated; later days wrap around */
export const WEATHER_DAYS = 12;

/** Scoring: arriving first pays much more than signing the deal */
export const MILITARY_BASE = 400;
export const PEACE_BASE = 150;
export const MILITARY_FUEL_POINTS = 3;
export const PEACE_FUEL_POINTS = 2;
export const PEACE_TALK_POINTS = 10;
export const GAP_POINTS = 20;
export const PROGRESS_POINTS = 10;
export const PROGRESS_TALK_POINTS = 5;

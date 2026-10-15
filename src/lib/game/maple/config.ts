/*
 * All tuning numbers of Maple Reserve Heist in one place. The game is turn based: every step of
 * the cart is one tick, and the moose guards take one step per tick.
 */

/** Hearts per level: a moose that spots the cart costs one and sends the cart back to the start */
export const STARTING_HEARTS = 3;

/** How many aisle cells a moose sees straight ahead (the cone is one cell wide, then three) */
export const GUARD_RANGE = 3;

/** The boss moose with the tiny tariff hat looks a cell further */
export const BOSS_RANGE = 4;

/** From this many barrels in tow the cart is heavy and slows the player down */
export const HEAVY_AT = 3;

/** A heavy cart creaks on every Nth step: the guards then take one extra step */
export const HEAVY_EVERY = 2;

/** Score: every delivered barrel, every move under par, and the price of every spotting */
export const BARREL_POINTS = 100;
export const PAR_MOVE_POINTS = 5;
export const SPOTTED_PENALTY = 50;

/** Pancakes in the ending stack never grow taller than this, however many barrels got home */
export const MAX_PANCAKES = 12;

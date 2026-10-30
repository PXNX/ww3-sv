/*
 * Gig Saboteur tuning. Distances are in tiles, speeds in tiles per second, times in seconds, angles in
 * radians. Gameplay numbers live here so the simulation, the level checks and the tests agree.
 */

/** One fixed simulation step */
export const STEP = 1 / 60;

/** Strikes in a run: every bust costs one */
export const STRIKES = 3;

export const PLAYER_RADIUS = 0.3;
export const SPEED = { sneak: 1.4, walk: 2.6, sprint: 4.4 } as const;
/** Pushing the stick less than this far sneaks instead of walking */
export const SNEAK_STICK = 0.5;

/** How close to a target's centre the player has to stand to work on it */
export const REACH = 1.35;
export const SABOTAGE_SECONDS = 1.5;

/** A guard this close (or closer) still sees someone hiding in a bush */
export const BUSH_REVEAL = 1.1;

/** Suspicion fills by BASE_RATE + CLOSE_RATE * (1 - distance / range) per second, scaled below */
export const BASE_RATE = 0.4;
export const CLOSE_RATE = 1.1;
export const STANCE_VISIBILITY = { idle: 0.6, sneak: 0.5, walk: 1, sprint: 1.35 } as const;
export const SHADOW_VISIBILITY = 0.5;
export const SUSPICION_DECAY = 0.3;
export const SUSPICION_DECAY_DELAY = 0.6;
/** The "unseen" star is lost when the meter ever passes this */
export const GHOST_LIMIT = 0.5;
/** Past this a guard that sees the player walks toward them */
export const CLOSE_IN = 0.45;

/** Sprinting makes noise this often, and guards or dogs within the radius come to look */
export const NOISE_INTERVAL = 0.45;
export const NOISE_RADIUS = { guard: 3.6, dog: 6 } as const;

export const GUARD = { speed: 1.5, chase: 2.2, range: 4.2, halfFov: (32 * Math.PI) / 180 } as const;
export const DOG = { speed: 1.9, chase: 3.4, range: 3.2, halfFov: (50 * Math.PI) / 180 } as const;
/** How long an investigating guard looks around once it got there */
export const SEARCH_SECONDS = 2.6;
export const TURN_RATE = 5;

export const PHONE = { range: 6, ringSeconds: 4.5, hearing: 8 } as const;

export const PAYOUT = { base: 50, perStar: 20 } as const;

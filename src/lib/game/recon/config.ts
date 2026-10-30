/*
 * Recon constants: the size of the map and of the scope you look through, the pacing of a
 * sortie, and the numbers behind scoring, air defence damage and the escalation meter.
 */

/** The whole theatre in world units; the scope only ever shows part of it */
export const MAP_W = 720;
export const MAP_H = 960;

/** What the scope shows, in world units */
export const VIEW_W = 360;
export const VIEW_H = 420;

/** Seconds a sensor needs to lock onto a contact and log its reading */
export const LOCK_S = 0.7;
/** How close a tap has to land to a contact, in world units (about 56 px on a phone) */
export const HIT_RADIUS = 30;

export const MAX_SORTIES = 8;
export const MAX_INTEGRITY = 100;
export const REPAIR_BETWEEN_SORTIES = 25;
export const ESCALATION_LIMIT = 100;
export const ESCALATION_DECAY_CLEAN = 20;

/** An air defence site hurts the drone while the scope centre is inside this radius */
export const AA_RADIUS = 120;
/** Integrity points lost per second inside that radius */
export const AA_DPS = 9;

/** Seconds a missile needs from launch to impact; the target is gone when it lands */
export const MISSILE_FLIGHT_S = 0.45;

export const POINTS = {
	hostileStruck: 100,
	aaStruck: 150,
	harmlessCleared: 30,
	civilianStruck: -150,
	decoyStruck: -60,
	hostileEscaped: -80,
	timeBonusPerSecond: 4,
	cleanBonusPerSortie: 50,
	campaignWon: 500
} as const;

export const ESCALATION = {
	civilianStruck: 34,
	decoyStruck: 10
} as const;

/** The start of every sortie: the drone arrives from the south edge */
export const START = { x: MAP_W / 2, y: MAP_H - VIEW_H / 2 - 10 } as const;

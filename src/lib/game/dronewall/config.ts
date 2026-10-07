/*
 * Drone Wall: fixed numbers and tables. The field is a portrait world of WORLD_WIDTH by
 * WORLD_HEIGHT units. Soldiers enter at the top, follow one winding road and lose the player a
 * heart when they reach the end of it (the Ukrainian line at the bottom).
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 560;

export interface Point {
	x: number;
	y: number;
}

/** The road, as a polyline. It starts above the field and ends on the line. */
export const PATH_POINTS: readonly Point[] = [
	{ x: 50, y: -20 },
	{ x: 50, y: 100 },
	{ x: 310, y: 100 },
	{ x: 310, y: 230 },
	{ x: 50, y: 230 },
	{ x: 50, y: 370 },
	{ x: 310, y: 370 },
	{ x: 310, y: 520 }
];

/** The Ukrainian line: soldiers that reach this height (the end of the road) breach it */
export const LINE_Y = 520;

/** Fixed defense positions, all within reach of the road */
export const SLOTS: readonly Point[] = [
	{ x: 130, y: 40 },
	{ x: 240, y: 40 },
	{ x: 100, y: 165 },
	{ x: 205, y: 165 },
	{ x: 150, y: 300 },
	{ x: 255, y: 300 },
	{ x: 110, y: 440 },
	{ x: 215, y: 440 }
];

export const STARTING_LIVES = 7;
export const STARTING_HELMETS = 22;

/** Time before the first wave and between waves, in which the player builds */
export const FIRST_PREP_MS = 9000;
export const PREP_MS = 6500;

/**
 * A dropped helmet collects itself: it pops up where the enemy fell, then flies to the helmet
 * counter and is added to the pocket when it lands.
 */
export const HELMET_POP_MS = 260;
export const HELMET_FLY_MS = 640;
/** Where the helmet counter sits on the field, until the page measures the real spot */
export const HELMET_TARGET: Point = { x: WORLD_WIDTH - 42, y: 22 };

export type DefenseKind = 'squad' | 'mortar' | 'nest' | 'patriot' | 'trench';
export const DEFENSE_KINDS: readonly DefenseKind[] = [
	'squad',
	'mortar',
	'nest',
	'patriot',
	'trench'
];
export const MAX_LEVEL = 3;

export type SoldierKind = 'scout' | 'grunt' | 'brute';

export interface SoldierStats {
	hp: number;
	/** World units per second along the road */
	speed: number;
	/** Helmet value dropped when the soldier falls */
	value: number;
	/** Body radius, for drawing and for clump counting */
	radius: number;
	/** Score for stopping this soldier */
	points: number;
}

export const SOLDIERS: Record<SoldierKind, SoldierStats> = {
	scout: { hp: 16, speed: 68, value: 1, radius: 8, points: 10 },
	grunt: { hp: 34, speed: 40, value: 1, radius: 10, points: 10 },
	brute: { hp: 150, speed: 25, value: 3, radius: 15, points: 40 }
};

/** Aerial enemies ignore the road and fly straight from the top edge at the line */
export type FlyerKind = 'shahed' | 'heli';
export type EnemyKind = SoldierKind | FlyerKind;

export interface FlyerStats {
	hp: number;
	/** World units per second along the straight flight */
	speed: number;
	value: number;
	radius: number;
	points: number;
}

export const FLYERS: Record<FlyerKind, FlyerStats> = {
	// A fast kamikaze drone
	shahed: { hp: 30, speed: 62, value: 1, radius: 9, points: 15 },
	// A slow, tough helicopter
	heli: { hp: 150, speed: 36, value: 3, radius: 15, points: 50 }
};

export function isFlyerKind(kind: EnemyKind): kind is FlyerKind {
	return kind in FLYERS;
}

/** Share of its damage an assault squad deals to aerial enemies (Patriots deal full damage) */
export const SQUAD_AIR_FACTOR = 0.4;

/** Enemies get a little sturdier every wave */
export function hpScale(wave: number): number {
	return Math.pow(1.11, Math.max(0, wave - 1));
}

export interface DefenseStats {
	/** Targeting range from the slot centre */
	range: number;
	/** Mortars cannot hit anything closer than this */
	minRange: number;
	/** Time between shots */
	intervalMs: number;
	/** Damage per shot (at the centre of a mortar blast) */
	damage: number;
	/** Mortar blast radius */
	splashRadius: number;
	/** Mortar shell flight time */
	flightMs: number;
	/** Trench: speed multiplier for soldiers inside range (1 = no slow) */
	slow: number;
	/** Trench: mine damage per second to every soldier inside range */
	dps: number;
	/** Nest drones and Patriot missiles: flight speed in units per second */
	speed: number;
}

const NONE = {
	minRange: 0,
	splashRadius: 0,
	flightMs: 0,
	slow: 1,
	dps: 0,
	speed: 0,
	intervalMs: 0,
	damage: 0
};

/** Stats by level, index 0 is level 1 */
const DEFENSE_STATS: Record<DefenseKind, readonly DefenseStats[]> = {
	// Close range, steady fire
	squad: [
		{ ...NONE, range: 88, intervalMs: 420, damage: 8 },
		{ ...NONE, range: 96, intervalMs: 360, damage: 10 },
		{ ...NONE, range: 104, intervalMs: 300, damage: 13 }
	],
	// Slow, long range, area damage
	mortar: [
		{
			...NONE,
			range: 165,
			minRange: 45,
			intervalMs: 2400,
			damage: 30,
			splashRadius: 44,
			flightMs: 750
		},
		{
			...NONE,
			range: 175,
			minRange: 45,
			intervalMs: 2100,
			damage: 40,
			splashRadius: 50,
			flightMs: 750
		},
		{
			...NONE,
			range: 190,
			minRange: 45,
			intervalMs: 1800,
			damage: 52,
			splashRadius: 58,
			flightMs: 750
		}
	],
	// Spams FPV drones, one every interval, each diving onto a soldier in reach
	nest: [
		{ ...NONE, range: 200, intervalMs: 560, damage: 18, speed: 230 },
		{ ...NONE, range: 215, intervalMs: 460, damage: 24, speed: 240 },
		{ ...NONE, range: 230, intervalMs: 340, damage: 30, speed: 250 }
	],
	// Long range anti-air: homing missiles that only go for aerial enemies
	patriot: [
		{ ...NONE, range: 240, intervalMs: 1900, damage: 45, speed: 300 },
		{ ...NONE, range: 255, intervalMs: 1550, damage: 60, speed: 310 },
		{ ...NONE, range: 270, intervalMs: 1250, damage: 80, speed: 320 }
	],
	// Slows the crowd; the upgrades add mines
	trench: [
		{ ...NONE, range: 72, slow: 0.58 },
		{ ...NONE, range: 80, slow: 0.46, dps: 3 },
		{ ...NONE, range: 88, slow: 0.36, dps: 8 }
	]
};

/** Helmet costs: [build, upgrade to level 2, upgrade to level 3] */
const DEFENSE_COSTS: Record<DefenseKind, readonly [number, number, number]> = {
	squad: [10, 12, 20],
	mortar: [20, 18, 28],
	nest: [16, 16, 26],
	patriot: [22, 18, 28],
	trench: [8, 10, 16]
};

/** Share of the spent helmets that comes back when a defense is sold */
export const SELL_REFUND = 0.6;

export function defenseStats(kind: DefenseKind, level: number): DefenseStats {
	const table = DEFENSE_STATS[kind];
	return table[Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL) - 1];
}

export function buildCost(kind: DefenseKind): number {
	return DEFENSE_COSTS[kind][0];
}

/** Cost to go from `level` to the next one, or null at the top level */
export function upgradeCost(kind: DefenseKind, level: number): number | null {
	if (level >= MAX_LEVEL || level < 1) return null;
	return DEFENSE_COSTS[kind][level];
}

/** Everything spent on a defense up to its current level */
export function totalSpent(kind: DefenseKind, level: number): number {
	let total = DEFENSE_COSTS[kind][0];
	for (let next = 2; next <= level; next++) total += DEFENSE_COSTS[kind][next - 1];
	return total;
}

export function sellValue(kind: DefenseKind, level: number): number {
	return Math.floor(totalSpent(kind, level) * SELL_REFUND);
}

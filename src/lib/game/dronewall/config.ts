/*
 * Drone Wall: fixed numbers and tables. The field is a portrait world of WORLD_WIDTH by
 * WORLD_HEIGHT units. Soldiers enter at the top, follow one winding road and lose the player a
 * heart when they reach the end of it (the Ukrainian line at the bottom). There are several maps,
 * each with its own road, defense slots and scenery.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 640;

export interface Point {
	x: number;
	y: number;
}

/** The Ukrainian line: soldiers that reach this height (the end of the road) breach it */
export const LINE_Y = 600;

export type DecorKind = 'tree' | 'pine' | 'rock' | 'bush' | 'cactus';

export interface MapTheme {
	field: string;
	/** The darker mown stripes */
	stripe: string;
	road: string;
	/** Scenery props scattered over the empty ground, and the colours of their leaves */
	decor: readonly DecorKind[];
	leaves: readonly string[];
}

export type MapId = 'serpentine' | 'riverbend' | 'lightning' | 'switchbacks';

export interface MapDef {
	id: MapId;
	/** The road, as a polyline. It starts above the field and ends on the line. */
	points: readonly Point[];
	/** Fixed defense positions, all within reach of the road */
	slots: readonly Point[];
	theme: MapTheme;
}

const pts = (list: readonly (readonly [number, number])[]): Point[] =>
	list.map(([x, y]) => ({ x, y }));

export const MAP_DEFS: readonly MapDef[] = [
	// Three long rows with a turn at each end
	{
		id: 'serpentine',
		points: pts([
			[50, -20],
			[50, 120],
			[310, 120],
			[310, 260],
			[50, 260],
			[50, 400],
			[310, 400],
			[310, 600]
		]),
		slots: pts([
			[130, 50],
			[240, 50],
			[100, 190],
			[205, 190],
			[150, 330],
			[255, 330],
			[110, 465],
			[215, 465],
			[235, 555]
		]),
		theme: {
			field: '#8c9d69',
			stripe: '#7c8c5c',
			road: '#e8dca8',
			decor: ['tree', 'bush', 'rock'],
			leaves: ['#5f8f4a', '#6da055']
		}
	},
	// Down the left bank, up the middle and down the right one
	{
		id: 'riverbend',
		points: pts([
			[60, -20],
			[60, 470],
			[180, 470],
			[180, 130],
			[300, 130],
			[300, 600]
		]),
		slots: pts([
			[120, 190],
			[120, 320],
			[120, 430],
			[240, 230],
			[240, 360],
			[240, 490],
			[120, 545],
			[180, 60],
			[270, 60]
		]),
		theme: {
			field: '#c9a063',
			stripe: '#b9914f',
			road: '#eadcb4',
			decor: ['tree', 'rock', 'bush'],
			leaves: ['#d9772b', '#b8442b', '#e0a431']
		}
	},
	// Sharp diagonal zigzags
	{
		id: 'lightning',
		points: pts([
			[310, -20],
			[310, 80],
			[50, 170],
			[310, 260],
			[50, 350],
			[310, 440],
			[50, 530],
			[50, 600]
		]),
		slots: pts([
			[130, 70],
			[230, 170],
			[130, 260],
			[230, 350],
			[130, 440],
			[220, 520],
			[150, 555]
		]),
		theme: {
			field: '#dfe9ef',
			stripe: '#cfdde6',
			road: '#c9b99a',
			decor: ['pine', 'rock', 'pine'],
			leaves: ['#3f6b52', '#4d7a5e']
		}
	},
	// Many short rows, tight turns
	{
		id: 'switchbacks',
		points: pts([
			[180, -20],
			[180, 90],
			[300, 90],
			[300, 200],
			[60, 200],
			[60, 320],
			[300, 320],
			[300, 430],
			[60, 430],
			[60, 540],
			[180, 540],
			[180, 600]
		]),
		slots: pts([
			[110, 145],
			[240, 145],
			[140, 260],
			[250, 260],
			[110, 375],
			[210, 375],
			[150, 485],
			[250, 485],
			[110, 40],
			[270, 35]
		]),
		theme: {
			field: '#d8b36a',
			stripe: '#cca55c',
			road: '#f0e2b6',
			decor: ['cactus', 'rock', 'bush'],
			leaves: ['#6f9a52', '#8aa85a']
		}
	}
];

export const MAP_IDS: readonly MapId[] = MAP_DEFS.map((map) => map.id);

/** The first map, which the simple helpers and tests use by default */
export const PATH_POINTS: readonly Point[] = MAP_DEFS[0].points;
export const SLOTS: readonly Point[] = MAP_DEFS[0].slots;

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

export type DefenseKind = 'squad' | 'mortar' | 'nest' | 'patriot' | 'trench' | 'azov' | 'leopard';
export const DEFENSE_KINDS: readonly DefenseKind[] = [
	'squad',
	'mortar',
	'nest',
	'patriot',
	'trench',
	'azov',
	'leopard'
];
export const MAX_LEVEL = 3;

/** Defenses that send units walking around the post to fight soldiers in melee */
export type GarrisonKind = 'azov' | 'leopard';

export function isGarrison(kind: DefenseKind): kind is GarrisonKind {
	return kind === 'azov' || kind === 'leopard';
}

export type SoldierKind = 'scout' | 'grunt' | 'brute' | 'runner' | 'shield' | 'btr';

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
	/** Damage per second dealt to a defender unit it is fighting */
	meleeDps: number;
	/** Share of an assault squad's bullet damage that gets through (1 = all of it) */
	armor: number;
}

export const SOLDIERS: Record<SoldierKind, SoldierStats> = {
	scout: { hp: 16, speed: 68, value: 1, radius: 8, points: 10, meleeDps: 4, armor: 1 },
	grunt: { hp: 34, speed: 40, value: 1, radius: 10, points: 10, meleeDps: 6, armor: 1 },
	brute: { hp: 150, speed: 25, value: 3, radius: 15, points: 40, meleeDps: 18, armor: 1 },
	// Very fast and fragile
	runner: { hp: 12, speed: 108, value: 1, radius: 7, points: 10, meleeDps: 3, armor: 1 },
	// Hides behind a shield: rifles do half damage, mortars and mines do not care
	shield: { hp: 62, speed: 34, value: 2, radius: 11, points: 20, meleeDps: 8, armor: 0.5 },
	// An armored car: huge, slow, rifles barely scratch it (FPV drones and mortars do)
	btr: { hp: 360, speed: 20, value: 6, radius: 19, points: 80, meleeDps: 28, armor: 0.35 }
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
	/**
	 * Garrisons (units that fight in melee): `range` is how far from the post they chase, `damage`
	 * is per hit and `intervalMs` is the time to replace a fallen unit
	 */
	unitCount: number;
	unitHp: number;
	unitSpeed: number;
	/** How close a unit must get to hit */
	unitReach: number;
	unitAttackMs: number;
	/** Health regained per second while not fighting */
	unitRegen: number;
	/** Whether a hit lands on every soldier in reach, not only the one being fought */
	cleave: boolean;
}

const NONE = {
	minRange: 0,
	splashRadius: 0,
	flightMs: 0,
	slow: 1,
	dps: 0,
	speed: 0,
	intervalMs: 0,
	damage: 0,
	unitCount: 0,
	unitHp: 0,
	unitSpeed: 0,
	unitReach: 0,
	unitAttackMs: 0,
	unitRegen: 0,
	cleave: false
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
		{ ...NONE, range: 76, slow: 0.58 },
		{ ...NONE, range: 84, slow: 0.46, dps: 3 },
		{ ...NONE, range: 92, slow: 0.36, dps: 8 }
	],
	// Infantry that patrol around the post and block and fight soldiers in melee
	azov: [
		{
			...NONE,
			range: 80,
			intervalMs: 7000,
			damage: 9,
			unitCount: 2,
			unitHp: 70,
			unitSpeed: 72,
			unitReach: 15,
			unitAttackMs: 480,
			unitRegen: 4
		},
		{
			...NONE,
			range: 88,
			intervalMs: 6000,
			damage: 12,
			unitCount: 3,
			unitHp: 90,
			unitSpeed: 76,
			unitReach: 15,
			unitAttackMs: 440,
			unitRegen: 5
		},
		{
			...NONE,
			range: 96,
			intervalMs: 5000,
			damage: 16,
			unitCount: 3,
			unitHp: 120,
			unitSpeed: 80,
			unitReach: 15,
			unitAttackMs: 400,
			unitRegen: 6
		}
	],
	// One heavy tank that rolls around the post and crushes everything within reach
	leopard: [
		{
			...NONE,
			range: 95,
			intervalMs: 16000,
			damage: 30,
			unitCount: 1,
			unitHp: 300,
			unitSpeed: 46,
			unitReach: 24,
			unitAttackMs: 700,
			unitRegen: 6,
			cleave: true
		},
		{
			...NONE,
			range: 105,
			intervalMs: 13000,
			damage: 40,
			unitCount: 1,
			unitHp: 420,
			unitSpeed: 50,
			unitReach: 26,
			unitAttackMs: 650,
			unitRegen: 8,
			cleave: true
		},
		{
			...NONE,
			range: 115,
			intervalMs: 10000,
			damage: 54,
			unitCount: 1,
			unitHp: 600,
			unitSpeed: 54,
			unitReach: 28,
			unitAttackMs: 600,
			unitRegen: 10,
			cleave: true
		}
	]
};

/** Helmet costs: [build, upgrade to level 2, upgrade to level 3] */
const DEFENSE_COSTS: Record<DefenseKind, readonly [number, number, number]> = {
	squad: [10, 12, 20],
	mortar: [20, 18, 28],
	nest: [16, 16, 26],
	patriot: [22, 18, 28],
	trench: [8, 10, 16],
	azov: [18, 16, 24],
	leopard: [30, 26, 38]
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

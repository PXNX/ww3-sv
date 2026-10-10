/*
 * Drone Wall: fixed numbers and tables. The field is WORLD_WIDTH units wide and as tall as the map
 * says: most maps are one screen (WORLD_HEIGHT) high, the big ones are several screens high and
 * scroll. Soldiers enter at the top, follow one winding road and lose the player a heart when they
 * reach the end of it (the Ukrainian line at the bottom). Every map has its own road, defense
 * slots, scenery and climate.
 */
import { smooth } from './roadShape';

export const WORLD_WIDTH = 360;
/** The height of one screen of the field; small maps are exactly this tall, big ones a multiple */
export const WORLD_HEIGHT = 640;

export interface Point {
	x: number;
	y: number;
}

/** The Ukrainian line of the standard maps: soldiers that reach this height breach it */
export const LINE_Y = 600;
/** The strip below the line (the flag colours) is this tall on every map */
export const LINE_DEPTH = WORLD_HEIGHT - LINE_Y;

export type WeatherKind = 'clear' | 'fog' | 'rain' | 'snow';

export type DecorKind =
	'tree' | 'pine' | 'rock' | 'bush' | 'cactus' | 'ruin' | 'wreck' | 'hay' | 'stump';

export interface MapTheme {
	field: string;
	/** The darker mown stripes */
	stripe: string;
	road: string;
	/** Scenery props scattered over the empty ground, and the colours of their leaves */
	decor: readonly DecorKind[];
	leaves: readonly string[];
}

export type MapId =
	| 'serpentine'
	| 'riverbend'
	| 'lightning'
	| 'switchbacks'
	| 'ridge'
	| 'oxbow'
	| 'barricades'
	| 'longmarch'
	| 'blackforest'
	| 'tundra'
	| 'metropolis';

export interface MapDef {
	id: MapId;
	/** How tall the field is, in world units; above WORLD_HEIGHT the map scrolls */
	height: number;
	/** Where the road ends and the line is: soldiers that reach this height breach it */
	lineY: number;
	/** Multiplier on the number of enemies per wave (long roads send bigger crowds) */
	crowd: number;
	/** The weather this map gets, as a bag to draw from (more copies, more often) */
	climate: readonly WeatherKind[];
	/** The road, as a polyline. It starts above the field and ends on the line. */
	points: readonly Point[];
	/** Fixed defense positions, all within reach of the road */
	slots: readonly Point[];
	theme: MapTheme;
}

export function isTallMap(map: Pick<MapDef, 'height'>): boolean {
	return map.height > WORLD_HEIGHT;
}

const pts = (list: readonly (readonly [number, number])[]): Point[] =>
	list.map(([x, y]) => ({ x, y }));

/** A road from corner points, with the corners cut `rounds` times (0 keeps them sharp) */
const road = (list: readonly (readonly [number, number])[], rounds = 0): Point[] =>
	smooth(pts(list), rounds);

export const MAP_DEFS: readonly MapDef[] = [
	// Three long rows with a turn at each end
	{
		id: 'serpentine',
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'clear', 'rain', 'fog'],
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
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'clear', 'rain', 'fog'],
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
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'snow', 'snow', 'fog'],
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
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'clear', 'clear', 'fog'],
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
	},
	// A mountain pass: one long diagonal S between rocks and pines
	{
		id: 'ridge',
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'fog', 'fog', 'snow'],
		points: road(
			[
				[300, -20],
				[300, 70],
				[120, 135],
				[60, 235],
				[170, 305],
				[285, 355],
				[300, 455],
				[180, 525],
				[180, 600]
			],
			2
		),
		slots: pts([
			[185, 46],
			[329, 104],
			[40, 147],
			[203, 250],
			[78, 320],
			[327, 329],
			[223, 426],
			[130, 511],
			[240, 569]
		]),
		theme: {
			field: '#a7b39a',
			stripe: '#98a58c',
			road: '#d8cfb4',
			decor: ['pine', 'rock', 'rock', 'stump'],
			leaves: ['#4a6b52', '#587a5e']
		}
	},
	// A lazy river bend: a smooth meander through wet green fields
	{
		id: 'oxbow',
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1,
		climate: ['clear', 'rain', 'rain', 'fog'],
		points: road(
			[
				[90, -20],
				[90, 150],
				[270, 215],
				[270, 365],
				[90, 430],
				[90, 520],
				[200, 560],
				[200, 600]
			],
			3
		),
		slots: pts([
			[152, 48],
			[277, 168],
			[85, 198],
			[206, 273],
			[326, 337],
			[113, 359],
			[230, 443],
			[88, 569],
			[262, 582]
		]),
		theme: {
			field: '#9fb878',
			stripe: '#8fa968',
			road: '#e6dbb0',
			decor: ['tree', 'bush', 'hay', 'tree'],
			leaves: ['#6da055', '#7bb064']
		}
	},
	// A ruined town: three long streets joined by sharp U-turns
	{
		id: 'barricades',
		height: WORLD_HEIGHT,
		lineY: LINE_Y,
		crowd: 1.1,
		climate: ['clear', 'rain', 'fog'],
		points: road(
			[
				[40, -20],
				[40, 545],
				[130, 545],
				[130, 95],
				[220, 95],
				[220, 545],
				[310, 545],
				[310, 600]
			],
			1
		),
		slots: pts([
			[82, 48],
			[260, 91],
			[92, 201],
			[282, 276],
			[168, 288],
			[78, 357],
			[282, 388],
			[182, 429],
			[330, 498],
			[168, 557]
		]),
		theme: {
			field: '#b0a898',
			stripe: '#a29a8a',
			road: '#e2d9bd',
			decor: ['ruin', 'wreck', 'rock', 'ruin'],
			leaves: ['#7d7766', '#8a8472']
		}
	},
	// Big map: a long zigzag across the steppe, almost two screens high
	{
		id: 'longmarch',
		height: 1120,
		lineY: 1080,
		crowd: 1.25,
		climate: ['clear', 'clear', 'rain', 'fog'],
		points: road(
			[
				[60, -20],
				[60, 100],
				[300, 200],
				[300, 300],
				[60, 400],
				[60, 500],
				[300, 600],
				[300, 700],
				[60, 800],
				[60, 900],
				[300, 1000],
				[300, 1080]
			],
			2
		),
		slots: pts([
			[103, 46],
			[240, 108],
			[329, 205],
			[159, 209],
			[254, 361],
			[38, 363],
			[145, 436],
			[282, 532],
			[75, 567],
			[259, 651],
			[146, 697],
			[271, 774],
			[30, 786],
			[214, 908],
			[321, 958],
			[78, 969],
			[249, 1049]
		]),
		theme: {
			field: '#cfc27a',
			stripe: '#c1b46b',
			road: '#efe3b5',
			decor: ['hay', 'bush', 'tree', 'stump'],
			leaves: ['#8fa84f', '#a3b85a']
		}
	},
	// Big map: a winding road through a dark forest, over two screens high
	{
		id: 'blackforest',
		height: 1400,
		lineY: 1360,
		crowd: 1.35,
		climate: ['fog', 'fog', 'rain', 'clear'],
		points: road(
			[
				[180, -20],
				[180, 120],
				[300, 230],
				[300, 330],
				[70, 430],
				[70, 560],
				[290, 670],
				[290, 790],
				[60, 900],
				[60, 1020],
				[280, 1130],
				[280, 1250],
				[180, 1310],
				[180, 1360]
			],
			3
		),
		slots: pts([
			[118, 49],
			[289, 136],
			[161, 180],
			[193, 308],
			[329, 327],
			[40, 423],
			[206, 439],
			[210, 583],
			[67, 615],
			[328, 675],
			[211, 707],
			[131, 798],
			[293, 844],
			[32, 872],
			[146, 933],
			[30, 1011],
			[280, 1072],
			[136, 1127],
			[322, 1202],
			[268, 1329],
			[118, 1342]
		]),
		theme: {
			field: '#4d6b45',
			stripe: '#456139',
			road: '#cbb98e',
			decor: ['pine', 'pine', 'tree', 'stump', 'rock'],
			leaves: ['#2f5a3c', '#38694a', '#2a4d36']
		}
	},
	// Big map: a frozen plain with long lazy bends, deep in snow
	{
		id: 'tundra',
		height: 1280,
		lineY: 1240,
		crowd: 1.3,
		climate: ['snow', 'snow', 'snow', 'fog', 'clear'],
		points: road(
			[
				[60, -20],
				[60, 200],
				[300, 300],
				[300, 520],
				[60, 620],
				[60, 840],
				[300, 940],
				[300, 1100],
				[180, 1190],
				[180, 1240]
			],
			3
		),
		slots: pts([
			[102, 48],
			[30, 161],
			[239, 209],
			[99, 277],
			[206, 337],
			[330, 338],
			[251, 452],
			[132, 524],
			[277, 586],
			[170, 644],
			[34, 647],
			[125, 758],
			[283, 876],
			[54, 880],
			[171, 932],
			[237, 1040],
			[329, 1120],
			[259, 1209],
			[118, 1222]
		]),
		theme: {
			field: '#e6eef2',
			stripe: '#d6e2e9',
			road: '#bfae92',
			decor: ['pine', 'rock', 'stump', 'pine'],
			leaves: ['#3f6b52', '#4d7a5e']
		}
	},
	// Big map: a ruined city of sharp street corners, the longest road of all
	{
		id: 'metropolis',
		height: 1600,
		lineY: 1560,
		crowd: 1.8,
		climate: ['clear', 'rain', 'fog', 'snow'],
		points: pts([
			[320, -20],
			[320, 110],
			[40, 110],
			[40, 260],
			[250, 260],
			[250, 380],
			[90, 380],
			[90, 520],
			[320, 520],
			[320, 680],
			[40, 680],
			[40, 820],
			[250, 820],
			[250, 950],
			[90, 950],
			[90, 1090],
			[320, 1090],
			[320, 1240],
			[40, 1240],
			[40, 1380],
			[220, 1380],
			[220, 1560]
		]),
		slots: pts([
			[44, 48],
			[280, 68],
			[112, 162],
			[232, 218],
			[100, 302],
			[312, 368],
			[174, 442],
			[38, 516],
			[262, 572],
			[148, 618],
			[80, 722],
			[224, 778],
			[312, 900],
			[170, 908],
			[38, 950],
			[162, 1048],
			[318, 1048],
			[44, 1178],
			[232, 1178],
			[320, 1292],
			[156, 1302],
			[40, 1422],
			[172, 1432],
			[262, 1528]
		]),
		theme: {
			field: '#9a9a92',
			stripe: '#8d8d86',
			road: '#d6cfba',
			decor: ['ruin', 'wreck', 'ruin', 'rock'],
			leaves: ['#6f6f66', '#7c7c72']
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

export type DefenseKind =
	| 'squad'
	| 'mortar'
	| 'nest'
	| 'patriot'
	| 'trench'
	| 'azov'
	| 'leopard'
	| 'himars'
	| 'sniper'
	| 'jammer'
	| 'gepard'
	| 'pion';
/** In build-menu order */
export const DEFENSE_KINDS: readonly DefenseKind[] = [
	'squad',
	'trench',
	'mortar',
	'nest',
	'patriot',
	'gepard',
	'sniper',
	'azov',
	'leopard',
	'jammer',
	'himars',
	'pion'
];

/** Levels 1 to 3 are the normal ones, 4 to 6 are the elite upgrades (elite I, II and III) */
export const NORMAL_LEVELS = 3;
export const MAX_LEVEL = 6;

export function isElite(level: number): boolean {
	return level > NORMAL_LEVELS;
}

/** 0 for a normal level, 1 to 3 for the elite levels */
export function eliteTier(level: number): number {
	return Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)) - NORMAL_LEVELS);
}

/** Defenses that send units walking around the post to fight soldiers in melee */
export type GarrisonKind = 'azov' | 'leopard';

export function isGarrison(kind: DefenseKind): kind is GarrisonKind {
	return kind === 'azov' || kind === 'leopard';
}

/** Defenses that lob shells, rockets or heavy rounds at a spot on the road */
export type ArtilleryKind = 'mortar' | 'himars' | 'pion';

export function isArtillery(kind: DefenseKind): kind is ArtilleryKind {
	return kind === 'mortar' || kind === 'himars' || kind === 'pion';
}

export type SoldierKind =
	| 'scout'
	| 'grunt'
	| 'brute'
	| 'runner'
	| 'shield'
	| 'btr'
	| 'medic'
	| 'officer'
	| 'sapper'
	| 'tank'
	| 'buggy';

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
	/** Armored cars, tanks and buggies: rain bogs them down (and snow does not) */
	vehicle: boolean;
	/** Hearts lost when it breaches the line */
	leak: number;
}

export const SOLDIERS: Record<SoldierKind, SoldierStats> = {
	scout: {
		hp: 16,
		speed: 68,
		value: 1,
		radius: 8,
		points: 10,
		meleeDps: 4,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	grunt: {
		hp: 34,
		speed: 40,
		value: 1,
		radius: 10,
		points: 10,
		meleeDps: 6,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	brute: {
		hp: 150,
		speed: 25,
		value: 3,
		radius: 15,
		points: 40,
		meleeDps: 18,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	// Very fast and fragile
	runner: {
		hp: 12,
		speed: 108,
		value: 1,
		radius: 7,
		points: 10,
		meleeDps: 3,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	// Hides behind a shield: rifles do half damage, mortars and mines do not care
	shield: {
		hp: 62,
		speed: 34,
		value: 2,
		radius: 11,
		points: 20,
		meleeDps: 8,
		armor: 0.5,
		vehicle: false,
		leak: 1
	},
	// An armored car: huge, slow, rifles barely scratch it (FPV drones and mortars do)
	btr: {
		hp: 360,
		speed: 20,
		value: 6,
		radius: 19,
		points: 80,
		meleeDps: 28,
		armor: 0.35,
		vehicle: true,
		leak: 1
	},
	// Patches up the soldiers around it
	medic: {
		hp: 42,
		speed: 36,
		value: 2,
		radius: 10,
		points: 25,
		meleeDps: 3,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	// Shouts the soldiers around it into a faster march
	officer: {
		hp: 90,
		speed: 34,
		value: 3,
		radius: 11,
		points: 40,
		meleeDps: 8,
		armor: 0.8,
		vehicle: false,
		leak: 1
	},
	// Fast and sneaky: trenches do not slow it and mines do not hurt it
	sapper: {
		hp: 30,
		speed: 56,
		value: 2,
		radius: 8.5,
		points: 20,
		meleeDps: 5,
		armor: 1,
		vehicle: false,
		leak: 1
	},
	// A main battle tank: the toughest thing on the road, and a breach costs two hearts
	tank: {
		hp: 520,
		speed: 23,
		value: 8,
		radius: 21,
		points: 130,
		meleeDps: 40,
		armor: 0.25,
		vehicle: true,
		leak: 2
	},
	// A fast light buggy with a gunner on the back
	buggy: {
		hp: 64,
		speed: 98,
		value: 2,
		radius: 11,
		points: 25,
		meleeDps: 9,
		armor: 0.7,
		vehicle: true,
		leak: 1
	}
};

/** Aerial enemies ignore the road and fly straight from the top edge at the line */
export type FlyerKind = 'shahed' | 'heli' | 'bomber' | 'swarm';
export type EnemyKind = SoldierKind | FlyerKind;

export interface FlyerStats {
	hp: number;
	/** World units per second along the straight flight */
	speed: number;
	value: number;
	radius: number;
	points: number;
	/** Hearts lost when it gets through */
	leak: number;
}

export const FLYERS: Record<FlyerKind, FlyerStats> = {
	// A fast kamikaze drone
	shahed: { hp: 30, speed: 62, value: 1, radius: 9, points: 15, leak: 1 },
	// A slow, tough helicopter
	heli: { hp: 150, speed: 36, value: 3, radius: 15, points: 50, leak: 1 },
	// A huge, slow bomber that takes a lot of missiles, and costs two hearts when it gets through
	bomber: { hp: 520, speed: 24, value: 9, radius: 24, points: 140, leak: 2 },
	// Tiny cheap kamikaze drones that come in a cloud and make a Patriot waste its missiles
	swarm: { hp: 9, speed: 92, value: 1, radius: 6, points: 5, leak: 1 }
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
	/** Artillery cannot hit anything closer than this */
	minRange: number;
	/** Time between shots */
	intervalMs: number;
	/** Damage per shot (at the centre of a blast) */
	damage: number;
	/** Artillery blast radius */
	splashRadius: number;
	/** Artillery shell flight time */
	flightMs: number;
	/**
	 * Trench: speed multiplier for soldiers inside range (1 = no slow). Jammer: the same for
	 * aerial enemies.
	 */
	slow: number;
	/** Trench: mine damage per second to every soldier inside range. Jammer: to every aircraft. */
	dps: number;
	/** Nest drones and Patriot missiles: flight speed in units per second */
	speed: number;
	/** Shots, drones, missiles or rockets fired at different targets with every shot */
	volley: number;
	/** Share of an enemy's armor that this shot ignores (snipers) */
	pierce: number;
	/** Share of the damage that hits aerial enemies and ground enemies (0 = cannot shoot them) */
	air: number;
	ground: number;
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

const NONE: DefenseStats = {
	range: 0,
	minRange: 0,
	splashRadius: 0,
	flightMs: 0,
	slow: 1,
	dps: 0,
	speed: 0,
	intervalMs: 0,
	damage: 0,
	volley: 1,
	pierce: 0,
	air: 0,
	ground: 1,
	unitCount: 0,
	unitHp: 0,
	unitSpeed: 0,
	unitReach: 0,
	unitAttackMs: 0,
	unitRegen: 0,
	cleave: false
};

/** The normal levels (1 to 3) by hand; index 0 is level 1 */
const NORMAL_STATS: Record<DefenseKind, readonly DefenseStats[]> = {
	// Close range, steady fire
	squad: [
		{ ...NONE, range: 88, intervalMs: 420, damage: 8, air: SQUAD_AIR_FACTOR },
		{ ...NONE, range: 96, intervalMs: 360, damage: 10, air: SQUAD_AIR_FACTOR },
		{ ...NONE, range: 104, intervalMs: 300, damage: 13, air: SQUAD_AIR_FACTOR }
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
	],
	// A rocket launcher truck: a salvo of rockets fired from far away, then a long reload
	himars: [
		{
			...NONE,
			range: 290,
			minRange: 80,
			intervalMs: 8000,
			damage: 30,
			splashRadius: 38,
			flightMs: 1000,
			volley: 4
		},
		{
			...NONE,
			range: 300,
			minRange: 80,
			intervalMs: 7000,
			damage: 36,
			splashRadius: 40,
			flightMs: 1000,
			volley: 4
		},
		{
			...NONE,
			range: 315,
			minRange: 80,
			intervalMs: 6200,
			damage: 44,
			splashRadius: 44,
			flightMs: 1000,
			volley: 5
		}
	],
	// A sniper team: one precise shot that picks the toughest soldier and ignores most armor
	sniper: [
		{ ...NONE, range: 195, intervalMs: 2600, damage: 65, pierce: 0.55 },
		{ ...NONE, range: 205, intervalMs: 2200, damage: 85, pierce: 0.65 },
		{ ...NONE, range: 215, intervalMs: 1900, damage: 110, pierce: 0.75 }
	],
	// An electronic warfare station: aircraft in its field crawl and take damage
	jammer: [
		{ ...NONE, range: 120, slow: 0.65, dps: 3 },
		{ ...NONE, range: 135, slow: 0.55, dps: 6 },
		{ ...NONE, range: 150, slow: 0.45, dps: 10 }
	],
	// A Gepard flak tank: a hail of rounds that shreds aircraft, and barely scratches the ground
	gepard: [
		{ ...NONE, range: 150, intervalMs: 150, damage: 7, air: 1, ground: 0.3 },
		{ ...NONE, range: 162, intervalMs: 130, damage: 8, air: 1, ground: 0.3 },
		{ ...NONE, range: 175, intervalMs: 110, damage: 10, air: 1, ground: 0.3 }
	],
	// Heavy long-range artillery: a huge round every now and then from across the whole field
	pion: [
		{
			...NONE,
			range: 330,
			minRange: 110,
			intervalMs: 11000,
			damage: 170,
			splashRadius: 58,
			flightMs: 1500
		},
		{
			...NONE,
			range: 345,
			minRange: 110,
			intervalMs: 9500,
			damage: 220,
			splashRadius: 64,
			flightMs: 1500
		},
		{
			...NONE,
			range: 360,
			minRange: 110,
			intervalMs: 8200,
			damage: 280,
			splashRadius: 70,
			flightMs: 1500
		}
	]
};

/**
 * The elite upgrades (levels 4 to 6) are built from the last normal level: every elite tier
 * multiplies power, speed of fire, reach and toughness, and some defenses get something new on
 * top, such as a bigger volley, more units or stronger mines.
 */
interface Tier {
	power: number;
	rate: number;
	reach: number;
	tough: number;
}

const TIERS: readonly Tier[] = [
	{ power: 1.3, rate: 0.88, reach: 1.06, tough: 1.5 },
	{ power: 1.6, rate: 0.78, reach: 1.12, tough: 2.2 },
	{ power: 2, rate: 0.68, reach: 1.18, tough: 3.2 }
];

type PerTier = readonly [number, number, number];

interface EliteExtra {
	volley?: PerTier;
	unitCount?: PerTier;
	pierce?: PerTier;
	slow?: PerTier;
	dps?: PerTier;
}

const ELITE_EXTRA: Record<DefenseKind, EliteExtra> = {
	squad: { volley: [1, 2, 2] },
	mortar: { volley: [1, 2, 2] },
	nest: { volley: [2, 2, 3] },
	patriot: { volley: [1, 2, 2] },
	trench: { slow: [0.3, 0.25, 0.2], dps: [12, 18, 26] },
	azov: { unitCount: [4, 4, 5] },
	leopard: { unitCount: [1, 2, 2] },
	himars: { volley: [6, 7, 8] },
	sniper: { volley: [1, 2, 2], pierce: [0.85, 0.92, 1] },
	jammer: { slow: [0.38, 0.3, 0.24], dps: [14, 20, 28] },
	gepard: { volley: [1, 1, 2] },
	pion: { volley: [1, 2, 2] }
};

function eliteStats(kind: DefenseKind, tier: number): DefenseStats {
	const base = NORMAL_STATS[kind][NORMAL_LEVELS - 1];
	const { power, rate, reach, tough } = TIERS[tier - 1];
	const extra = ELITE_EXTRA[kind];
	const volley = extra.volley?.[tier - 1] ?? base.volley;
	// A bigger volley already multiplies the damage dealt, so the shots themselves grow less
	const damageGrowth = volley > base.volley ? 1 + (power - 1) * 0.6 : power;
	return {
		...base,
		range: Math.round(base.range * reach),
		intervalMs: Math.round(base.intervalMs * rate),
		damage: Math.round(base.damage * damageGrowth),
		splashRadius: Math.round(base.splashRadius * (1 + (reach - 1) * 1.5)),
		speed: Math.round(base.speed * (1 + (reach - 1) * 0.5)),
		volley,
		pierce: extra.pierce?.[tier - 1] ?? base.pierce,
		slow: extra.slow?.[tier - 1] ?? base.slow,
		dps: extra.dps?.[tier - 1] ?? base.dps,
		unitCount: extra.unitCount?.[tier - 1] ?? base.unitCount,
		unitHp: Math.round(base.unitHp * tough),
		unitSpeed: Math.round(base.unitSpeed * (1 + (reach - 1) * 0.8)),
		unitReach: Math.round(base.unitReach * (1 + (reach - 1) * 0.8)),
		unitAttackMs: Math.round(base.unitAttackMs * rate),
		unitRegen: Math.round(base.unitRegen * tough)
	};
}

/** Stats by level, index 0 is level 1 */
const DEFENSE_STATS: Record<DefenseKind, readonly DefenseStats[]> = Object.fromEntries(
	(Object.keys(NORMAL_STATS) as DefenseKind[]).map((kind) => [
		kind,
		[...NORMAL_STATS[kind], ...[1, 2, 3].map((tier) => eliteStats(kind, tier))]
	])
) as unknown as Record<DefenseKind, readonly DefenseStats[]>;

/** Helmet costs: [build, then the upgrade to each of levels 2 to 6] */
const DEFENSE_COSTS: Record<
	DefenseKind,
	readonly [number, number, number, number, number, number]
> = {
	squad: [10, 12, 20, 34, 48, 66],
	trench: [8, 10, 16, 26, 38, 52],
	mortar: [20, 18, 28, 44, 60, 80],
	nest: [16, 16, 26, 40, 56, 76],
	patriot: [22, 18, 28, 44, 60, 82],
	gepard: [20, 16, 24, 38, 54, 72],
	sniper: [14, 14, 22, 34, 48, 64],
	azov: [18, 16, 24, 38, 52, 70],
	leopard: [30, 26, 38, 56, 76, 100],
	jammer: [18, 16, 24, 34, 46, 62],
	himars: [40, 30, 44, 62, 84, 110],
	pion: [38, 30, 44, 62, 84, 110]
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

/*
 * Powers: things the player calls in by hand, for helmets. Each unlocks once a defense has been
 * promoted to an elite level for the first time (the highest elite tier ever reached is the
 * "elite rank"), and the higher the rank the harder they hit.
 */
export type PowerKind = 'airstrike' | 'stormshadow';
export const POWER_KINDS: readonly PowerKind[] = ['airstrike', 'stormshadow'];

export interface PowerDef {
	cost: number;
	cooldownMs: number;
	/** Elite rank (1 to 3) needed before the power can be called */
	unlockRank: number;
}

export const POWERS: Record<PowerKind, PowerDef> = {
	airstrike: { cost: 45, cooldownMs: 40000, unlockRank: 1 },
	stormshadow: { cost: 60, cooldownMs: 55000, unlockRank: 2 }
};

/** F-16s fly across the field and carpet-bomb a band of it; more bombs at a higher elite rank */
export const AIRSTRIKE = {
	/** Half the height of the bombed band */
	halfBand: 80,
	radius: 40,
	damage: 85,
	/** Time the jets take to cross the field */
	crossMs: 1100,
	/** Time a bomb takes to fall */
	fallMs: 520,
	/** Bombs by elite rank 1 to 3 */
	bombs: [8, 11, 14],
	/** Damage multiplier by elite rank */
	rankDamage: [1, 1.25, 1.5]
} as const;

/** A Storm Shadow cruise missile: one huge blast on one spot */
export const STORM_SHADOW = {
	radius: 76,
	damage: 420,
	flightMs: 1500,
	/** Damage multiplier by elite rank 1 to 3 */
	rankDamage: [1, 1, 1.35]
} as const;

/** Powers keep up with the enemies: their damage grows with the wave */
export function powerScale(wave: number): number {
	return 0.5 + 0.5 * hpScale(wave);
}

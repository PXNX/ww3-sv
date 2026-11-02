/*
 * Beachhead tuning: the island grid, the landing party and the stats of everything that shoots.
 * Everything here is a plain number or list so the rules stay testable and easy to balance.
 */

export const COLUMNS = 12;
export const ROWS = 8;

/** The water and the beach: a tap left of this line lands the next squad */
export const SHORE_X = 2;
/** Where a landed squad first stands, in grid cells */
export const LANDING_X = 1.15;

export type BuildingKind =
	| 'hq'
	| 'field-cannon'
	| 'mortar'
	| 'fpv-nest'
	| 'air-defence'
	| 'sniper'
	| 'mg'
	| 'flame'
	| 'depot';

/** Which troop a gun picks when several are in range */
export type Targeting = 'nearest' | 'weakest' | 'farthest';

export interface BuildingStats {
	width: number;
	height: number;
	hp: number;
	/** Damage per shot; 0 for buildings that do not shoot */
	damage: number;
	/** Tiles from the building's edge to the furthest troop it can hit */
	range: number;
	/** Milliseconds between two shots */
	reloadMs: number;
	/** Tiles around the aimed troop that also take damage (0 = only the aimed troop) */
	splash: number;
	/** Tiles closer than this are too close to hit, for lobbed weapons */
	minRange?: number;
	/** Defaults to the nearest troop in range */
	targeting?: Targeting;
	/** Score for destroying it */
	score: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingStats> = {
	hq: { width: 2, height: 2, hp: 1500, damage: 0, range: 0, reloadMs: 0, splash: 0, score: 1000 },
	'field-cannon': {
		width: 1,
		height: 1,
		hp: 420,
		damage: 42,
		range: 3.2,
		reloadMs: 1700,
		splash: 0,
		score: 300
	},
	mortar: {
		width: 1,
		height: 1,
		hp: 380,
		damage: 46,
		range: 5.6,
		reloadMs: 2600,
		splash: 1,
		minRange: 1.6,
		targeting: 'farthest',
		score: 320
	},
	'fpv-nest': {
		width: 1,
		height: 1,
		hp: 300,
		damage: 28,
		range: 6.2,
		reloadMs: 2100,
		splash: 0,
		targeting: 'weakest',
		score: 300
	},
	'air-defence': {
		width: 1,
		height: 1,
		hp: 480,
		damage: 18,
		range: 6.6,
		reloadMs: 1000,
		splash: 0.5,
		targeting: 'farthest',
		score: 340
	},
	sniper: {
		width: 1,
		height: 1,
		hp: 280,
		damage: 16,
		range: 5.2,
		reloadMs: 900,
		splash: 0,
		targeting: 'weakest',
		score: 250
	},
	mg: {
		width: 1,
		height: 1,
		hp: 300,
		damage: 6,
		range: 2.3,
		reloadMs: 190,
		splash: 0,
		score: 250
	},
	flame: {
		width: 1,
		height: 1,
		hp: 360,
		damage: 4,
		range: 1.8,
		reloadMs: 160,
		splash: 0.45,
		score: 280
	},
	depot: { width: 1, height: 1, hp: 220, damage: 0, range: 0, reloadMs: 0, splash: 0, score: 150 }
};

export const TROOP = {
	hp: 100,
	damage: 16,
	range: 1.15,
	speed: 3,
	attackMs: 620,
	/** Troops stop short of a building they bump into and attack that instead */
	body: 0.18
};

export const SQUADS = 3;
export const TROOPS_PER_SQUAD = 4;

/** Seconds an island is expected to take; beating it adds a small time bonus to the score */
export const PAR_SECONDS = 30;

export interface IslandBuilding {
	kind: BuildingKind;
	x: number;
	y: number;
}

export interface Island {
	id: string;
	buildings: readonly IslandBuilding[];
}

/**
 * Six islands, easiest first. The headquarters sits inland on the right; tap a row on the beach to
 * land a squad on it. Every island adds a different defensive structure, from field cannons and
 * machine guns to mortars, drone nests, air defence batteries and flamethrowers.
 */
export const ISLANDS: readonly Island[] = [
	{
		id: 'palm-key',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 6, y: 2 },
			{ kind: 'mg', x: 7, y: 5 },
			{ kind: 'depot', x: 5, y: 4 }
		]
	},
	{
		id: 'coral-battery',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 5, y: 2 },
			{ kind: 'sniper', x: 7, y: 5 },
			{ kind: 'mg', x: 4, y: 5 },
			{ kind: 'depot', x: 6, y: 4 }
		]
	},
	{
		id: 'mangrove-line',
		buildings: [
			{ kind: 'hq', x: 9, y: 2 },
			{ kind: 'field-cannon', x: 5, y: 1 },
			{ kind: 'mortar', x: 6, y: 4 },
			{ kind: 'sniper', x: 8, y: 6 },
			{ kind: 'mg', x: 4, y: 6 },
			{ kind: 'depot', x: 4, y: 3 }
		]
	},
	{
		id: 'harbour-ring',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 5, y: 1 },
			{ kind: 'field-cannon', x: 5, y: 5 },
			{ kind: 'mortar', x: 7, y: 3 },
			{ kind: 'air-defence', x: 8, y: 0 },
			{ kind: 'mg', x: 7, y: 6 },
			{ kind: 'flame', x: 8, y: 5 },
			{ kind: 'depot', x: 4, y: 3 },
			{ kind: 'depot', x: 6, y: 6 }
		]
	},
	{
		id: 'twin-atolls',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'sniper', x: 4, y: 1 },
			{ kind: 'sniper', x: 4, y: 6 },
			{ kind: 'mortar', x: 6, y: 2 },
			{ kind: 'field-cannon', x: 6, y: 5 },
			{ kind: 'fpv-nest', x: 8, y: 0 },
			{ kind: 'mg', x: 8, y: 6 },
			{ kind: 'depot', x: 7, y: 3 }
		]
	},
	{
		id: 'junta-fortress',
		buildings: [
			{ kind: 'hq', x: 9, y: 2 },
			{ kind: 'field-cannon', x: 4, y: 1 },
			{ kind: 'field-cannon', x: 4, y: 6 },
			{ kind: 'mortar', x: 6, y: 0 },
			{ kind: 'sniper', x: 6, y: 7 },
			{ kind: 'mg', x: 7, y: 2 },
			{ kind: 'mg', x: 7, y: 5 },
			{ kind: 'fpv-nest', x: 8, y: 4 },
			{ kind: 'air-defence', x: 5, y: 3 },
			{ kind: 'flame', x: 8, y: 6 },
			{ kind: 'depot', x: 5, y: 5 }
		]
	}
];

export const ISLAND_IDS: readonly string[] = ISLANDS.map((island) => island.id);

/** Total landing party of one attack */
export const LANDING_PARTY = SQUADS * TROOPS_PER_SQUAD;

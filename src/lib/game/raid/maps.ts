/*
 * The three battlefields. Each layout is generated once from a fixed seed (so it is the same on
 * every device and every raid) around a few hand-placed landmarks: solid cover that blocks
 * movement and bullets, plus ground decoration that is only drawn. Maps also set their own
 * difficulty and reward multiplier.
 */
import { createRandom, randomInt, type Random } from '#lib/game/random.js';
import type { MapId } from './config';

export type ObstacleKind =
	| 'tree'
	| 'haybale'
	| 'wreck'
	| 'rock'
	| 'barrels'
	| 'derrick'
	| 'palm'
	| 'iceblock'
	| 'pine'
	| 'crates'
	| 'radar';

export type DecorKind =
	| 'sunflowers'
	| 'grass'
	| 'crater'
	| 'mud'
	| 'dune'
	| 'oil'
	| 'shell'
	| 'drift'
	| 'crack'
	| 'tracks';

export interface Obstacle {
	x: number;
	y: number;
	r: number;
	kind: ObstacleKind;
	/** Fixed per obstacle, for small visual variety */
	seed: number;
}

export interface Decor {
	x: number;
	y: number;
	size: number;
	kind: DecorKind;
	seed: number;
}

export interface Palette {
	ground: string;
	groundDark: string;
	groundLight: string;
	edge: string;
}

export interface RaidMap {
	id: MapId;
	width: number;
	height: number;
	/** Enemy health and damage multiplier */
	difficulty: number;
	/** XP, gold and loot luck multiplier */
	reward: number;
	/** Extra item level for gear found here */
	itemLevelBonus: number;
	palette: Palette;
	spawn: { x: number; y: number };
	obstacles: Obstacle[];
	decor: Decor[];
}

interface MapRecipe {
	id: MapId;
	seed: number;
	width: number;
	height: number;
	difficulty: number;
	reward: number;
	itemLevelBonus: number;
	palette: Palette;
	/** Landmarks placed by hand, in shares of the map size */
	landmarks: { x: number; y: number; r: number; kind: ObstacleKind }[];
	/** Scattered cover: kind, radius range and how many */
	scatter: { kind: ObstacleKind; min: number; max: number; count: number }[];
	decor: { kind: DecorKind; min: number; max: number; count: number }[];
}

const RECIPES: Record<MapId, MapRecipe> = {
	sunflower: {
		id: 'sunflower',
		seed: 1101,
		width: 2600,
		height: 1800,
		difficulty: 1,
		reward: 1,
		itemLevelBonus: 0,
		palette: { ground: '#a6b85a', groundDark: '#7f9440', groundLight: '#c4d47a', edge: '#5b6b2c' },
		landmarks: [
			{ x: 0.22, y: 0.3, r: 62, kind: 'wreck' },
			{ x: 0.78, y: 0.68, r: 62, kind: 'wreck' },
			{ x: 0.7, y: 0.22, r: 46, kind: 'haybale' },
			{ x: 0.3, y: 0.78, r: 46, kind: 'haybale' }
		],
		scatter: [
			{ kind: 'tree', min: 28, max: 44, count: 22 },
			{ kind: 'haybale', min: 22, max: 30, count: 14 },
			{ kind: 'rock', min: 18, max: 30, count: 10 }
		],
		decor: [
			{ kind: 'sunflowers', min: 40, max: 90, count: 70 },
			{ kind: 'grass', min: 10, max: 18, count: 180 },
			{ kind: 'crater', min: 30, max: 60, count: 22 },
			{ kind: 'mud', min: 50, max: 110, count: 18 }
		]
	},
	strait: {
		id: 'strait',
		seed: 2202,
		width: 2800,
		height: 1900,
		difficulty: 1.3,
		reward: 1.5,
		itemLevelBonus: 2,
		palette: { ground: '#e3c27f', groundDark: '#c9a35d', groundLight: '#f2dca4', edge: '#9a7a3c' },
		landmarks: [
			{ x: 0.25, y: 0.25, r: 70, kind: 'derrick' },
			{ x: 0.75, y: 0.25, r: 70, kind: 'derrick' },
			{ x: 0.5, y: 0.8, r: 70, kind: 'derrick' }
		],
		scatter: [
			{ kind: 'rock', min: 24, max: 46, count: 22 },
			{ kind: 'barrels', min: 22, max: 30, count: 18 },
			{ kind: 'palm', min: 22, max: 30, count: 14 }
		],
		decor: [
			{ kind: 'dune', min: 60, max: 140, count: 60 },
			{ kind: 'oil', min: 30, max: 80, count: 24 },
			{ kind: 'shell', min: 8, max: 14, count: 60 },
			{ kind: 'crater', min: 30, max: 56, count: 16 }
		]
	},
	arctic: {
		id: 'arctic',
		seed: 3303,
		width: 2800,
		height: 2000,
		difficulty: 1.65,
		reward: 2.2,
		itemLevelBonus: 4,
		palette: { ground: '#e8f1f7', groundDark: '#c4d8e6', groundLight: '#ffffff', edge: '#8aa6bb' },
		landmarks: [
			{ x: 0.5, y: 0.22, r: 84, kind: 'radar' },
			{ x: 0.2, y: 0.7, r: 56, kind: 'crates' },
			{ x: 0.82, y: 0.6, r: 56, kind: 'crates' }
		],
		scatter: [
			{ kind: 'pine', min: 26, max: 42, count: 26 },
			{ kind: 'iceblock', min: 22, max: 40, count: 20 },
			{ kind: 'crates', min: 22, max: 30, count: 10 }
		],
		decor: [
			{ kind: 'drift', min: 50, max: 120, count: 60 },
			{ kind: 'crack', min: 30, max: 70, count: 30 },
			{ kind: 'tracks', min: 60, max: 120, count: 18 },
			{ kind: 'crater', min: 30, max: 50, count: 10 }
		]
	}
};

/** No cover within this distance of the start, so the first seconds are never cramped */
const CLEAR_START = 220;
/** Gap kept between two pieces of cover, so there is always a way through */
const COVER_GAP = 70;
/** Cover keeps this far from the edge */
const EDGE_MARGIN = 60;

function fits(obstacles: readonly Obstacle[], x: number, y: number, r: number): boolean {
	return obstacles.every((other) => Math.hypot(other.x - x, other.y - y) > other.r + r + COVER_GAP);
}

function buildMap(recipe: MapRecipe): RaidMap {
	const random: Random = createRandom(recipe.seed);
	const { width, height } = recipe;
	const spawn = { x: width / 2, y: height / 2 };
	const obstacles: Obstacle[] = recipe.landmarks.map((mark) => ({
		x: Math.round(mark.x * width),
		y: Math.round(mark.y * height),
		r: mark.r,
		kind: mark.kind,
		seed: randomInt(random, 0, 1000)
	}));

	for (const group of recipe.scatter) {
		let placed = 0;
		for (let attempt = 0; attempt < group.count * 40 && placed < group.count; attempt++) {
			const r = randomInt(random, group.min, group.max + 1);
			const x = randomInt(random, EDGE_MARGIN + r, width - EDGE_MARGIN - r);
			const y = randomInt(random, EDGE_MARGIN + r, height - EDGE_MARGIN - r);
			if (Math.hypot(x - spawn.x, y - spawn.y) < CLEAR_START + r) continue;
			if (!fits(obstacles, x, y, r)) continue;
			obstacles.push({ x, y, r, kind: group.kind, seed: randomInt(random, 0, 1000) });
			placed += 1;
		}
	}

	const decor: Decor[] = [];
	for (const group of recipe.decor) {
		for (let i = 0; i < group.count; i++) {
			decor.push({
				x: randomInt(random, 0, width),
				y: randomInt(random, 0, height),
				size: randomInt(random, group.min, group.max + 1),
				kind: group.kind,
				seed: randomInt(random, 0, 1000)
			});
		}
	}
	// Flat things first, so taller decoration is drawn over them
	const order: DecorKind[] = [
		'mud',
		'oil',
		'dune',
		'drift',
		'crack',
		'crater',
		'tracks',
		'grass',
		'shell',
		'sunflowers'
	];
	decor.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

	return {
		id: recipe.id,
		width,
		height,
		difficulty: recipe.difficulty,
		reward: recipe.reward,
		itemLevelBonus: recipe.itemLevelBonus,
		palette: recipe.palette,
		spawn,
		obstacles,
		decor
	};
}

const built = new Map<MapId, RaidMap>();

/** The map layout; generated on first use and then shared */
export function raidMap(id: MapId): RaidMap {
	let map = built.get(id);
	if (!map) {
		map = buildMap(RECIPES[id]);
		built.set(id, map);
	}
	return map;
}

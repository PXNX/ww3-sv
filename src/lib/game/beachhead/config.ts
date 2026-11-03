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
	| 'depot'
	| 'catapult'
	| 'ballista'
	| 'ice-cannon'
	| 'ice-spire'
	| 'dart-hut'
	| 'totem'
	| 'sand-mortar'
	| 'scorpion-nest'
	| MineKind;

/** One-cell mines: they sit on the ground and go off when a troop walks over them */
export type MineKind = 'mine-emp' | 'mine-personnel' | 'mine-at';
export const MINE_KINDS: readonly MineKind[] = ['mine-personnel', 'mine-at', 'mine-emp'];

export function isMine(kind: BuildingKind): kind is MineKind {
	return kind === 'mine-emp' || kind === 'mine-personnel' || kind === 'mine-at';
}

/** Which troop a gun picks when several are in range */
export type Targeting = 'nearest' | 'weakest' | 'farthest';

/** How a projectile travels and how it is drawn */
export type ProjectileKind = 'shell' | 'rocket' | 'drone';

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
	/** Guns with a projectile fire a visible shot that lands a moment later */
	projectile?: ProjectileKind;
	/** Projectile speed in grid cells per second; the flight time follows the distance */
	projectileSpeed?: number;
	/** Rockets and drones follow a living target instead of flying to where it stood */
	homing?: boolean;
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
		projectile: 'shell',
		projectileSpeed: 8.5,
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
		projectile: 'drone',
		projectileSpeed: 10,
		homing: true,
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
		projectile: 'rocket',
		projectileSpeed: 15,
		homing: true,
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
	depot: { width: 1, height: 1, hp: 220, damage: 0, range: 0, reloadMs: 0, splash: 0, score: 150 },
	// The orc lands in the north: a lobbing catapult and a long ballista that picks off the weakest
	catapult: {
		width: 1,
		height: 1,
		hp: 520,
		damage: 58,
		range: 6.4,
		reloadMs: 3400,
		splash: 1.4,
		minRange: 2.2,
		targeting: 'farthest',
		projectile: 'shell',
		projectileSpeed: 6.5,
		score: 360
	},
	ballista: {
		width: 1,
		height: 1,
		hp: 340,
		damage: 34,
		range: 6,
		reloadMs: 1500,
		splash: 0,
		targeting: 'weakest',
		score: 300
	},
	// The frozen north: a frost cannon that lobs ice and a spire that picks off the weakest from afar
	'ice-cannon': {
		width: 1,
		height: 1,
		hp: 540,
		damage: 50,
		range: 5.8,
		reloadMs: 2800,
		splash: 1.2,
		minRange: 2,
		targeting: 'farthest',
		projectile: 'shell',
		projectileSpeed: 7,
		score: 360
	},
	'ice-spire': {
		width: 1,
		height: 1,
		hp: 360,
		damage: 22,
		range: 6.8,
		reloadMs: 900,
		splash: 0,
		targeting: 'weakest',
		score: 320
	},
	// The jungle: a hut of blowpipes that spits darts all day and a totem that shocks everyone close
	'dart-hut': {
		width: 1,
		height: 1,
		hp: 320,
		damage: 5,
		range: 3,
		reloadMs: 140,
		splash: 0,
		score: 260
	},
	totem: {
		width: 1,
		height: 1,
		hp: 480,
		damage: 12,
		range: 2.6,
		reloadMs: 500,
		splash: 0.8,
		score: 300
	},
	// The desert: a mortar dug into the dunes and a scorpion nest that stings the weakest
	'sand-mortar': {
		width: 1,
		height: 1,
		hp: 400,
		damage: 54,
		range: 6.2,
		reloadMs: 2900,
		splash: 1.3,
		minRange: 1.8,
		targeting: 'farthest',
		projectile: 'shell',
		projectileSpeed: 7.5,
		score: 340
	},
	'scorpion-nest': {
		width: 1,
		height: 1,
		hp: 380,
		damage: 30,
		range: 4.2,
		reloadMs: 1100,
		splash: 0,
		targeting: 'weakest',
		score: 300
	},
	// Mines are not shot at and score nothing; their effect lives in MINES
	'mine-personnel': {
		width: 1,
		height: 1,
		hp: 40,
		damage: 0,
		range: 0,
		reloadMs: 0,
		splash: 0,
		score: 0
	},
	'mine-at': { width: 1, height: 1, hp: 40, damage: 0, range: 0, reloadMs: 0, splash: 0, score: 0 },
	'mine-emp': { width: 1, height: 1, hp: 40, damage: 0, range: 0, reloadMs: 0, splash: 0, score: 0 }
};

/** Vehicles take the full hit from anti-tank mines and shrug off personnel mines */
export const VEHICLE_TROOPS: readonly TroopKind[] = ['tank', 'apc', 'artillery'];

export interface MineStats {
	/** Which troops set the mine off by stepping on it */
	triggeredBy: 'infantry' | 'vehicle' | 'any';
	/** Distance in cells from the mine at which a troop sets it off */
	triggerRadius: number;
	/** Blast radius in cells */
	radius: number;
	/** Damage to the troops of the kind the mine is built for; others take the share below */
	damage: number;
	otherDamageShare: number;
	/** Milliseconds every troop in the blast is too shaken to move or shoot */
	stunMs: number;
}

export const MINES: Record<MineKind, MineStats> = {
	'mine-personnel': {
		triggeredBy: 'infantry',
		triggerRadius: 0.4,
		radius: 1.1,
		damage: 75,
		otherDamageShare: 0.15,
		stunMs: 350
	},
	'mine-at': {
		triggeredBy: 'vehicle',
		triggerRadius: 0.5,
		radius: 1.2,
		damage: 280,
		otherDamageShare: 0.1,
		stunMs: 500
	},
	'mine-emp': {
		triggeredBy: 'any',
		triggerRadius: 0.4,
		radius: 1.9,
		damage: 12,
		otherDamageShare: 1,
		stunMs: 2600
	}
};

/** The units the player can load into the landing craft */
export type TroopKind =
	| 'assault'
	| 'tank'
	| 'mortar'
	| 'drone'
	| 'medic'
	| 'hero'
	| 'artillery'
	| 'apc'
	| 'demo'
	| 'heavy'
	| 'azov';

/** Everything except the two heroes can be loaded into a boat; a hero always comes along */
export type ArmyKind = Exclude<TroopKind, 'hero' | 'azov'>;

export interface TroopStats {
	hp: number;
	damage: number;
	range: number;
	speed: number;
	attackMs: number;
	/** Boat space one unit takes; a hero takes none and lands with the first boat */
	space: number;
	/** Units with a projectile lob or launch it instead of hitting instantly */
	projectile?: ProjectileKind;
	projectileSpeed?: number;
	splash?: number;
	homing?: boolean;
	/** Grid cells a shot may land away from its aim point; big guns are not precise */
	scatter?: number;
	/** The M113 keeps a squad of reinforcements coming */
	spawnKind?: TroopKind;
	spawnEveryMs?: number;
	spawnCap?: number;
	/** Passive healing the unit gives the troops around it */
	healRadius?: number;
	healAmount?: number;
	healEveryMs?: number;
	/** The Azov commander's aura: nearby troops hit harder and walk faster */
	commandRadius?: number;
	/** Damage and speed bonus of the aura are fractions, filled in from the skill level */
	commandDamage?: number;
	commandSpeed?: number;
}

export const TROOPS: Record<TroopKind, TroopStats> = {
	assault: {
		hp: 100,
		damage: 16,
		range: 1.15,
		speed: 3,
		attackMs: 620,
		space: 1
	},
	tank: {
		hp: 520,
		damage: 55,
		range: 2.1,
		speed: 1.9,
		attackMs: 1400,
		space: 6,
		projectile: 'shell',
		projectileSpeed: 9,
		splash: 1
	},
	mortar: {
		hp: 130,
		damage: 50,
		range: 4.4,
		speed: 2.4,
		attackMs: 2400,
		space: 3,
		projectile: 'shell',
		projectileSpeed: 7.5,
		splash: 1.25
	},
	drone: {
		hp: 110,
		damage: 30,
		range: 3.4,
		speed: 3.2,
		attackMs: 1600,
		space: 2,
		projectile: 'drone',
		projectileSpeed: 11,
		homing: true
	},
	medic: {
		hp: 150,
		damage: 6,
		range: 1,
		speed: 2.8,
		attackMs: 1000,
		space: 2,
		healRadius: 1.9,
		healAmount: 9,
		healEveryMs: 900
	},
	hero: {
		hp: 700,
		damage: 70,
		range: 1.1,
		speed: 2.9,
		attackMs: 800,
		space: 0,
		// Prigozhin's hammer: a heavy swing, then a pulse that patches up everyone around him
		healRadius: 2.2,
		healAmount: 28,
		healEveryMs: 2400
	},
	artillery: {
		hp: 120,
		damage: 90,
		range: 5.2,
		speed: 1.8,
		attackMs: 3000,
		space: 4,
		// Devastating against a cluster, but the crew cannot hit the same spot twice
		projectile: 'shell',
		projectileSpeed: 7,
		splash: 1.7,
		scatter: 2
	},
	apc: {
		hp: 900,
		damage: 10,
		range: 1,
		speed: 1.6,
		attackMs: 1200,
		space: 5,
		// A rolling barracks: it drops a rifleman every few seconds while it survives
		spawnKind: 'assault',
		spawnEveryMs: 5000,
		spawnCap: 4
	},
	demo: {
		hp: 55,
		damage: 320,
		range: 0.85,
		speed: 3.6,
		attackMs: 1800,
		space: 2,
		// A heavy charge on a short fuse: enormous damage, almost no staying power
		projectile: 'shell',
		projectileSpeed: 13,
		splash: 1.2
	},
	heavy: {
		hp: 340,
		damage: 9,
		range: 1.5,
		speed: 1.7,
		attackMs: 110,
		space: 4
		// The minigun trades reach for a stream of bullets
	},
	azov: {
		hp: 820,
		damage: 74,
		range: 1.25,
		speed: 3.05,
		attackMs: 900,
		space: 0,
		// The Azov commander: no support call, but his command aura lifts the whole landing party
		commandRadius: 3
	}
};

/** The Azov commander's command aura, growing with the skill level */
export const AZOV_COMMAND = {
	radius: 3,
	/** Extra damage per skill level, as a fraction */
	damagePerLevel: 0.04,
	/** Extra movement speed per skill level, as a fraction */
	speedPerLevel: 0.02
} as const;

/** The assault soldier, also the default troop used by the physics and battle tests */
export const TROOP = {
	...TROOPS.assault,
	/** Troops stop short of a building they bump into and attack that instead */
	body: 0.18,
	/** Push from a nearby blast, in grid cells per second */
	knockback: 2.4,
	/** How quickly a pushed troop slows down; higher is snappier */
	drag: 7,
	/** Milliseconds a troop is too shaken to move or shoot after a blast */
	stunMs: 260,
	/** Milliseconds a muzzle flash stays visible */
	muzzleMs: 90
};

/** The eight landing craft; a boat carries more as it is upgraded */
export const BOAT_COUNT = 8;
/** Boat space by level; index 0 is unused */
export const BOAT_CAPACITY = [0, 6, 7, 8, 9, 10, 11, 12, 13] as const;
/** The first three boats are in the water from the start, one more per headquarters level */
export const STARTING_BOATS = 3;
export const MAX_BOAT_LEVEL = 8;
export const MAX_HQ_LEVEL = 8;
export const MAX_TRAINING_LEVEL = 8;
export const MAX_TROOP_LEVEL = 8;
export const MAX_WAREHOUSE_LEVEL = 6;
/** The hero dojo, and the hero and skill levels it unlocks */
export const MAX_DOJO_LEVEL = 6;
export const MAX_HERO_LEVEL = 6;
export const MAX_HERO_SKILL_LEVEL = 6;
/** A conquered base drops Azov commander cards at this low rate */
export const HERO_CARD_DROP_CHANCE = 0.1;
/** The radar tower starts by charting six islands and reveals three more per level */
export const MAX_RADAR_LEVEL = 8;
export const BASE_CHARTED_ISLANDS = 6;

/** The support skills the player can call in during an assault */
export type SkillId = 'flamingo' | 'barrage' | 'flare' | 'smoke' | 'heal';

export interface SkillStats {
	/** Grid cells around the aim point that are affected */
	radius: number;
	/** Damage each impact deals to every building it catches */
	damage: number;
	/** Milliseconds before the first impact, so the missile can be seen coming */
	delayMs: number;
	/** Extra impacts for a barrage and how far they scatter around the aim point */
	shells?: number;
	scatter?: number;
	/** How long a flare, smoke cloud or healing circle stays on the island */
	durationMs?: number;
	/** Health restored per second to troops inside a healing circle */
	healPerSecond?: number;
}

export const SKILLS: Record<SkillId, SkillStats> = {
	flamingo: { radius: 2.2, damage: 360, delayMs: 850 },
	barrage: { radius: 1.1, damage: 90, delayMs: 550, shells: 6, scatter: 1.5 },
	flare: { radius: 0.35, damage: 0, delayMs: 0, durationMs: 9000 },
	smoke: { radius: 2.3, damage: 0, delayMs: 0, durationMs: 9000 },
	heal: { radius: 2.2, damage: 0, delayMs: 0, durationMs: 7000, healPerSecond: 16 }
};

/** The support skills are trained at the training ground; every level makes them hit harder and last longer */
export const MAX_SUPPORT_SKILL_LEVEL = 6;
export const SUPPORT_SKILL_PER_LEVEL = {
	damage: 0.14,
	radius: 0.05,
	duration: 0.1,
	heal: 0.12
} as const;

/** A skill's tuning at a trained level; level one is the table above */
export function skillStatsAt(skill: SkillId, level: number): SkillStats {
	const base = SKILLS[skill];
	const steps = Math.max(0, Math.min(MAX_SUPPORT_SKILL_LEVEL, Math.round(level)) - 1);
	return {
		...base,
		radius: base.radius * (1 + SUPPORT_SKILL_PER_LEVEL.radius * steps),
		damage: Math.round(base.damage * (1 + SUPPORT_SKILL_PER_LEVEL.damage * steps)),
		durationMs:
			base.durationMs === undefined
				? undefined
				: Math.round(base.durationMs * (1 + SUPPORT_SKILL_PER_LEVEL.duration * steps)),
		healPerSecond:
			base.healPerSecond === undefined
				? undefined
				: base.healPerSecond * (1 + SUPPORT_SKILL_PER_LEVEL.heal * steps)
	};
}

/** Every skill use costs more than the last; destroyed buildings give a little energy back */
export const SKILL_ENERGY = {
	start: 150,
	baseCost: 30,
	costStep: 15,
	max: 300,
	rewardPerBuilding: 12
} as const;

export const SQUADS = 3;
export const TROOPS_PER_SQUAD = 4;

/** An attack ends in defeat when the headquarters still stands after this long */
export const ATTACK_TIME_LIMIT_MS = 3 * 60 * 1000;

/** Seconds an island is expected to take; beating it adds a small time bonus to the score */
export const PAR_SECONDS = 30;

export interface IslandBuilding {
	kind: BuildingKind;
	x: number;
	y: number;
}

export type IslandTheme = 'orc' | 'ice' | 'jungle' | 'desert';

export interface Island {
	id: string;
	/** Where the island lies decides how it looks and what defends it */
	theme?: IslandTheme;
	/** How icy the island is, 0 to 1; the further inland in the frozen north, the more */
	frost?: number;
	buildings: readonly IslandBuilding[];
}

/**
 * Six islands, easiest first. The headquarters sits inland on the right; tap a row on the beach to
 * land a squad on it. Every island adds a different defensive structure, from field cannons and
 * machine guns to mortars, drone nests, air defence batteries and flamethrowers.
 */
/** A small deterministic random sequence, so a generated island is the same on every device */
function sequence(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const THEME_GUNS: Record<'ice' | 'jungle' | 'desert', readonly BuildingKind[]> = {
	ice: ['ice-cannon', 'ice-spire'],
	jungle: ['dart-hut', 'totem'],
	desert: ['sand-mortar', 'scorpion-nest']
};
const COMMON_GUNS: readonly BuildingKind[] = [
	'field-cannon',
	'mortar',
	'sniper',
	'mg',
	'fpv-nest',
	'air-defence',
	'flame'
];
const MINE_ROTATION: readonly BuildingKind[] = ['mine-personnel', 'mine-at', 'mine-emp'];

/**
 * An island of a biome with a defence that fits it. Later steps carry more guns and mines, and the
 * themed defences always make up a good share of the guns.
 */
function generatedIsland(
	id: string,
	theme: 'ice' | 'jungle' | 'desert',
	step: number,
	seed: number
): Island {
	const random = sequence(seed);
	const hqY = 2 + (step % 3);
	const buildings: IslandBuilding[] = [{ kind: 'hq', x: 9, y: hqY }];
	// Free cells for the guns: the sand in front of the headquarters, shuffled by the island's seed
	const cells: { x: number; y: number }[] = [];
	for (let x = 4; x <= 8; x++) for (let y = 0; y < ROWS; y++) cells.push({ x, y });
	for (let index = cells.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[cells[index], cells[other]] = [cells[other], cells[index]];
	}
	const themed = THEME_GUNS[theme];
	const guns = 12 + Math.floor(step / 3);
	for (let gun = 0; gun < guns; gun++) {
		const cell = cells.pop();
		if (!cell) break;
		// Every third gun belongs to the biome; the rest is the usual mix
		const kind =
			gun % 3 === 0
				? themed[(gun / 3) % themed.length]
				: COMMON_GUNS[Math.floor(random() * COMMON_GUNS.length)];
		buildings.push({ kind, x: cell.x, y: cell.y });
	}
	for (let depot = 0; depot < 2; depot++) {
		const cell = cells.pop();
		if (cell) buildings.push({ kind: 'depot', x: cell.x, y: cell.y });
	}
	// Mines wait on the beach side, three kinds in rotation
	const mines = 3 + Math.floor(step / 2);
	const mineCells: { x: number; y: number }[] = [];
	for (let x = 3; x <= 3; x++) for (let y = 0; y < ROWS; y++) mineCells.push({ x, y });
	for (let mine = 0; mine < Math.min(mines, mineCells.length); mine++) {
		const cell = mineCells[(mine * 3 + step) % mineCells.length];
		if (buildings.some((b) => b.x === cell.x && b.y === cell.y)) continue;
		buildings.push({ kind: MINE_ROTATION[mine % MINE_ROTATION.length], x: cell.x, y: cell.y });
	}
	return { id, theme, buildings };
}

/** The first nine islands are drawn by hand; the rest are built from a theme and a step of difficulty */
const CORE_ISLANDS: readonly Island[] = [
	{
		id: 'palm-key',
		theme: 'jungle',
		buildings: [
			{ kind: 'dart-hut', x: 4, y: 6 },
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 6, y: 2 },
			{ kind: 'mg', x: 7, y: 5 },
			{ kind: 'depot', x: 5, y: 4 }
		]
	},
	{
		id: 'coral-battery',
		theme: 'desert',
		buildings: [
			{ kind: 'scorpion-nest', x: 6, y: 6 },
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 5, y: 2 },
			{ kind: 'sniper', x: 7, y: 5 },
			{ kind: 'mg', x: 4, y: 5 },
			{ kind: 'depot', x: 6, y: 4 },
			{ kind: 'mine-personnel', x: 3, y: 4 }
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
			{ kind: 'depot', x: 4, y: 3 },
			{ kind: 'mine-personnel', x: 3, y: 4 }
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
			{ kind: 'depot', x: 6, y: 6 },
			{ kind: 'mine-personnel', x: 3, y: 2 },
			{ kind: 'mine-personnel', x: 3, y: 5 }
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
			{ kind: 'depot', x: 7, y: 3 },
			{ kind: 'mine-at', x: 5, y: 3 },
			{ kind: 'mine-personnel', x: 3, y: 3 }
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
			{ kind: 'depot', x: 5, y: 5 },
			{ kind: 'mine-emp', x: 3, y: 3 },
			{ kind: 'mine-at', x: 6, y: 4 }
		]
	},
	{
		id: 'black-reef',
		theme: 'orc',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'catapult', x: 5, y: 1 },
			{ kind: 'field-cannon', x: 5, y: 5 },
			{ kind: 'mortar', x: 7, y: 1 },
			{ kind: 'ballista', x: 7, y: 6 },
			{ kind: 'sniper', x: 6, y: 3 },
			{ kind: 'mg', x: 8, y: 1 },
			{ kind: 'mg', x: 8, y: 6 },
			{ kind: 'fpv-nest', x: 4, y: 3 },
			{ kind: 'air-defence', x: 6, y: 0 },
			{ kind: 'flame', x: 10, y: 6 },
			{ kind: 'depot', x: 4, y: 6 },
			{ kind: 'mine-emp', x: 3, y: 3 },
			{ kind: 'mine-at', x: 6, y: 4 },
			{ kind: 'mine-personnel', x: 3, y: 5 }
		]
	},
	{
		id: 'iron-bay',
		theme: 'orc',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'field-cannon', x: 4, y: 1 },
			{ kind: 'catapult', x: 4, y: 5 },
			{ kind: 'mortar', x: 6, y: 1 },
			{ kind: 'catapult', x: 6, y: 6 },
			{ kind: 'ballista', x: 8, y: 0 },
			{ kind: 'sniper', x: 7, y: 3 },
			{ kind: 'mg', x: 8, y: 6 },
			{ kind: 'mg', x: 10, y: 6 },
			{ kind: 'fpv-nest', x: 5, y: 3 },
			{ kind: 'air-defence', x: 7, y: 0 },
			{ kind: 'flame', x: 8, y: 4 },
			{ kind: 'depot', x: 4, y: 3 },
			{ kind: 'mine-emp', x: 3, y: 2 },
			{ kind: 'mine-at', x: 5, y: 4 },
			{ kind: 'mine-personnel', x: 3, y: 5 }
		]
	},
	{
		id: 'dragons-teeth',
		theme: 'orc',
		buildings: [
			{ kind: 'hq', x: 9, y: 3 },
			{ kind: 'catapult', x: 4, y: 1 },
			{ kind: 'catapult', x: 4, y: 6 },
			{ kind: 'mortar', x: 6, y: 1 },
			{ kind: 'mortar', x: 6, y: 6 },
			{ kind: 'ballista', x: 8, y: 0 },
			{ kind: 'ballista', x: 7, y: 3 },
			{ kind: 'mg', x: 8, y: 6 },
			{ kind: 'mg', x: 10, y: 6 },
			{ kind: 'fpv-nest', x: 5, y: 3 },
			{ kind: 'air-defence', x: 7, y: 0 },
			{ kind: 'flame', x: 8, y: 4 },
			{ kind: 'flame', x: 10, y: 1 },
			{ kind: 'depot', x: 4, y: 3 },
			{ kind: 'depot', x: 6, y: 3 },
			{ kind: 'mine-emp', x: 3, y: 2 },
			{ kind: 'mine-at', x: 5, y: 4 },
			{ kind: 'mine-personnel', x: 3, y: 5 },
			{ kind: 'mine-personnel', x: 3, y: 3 }
		]
	}
];

/** Where each island sits on the sea chart, as a percentage of the chart's width and height */
export const ISLAND_MAP_POSITIONS: readonly { x: number; y: number }[] = [
	// Your own base sits in the middle of the chart, and the enemy bases ring it
	{ x: 30, y: 74 },
	{ x: 70, y: 76 },
	{ x: 16, y: 52 },
	{ x: 84, y: 54 },
	{ x: 32, y: 40 },
	{ x: 68, y: 40 },
	// The orc lands: a broad landmass along the north edge, each stronghold on its own headland
	{ x: 24, y: 17 },
	{ x: 50, y: 12 },
	{ x: 76, y: 17 },
	// The frozen north, around the orc lands
	{ x: 8, y: 30 },
	{ x: 38, y: 27 },
	{ x: 62, y: 27 },
	{ x: 92, y: 30 },
	{ x: 36, y: 6 },
	{ x: 64, y: 6 },
	// The jungle in the south-west
	{ x: 10, y: 74 },
	{ x: 20, y: 90 },
	{ x: 42, y: 88 },
	{ x: 8, y: 60 },
	{ x: 40, y: 66 },
	// The desert in the south-east
	{ x: 90, y: 78 },
	{ x: 62, y: 90 },
	{ x: 80, y: 66 },
	{ x: 94, y: 56 },
	{ x: 82, y: 92 }
];

/** Where your own base lies on the sea chart, as a percentage of its width and height */
export const HOME_MAP_POSITION = { x: 50, y: 58 } as const;

/** The landmass of the orc lands: where the islands from this index on stand */
export const ORC_LANDS_FROM_INDEX = 6;

const EXTRA_THEMES: readonly ('ice' | 'jungle' | 'desert')[] = [
	...Array.from({ length: 6 }, () => 'ice' as const),
	...Array.from({ length: 5 }, () => 'jungle' as const),
	...Array.from({ length: 5 }, () => 'desert' as const)
];
const EXTRA_NAMES: Record<'ice' | 'jungle' | 'desert', string> = {
	ice: 'frostbite',
	jungle: 'jungle-key',
	desert: 'dune-outpost'
};

const EXTRA_ISLANDS: readonly Island[] = EXTRA_THEMES.map((theme, index) =>
	generatedIsland(`${EXTRA_NAMES[theme]}-${index + 1}`, theme, index, 7919 * (index + 3))
);

/** The north gets icier the further inland an island lies: orc and frozen islands carry a frost value */
function withFrost(island: Island, index: number): Island {
	if (island.theme !== 'orc' && island.theme !== 'ice') return island;
	const y = ISLAND_MAP_POSITIONS[index]?.y ?? 50;
	const frost = Math.max(0, Math.min(1, (34 - y) / 30));
	return {
		...island,
		frost: Math.round(Math.max(island.theme === 'ice' ? 0.55 : 0.1, frost) * 100) / 100
	};
}

export const ISLANDS: readonly Island[] = [...CORE_ISLANDS, ...EXTRA_ISLANDS].map(withFrost);

export const ISLAND_IDS: readonly string[] = ISLANDS.map((island) => island.id);

/** Total landing party of one attack */
export const LANDING_PARTY = SQUADS * TROOPS_PER_SQUAD;

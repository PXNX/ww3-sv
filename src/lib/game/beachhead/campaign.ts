/*
 * Beachhead campaign: the shore base, its buildings and the islands under the player's control.
 * Everything here is stored locally and calculated from plain numbers, so the economy can be
 * tested without a browser. Controlled islands produce wood, stone, iron and gold; those resources
 * pay for headquarters, training ground and landing-craft levels, for troop training and for the
 * army that fills the boats. Upgrades run on a builder for a while, one build at a time (two for
 * Pro subscribers). A boat carries a fixed number of troop spaces and every unit takes a different
 * amount, so the loadout is a small packing puzzle.
 */
import {
	AZOV_COMMAND,
	BASE_CHARTED_ISLANDS,
	BOAT_CAPACITY,
	BOAT_COUNT,
	HERO_CARD_DROP_CHANCE,
	ISLAND_IDS,
	MAX_BOAT_LEVEL,
	MAX_DOJO_LEVEL,
	MAX_HERO_LEVEL,
	MAX_HERO_SKILL_LEVEL,
	MAX_HQ_LEVEL,
	MAX_RADAR_LEVEL,
	MAX_SUPPORT_SKILL_LEVEL,
	MAX_TRAINING_LEVEL,
	MAX_TROOP_LEVEL,
	MAX_WAREHOUSE_LEVEL,
	STARTING_BOATS,
	TROOPS,
	type ArmyKind,
	type Island,
	type MineKind,
	type SkillId,
	type TroopKind
} from './config.js';
import type { BattleModifiers, SquadTroop } from './battle.js';
import {
	MINE_COST,
	addMine,
	defaultLayout,
	isLayoutKey,
	mineRefund,
	moveBuilding,
	moveMine,
	normalizeLayout,
	removeMine,
	type BaseLayout,
	type Cell
} from './baseLayout.js';

export const SAVE_KEY = 'beachhead:save';
export const SAVE_VERSION = 6;
/** Longer absences stop earning at this point, so a save cannot grow forever */
export const INCOME_CAP_MS = 8 * 60 * 60 * 1000;
/** One controlled island is lost to the enemy on this rhythm */
export const TAKEBACK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Each capture hardens an island by this much, up to the cap below */
export const FORTIFY_PER_CAPTURE = 0.2;
export const MAX_FORTIFY_BONUS = 2;
/** A very old save cannot trigger thousands of takebacks in one visit */
const MAX_TAKEBACK_STEPS = 500;

export type ResourceKind = 'wood' | 'stone' | 'iron' | 'gold';
export type Resources = Record<ResourceKind, number>;
export const RESOURCE_KINDS: readonly ResourceKind[] = ['wood', 'stone', 'iron', 'gold'];

/** Every resource has two warehouses, and each of them can be leveled up on its own */
export const WAREHOUSES_PER_RESOURCE = 2;
/** A stockpile starts here and every warehouse level adds room for more */
export const STORAGE_BASE = 0;
export const STORAGE_PER_LEVEL = 500;

export type BoatKey = `boat-${number}`;
export type WarehouseKey = `warehouse-${ResourceKind}-${number}`;
export type BuildingKey = 'hq' | 'training' | 'radar' | 'dojo' | BoatKey | WarehouseKey;
export type Army = Record<ArmyKind, number>;
export type TroopLevels = Record<TroopKind, number>;

/** The Azov commander: his own level, his command skill and the cards found on conquered bases */
export interface HeroState {
	level: number;
	skill: number;
	cards: number;
}

export const BOAT_KEYS: readonly BoatKey[] = Array.from(
	{ length: BOAT_COUNT },
	(_, index) => `boat-${index}` as BoatKey
);
export const WAREHOUSE_KEYS: readonly WarehouseKey[] = RESOURCE_KINDS.flatMap((kind) =>
	Array.from(
		{ length: WAREHOUSES_PER_RESOURCE },
		(_, index) => `warehouse-${kind}-${index}` as WarehouseKey
	)
);
export const BUILDING_KEYS: readonly BuildingKey[] = [
	'hq',
	'training',
	'radar',
	'dojo',
	...BOAT_KEYS,
	...WAREHOUSE_KEYS
];

export const STARTING_RESOURCES: Resources = { wood: 300, stone: 220, iron: 100, gold: 30 };
/** What the home shore produces per minute on its own: the forest's logs, the mountain's ore and a trickle of gold; the islands add their own lines */
export const HOME_PRODUCTION: Resources = { wood: 3, stone: 0, iron: 1, gold: 1 };
/** What each island adds to the tax income once controlled, in units per minute */
const HAND_MADE_PRODUCTION: readonly Resources[] = [
	{ wood: 2, stone: 1, iron: 0, gold: 0 },
	{ wood: 2, stone: 1, iron: 1, gold: 0 },
	{ wood: 3, stone: 2, iron: 1, gold: 0 },
	{ wood: 2, stone: 2, iron: 2, gold: 1 },
	{ wood: 3, stone: 3, iron: 3, gold: 1 },
	{ wood: 3, stone: 3, iron: 3, gold: 2 },
	{ wood: 4, stone: 3, iron: 4, gold: 2 },
	{ wood: 4, stone: 4, iron: 5, gold: 3 },
	{ wood: 5, stone: 5, iron: 6, gold: 4 }
];
/** Later islands pay a little more than the last, so the far ends of the chart are worth the trip */
export const ISLAND_PRODUCTION: readonly Resources[] = [
	...HAND_MADE_PRODUCTION,
	...Array.from({ length: 24 }, (_, step): Resources => {
		const last = HAND_MADE_PRODUCTION[HAND_MADE_PRODUCTION.length - 1];
		const growth = 1 + (step + 1) * 0.08;
		return {
			wood: Math.round(last.wood * growth),
			stone: Math.round(last.stone * growth),
			iron: Math.round(last.iron * growth),
			gold: Math.round(last.gold * growth)
		};
	})
];
/** Troop kinds the player loads into boats; the heroes always come along and take no space */
export const ARMY_KINDS: readonly ArmyKind[] = [
	'assault',
	'tank',
	'mortar',
	'drone',
	'medic',
	'artillery',
	'apc',
	'demo',
	'heavy'
];

export interface Levels {
	hq: number;
	training: number;
	/** Radar tower level; each level charts one more island on the sea map */
	radar: number;
	/** Hero dojo level; it caps both the Azov commander's level and his skill level */
	dojo: number;
	/** One level per landing craft, in boarding order */
	boats: number[];
	/** One level per warehouse, in the order of WAREHOUSE_KEYS */
	warehouses: number[];
}

export interface IslandControl {
	/** Best star rating, 0 while never taken */
	stars: number;
	controlled: boolean;
	/** How often the island has been captured; every capture hardens its defences */
	captures: number;
}

/** A building upgrade that is running on a builder */
export interface BuildTask {
	key: BuildingKey;
	startedAt: number;
	endsAt: number;
}

export interface CareerStats {
	wins: number;
	threeStarWins: number;
	winsWithoutSkills: number;
	heroWins: number;
}

export interface BeachheadSave {
	version: 6;
	resources: Resources;
	levels: Levels;
	/** The Azov commander and the cards to upgrade him */
	hero: HeroState;
	troops: TroopLevels;
	army: Army;
	islands: Record<string, IslandControl>;
	/** Building upgrades on the builders right now */
	builders: BuildTask[];
	/** Ids of the Beachhead achievements already paid out */
	achievements: string[];
	stats: CareerStats;
	/** Unix milliseconds of the last income tick */
	lastIncomeMs: number;
	/** Unix milliseconds of the last enemy takeback check */
	lastTakebackMs: number;
	/** Where the buildings and mines stand on the home island; saves from before the grid have none */
	layout?: BaseLayout;
	/** Troops killed in attacks that still wait to be retrained with gold; older saves have none */
	lost?: Partial<Army>;
	/** Training level of the support skills; a skill missing here is at level one */
	skillLevels?: Partial<Record<SkillId, number>>;
}

/** Cost of the first upgrade of each building family; each later level grows by a factor */
const BUILDING_BASE_COST: Record<
	'hq' | 'training' | 'radar' | 'dojo' | 'boat' | 'warehouse',
	Resources
> = {
	hq: { wood: 320, stone: 240, iron: 100, gold: 20 },
	training: { wood: 180, stone: 120, iron: 40, gold: 8 },
	radar: { wood: 280, stone: 220, iron: 120, gold: 24 },
	dojo: { wood: 640, stone: 520, iron: 280, gold: 80 },
	boat: { wood: 100, stone: 60, iron: 20, gold: 4 },
	warehouse: { wood: 140, stone: 100, iron: 30, gold: 4 }
};
const BUILDING_COST_GROWTH = 1.55;

const TROOP_BASE_COST: Record<TroopKind, Resources> = {
	assault: { wood: 50, stone: 30, iron: 15, gold: 3 },
	tank: { wood: 120, stone: 80, iron: 50, gold: 8 },
	mortar: { wood: 90, stone: 60, iron: 35, gold: 6 },
	drone: { wood: 80, stone: 50, iron: 40, gold: 6 },
	medic: { wood: 100, stone: 70, iron: 30, gold: 5 },
	hero: { wood: 140, stone: 100, iron: 60, gold: 12 },
	artillery: { wood: 130, stone: 90, iron: 55, gold: 9 },
	apc: { wood: 150, stone: 110, iron: 70, gold: 10 },
	demo: { wood: 70, stone: 45, iron: 55, gold: 5 },
	heavy: { wood: 120, stone: 85, iron: 65, gold: 8 },
	azov: { wood: 500, stone: 420, iron: 260, gold: 80 }
};

/** The Azov commander is paid for in cards as well as resources, and he is not cheap */
const HERO_COST_GROWTH = 1.75;
const SKILL_COST_GROWTH = 1.7;

/** The army of a fresh base: a full first wave of riflemen */
const STARTING_ARMY: Army = {
	assault: 18,
	tank: 0,
	mortar: 0,
	drone: 0,
	medic: 0,
	artillery: 0,
	apc: 0,
	demo: 0,
	heavy: 0
};

/** A full troop-level record, with level one for every kind the game knows */
function defaultTroopLevels(): TroopLevels {
	return Object.fromEntries(Object.keys(TROOPS).map((kind) => [kind, 1])) as TroopLevels;
}

/** Both warehouses of every resource exist from the start, at level one */
function defaultWarehouseLevels(): number[] {
	return Array.from({ length: WAREHOUSE_KEYS.length }, () => 1);
}

/** Fills in troop kinds an older save did not know about */
function fillArmy(army: Partial<Army>): Army {
	return Object.fromEntries(
		ARMY_KINDS.map((kind) => [
			kind,
			Number.isInteger(army[kind]) && (army[kind] as number) >= 0 ? (army[kind] as number) : 0
		])
	) as Army;
}

function fillTroopLevels(levels: Partial<TroopLevels>): TroopLevels {
	return Object.fromEntries(
		(Object.keys(TROOPS) as TroopKind[]).map((kind) => {
			const level = levels[kind];
			return [kind, Number.isInteger(level) && (level as number) >= 1 ? level : 1];
		})
	) as TroopLevels;
}
const TROOP_COST_GROWTH = 1.5;

/** How long a building upgrade runs, before the level growth */
const BUILD_BASE_MS: Record<'hq' | 'training' | 'radar' | 'dojo' | 'boat' | 'warehouse', number> = {
	hq: 150_000,
	training: 100_000,
	radar: 125_000,
	dojo: 225_000,
	boat: 50_000,
	warehouse: 60_000
};
const BUILD_TIME_GROWTH = 1.45;

export function newSave(nowMs: number): BeachheadSave {
	return {
		version: SAVE_VERSION,
		resources: { ...STARTING_RESOURCES },
		levels: {
			hq: 1,
			training: 1,
			radar: 1,
			dojo: 1,
			boats: Array.from({ length: BOAT_COUNT }, () => 1),
			warehouses: defaultWarehouseLevels()
		},
		hero: { level: 1, skill: 1, cards: 0 },
		troops: defaultTroopLevels(),
		army: { ...STARTING_ARMY },
		islands: {},
		builders: [],
		achievements: [],
		stats: { wins: 0, threeStarWins: 0, winsWithoutSkills: 0, heroWins: 0 },
		lastIncomeMs: nowMs,
		lastTakebackMs: nowMs
	};
}

function resourceCost(base: Resources, factor: number): Resources {
	return {
		wood: Math.max(1, Math.round(base.wood * factor)),
		stone: Math.max(1, Math.round(base.stone * factor)),
		iron: Math.max(1, Math.round(base.iron * factor)),
		gold: Math.max(1, Math.round(base.gold * factor))
	};
}

function buildingFamily(
	key: BuildingKey
): 'hq' | 'training' | 'radar' | 'dojo' | 'boat' | 'warehouse' {
	if (key === 'hq' || key === 'training' || key === 'radar' || key === 'dojo') return key;
	if (key.startsWith('warehouse-')) return 'warehouse';
	return 'boat';
}

/** How many boats are in the water at this headquarters level */
export function boatsAtHq(hq: number): number {
	return Math.min(BOAT_COUNT, STARTING_BOATS + Math.max(0, hq - 1));
}

export function boatUnlocked(save: BeachheadSave, index: number): boolean {
	return index >= 0 && index < boatsAtHq(save.levels.hq) && lookupBoatLevel(save, index) !== null;
}

function lookupBoatLevel(save: BeachheadSave, index: number): number | null {
	return save.levels.boats[index] ?? null;
}

export function boatCapacity(level: number): number {
	return BOAT_CAPACITY[Math.min(MAX_BOAT_LEVEL, Math.max(1, level))] ?? 0;
}

export function levelOf(save: BeachheadSave, key: BuildingKey): number {
	if (key === 'hq') return save.levels.hq;
	if (key === 'training') return save.levels.training;
	if (key === 'radar') return save.levels.radar;
	if (key === 'dojo') return save.levels.dojo;
	if (key.startsWith('warehouse-')) {
		const index = WAREHOUSE_KEYS.indexOf(key as WarehouseKey);
		return index >= 0 ? (save.levels.warehouses[index] ?? 1) : 1;
	}
	return lookupBoatLevel(save, Number(key.slice('boat-'.length))) ?? 1;
}

export function maxLevelOf(key: BuildingKey): number {
	if (key === 'hq') return MAX_HQ_LEVEL;
	if (key === 'training') return MAX_TRAINING_LEVEL;
	if (key === 'radar') return MAX_RADAR_LEVEL;
	if (key === 'dojo') return MAX_DOJO_LEVEL;
	if (key.startsWith('warehouse-')) return MAX_WAREHOUSE_LEVEL;
	return MAX_BOAT_LEVEL;
}

/** The resource a warehouse key belongs to */
export function warehouseResource(key: WarehouseKey): ResourceKind {
	const resource = key.split('-')[1];
	return RESOURCE_KINDS.includes(resource as ResourceKind) ? (resource as ResourceKind) : 'wood';
}

/** The zero-based number of a warehouse within its resource, for labels */
export function warehouseIndex(key: WarehouseKey): number {
	const index = WAREHOUSE_KEYS.indexOf(key);
	return index < 0 ? 0 : index % WAREHOUSES_PER_RESOURCE;
}

/** The cost of the next level, or null when the building is already maxed out */
export function upgradeCost(save: BeachheadSave, key: BuildingKey): Resources | null {
	const level = levelOf(save, key);
	if (level >= maxLevelOf(key)) return null;
	return resourceCost(
		BUILDING_BASE_COST[buildingFamily(key)],
		Math.pow(BUILDING_COST_GROWTH, level - 1)
	);
}

/** Training, radar and boats can outgrow the headquarters by one level, as in a base builder */
export function upgradeLocked(save: BeachheadSave, key: BuildingKey): boolean {
	if (key === 'hq') return false;
	if (key.startsWith('boat-')) {
		const index = Number(key.slice('boat-'.length));
		if (!boatUnlocked(save, index)) return true;
	}
	return levelOf(save, key) + 1 > Math.min(maxLevelOf(key), save.levels.hq + 1);
}

/** How much of one resource the stockpile holds: the base plus every warehouse level of that kind */
export function storageCapacity(save: BeachheadSave, kind: ResourceKind): number {
	let levels = 0;
	for (const key of WAREHOUSE_KEYS) {
		if (warehouseResource(key) === kind) levels += levelOf(save, key);
	}
	return STORAGE_BASE + levels * STORAGE_PER_LEVEL;
}

export function storageCapacities(save: BeachheadSave): Resources {
	return {
		wood: storageCapacity(save, 'wood'),
		stone: storageCapacity(save, 'stone'),
		iron: storageCapacity(save, 'iron'),
		gold: storageCapacity(save, 'gold')
	};
}

export function isStorageFull(save: BeachheadSave, kind: ResourceKind): boolean {
	return save.resources[kind] >= storageCapacity(save, kind);
}

export function canAfford(save: BeachheadSave, cost: Resources): boolean {
	return RESOURCE_KINDS.every((kind) => save.resources[kind] >= cost[kind]);
}

export function canUpgrade(save: BeachheadSave, key: BuildingKey): boolean {
	const cost = upgradeCost(save, key);
	return cost !== null && !upgradeLocked(save, key) && canAfford(save, cost);
}

function payResources(resources: Resources, cost: Resources): Resources {
	return {
		wood: resources.wood - cost.wood,
		stone: resources.stone - cost.stone,
		iron: resources.iron - cost.iron,
		gold: resources.gold - cost.gold
	};
}

/** How long the next level of a building takes on a builder */
export function buildDurationMs(key: BuildingKey, level: number): number {
	const family = buildingFamily(key);
	return Math.round(BUILD_BASE_MS[family] * Math.pow(BUILD_TIME_GROWTH, Math.max(0, level - 1)));
}

export function constructionOf(save: BeachheadSave, key: BuildingKey): BuildTask | undefined {
	return save.builders.find((task) => task.key === key);
}

/** One builder from the start; a Pro subscription runs a second one in parallel */
export function builderSlots(pro: boolean): number {
	return pro ? 2 : 1;
}

export function freeBuilderSlots(save: BeachheadSave, slots: number): number {
	return Math.max(0, slots - save.builders.length);
}

/**
 * Starts a level on a builder. Null when the upgrade is locked, already running, unaffordable or
 * every builder is busy. The resources are taken at once, as in a base builder.
 */
export function startUpgrade(
	save: BeachheadSave,
	key: BuildingKey,
	nowMs: number,
	slots: number
): BeachheadSave | null {
	if (!Number.isFinite(nowMs) || save.builders.length >= slots) return null;
	if (constructionOf(save, key)) return null;
	const cost = upgradeCost(save, key);
	if (!cost || upgradeLocked(save, key) || !canAfford(save, cost)) return null;
	const endsAt = nowMs + buildDurationMs(key, levelOf(save, key));
	return {
		...save,
		resources: payResources(save.resources, cost),
		builders: [...save.builders, { key, startedAt: nowMs, endsAt }]
	};
}

function withBuildingLevel(save: BeachheadSave, key: BuildingKey): BeachheadSave {
	if (key === 'hq') {
		return { ...save, levels: { ...save.levels, hq: Math.min(MAX_HQ_LEVEL, save.levels.hq + 1) } };
	}
	if (key === 'training') {
		return {
			...save,
			levels: {
				...save.levels,
				training: Math.min(MAX_TRAINING_LEVEL, save.levels.training + 1)
			}
		};
	}
	if (key === 'radar') {
		return {
			...save,
			levels: { ...save.levels, radar: Math.min(MAX_RADAR_LEVEL, save.levels.radar + 1) }
		};
	}
	if (key === 'dojo') {
		return {
			...save,
			levels: { ...save.levels, dojo: Math.min(MAX_DOJO_LEVEL, save.levels.dojo + 1) }
		};
	}
	if (key.startsWith('warehouse-')) {
		const index = WAREHOUSE_KEYS.indexOf(key as WarehouseKey);
		const warehouses = save.levels.warehouses.map((level, warehouse) =>
			warehouse === index ? Math.min(MAX_WAREHOUSE_LEVEL, level + 1) : level
		);
		return { ...save, levels: { ...save.levels, warehouses } };
	}
	const index = Number(key.slice('boat-'.length));
	const boats = save.levels.boats.map((level, boat) =>
		boat === index ? Math.min(MAX_BOAT_LEVEL, level + 1) : level
	);
	return { ...save, levels: { ...save.levels, boats } };
}

/** Finishes every build whose time is up; returns the same save when nothing was done */
export function finishBuilds(save: BeachheadSave, nowMs: number): BeachheadSave {
	const done = save.builders.filter((task) => nowMs >= task.endsAt);
	if (done.length === 0) return save;
	let next: BeachheadSave = {
		...save,
		builders: save.builders.filter((task) => nowMs < task.endsAt)
	};
	for (const task of done) next = withBuildingLevel(next, task.key);
	return next;
}

/** Total troop space the landing party can use with every unlocked boat */
export function armyCapacity(save: BeachheadSave): number {
	return save.levels.boats.reduce(
		(sum, level, index) => sum + (boatUnlocked(save, index) ? boatCapacity(level) : 0),
		0
	);
}

export function armySpace(army: Army): number {
	return ARMY_KINDS.reduce((sum, kind) => sum + army[kind] * TROOPS[kind].space, 0);
}

export function usedArmySpace(save: BeachheadSave): number {
	return armySpace(save.army);
}

/** Adds or removes units; adding is refused when the boats have no space left */
export function changeTroop(save: BeachheadSave, kind: ArmyKind, delta: number): BeachheadSave {
	if (!ARMY_KINDS.includes(kind) || !Number.isFinite(delta) || delta === 0) return save;
	const current = save.army[kind];
	const next = Math.max(0, Math.round(current + delta));
	if (next === current) return save;
	if (delta > 0) {
		const extra = (next - current) * TROOPS[kind].space;
		if (usedArmySpace(save) + extra > armyCapacity(save)) return save;
	}
	return { ...save, army: { ...save.army, [kind]: next } };
}

/** What retraining one unit costs, in gold; the bigger the unit, the more it takes */
export const RETRAIN_GOLD: Record<ArmyKind, number> = {
	assault: 1,
	demo: 2,
	medic: 3,
	mortar: 3,
	drone: 3,
	heavy: 4,
	artillery: 5,
	tank: 6,
	apc: 8
};

/** A few volunteers turn up when a base has no troops and no gold, so a bad day is never the end */
const VOLUNTEERS = 4;

export function retrainCost(kind: ArmyKind): Resources {
	return { wood: 0, stone: 0, iron: 0, gold: RETRAIN_GOLD[kind] };
}

/** The troops killed in attacks and not yet retrained, with a zero for every kind */
export function lostOf(save: BeachheadSave): Army {
	return fillArmy(save.lost ?? {});
}

export function lostCount(save: BeachheadSave): number {
	return ARMY_KINDS.reduce((sum, kind) => sum + lostOf(save)[kind], 0);
}

/**
 * Takes the troops an attack killed out of the army and lists them as lost. They come back only by
 * retraining them with gold. Heroes and troops an APC dropped on the beach cost nothing.
 */
export function applyCasualties(
	save: BeachheadSave,
	casualties: Partial<Record<TroopKind, number>>
): BeachheadSave {
	const army = { ...save.army };
	const lost = lostOf(save);
	let any = false;
	for (const kind of ARMY_KINDS) {
		const dead = Math.min(army[kind], Math.max(0, Math.floor(casualties[kind] ?? 0)));
		if (dead <= 0) continue;
		army[kind] -= dead;
		lost[kind] += dead;
		any = true;
	}
	if (!any) return save;
	let next: BeachheadSave = { ...save, army, lost };
	// Nobody left to send and no gold to train anyone: a handful of volunteers fill the first boat
	if (usedArmySpace(next) === 0 && next.resources.gold < RETRAIN_GOLD.assault) {
		const room = Math.floor(armyCapacity(next) / TROOPS.assault.space);
		next = { ...next, army: { ...army, assault: Math.min(VOLUNTEERS, room) } };
	}
	return next;
}

/** Trains one unit for gold when the boats have room; a unit that was lost comes off the lost list */
export function recruitTroop(save: BeachheadSave, kind: ArmyKind): BeachheadSave | null {
	if (!ARMY_KINDS.includes(kind)) return null;
	const cost = retrainCost(kind);
	if (!canAfford(save, cost)) return null;
	const added = changeTroop(save, kind, 1);
	if (added === save) return null;
	const lost = lostOf(save);
	lost[kind] = Math.max(0, lost[kind] - 1);
	return { ...added, resources: payResources(save.resources, cost), lost };
}

/** Sends a unit home again; the gold comes back, so a misclick costs nothing */
export function dismissTroop(save: BeachheadSave, kind: ArmyKind): BeachheadSave | null {
	const removed = changeTroop(save, kind, -1);
	if (removed === save) return null;
	return addResources(removed, retrainCost(kind));
}

/** Retrains every lost unit it can pay for and fit, cheapest first so the most men come back */
export function retrainAll(save: BeachheadSave): BeachheadSave {
	let next = save;
	const order = [...ARMY_KINDS].sort((a, b) => RETRAIN_GOLD[a] - RETRAIN_GOLD[b]);
	for (const kind of order) {
		while (lostOf(next)[kind] > 0) {
			const trained = recruitTroop(next, kind);
			if (!trained) break;
			next = trained;
		}
	}
	return next;
}

/** The gold it takes to bring every lost unit back */
export function retrainAllCost(save: BeachheadSave): number {
	const lost = lostOf(save);
	return ARMY_KINDS.reduce((sum, kind) => sum + lost[kind] * RETRAIN_GOLD[kind], 0);
}

/** The support skills the training ground can improve, in the order of the skill bar */
export const SUPPORT_SKILLS: readonly SkillId[] = ['flamingo', 'barrage', 'flare', 'smoke', 'heal'];

const SKILL_BASE_COST: Record<SkillId, Resources> = {
	flamingo: { wood: 220, stone: 160, iron: 120, gold: 16 },
	barrage: { wood: 200, stone: 150, iron: 140, gold: 14 },
	flare: { wood: 120, stone: 90, iron: 50, gold: 8 },
	smoke: { wood: 130, stone: 100, iron: 60, gold: 8 },
	heal: { wood: 180, stone: 130, iron: 90, gold: 14 }
};
const SKILL_COST_FACTOR = 1.6;

export function supportSkillLevel(save: BeachheadSave, skill: SkillId): number {
	const level = save.skillLevels?.[skill];
	return Number.isInteger(level) && (level as number) >= 1
		? Math.min(MAX_SUPPORT_SKILL_LEVEL, level as number)
		: 1;
}

/** The cost of the next level of a support skill, or null at the top */
export function supportSkillCost(save: BeachheadSave, skill: SkillId): Resources | null {
	const level = supportSkillLevel(save, skill);
	if (level >= MAX_SUPPORT_SKILL_LEVEL) return null;
	return resourceCost(SKILL_BASE_COST[skill], Math.pow(SKILL_COST_FACTOR, level - 1));
}

/** A skill cannot be trained past the level of the training ground */
export function supportSkillLocked(save: BeachheadSave, skill: SkillId): boolean {
	return supportSkillLevel(save, skill) + 1 > save.levels.training;
}

export function canUpgradeSupportSkill(save: BeachheadSave, skill: SkillId): boolean {
	const cost = supportSkillCost(save, skill);
	return cost !== null && !supportSkillLocked(save, skill) && canAfford(save, cost);
}

export function applySupportSkillUpgrade(save: BeachheadSave, skill: SkillId): BeachheadSave {
	const cost = supportSkillCost(save, skill);
	if (!cost || supportSkillLocked(save, skill) || !canAfford(save, cost)) return save;
	return {
		...save,
		resources: payResources(save.resources, cost),
		skillLevels: { ...save.skillLevels, [skill]: supportSkillLevel(save, skill) + 1 }
	};
}

export function troopLevel(save: BeachheadSave, kind: TroopKind): number {
	// The Azov commander grows through his cards, not through the training ground
	if (kind === 'azov') return save.hero.level;
	return save.troops[kind] ?? 1;
}

/** Training ground level gates troop levels: a troop can never be better trained than the ground */
export function troopUpgradeLocked(save: BeachheadSave, kind: TroopKind): boolean {
	if (kind === 'azov') return true;
	return troopLevel(save, kind) >= Math.min(MAX_TROOP_LEVEL, save.levels.training);
}

export function troopUpgradeCost(save: BeachheadSave, kind: TroopKind): Resources | null {
	if (kind === 'azov') return null;
	const level = troopLevel(save, kind);
	if (level >= MAX_TROOP_LEVEL) return null;
	return resourceCost(TROOP_BASE_COST[kind], Math.pow(TROOP_COST_GROWTH, level - 1));
}

export function canUpgradeTroop(save: BeachheadSave, kind: TroopKind): boolean {
	const cost = troopUpgradeCost(save, kind);
	return cost !== null && !troopUpgradeLocked(save, kind) && canAfford(save, cost);
}

/** Troop training happens at the ground and is paid at once; it is not a builder job */
export function applyTroopUpgrade(save: BeachheadSave, kind: TroopKind): BeachheadSave {
	if (!canUpgradeTroop(save, kind)) return save;
	const cost = troopUpgradeCost(save, kind) as Resources;
	return {
		...save,
		resources: payResources(save.resources, cost),
		troops: { ...save.troops, [kind]: troopLevel(save, kind) + 1 }
	};
}

/** Troop stats at a level: every level adds health and damage */
export function troopStatsForLevel(kind: TroopKind, level: number) {
	const base = TROOPS[kind];
	const steps = Math.max(0, Math.min(MAX_TROOP_LEVEL, level) - 1);
	return {
		...base,
		hp: Math.round(base.hp * (1 + 0.16 * steps)),
		damage: Math.round(base.damage * (1 + 0.14 * steps))
	};
}

export function troopStats(save: BeachheadSave, kind: TroopKind) {
	return troopStatsForLevel(kind, troopLevel(save, kind));
}

/** The command aura the Azov commander brings, growing with his skill level */
export interface CommandAura {
	radius: number;
	/** Fraction of extra damage for nearby troops */
	damage: number;
	/** Fraction of extra movement speed for nearby troops */
	speed: number;
}

export function azovCommand(save: BeachheadSave): CommandAura {
	const skill = Math.max(1, Math.min(MAX_HERO_SKILL_LEVEL, save.hero.skill));
	return {
		radius: AZOV_COMMAND.radius,
		damage: AZOV_COMMAND.damagePerLevel * skill,
		speed: AZOV_COMMAND.speedPerLevel * skill
	};
}

/** How many cards the next hero level costs, or null when he is maxed out */
export function heroCardCost(save: BeachheadSave): number | null {
	const level = save.hero.level;
	if (level >= MAX_HERO_LEVEL) return null;
	return level;
}

/** The hero can never grow past the dojo that trains him */
export function heroUpgradeLocked(save: BeachheadSave): boolean {
	return save.hero.level >= Math.min(MAX_HERO_LEVEL, save.levels.dojo);
}

export function heroUpgradeCost(save: BeachheadSave): Resources | null {
	const level = save.hero.level;
	if (level >= MAX_HERO_LEVEL) return null;
	return resourceCost(TROOP_BASE_COST.azov, Math.pow(HERO_COST_GROWTH, level - 1));
}

export function canUpgradeHero(save: BeachheadSave): boolean {
	const cost = heroUpgradeCost(save);
	const cards = heroCardCost(save);
	return (
		cost !== null &&
		cards !== null &&
		!heroUpgradeLocked(save) &&
		save.hero.cards >= cards &&
		canAfford(save, cost)
	);
}

/** Spends the resources and the cards at once and raises the commander by one level */
export function applyHeroUpgrade(save: BeachheadSave): BeachheadSave {
	if (!canUpgradeHero(save)) return save;
	const cost = heroUpgradeCost(save) as Resources;
	const cards = heroCardCost(save) as number;
	return {
		...save,
		resources: payResources(save.resources, cost),
		hero: { ...save.hero, level: save.hero.level + 1, cards: save.hero.cards - cards }
	};
}

/** The command skill is gated by the same dojo as the hero himself */
export function skillUpgradeLocked(save: BeachheadSave): boolean {
	return save.hero.skill >= Math.min(MAX_HERO_SKILL_LEVEL, save.levels.dojo);
}

export function skillUpgradeCost(save: BeachheadSave): Resources | null {
	const level = save.hero.skill;
	if (level >= MAX_HERO_SKILL_LEVEL) return null;
	return resourceCost(TROOP_BASE_COST.azov, Math.pow(SKILL_COST_GROWTH, level - 1) * 0.7);
}

export function skillCardCost(save: BeachheadSave): number | null {
	const level = save.hero.skill;
	if (level >= MAX_HERO_SKILL_LEVEL) return null;
	return Math.max(1, level - 1);
}

export function canUpgradeSkill(save: BeachheadSave): boolean {
	const cost = skillUpgradeCost(save);
	const cards = skillCardCost(save);
	return (
		cost !== null &&
		cards !== null &&
		!skillUpgradeLocked(save) &&
		save.hero.cards >= cards &&
		canAfford(save, cost)
	);
}

export function applySkillUpgrade(save: BeachheadSave): BeachheadSave {
	if (!canUpgradeSkill(save)) return save;
	const cost = skillUpgradeCost(save) as Resources;
	const cards = skillCardCost(save) as number;
	return {
		...save,
		resources: payResources(save.resources, cost),
		hero: { ...save.hero, skill: save.hero.skill + 1, cards: save.hero.cards - cards }
	};
}

/** Adds the cards found on a conquered base */
export function grantHeroCards(save: BeachheadSave, count: number): BeachheadSave {
	const gained = Math.max(0, Math.floor(count));
	if (gained === 0) return save;
	return { ...save, hero: { ...save.hero, cards: save.hero.cards + gained } };
}

/** How many cards a victory drops: usually none, rarely one and very rarely two */
export function heroCardsForRoll(roll: number): number {
	const safe = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 1;
	if (safe < HERO_CARD_DROP_CHANCE * 0.2) return 2;
	if (safe < HERO_CARD_DROP_CHANCE) return 1;
	return 0;
}

/** Every conquest drops hero shards: one at least, more on the far islands and sometimes a bonus one */
export function shardsForWin(islandIndex: number, roll: number): number {
	const safe = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 1;
	return 1 + Math.floor(Math.max(0, islandIndex) / 6) + (safe < 0.3 ? 1 : 0);
}

/** Boats in boarding order with their capacity and the units packed into them */
export interface BoatLoad {
	index: number;
	level: number;
	capacity: number;
	unlocked: boolean;
	units: TroopKind[];
}

function packArmy(save: BeachheadSave): BoatLoad[] {
	const remaining: Army = { ...save.army };
	// Big units first, so a tank is never squeezed out by a crowd of assault soldiers
	const order: Exclude<TroopKind, 'hero'>[] = [
		'tank',
		'apc',
		'artillery',
		'heavy',
		'mortar',
		'drone',
		'demo',
		'medic',
		'assault'
	];
	return save.levels.boats.map((level, index) => {
		const capacity = boatCapacity(level);
		const unlocked = boatUnlocked(save, index);
		const units: TroopKind[] = [];
		if (unlocked) {
			let space = capacity;
			for (const kind of order) {
				while (remaining[kind] > 0 && space >= TROOPS[kind].space) {
					units.push(kind);
					remaining[kind] -= 1;
					space -= TROOPS[kind].space;
				}
			}
		}
		return { index, level, capacity, unlocked, units };
	});
}

export function boatLoads(save: BeachheadSave): BoatLoad[] {
	return packArmy(save);
}

function squadSpec(save: BeachheadSave, kind: TroopKind): SquadTroop {
	const stats = troopStats(save, kind);
	const command = kind === 'azov' ? azovCommand(save) : null;
	return {
		kind,
		hp: stats.hp,
		damage: stats.damage,
		range: stats.range,
		speed: stats.speed,
		attackMs: stats.attackMs,
		projectile: stats.projectile,
		projectileSpeed: stats.projectileSpeed,
		splash: stats.splash,
		homing: stats.homing,
		scatter: stats.scatter,
		spawnKind: stats.spawnKind,
		spawnEveryMs: stats.spawnEveryMs,
		spawnCap: stats.spawnCap,
		healRadius: stats.healRadius,
		healAmount: stats.healAmount,
		healEveryMs: stats.healEveryMs,
		commandRadius: command?.radius,
		commandDamage: command?.damage,
		commandSpeed: command?.speed
	};
}

/** The squads in the order they land: one per non-empty boat, with both heroes on the first */
export function landingPlan(save: BeachheadSave): SquadTroop[][] {
	const squads: SquadTroop[][] = [];
	for (const load of packArmy(save)) {
		if (load.units.length === 0) continue;
		squads.push(load.units.map((kind) => squadSpec(save, kind)));
	}
	const heroes = [squadSpec(save, 'hero'), squadSpec(save, 'azov')];
	if (squads.length === 0) squads.push(heroes);
	else squads[0].push(...heroes);
	return squads;
}

/** How much harder an island's guns hit and how much more health they have after captures */
export function fortificationScale(captures: number): number {
	const safe = Number.isFinite(captures) ? Math.max(0, Math.floor(captures)) : 0;
	return 1 + Math.min(MAX_FORTIFY_BONUS, FORTIFY_PER_CAPTURE * safe);
}

/** What the shore-base upgrades and the army change about the landing party */
export function modifiersFor(save: BeachheadSave, islandId?: string): BattleModifiers {
	return {
		squads: landingPlan(save),
		defenseScale: islandId ? fortificationScale(islandControl(save, islandId).captures) : 1,
		skillLevels: Object.fromEntries(SUPPORT_SKILLS.map((id) => [id, supportSkillLevel(save, id)]))
	};
}

/** Every island has been captured at least twice, so each one has been retaken after a takeback */
export function allIslandsPerfect(save: BeachheadSave): boolean {
	return ISLAND_IDS.every((islandId) => capturesOf(save, islandId) >= 2);
}

/** Headquarters, radar tower, training ground, dojo, every boat and every warehouse at the top */
export function baseFullyMaxed(save: BeachheadSave): boolean {
	return (
		save.levels.hq >= MAX_HQ_LEVEL &&
		save.levels.training >= MAX_TRAINING_LEVEL &&
		save.levels.radar >= MAX_RADAR_LEVEL &&
		save.levels.dojo >= MAX_DOJO_LEVEL &&
		save.levels.boats.every((level) => level >= MAX_BOAT_LEVEL) &&
		save.levels.warehouses.every((level) => level >= MAX_WAREHOUSE_LEVEL)
	);
}

export interface BeachheadAchievement {
	id: string;
	/** Fake News paid into the career wallet */
	coins: number;
	check(save: BeachheadSave): boolean;
}

/** Achievements, easiest first; the last two also unlock a cosmetic cap in the avatar editor */
export const ACHIEVEMENTS: readonly BeachheadAchievement[] = [
	{
		id: 'first-landing',
		coins: 25,
		check: (save) => controlledCount(save, ISLAND_IDS) >= 1
	},
	{
		id: 'archipelago',
		coins: 100,
		check: (save) => controlledCount(save, ISLAND_IDS) >= ISLAND_IDS.length
	},
	{
		id: 'armada',
		coins: 50,
		check: (save) => boatsAtHq(save.levels.hq) >= BOAT_COUNT
	},
	{
		id: 'veteran',
		coins: 50,
		check: (save) => save.stats.wins >= 10
	},
	{
		id: 'no-support',
		coins: 75,
		check: (save) => save.stats.winsWithoutSkills >= 1
	},
	{
		id: 'heroic',
		coins: 75,
		check: (save) => save.stats.heroWins >= 1
	},
	{
		id: 'top-hq',
		coins: 125,
		check: (save) => save.levels.hq >= MAX_HQ_LEVEL
	},
	{
		id: 'all-stars',
		coins: 250,
		check: allIslandsPerfect
	},
	{
		id: 'fortress',
		coins: 350,
		check: baseFullyMaxed
	}
];

export function achievementById(id: string): BeachheadAchievement | undefined {
	return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

export interface AchievementPayout {
	save: BeachheadSave;
	earned: string[];
	coins: number;
}

/** Marks every newly reached achievement and totals the Fake News it pays */
export function claimAchievements(save: BeachheadSave): AchievementPayout {
	const earned = ACHIEVEMENTS.filter(
		(achievement) => !save.achievements.includes(achievement.id) && achievement.check(save)
	);
	if (earned.length === 0) return { save, earned: [], coins: 0 };
	return {
		save: {
			...save,
			achievements: [...save.achievements, ...earned.map((achievement) => achievement.id)]
		},
		earned: earned.map((achievement) => achievement.id),
		coins: earned.reduce((sum, achievement) => sum + achievement.coins, 0)
	};
}

/** Counts a battle result, used by the victory achievements */
export function recordVictory(
	save: BeachheadSave,
	result: { stars: number; skillsUsed: number; heroAlive: boolean }
): BeachheadSave {
	return {
		...save,
		stats: {
			wins: save.stats.wins + 1,
			threeStarWins: save.stats.threeStarWins + (result.stars >= 3 ? 1 : 0),
			winsWithoutSkills: save.stats.winsWithoutSkills + (result.skillsUsed === 0 ? 1 : 0),
			heroWins: save.stats.heroWins + (result.heroAlive ? 1 : 0)
		}
	};
}

/** A win pays loot; taking an island for the first time pays a bonus on top */
export const REPLAY_LOOT = 15;
export function lootFor(index: number, firstControl: boolean): Resources {
	const scale = 1 + index * 0.35 + (firstControl ? 0.5 : 0);
	return {
		wood: Math.round(40 * scale),
		stone: Math.round(25 * scale),
		iron: Math.round(12 * scale),
		gold: Math.round(6 * scale)
	};
}

function isLevel(value: unknown, max: number): value is number {
	return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
}

function isIslandControl(value: unknown): value is IslandControl {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<IslandControl>;
	return (
		typeof candidate.controlled === 'boolean' &&
		Number.isInteger(candidate.stars) &&
		(candidate.stars as number) >= 0 &&
		(candidate.stars as number) <= 3 &&
		Number.isInteger(candidate.captures) &&
		(candidate.captures as number) >= 0 &&
		(!candidate.controlled || (candidate.stars as number) >= 1)
	);
}

function isIslands(value: unknown): value is Record<string, IslandControl> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every(isIslandControl)
	);
}

function isResources(value: unknown): value is Resources {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<Resources>;
	return RESOURCE_KINDS.every(
		(kind) =>
			typeof candidate[kind] === 'number' &&
			Number.isFinite(candidate[kind]) &&
			candidate[kind]! >= 0
	);
}

function isBuildTask(value: unknown): value is BuildTask {
	if (typeof value !== 'object' || value === null) return false;
	const task = value as Partial<BuildTask>;
	return (
		typeof task.key === 'string' &&
		BUILDING_KEYS.includes(task.key as BuildingKey) &&
		typeof task.startedAt === 'number' &&
		Number.isFinite(task.startedAt) &&
		typeof task.endsAt === 'number' &&
		Number.isFinite(task.endsAt) &&
		task.endsAt >= task.startedAt
	);
}

function isStats(value: unknown): value is CareerStats {
	if (typeof value !== 'object' || value === null) return false;
	const stats = value as Partial<CareerStats>;
	return (
		Number.isInteger(stats.wins) &&
		stats.wins! >= 0 &&
		Number.isInteger(stats.threeStarWins) &&
		stats.threeStarWins! >= 0 &&
		Number.isInteger(stats.winsWithoutSkills) &&
		stats.winsWithoutSkills! >= 0 &&
		Number.isInteger(stats.heroWins) &&
		stats.heroWins! >= 0
	);
}

export function isBeachheadSave(value: unknown): value is BeachheadSave {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<BeachheadSave>;
	if (candidate.version !== SAVE_VERSION) return false;
	if (!isResources(candidate.resources)) return false;
	if (
		typeof candidate.lastIncomeMs !== 'number' ||
		!Number.isFinite(candidate.lastIncomeMs) ||
		candidate.lastIncomeMs < 0
	) {
		return false;
	}
	if (
		typeof candidate.lastTakebackMs !== 'number' ||
		!Number.isFinite(candidate.lastTakebackMs) ||
		candidate.lastTakebackMs < 0
	) {
		return false;
	}
	const levels = candidate.levels;
	if (typeof levels !== 'object' || levels === null) return false;
	if (
		!isLevel(levels.hq, MAX_HQ_LEVEL) ||
		!isLevel(levels.training, MAX_TRAINING_LEVEL) ||
		!isLevel(levels.radar, MAX_RADAR_LEVEL) ||
		!isLevel(levels.dojo, MAX_DOJO_LEVEL)
	) {
		return false;
	}
	if (
		!Array.isArray(levels.boats) ||
		levels.boats.length !== BOAT_COUNT ||
		!levels.boats.every((level) => isLevel(level, MAX_BOAT_LEVEL))
	) {
		return false;
	}
	if (
		!Array.isArray(levels.warehouses) ||
		levels.warehouses.length !== WAREHOUSE_KEYS.length ||
		!levels.warehouses.every((level) => isLevel(level, MAX_WAREHOUSE_LEVEL))
	) {
		return false;
	}
	const troops = candidate.troops;
	if (typeof troops !== 'object' || troops === null) return false;
	if (
		!(Object.keys(TROOPS) as TroopKind[]).every((kind) => isLevel(troops[kind], MAX_TROOP_LEVEL))
	) {
		return false;
	}
	const hero = candidate.hero;
	if (typeof hero !== 'object' || hero === null) return false;
	if (
		!isLevel(hero.level, MAX_HERO_LEVEL) ||
		!isLevel(hero.skill, MAX_HERO_SKILL_LEVEL) ||
		!Number.isInteger(hero.cards) ||
		hero.cards < 0
	) {
		return false;
	}
	const army = candidate.army;
	if (typeof army !== 'object' || army === null) return false;
	if (!ARMY_KINDS.every((kind) => Number.isInteger(army[kind]) && army[kind] >= 0)) return false;
	if (!Array.isArray(candidate.builders) || !candidate.builders.every(isBuildTask)) return false;
	if (
		!Array.isArray(candidate.achievements) ||
		!candidate.achievements.every((id) => typeof id === 'string')
	) {
		return false;
	}
	if (!isStats(candidate.stats)) return false;
	return isIslands(candidate.islands);
}

interface LegacyUpgrades {
	hq: number;
	troops: number;
	landing: number;
}

interface LegacyLevels {
	hq: number;
	training: number;
	radar?: number;
	dojo?: number;
	boats: number[];
	warehouses?: number[];
}

interface LegacyIslandControl {
	stars: number;
	controlled: boolean;
	captures?: number;
}

interface LegacySave {
	version: 1 | 2;
	supplies: number;
	upgrades?: LegacyUpgrades;
	levels?: LegacyLevels;
	troops?: TroopLevels;
	army?: Army;
	islands: Record<string, LegacyIslandControl>;
	lastIncomeMs: number;
}

function isLegacyIslandControl(value: unknown): value is LegacyIslandControl {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<LegacyIslandControl>;
	return (
		typeof candidate.controlled === 'boolean' &&
		Number.isInteger(candidate.stars) &&
		(candidate.stars as number) >= 0 &&
		(candidate.stars as number) <= 3 &&
		(!candidate.controlled || (candidate.stars as number) >= 1) &&
		(candidate.captures === undefined ||
			(Number.isInteger(candidate.captures) && candidate.captures >= 0))
	);
}

function isLegacyIslands(value: unknown): value is Record<string, LegacyIslandControl> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every(isLegacyIslandControl)
	);
}

/** Older saves had no capture count; a controlled island counts as one capture */
function normalizeIslands(
	islands: Record<string, LegacyIslandControl>
): Record<string, IslandControl> {
	return Object.fromEntries(
		Object.entries(islands).map(([islandId, control]) => [
			islandId,
			{
				stars: control.stars,
				controlled: control.controlled,
				captures:
					control.captures !== undefined
						? control.captures
						: control.controlled
							? 1
							: control.stars > 0
								? 1
								: 0
			}
		])
	);
}

function isLegacySave(value: unknown): value is LegacySave {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<LegacySave>;
	if (candidate.version !== 1 && candidate.version !== 2) return false;
	return (
		typeof candidate.supplies === 'number' &&
		Number.isFinite(candidate.supplies) &&
		candidate.supplies >= 0 &&
		typeof candidate.lastIncomeMs === 'number' &&
		Number.isFinite(candidate.lastIncomeMs) &&
		candidate.lastIncomeMs >= 0 &&
		isLegacyIslands(candidate.islands)
	);
}

/** The old single supply stock becomes the four resources, in a sensible split */
function resourcesFromSupplies(supplies: number): Resources {
	return {
		wood: Math.round(supplies),
		stone: Math.round(supplies * 0.6),
		iron: Math.round(supplies * 0.3),
		gold: Math.round(supplies * 0.1)
	};
}

/** Every save starts with the commander at level one, no cards and the first skill */
function defaultHero(): HeroState {
	return { level: 1, skill: 1, cards: 0 };
}

/** Version 3 knows the economy but not the radar tower, takebacks or capture counts */
function upgradeV3Save(value: unknown): BeachheadSave | null {
	if (typeof value !== 'object' || value === null) return null;
	const candidate = value as Record<string, unknown>;
	if (candidate.version !== 3) return null;
	const levels = candidate.levels;
	const islands = candidate.islands;
	const lastIncomeMs = candidate.lastIncomeMs;
	if (typeof levels !== 'object' || levels === null) return null;
	if (!isLegacyIslands(islands)) return null;
	if (typeof lastIncomeMs !== 'number' || !Number.isFinite(lastIncomeMs)) return null;
	const prepared = {
		...candidate,
		version: SAVE_VERSION,
		levels: { ...levels, radar: 1, dojo: 1, warehouses: defaultWarehouseLevels() },
		hero: defaultHero(),
		islands: normalizeIslands(islands),
		lastTakebackMs: lastIncomeMs
	};
	return isBeachheadSave(prepared) ? prepared : null;
}

/** Version 4 has the radar and takebacks but still only one warehouse per resource */
function upgradeV4Save(value: unknown): BeachheadSave | null {
	if (typeof value !== 'object' || value === null) return null;
	const candidate = value as Record<string, unknown>;
	if (candidate.version !== 4) return null;
	const levels = candidate.levels;
	if (typeof levels !== 'object' || levels === null) return null;
	const prepared = {
		...candidate,
		version: SAVE_VERSION,
		levels: { ...levels, dojo: 1, warehouses: defaultWarehouseLevels() },
		hero: defaultHero()
	};
	return isBeachheadSave(prepared) ? prepared : null;
}

/** Version 5 has multiple warehouses but no dojo, hero or hero cards yet */
function upgradeV5Save(value: unknown): BeachheadSave | null {
	if (typeof value !== 'object' || value === null) return null;
	const candidate = value as Record<string, unknown>;
	if (candidate.version !== 5) return null;
	const levels = candidate.levels;
	if (typeof levels !== 'object' || levels === null) return null;
	const prepared = {
		...candidate,
		version: SAVE_VERSION,
		levels: { ...levels, dojo: 1 },
		hero: defaultHero()
	};
	return isBeachheadSave(prepared) ? prepared : null;
}

/**
 * Reads a stored save, upgrading the single-supply versions (three abstract upgrades, then the
 * first building-level save), the version-3 economy save, the version-4 save and the version-5
 * warehouse save to the hero dojo and the Azov commander.
 */
export function parseSave(value: unknown): BeachheadSave | null {
	const parsed = parseSaveVersions(value);
	if (!parsed) return parsed;
	// Nothing can be stored beyond what the warehouses hold, whatever an older save says
	const capacities = storageCapacities(parsed);
	const resources: Resources = {
		wood: Math.min(parsed.resources.wood, capacities.wood),
		stone: Math.min(parsed.resources.stone, capacities.stone),
		iron: Math.min(parsed.resources.iron, capacities.iron),
		gold: Math.min(parsed.resources.gold, capacities.gold)
	};
	const next = { ...parsed, resources };
	return next.layout === undefined ? next : { ...next, layout: normalizeLayout(next.layout) };
}

function parseSaveVersions(value: unknown): BeachheadSave | null {
	if (isBeachheadSave(value)) return value;
	const upgradedV5 = upgradeV5Save(value);
	if (upgradedV5) return upgradedV5;
	const upgradedV4 = upgradeV4Save(value);
	if (upgradedV4) return upgradedV4;
	const upgradedV3 = upgradeV3Save(value);
	if (upgradedV3) return upgradedV3;
	if (!isLegacySave(value)) return null;
	const legacy = value;
	const levels: Levels =
		legacy.version === 2 && legacy.levels
			? {
					hq: legacy.levels.hq,
					training: legacy.levels.training,
					radar: legacy.levels.radar ?? 1,
					dojo: legacy.levels.dojo ?? 1,
					boats: [...legacy.levels.boats],
					warehouses: defaultWarehouseLevels()
				}
			: {
					hq: legacy.upgrades?.hq ?? 1,
					training: legacy.upgrades?.troops ?? 1,
					radar: 1,
					dojo: 1,
					boats: Array.from({ length: BOAT_COUNT }, (_, index) =>
						index < STARTING_BOATS ? (legacy.upgrades?.landing ?? 1) : 1
					),
					warehouses: defaultWarehouseLevels()
				};
	const troops: TroopLevels =
		legacy.version === 2 && legacy.troops ? fillTroopLevels(legacy.troops) : defaultTroopLevels();
	const army: Army =
		legacy.version === 2 && legacy.army ? fillArmy(legacy.army) : { ...STARTING_ARMY };
	const save: BeachheadSave = {
		version: SAVE_VERSION,
		resources: resourcesFromSupplies(legacy.supplies),
		levels,
		hero: defaultHero(),
		troops,
		army,
		islands: normalizeIslands(legacy.islands),
		builders: [],
		achievements: [],
		stats: { wins: 0, threeStarWins: 0, winsWithoutSkills: 0, heroWins: 0 },
		lastIncomeMs: legacy.lastIncomeMs,
		lastTakebackMs: legacy.lastIncomeMs
	};
	// Never load an army that no boat could carry
	if (usedArmySpace(save) > armyCapacity(save)) {
		return { ...save, army: { ...STARTING_ARMY, assault: armyCapacity(save) } };
	}
	return save;
}

/** The island grid of a save, with the default arrangement for saves from before it existed */
export function layoutOf(save: BeachheadSave): BaseLayout {
	return save.layout ?? defaultLayout();
}

/** Moves a building on the home island grid; null when the spot is taken, off the grid or unchanged */
export function moveBuildingTo(
	save: BeachheadSave,
	key: BuildingKey,
	cell: Cell
): BeachheadSave | null {
	if (!isLayoutKey(key)) return null;
	const layout = moveBuilding(layoutOf(save), key, cell);
	return layout ? { ...save, layout } : null;
}

export function canAffordMine(save: BeachheadSave, kind: MineKind): boolean {
	return canAfford(save, MINE_COST[kind]);
}

/** Buys a mine and puts it on the first free cell; null when unaffordable or the island is full */
export function buyMine(save: BeachheadSave, kind: MineKind): BeachheadSave | null {
	if (!canAffordMine(save, kind)) return null;
	const layout = addMine(layoutOf(save), kind);
	if (!layout) return null;
	return { ...save, resources: payResources(save.resources, MINE_COST[kind]), layout };
}

export function moveMineTo(save: BeachheadSave, id: number, cell: Cell): BeachheadSave | null {
	const layout = moveMine(layoutOf(save), id, cell);
	return layout ? { ...save, layout } : null;
}

/** Takes a mine away again and pays half of it back, up to what the warehouses can hold */
export function sellMine(save: BeachheadSave, id: number): BeachheadSave | null {
	const mine = layoutOf(save).mines.find((candidate) => candidate.id === id);
	const layout = mine ? removeMine(layoutOf(save), id) : null;
	if (!mine || !layout) return null;
	const refund = mineRefund(mine.kind);
	const refunded = addResources(save, refund);
	return { ...refunded, layout };
}

export function islandControl(save: BeachheadSave, islandId: string): IslandControl {
	return save.islands[islandId] ?? { stars: 0, controlled: false, captures: 0 };
}

export function starsOf(save: BeachheadSave, islandId: string): number {
	return islandControl(save, islandId).stars;
}

export function capturesOf(save: BeachheadSave, islandId: string): number {
	return islandControl(save, islandId).captures;
}

export function isControlled(save: BeachheadSave, islandId: string): boolean {
	return islandControl(save, islandId).controlled;
}

/** The island has been taken at least once, even if the enemy has since retaken it */
export function everCaptured(save: BeachheadSave, islandId: string): boolean {
	const control = islandControl(save, islandId);
	return control.stars > 0 || control.captures > 0;
}

/** How many islands the radar tower has charted on the sea map */
export function chartedCount(save: BeachheadSave, total: number = ISLAND_IDS.length): number {
	return Math.min(total, BASE_CHARTED_ISLANDS + (save.levels.radar - 1) * 3);
}

export function isCharted(save: BeachheadSave, index: number): boolean {
	return index >= 0 && index < chartedCount(save);
}

/**
 * The first island is always open. Every other island must be charted by the radar tower and
 * the island before it must have been captured at least once; a takeback does not relock it.
 */
export function isUnlocked(
	save: BeachheadSave,
	islandIds: readonly string[],
	index: number
): boolean {
	if (index < 0 || index >= islandIds.length) return false;
	if (index === 0) return true;
	return isCharted(save, index) && everCaptured(save, islandIds[index - 1]);
}

export function controlledCount(save: BeachheadSave, islandIds: readonly string[]): number {
	return islandIds.filter((islandId) => isControlled(save, islandId)).length;
}

export function totalStars(save: BeachheadSave, islandIds: readonly string[]): number {
	return islandIds.reduce((sum, islandId) => sum + starsOf(save, islandId), 0);
}

/** One island's own production line, with the headquarters bonus applied */
export function islandProduction(save: BeachheadSave, index: number): Resources {
	const line = ISLAND_PRODUCTION[index] ?? { wood: 0, stone: 0, iron: 0, gold: 0 };
	const multiplier = 1 + 0.25 * (save.levels.hq - 1);
	return {
		wood: Math.round(line.wood * multiplier * 10) / 10,
		stone: Math.round(line.stone * multiplier * 10) / 10,
		iron: Math.round(line.iron * multiplier * 10) / 10,
		gold: Math.round(line.gold * multiplier * 10) / 10
	};
}

/** Production per minute: the home shore plus every controlled island, raised by the headquarters */
export function incomeRate(save: BeachheadSave, islandIds: readonly string[]): Resources {
	const total: Resources = { ...HOME_PRODUCTION };
	for (const [index, islandId] of islandIds.entries()) {
		if (!isControlled(save, islandId)) continue;
		const production = ISLAND_PRODUCTION[index];
		if (!production) continue;
		for (const kind of RESOURCE_KINDS) total[kind] += production[kind];
	}
	const multiplier = 1 + 0.25 * (save.levels.hq - 1);
	return {
		wood: Math.round(total.wood * multiplier * 10) / 10,
		stone: Math.round(total.stone * multiplier * 10) / 10,
		iron: Math.round(total.iron * multiplier * 10) / 10,
		gold: Math.round(total.gold * multiplier * 10) / 10
	};
}

/** The approximate worth of a resource, for sorting and for the loot line */
export const RESOURCE_VALUE: Record<ResourceKind, number> = {
	wood: 1,
	stone: 1.5,
	iron: 3,
	gold: 8
};

export function resourcesWorth(resources: Resources): number {
	return RESOURCE_KINDS.reduce((sum, kind) => sum + resources[kind] * RESOURCE_VALUE[kind], 0);
}

/**
 * Adds the resources earned since the last tick. Whole minutes are banked and the rest is left for
 * the next visit, so opening and closing the base repeatedly cannot round up extra income.
 */
export function claimIncome(
	save: BeachheadSave,
	islandIds: readonly string[],
	nowMs: number
): BeachheadSave {
	if (!Number.isFinite(nowMs) || nowMs <= save.lastIncomeMs) return save;
	const elapsed = nowMs - save.lastIncomeMs;
	const capped = Math.min(INCOME_CAP_MS, elapsed);
	const minutes = Math.floor(capped / 60_000);
	if (minutes <= 0) return save;
	const rate = incomeRate(save, islandIds);
	const capacities = storageCapacities(save);
	const stock = (kind: ResourceKind, gain: number): number =>
		save.resources[kind] >= capacities[kind]
			? save.resources[kind]
			: Math.min(capacities[kind], save.resources[kind] + gain);
	const resources: Resources = {
		wood: stock('wood', Math.floor(rate.wood * minutes)),
		stone: stock('stone', Math.floor(rate.stone * minutes)),
		iron: stock('iron', Math.floor(rate.iron * minutes)),
		gold: stock('gold', Math.floor(rate.gold * minutes))
	};
	return {
		...save,
		resources,
		// An absence longer than the cap is paid once; the clock then jumps to now, so calling
		// this again at the same moment cannot bank the capped hours a second time.
		lastIncomeMs: elapsed > INCOME_CAP_MS ? nowMs : save.lastIncomeMs + minutes * 60_000
	};
}

export function addResources(save: BeachheadSave, loot: Resources): BeachheadSave {
	const capacities = storageCapacities(save);
	const stock = (kind: ResourceKind, gain: number): number =>
		save.resources[kind] >= capacities[kind]
			? save.resources[kind]
			: Math.min(capacities[kind], save.resources[kind] + Math.max(0, Math.floor(gain)));
	const resources: Resources = {
		wood: stock('wood', loot.wood),
		stone: stock('stone', loot.stone),
		iron: stock('iron', loot.iron),
		gold: stock('gold', loot.gold)
	};
	return { ...save, resources };
}

/** Marks an island controlled, keeping the better star rating and counting the capture */
export function controlIsland(save: BeachheadSave, islandId: string, stars: number): BeachheadSave {
	const previous = islandControl(save, islandId);
	const best = Math.min(3, Math.max(1, Math.round(stars)));
	return {
		...save,
		islands: {
			...save.islands,
			[islandId]: {
				stars: Math.max(previous.stars, best),
				controlled: true,
				captures: previous.captures + 1
			}
		}
	};
}

export interface TakebackResult {
	save: BeachheadSave;
	/** Islands the enemy retook during this check, oldest first */
	lost: string[];
}

/**
 * The enemy retakes one random controlled island every six hours. Captures and stars stay, so
 * progression stays open and the island can be stormed again with its hardened defences.
 */
export function processTakebacks(
	save: BeachheadSave,
	islandIds: readonly string[],
	nowMs: number,
	random: () => number = Math.random
): TakebackResult {
	if (!Number.isFinite(nowMs) || nowMs <= save.lastTakebackMs) return { save, lost: [] };
	const intervals = Math.min(
		MAX_TAKEBACK_STEPS,
		Math.floor((nowMs - save.lastTakebackMs) / TAKEBACK_INTERVAL_MS)
	);
	if (intervals <= 0) return { save, lost: [] };

	let islands = save.islands;
	let lost: string[] = [];
	for (let step = 0; step < intervals; step++) {
		const held = islandIds.filter((islandId) => isControlled({ ...save, islands }, islandId));
		if (held.length === 0) break;
		const pick = Math.min(held.length - 1, Math.max(0, Math.floor(random() * held.length)));
		const islandId = held[pick];
		islands = {
			...islands,
			[islandId]: { ...islandControl({ ...save, islands }, islandId), controlled: false }
		};
		lost = [...lost, islandId];
	}
	return {
		save: {
			...save,
			islands,
			lastTakebackMs: save.lastTakebackMs + intervals * TAKEBACK_INTERVAL_MS
		},
		lost
	};
}

/** The island the map should offer next, for a "take the fight onwards" button */
export function nextIsland(save: BeachheadSave, islands: readonly Island[]): Island | null {
	for (const [index, island] of islands.entries()) {
		if (isUnlocked(save, ISLAND_IDS, index) && !isControlled(save, island.id)) return island;
	}
	return null;
}

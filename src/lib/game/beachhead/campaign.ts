/*
 * Beachhead campaign: the shore base, its upgrades and the islands under the player's control.
 * Everything here is stored locally and calculated from plain numbers, so the economy can be
 * tested without a browser. Controlled islands add their production to the tax income; supplies
 * are spent on the headquarters, troop training and bigger landing craft.
 */
import { ISLAND_IDS, TROOP, TROOPS_PER_SQUAD, type Island } from './config.js';
import type { BattleModifiers } from './battle.js';

export const SAVE_KEY = 'beachhead:save';
export const STARTING_SUPPLIES = 100;
/** Supplies per minute from the home shore, before the islands and the headquarters bonus */
export const HOME_INCOME_PER_MIN = 1;
/** Longer absences stop earning at this point, so a save cannot grow forever */
export const INCOME_CAP_MS = 8 * 60 * 60 * 1000;

/** What each island adds to the tax income once controlled, in supplies per minute */
export const ISLAND_INCOME = [2, 3, 4, 5, 6, 8] as const;

export type UpgradeKey = 'hq' | 'troops' | 'landing';

export interface Upgrades {
	hq: number;
	troops: number;
	landing: number;
}

export interface IslandControl {
	/** Best star rating, 0 while never taken */
	stars: number;
	controlled: boolean;
}

export interface BeachheadSave {
	version: 1;
	supplies: number;
	upgrades: Upgrades;
	islands: Record<string, IslandControl>;
	/** Unix milliseconds of the last income tick */
	lastIncomeMs: number;
}

export const MAX_UPGRADE: Record<UpgradeKey, number> = { hq: 5, troops: 5, landing: 4 };

/** Cost to go from the current level to the next; index 0 is unused */
export const UPGRADE_COSTS: Record<UpgradeKey, readonly number[]> = {
	hq: [0, 250, 600, 1200, 2200],
	troops: [0, 90, 220, 480, 900],
	landing: [0, 180, 420, 850]
};

/** A win pays loot; taking an island for the first time pays a bonus on top */
export const REPLAY_LOOT = 15;
export function lootFor(index: number, firstControl: boolean): number {
	return 60 + index * 25 + (firstControl ? 40 : 0);
}

export function newSave(nowMs: number): BeachheadSave {
	return {
		version: 1,
		supplies: STARTING_SUPPLIES,
		upgrades: { hq: 1, troops: 1, landing: 1 },
		islands: {},
		lastIncomeMs: nowMs
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
		(!candidate.controlled || (candidate.stars as number) >= 1)
	);
}

export function isBeachheadSave(value: unknown): value is BeachheadSave {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<BeachheadSave>;
	if (candidate.version !== 1) return false;
	if (
		typeof candidate.supplies !== 'number' ||
		!Number.isFinite(candidate.supplies) ||
		candidate.supplies < 0
	) {
		return false;
	}
	if (
		typeof candidate.lastIncomeMs !== 'number' ||
		!Number.isFinite(candidate.lastIncomeMs) ||
		candidate.lastIncomeMs < 0
	) {
		return false;
	}
	const upgrades = candidate.upgrades;
	if (typeof upgrades !== 'object' || upgrades === null) return false;
	if (
		!isLevel(upgrades.hq, MAX_UPGRADE.hq) ||
		!isLevel(upgrades.troops, MAX_UPGRADE.troops) ||
		!isLevel(upgrades.landing, MAX_UPGRADE.landing)
	) {
		return false;
	}
	const islands = candidate.islands;
	if (typeof islands !== 'object' || islands === null || Array.isArray(islands)) return false;
	return Object.values(islands).every(isIslandControl);
}

export function islandControl(save: BeachheadSave, islandId: string): IslandControl {
	return save.islands[islandId] ?? { stars: 0, controlled: false };
}

export function starsOf(save: BeachheadSave, islandId: string): number {
	return islandControl(save, islandId).stars;
}

export function isControlled(save: BeachheadSave, islandId: string): boolean {
	return islandControl(save, islandId).controlled;
}

/** The first island is always open; every other one needs the previous island controlled */
export function isUnlocked(
	save: BeachheadSave,
	islandIds: readonly string[],
	index: number
): boolean {
	if (index <= 0) return index === 0;
	return isControlled(save, islandIds[index - 1]);
}

export function controlledCount(save: BeachheadSave, islandIds: readonly string[]): number {
	return islandIds.filter((islandId) => isControlled(save, islandId)).length;
}

export function totalStars(save: BeachheadSave, islandIds: readonly string[]): number {
	return islandIds.reduce((sum, islandId) => sum + starsOf(save, islandId), 0);
}

/** Supplies per minute: the home shore plus every controlled island, raised by the headquarters */
export function incomeRate(save: BeachheadSave, islandIds: readonly string[]): number {
	let production = HOME_INCOME_PER_MIN;
	for (const [index, islandId] of islandIds.entries()) {
		if (isControlled(save, islandId)) production += ISLAND_INCOME[index] ?? 0;
	}
	const multiplier = 1 + 0.25 * (save.upgrades.hq - 1);
	return Math.round(production * multiplier * 10) / 10;
}

/**
 * Adds the supplies earned since the last tick. Whole minutes are banked and the rest is left for
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
	const amount = Math.floor(incomeRate(save, islandIds) * minutes);
	return {
		...save,
		supplies: save.supplies + amount,
		// An absence longer than the cap is paid once; the clock then jumps to now, so calling
		// this again at the same moment cannot bank the capped hours a second time.
		lastIncomeMs: elapsed > INCOME_CAP_MS ? nowMs : save.lastIncomeMs + minutes * 60_000
	};
}

/** The cost of the next level, or null when that upgrade is already maxed out */
export function upgradeCost(save: BeachheadSave, key: UpgradeKey): number | null {
	const level = save.upgrades[key];
	if (level >= MAX_UPGRADE[key]) return null;
	return UPGRADE_COSTS[key][level] ?? null;
}

/** Troops and landing craft cannot outgrow the headquarters by more than one level */
export function upgradeLocked(save: BeachheadSave, key: UpgradeKey): boolean {
	if (key === 'hq') return false;
	return save.upgrades[key] + 1 > Math.min(MAX_UPGRADE[key], save.upgrades.hq + 1);
}

export function canUpgrade(save: BeachheadSave, key: UpgradeKey): boolean {
	const cost = upgradeCost(save, key);
	return cost !== null && !upgradeLocked(save, key) && save.supplies >= cost;
}

export function applyUpgrade(save: BeachheadSave, key: UpgradeKey): BeachheadSave {
	if (!canUpgrade(save, key)) return save;
	const cost = upgradeCost(save, key) as number;
	return {
		...save,
		supplies: save.supplies - cost,
		upgrades: { ...save.upgrades, [key]: save.upgrades[key] + 1 }
	};
}

export function addSupplies(save: BeachheadSave, amount: number): BeachheadSave {
	if (!Number.isFinite(amount) || amount <= 0) return save;
	return { ...save, supplies: save.supplies + Math.floor(amount) };
}

/** Marks an island controlled, keeping the better star rating */
export function controlIsland(save: BeachheadSave, islandId: string, stars: number): BeachheadSave {
	const previous = islandControl(save, islandId);
	const best = Math.min(3, Math.max(1, Math.round(stars)));
	return {
		...save,
		islands: {
			...save.islands,
			[islandId]: {
				stars: Math.max(previous.stars, best),
				controlled: true
			}
		}
	};
}

/** One more soldier per squad and tougher, harder-hitting troops per training level */
export function modifiersFor(save: BeachheadSave): BattleModifiers {
	const training = save.upgrades.troops - 1;
	const landing = save.upgrades.landing - 1;
	return {
		troopHp: Math.round(TROOP.hp * (1 + 0.1 * training)),
		troopDamage: Math.round(TROOP.damage * (1 + 0.12 * training)),
		troopsPerSquad: TROOPS_PER_SQUAD + landing
	};
}

/** The island the map should offer next, for a "take the fight onwards" button */
export function nextIsland(save: BeachheadSave, islands: readonly Island[]): Island | null {
	for (const [index, island] of islands.entries()) {
		if (isUnlocked(save, ISLAND_IDS, index) && !isControlled(save, island.id)) return island;
	}
	return null;
}

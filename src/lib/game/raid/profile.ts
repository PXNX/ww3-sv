/*
 * The raider's profile that lasts between raids: level and XP, gold, the equipped loadout (two
 * weapons, a helmet and a vest) and the stash. Raids hand their haul in here when they end; the
 * lobby equips, upgrades and salvages gear. Pure functions on plain data, so the store only has
 * to read and write it.
 */
import {
	ARMOR_SLOTS,
	HP_PER_LEVEL,
	MAP_IDS,
	MAX_ITEM_LEVEL,
	MAX_PLAYER_LEVEL,
	PLAYER_BASE_HP,
	RARITIES,
	STASH_SIZE,
	WEAPON_KINDS,
	type MapId
} from './config';
import {
	gearScore,
	helmetHp,
	makeWeapon,
	salvageValue,
	upgradeCost,
	upgraded,
	vestArmor,
	type ArmorItem,
	type GearItem,
	type WeaponItem
} from './items';

export interface Loadout {
	/** The all-rounder slot: starts with the rifle that carries the heal and the grenade */
	primary: WeaponItem;
	/** Starts with the marksman rifle and its high critical hit chance */
	secondary: WeaponItem;
	helmet: ArmorItem | null;
	vest: ArmorItem | null;
}

export type LoadoutSlot = keyof Loadout;

export interface Profile {
	version: 1;
	level: number;
	/** XP towards the next level */
	xp: number;
	gold: number;
	loadout: Loadout;
	stash: GearItem[];
	raids: number;
	/** Longest survival per map in milliseconds */
	bestTimeMs: Partial<Record<MapId, number>>;
}

export function newProfile(): Profile {
	return {
		version: 1,
		level: 1,
		xp: 0,
		gold: 0,
		loadout: {
			primary: makeWeapon('rifle'),
			secondary: makeWeapon('marksman'),
			helmet: null,
			vest: null
		},
		stash: [],
		raids: 0,
		bestTimeMs: {}
	};
}

/** XP needed to go from this level to the next */
export function xpToNext(level: number): number {
	return Math.round(120 * level ** 1.45);
}

export function maxHpFor(level: number, helmet: ArmorItem | null): number {
	return PLAYER_BASE_HP + HP_PER_LEVEL * (Math.max(1, level) - 1) + helmetHp(helmet);
}

export function armorFor(vest: ArmorItem | null): number {
	return vestArmor(vest);
}

export interface XpResult {
	level: number;
	xp: number;
	levelsGained: number;
}

export function addXp(level: number, xp: number, gained: number): XpResult {
	let nextLevel = level;
	let nextXp = xp + Math.max(0, Math.round(gained));
	while (nextLevel < MAX_PLAYER_LEVEL && nextXp >= xpToNext(nextLevel)) {
		nextXp -= xpToNext(nextLevel);
		nextLevel += 1;
	}
	if (nextLevel >= MAX_PLAYER_LEVEL) nextXp = 0;
	return { level: nextLevel, xp: nextXp, levelsGained: nextLevel - level };
}

export interface RaidHaul {
	map: MapId;
	timeMs: number;
	xp: number;
	gold: number;
	/** Gear picked up during the raid (anything swapped out of the loadout included) */
	gear: GearItem[];
	/** The loadout as the raid ended, with any upgrades and swaps made in the field */
	loadout: Loadout;
}

export interface HaulResult {
	profile: Profile;
	levelsGained: number;
	/** Gear that did not fit in the stash and was salvaged */
	salvaged: number;
	salvageGold: number;
}

/** Banks a finished raid: XP, gold, the field loadout and the gear (best first into the stash) */
export function bankHaul(profile: Profile, haul: RaidHaul): HaulResult {
	const xp = addXp(profile.level, profile.xp, haul.xp);
	const incoming = [...haul.gear].sort((a, b) => gearScore(b) - gearScore(a));
	const stash = [...profile.stash];
	let salvaged = 0;
	let salvageGold = 0;
	for (const item of incoming) {
		if (stash.length < STASH_SIZE) {
			stash.push(item);
		} else {
			salvaged += 1;
			salvageGold += salvageValue(item);
		}
	}
	const best = profile.bestTimeMs[haul.map] ?? 0;
	return {
		profile: {
			...profile,
			level: xp.level,
			xp: xp.xp,
			gold: profile.gold + Math.round(haul.gold) + salvageGold,
			loadout: haul.loadout,
			stash,
			raids: profile.raids + 1,
			bestTimeMs: { ...profile.bestTimeMs, [haul.map]: Math.max(best, haul.timeMs) }
		},
		levelsGained: xp.levelsGained,
		salvaged,
		salvageGold
	};
}

/** Which loadout slots an item can go into */
export function slotsFor(item: GearItem): LoadoutSlot[] {
	if (item.type === 'weapon') return ['primary', 'secondary'];
	return [item.slot];
}

/** Moves a stash item into a slot; whatever was there goes back to the stash */
export function equipFromStash(profile: Profile, itemId: string, slot: LoadoutSlot): Profile {
	const item = profile.stash.find((candidate) => candidate.id === itemId);
	if (!item || !slotsFor(item).includes(slot)) return profile;
	const stash = profile.stash.filter((candidate) => candidate.id !== itemId);
	const previous = profile.loadout[slot];
	if (previous) stash.push(previous);
	return { ...profile, stash, loadout: { ...profile.loadout, [slot]: item } };
}

/** Puts a helmet or vest back into the stash; weapons always stay equipped */
export function unequipArmor(profile: Profile, slot: 'helmet' | 'vest'): Profile {
	const item = profile.loadout[slot];
	if (!item || profile.stash.length >= STASH_SIZE) return profile;
	return {
		...profile,
		stash: [...profile.stash, item],
		loadout: { ...profile.loadout, [slot]: null }
	};
}

export function swapWeapons(profile: Profile): Profile {
	const { primary, secondary } = profile.loadout;
	return { ...profile, loadout: { ...profile.loadout, primary: secondary, secondary: primary } };
}

/** Spends gold on one level for an equipped item; unchanged if it is maxed or too expensive */
export function upgradeSlot(profile: Profile, slot: LoadoutSlot): Profile {
	const item = profile.loadout[slot];
	if (!item) return profile;
	const cost = upgradeCost(item);
	if (cost === null || cost > profile.gold) return profile;
	return {
		...profile,
		gold: profile.gold - cost,
		loadout: { ...profile.loadout, [slot]: upgraded(item) }
	};
}

export function salvage(profile: Profile, itemId: string): Profile {
	const item = profile.stash.find((candidate) => candidate.id === itemId);
	if (!item) return profile;
	return {
		...profile,
		gold: profile.gold + salvageValue(item),
		stash: profile.stash.filter((candidate) => candidate.id !== itemId)
	};
}

// ---------------------------------------------------------------------------------------------
// Validation of what comes back from local storage

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isLevel = (value: unknown, max: number): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0;

function isWeapon(value: unknown): value is WeaponItem {
	return (
		isRecord(value) &&
		value.type === 'weapon' &&
		typeof value.id === 'string' &&
		(WEAPON_KINDS as readonly unknown[]).includes(value.kind) &&
		(RARITIES as readonly unknown[]).includes(value.rarity) &&
		isLevel(value.level, MAX_ITEM_LEVEL)
	);
}

function isArmor(value: unknown): value is ArmorItem {
	return (
		isRecord(value) &&
		value.type === 'armor' &&
		typeof value.id === 'string' &&
		(ARMOR_SLOTS as readonly unknown[]).includes(value.slot) &&
		(RARITIES as readonly unknown[]).includes(value.rarity) &&
		isLevel(value.level, MAX_ITEM_LEVEL)
	);
}

const isGear = (value: unknown): value is GearItem => isWeapon(value) || isArmor(value);

export function isProfile(value: unknown): value is Profile {
	if (!isRecord(value) || value.version !== 1) return false;
	const { loadout, stash, bestTimeMs } = value;
	return (
		isLevel(value.level, MAX_PLAYER_LEVEL) &&
		isCount(value.xp) &&
		isCount(value.gold) &&
		isCount(value.raids) &&
		isRecord(loadout) &&
		isWeapon(loadout.primary) &&
		isWeapon(loadout.secondary) &&
		(loadout.helmet === null || (isArmor(loadout.helmet) && loadout.helmet.slot === 'helmet')) &&
		(loadout.vest === null || (isArmor(loadout.vest) && loadout.vest.slot === 'vest')) &&
		Array.isArray(stash) &&
		stash.length <= STASH_SIZE * 2 &&
		stash.every(isGear) &&
		isRecord(bestTimeMs) &&
		Object.entries(bestTimeMs).every(
			([map, time]) => (MAP_IDS as readonly string[]).includes(map) && isCount(time)
		)
	);
}

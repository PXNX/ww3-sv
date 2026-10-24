/*
 * The raider's profile that lasts between raids: level and XP, gold and scrap, the equipped
 * loadout (two weapons, a helmet, a vest and boots), the stash, the crystals, the season track and
 * the daily quests. Raids hand their haul in here when they end; the lobby equips, upgrades and
 * salvages gear, sockets and combines crystals and claims season and quest rewards. Pure
 * functions on plain data, so the store only has to read and write it.
 */
import { dayKey } from '#lib/game/random.js';
import {
	ARMOR_SLOTS,
	ARMOR_PERKS,
	CRYSTAL_COMBINE_COUNT,
	CRYSTAL_COMBINE_SCRAP,
	CRYSTAL_KINDS,
	HP_PER_LEVEL,
	MAP_IDS,
	MAX_ITEM_LEVEL,
	MAX_PLAYER_LEVEL,
	PLAYER_BASE_HP,
	RARITIES,
	STASH_SIZE,
	WEAPON_KINDS,
	type ArmorSlot,
	type MapId
} from './config';
import {
	crystalKey,
	crystalsOf,
	gearScore,
	helmetHp,
	makeWeapon,
	nextRarity,
	parseCrystalKey,
	rarityIndex,
	salvageScrap,
	salvageValue,
	socketsOf,
	upgradeCost,
	upgraded,
	vestArmor,
	type ArmorItem,
	type Crystal,
	type CrystalStock,
	type GearItem,
	type WeaponItem
} from './items';
import {
	isSeasonProgress,
	newSeason,
	seasonId,
	seasonReward,
	seasonTier,
	type SeasonProgress,
	type SeasonReward
} from './season';
import {
	addRaidToQuests,
	isDailyQuests,
	newDailyQuests,
	questDone,
	type DailyQuests,
	type QuestStats
} from './quests';

export interface Loadout {
	/** The all-rounder slot: starts with the rifle that carries the heal and the grenade */
	primary: WeaponItem;
	/** Starts with the marksman rifle and its high critical hit chance */
	secondary: WeaponItem;
	helmet: ArmorItem | null;
	vest: ArmorItem | null;
	/** Missing in saves from before boots existed */
	boots: ArmorItem | null;
}

export type LoadoutSlot = keyof Loadout;
export type WeaponSlot = 'primary' | 'secondary';

export interface Profile {
	version: 1;
	level: number;
	/** XP towards the next level */
	xp: number;
	gold: number;
	/** Salvaged material, spent on combining crystals */
	scrap: number;
	loadout: Loadout;
	stash: GearItem[];
	/** Loose crystals, counted by kind and rarity */
	crystals: CrystalStock;
	season: SeasonProgress;
	/** Today's quests (missing in older saves) */
	quests: DailyQuests;
	raids: number;
	/** Longest survival per map in milliseconds */
	bestTimeMs: Partial<Record<MapId, number>>;
}

export function newProfile(now: Date = new Date()): Profile {
	return {
		version: 1,
		level: 1,
		xp: 0,
		gold: 0,
		scrap: 0,
		loadout: {
			primary: makeWeapon('rifle'),
			secondary: makeWeapon('marksman'),
			helmet: null,
			vest: null,
			boots: null
		},
		stash: [],
		crystals: {},
		season: newSeason(now),
		quests: newDailyQuests(now),
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

// ---------------------------------------------------------------------------------------------
// Crystal stock

export function crystalCount(stock: CrystalStock, crystal: Crystal): number {
	return stock[crystalKey(crystal)] ?? 0;
}

function addCrystals(stock: CrystalStock, crystal: Crystal, count: number): CrystalStock {
	const key = crystalKey(crystal);
	const next = { ...stock, [key]: Math.max(0, (stock[key] ?? 0) + count) };
	if (next[key] === 0) delete next[key];
	return next;
}

/** Every crystal in a stock, rarest first */
export function stockList(stock: CrystalStock): { crystal: Crystal; count: number }[] {
	return Object.entries(stock)
		.flatMap(([key, count]) => {
			const crystal = parseCrystalKey(key);
			return crystal && count ? [{ crystal, count }] : [];
		})
		.sort(
			(a, b) =>
				rarityIndex(b.crystal.rarity) - rarityIndex(a.crystal.rarity) ||
				CRYSTAL_KINDS.indexOf(a.crystal.kind) - CRYSTAL_KINDS.indexOf(b.crystal.kind)
		);
}

/** Puts a crystal from the stock into a free socket of an equipped weapon */
export function socketCrystal(profile: Profile, slot: WeaponSlot, crystal: Crystal): Profile {
	const weapon = profile.loadout[slot];
	const socketed = crystalsOf(weapon);
	if (crystalCount(profile.crystals, crystal) <= 0 || socketed.length >= socketsOf(weapon)) {
		return profile;
	}
	return {
		...profile,
		crystals: addCrystals(profile.crystals, crystal, -1),
		loadout: {
			...profile.loadout,
			[slot]: { ...weapon, crystals: [...socketed, { ...crystal }] }
		}
	};
}

/** Takes a crystal out of an equipped weapon, back into the stock */
export function unsocketCrystal(profile: Profile, slot: WeaponSlot, index: number): Profile {
	const weapon = profile.loadout[slot];
	const socketed = crystalsOf(weapon);
	const crystal = socketed[index];
	if (!crystal) return profile;
	return {
		...profile,
		crystals: addCrystals(profile.crystals, crystal, 1),
		loadout: {
			...profile.loadout,
			[slot]: { ...weapon, crystals: socketed.filter((_, i) => i !== index) }
		}
	};
}

/** Scrap it costs to combine five crystals of this rarity into the next, or null for legendary */
export function combineCost(crystal: Crystal): number | null {
	return nextRarity(crystal.rarity) ? CRYSTAL_COMBINE_SCRAP[rarityIndex(crystal.rarity)] : null;
}

export function canCombine(profile: Profile, crystal: Crystal): boolean {
	const cost = combineCost(crystal);
	return (
		cost !== null &&
		cost <= profile.scrap &&
		crystalCount(profile.crystals, crystal) >= CRYSTAL_COMBINE_COUNT
	);
}

/** Five crystals of one kind and rarity plus scrap become one of the next rarity */
export function combineCrystals(profile: Profile, crystal: Crystal): Profile {
	const next = nextRarity(crystal.rarity);
	if (!next || !canCombine(profile, crystal)) return profile;
	let crystals = addCrystals(profile.crystals, crystal, -CRYSTAL_COMBINE_COUNT);
	crystals = addCrystals(crystals, { kind: crystal.kind, rarity: next }, 1);
	return { ...profile, crystals, scrap: profile.scrap - combineCost(crystal)! };
}

// ---------------------------------------------------------------------------------------------
// Season

/** Adds a season reward to the profile; gear that does not fit in the stash is salvaged */
function grantReward(profile: Profile, reward: SeasonReward): Profile {
	switch (reward.type) {
		case 'gold':
			return { ...profile, gold: profile.gold + reward.amount };
		case 'scrap':
			return { ...profile, scrap: profile.scrap + reward.amount };
		case 'crystal':
			return { ...profile, crystals: addCrystals(profile.crystals, reward.crystal, reward.count) };
		case 'weapon': {
			const item = makeWeapon(reward.kind, reward.rarity, reward.level);
			if (profile.stash.length < STASH_SIZE) return { ...profile, stash: [...profile.stash, item] };
			return {
				...profile,
				gold: profile.gold + salvageValue(item),
				scrap: profile.scrap + salvageScrap(item)
			};
		}
	}
}

/** Claims every reached tier that is not claimed yet, in order */
export function claimSeasonRewards(profile: Profile): {
	profile: Profile;
	rewards: SeasonReward[];
} {
	const reached = seasonTier(profile.season.xp);
	const rewards: SeasonReward[] = [];
	let next = profile;
	for (let tier = profile.season.claimed + 1; tier <= reached; tier++) {
		const reward = seasonReward(profile.season.id, tier);
		rewards.push(reward);
		next = grantReward(next, reward);
	}
	if (rewards.length === 0) return { profile, rewards };
	return { profile: { ...next, season: { ...next.season, claimed: reached } }, rewards };
}

/** Moves the profile into the current season; anything left unclaimed in the old one is claimed */
export function withCurrentSeason(profile: Profile, now: Date = new Date()): Profile {
	if (profile.season.id === seasonId(now)) return profile;
	const claimed = claimSeasonRewards(profile).profile;
	return { ...claimed, season: newSeason(now) };
}

/** Raid XP (or quest XP) for both the level and the season track */
function gainXp(profile: Profile, gained: number): { profile: Profile; levelsGained: number } {
	const xp = addXp(profile.level, profile.xp, gained);
	return {
		profile: {
			...profile,
			level: xp.level,
			xp: xp.xp,
			season: { ...profile.season, xp: profile.season.xp + Math.max(0, Math.round(gained)) }
		},
		levelsGained: xp.levelsGained
	};
}

// ---------------------------------------------------------------------------------------------
// Daily quests

/** Gives the profile today's quests if the ones it has are from an earlier day */
export function withCurrentQuests(profile: Profile, now: Date = new Date()): Profile {
	if (profile.quests.day === dayKey(now)) return profile;
	return { ...profile, quests: newDailyQuests(now) };
}

/** Moves the profile into the current season and day */
export function withToday(profile: Profile, now: Date = new Date()): Profile {
	return withCurrentQuests(withCurrentSeason(profile, now), now);
}

/** Claims a finished quest's reward; unchanged if it is not finished or already claimed */
export function claimQuest(profile: Profile, index: number): Profile {
	const quest = profile.quests.quests[index];
	if (!quest || quest.claimed || !questDone(quest)) return profile;
	const quests = profile.quests.quests.map((other, i) =>
		i === index ? { ...other, claimed: true } : other
	);
	const next = gainXp(profile, quest.reward.xp).profile;
	return {
		...next,
		gold: next.gold + quest.reward.gold,
		scrap: next.scrap + quest.reward.scrap,
		quests: { ...profile.quests, quests }
	};
}

// ---------------------------------------------------------------------------------------------
// Banking a raid

export interface RaidHaul {
	map: MapId;
	timeMs: number;
	xp: number;
	gold: number;
	scrap: number;
	/** Gear picked up during the raid (anything swapped out of the loadout included) */
	gear: GearItem[];
	crystals: Crystal[];
	/** The loadout as the raid ended, with any upgrades and swaps made in the field */
	loadout: Loadout;
	/** What the raid counts towards the daily quests */
	stats: QuestStats;
}

export interface HaulResult {
	profile: Profile;
	levelsGained: number;
	/** Gear that did not fit in the stash and was salvaged */
	salvaged: number;
	salvageGold: number;
	salvageScrap: number;
	/** Season tiers reached by this raid */
	seasonTiersGained: number;
}

/**
 * Banks a finished raid: XP (also for the season), gold, scrap, crystals, loadout, gear and the
 * progress of the daily quests
 */
export function bankHaul(profile: Profile, haul: RaidHaul, now: Date = new Date()): HaulResult {
	const today = withToday(profile, now);
	const { profile: current, levelsGained } = gainXp(today, haul.xp);
	const incoming = [...haul.gear].sort((a, b) => gearScore(b) - gearScore(a));
	const stash = [...current.stash];
	let salvaged = 0;
	let salvageGold = 0;
	let scrapFromSalvage = 0;
	let crystals = current.crystals;
	for (const item of incoming) {
		if (stash.length < STASH_SIZE) {
			stash.push(item);
		} else {
			salvaged += 1;
			salvageGold += salvageValue(item);
			scrapFromSalvage += salvageScrap(item);
			if (item.type === 'weapon') {
				for (const crystal of crystalsOf(item)) crystals = addCrystals(crystals, crystal, 1);
			}
		}
	}
	for (const crystal of haul.crystals) crystals = addCrystals(crystals, crystal, 1);
	const best = current.bestTimeMs[haul.map] ?? 0;
	return {
		profile: {
			...current,
			gold: current.gold + Math.round(haul.gold) + salvageGold,
			scrap: current.scrap + Math.round(haul.scrap) + scrapFromSalvage,
			loadout: haul.loadout,
			stash,
			crystals,
			quests: addRaidToQuests(current.quests, haul.stats),
			raids: current.raids + 1,
			bestTimeMs: { ...current.bestTimeMs, [haul.map]: Math.max(best, haul.timeMs) }
		},
		levelsGained,
		salvaged,
		salvageGold,
		salvageScrap: scrapFromSalvage,
		seasonTiersGained: seasonTier(current.season.xp) - seasonTier(today.season.xp)
	};
}

// ---------------------------------------------------------------------------------------------
// Lobby

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

/** Puts a helmet, vest or boots back into the stash; weapons always stay equipped */
export function unequipArmor(profile: Profile, slot: ArmorSlot): Profile {
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

/** Breaks a stash item down into gold and scrap; a weapon's crystals go back to the stock */
export function salvage(profile: Profile, itemId: string): Profile {
	const item = profile.stash.find((candidate) => candidate.id === itemId);
	if (!item) return profile;
	let crystals = profile.crystals;
	if (item.type === 'weapon') {
		for (const crystal of crystalsOf(item)) crystals = addCrystals(crystals, crystal, 1);
	}
	return {
		...profile,
		gold: profile.gold + salvageValue(item),
		scrap: profile.scrap + salvageScrap(item),
		crystals,
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

function isCrystal(value: unknown): value is Crystal {
	return (
		isRecord(value) &&
		(CRYSTAL_KINDS as readonly unknown[]).includes(value.kind) &&
		(RARITIES as readonly unknown[]).includes(value.rarity)
	);
}

function isWeapon(value: unknown): value is WeaponItem {
	return (
		isRecord(value) &&
		value.type === 'weapon' &&
		typeof value.id === 'string' &&
		(WEAPON_KINDS as readonly unknown[]).includes(value.kind) &&
		(RARITIES as readonly unknown[]).includes(value.rarity) &&
		isLevel(value.level, MAX_ITEM_LEVEL) &&
		(value.crystals === undefined ||
			(Array.isArray(value.crystals) &&
				value.crystals.length <= socketsOf(value as unknown as WeaponItem) &&
				value.crystals.every(isCrystal)))
	);
}

function isArmor(value: unknown): value is ArmorItem {
	return (
		isRecord(value) &&
		value.type === 'armor' &&
		typeof value.id === 'string' &&
		(ARMOR_SLOTS as readonly unknown[]).includes(value.slot) &&
		(RARITIES as readonly unknown[]).includes(value.rarity) &&
		isLevel(value.level, MAX_ITEM_LEVEL) &&
		(value.perk === undefined || (ARMOR_PERKS as readonly unknown[]).includes(value.perk))
	);
}

const isWorn = (value: unknown, slot: ArmorSlot) =>
	value === null || (isArmor(value) && value.slot === slot);

const isGear = (value: unknown): value is GearItem => isWeapon(value) || isArmor(value);

function isCrystalStock(value: unknown): value is CrystalStock {
	return (
		isRecord(value) &&
		Object.entries(value).every(
			([key, count]) => parseCrystalKey(key) !== null && isCount(count) && Number.isInteger(count)
		)
	);
}

export function isProfile(value: unknown): value is Profile {
	if (!isRecord(value) || value.version !== 1) return false;
	const { loadout, stash, bestTimeMs } = value;
	return (
		isLevel(value.level, MAX_PLAYER_LEVEL) &&
		isCount(value.xp) &&
		isCount(value.gold) &&
		isCount(value.raids) &&
		(value.scrap === undefined || isCount(value.scrap)) &&
		(value.crystals === undefined || isCrystalStock(value.crystals)) &&
		(value.season === undefined || isSeasonProgress(value.season)) &&
		(value.quests === undefined || isDailyQuests(value.quests)) &&
		isRecord(loadout) &&
		isWeapon(loadout.primary) &&
		isWeapon(loadout.secondary) &&
		isWorn(loadout.helmet, 'helmet') &&
		isWorn(loadout.vest, 'vest') &&
		(loadout.boots === undefined || isWorn(loadout.boots, 'boots')) &&
		Array.isArray(stash) &&
		stash.length <= STASH_SIZE * 2 &&
		stash.every(isGear) &&
		isRecord(bestTimeMs) &&
		Object.entries(bestTimeMs).every(
			([map, time]) => (MAP_IDS as readonly string[]).includes(map) && isCount(time)
		)
	);
}

/**
 * A saved profile, or null if it is not one. Saves from before boots, scrap, crystals, seasons
 * and quests get those filled in, and the season and quests move on to the current ones.
 */
export function parseProfile(value: unknown, now: Date = new Date()): Profile | null {
	if (!isProfile(value)) return null;
	const loaded = value as Partial<Profile> & Profile;
	return withToday(
		{
			...loaded,
			loadout: { ...loaded.loadout, boots: loaded.loadout.boots ?? null },
			scrap: loaded.scrap ?? 0,
			crystals: loaded.crystals ?? {},
			season: loaded.season ?? newSeason(now),
			quests: loaded.quests ?? newDailyQuests(now)
		},
		now
	);
}

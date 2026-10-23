/*
 * The raid season: every calendar month is a season, and the XP earned in raids during it also
 * climbs a track of SEASON_TIERS reward tiers (gold, scrap, crystals, and at every tenth tier a
 * rare weapon). The track starts over each month. Rewards are the same for everybody in a season:
 * the random parts are seeded from the season and the tier.
 */
import { createRandom, randomInt, seedFromString } from '#lib/game/random.js';
import {
	CRYSTAL_KINDS,
	MAX_ITEM_LEVEL,
	SEASON_TIERS,
	SEASON_XP_PER_TIER,
	WEAPON_KINDS,
	type Rarity,
	type WeaponKind
} from './config';
import type { Crystal } from './items';

export interface SeasonProgress {
	/** The month, such as "2026-10" */
	id: string;
	/** Raid XP earned this season */
	xp: number;
	/** Rewards are claimed in order: every tier up to this one is claimed */
	claimed: number;
}

export type SeasonReward =
	| { type: 'gold'; amount: number }
	| { type: 'scrap'; amount: number }
	| { type: 'crystal'; crystal: Crystal; count: number }
	| { type: 'weapon'; kind: WeaponKind; rarity: Rarity; level: number };

/** The first season, so the seasons are numbered from 1 */
const FIRST_SEASON = { year: 2026, month: 10 };

export function seasonId(date: Date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The season's number, counted from the first one */
export function seasonNumber(id: string): number {
	const [year, month] = id.split('-').map(Number);
	return Math.max(1, (year - FIRST_SEASON.year) * 12 + month - FIRST_SEASON.month + 1);
}

/** Whole days until the season ends (at local midnight on the first of next month) */
export function seasonDaysLeft(date: Date = new Date()): number {
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
	return Math.max(1, Math.ceil((end.getTime() - date.getTime()) / 86_400_000));
}

export function newSeason(date: Date = new Date()): SeasonProgress {
	return { id: seasonId(date), xp: 0, claimed: 0 };
}

/** Tiers reached with this much season XP */
export function seasonTier(xp: number): number {
	return Math.min(SEASON_TIERS, Math.floor(Math.max(0, xp) / SEASON_XP_PER_TIER));
}

/** XP gathered towards the next tier, and how much that tier needs (0 once the track is done) */
export function seasonTierProgress(xp: number): { xp: number; needed: number } {
	if (seasonTier(xp) >= SEASON_TIERS) return { xp: 0, needed: 0 };
	return { xp: Math.max(0, xp) % SEASON_XP_PER_TIER, needed: SEASON_XP_PER_TIER };
}

/**
 * The reward of one tier (1 to SEASON_TIERS). Every tenth tier a weapon (epic, legendary at the
 * end), every fifth a rare or epic crystal, every third a pair of crystals, otherwise gold and
 * scrap in turn, growing along the track.
 */
export function seasonReward(id: string, tier: number): SeasonReward {
	const random = createRandom(seedFromString(`raid-season:${id}:${tier}`));
	const crystalKind = CRYSTAL_KINDS[randomInt(random, 0, CRYSTAL_KINDS.length)];
	if (tier % 10 === 0) {
		return {
			type: 'weapon',
			kind: WEAPON_KINDS[randomInt(random, 0, WEAPON_KINDS.length)],
			rarity: tier >= SEASON_TIERS ? 'legendary' : 'epic',
			level: Math.min(MAX_ITEM_LEVEL, tier / 2)
		};
	}
	if (tier % 5 === 0) {
		return {
			type: 'crystal',
			crystal: { kind: crystalKind, rarity: tier >= 25 ? 'epic' : 'rare' },
			count: 1
		};
	}
	if (tier % 3 === 0) {
		return {
			type: 'crystal',
			crystal: { kind: crystalKind, rarity: tier > 15 ? 'uncommon' : 'common' },
			count: 2
		};
	}
	if (tier % 2 === 0) return { type: 'scrap', amount: 20 + 4 * tier };
	return { type: 'gold', amount: 60 + 15 * tier };
}

export function isSeasonProgress(value: unknown): value is SeasonProgress {
	if (typeof value !== 'object' || value === null) return false;
	const { id, xp, claimed } = value as Record<string, unknown>;
	return (
		typeof id === 'string' &&
		/^\d{4}-\d{2}$/.test(id) &&
		typeof xp === 'number' &&
		Number.isFinite(xp) &&
		xp >= 0 &&
		typeof claimed === 'number' &&
		Number.isInteger(claimed) &&
		claimed >= 0 &&
		claimed <= SEASON_TIERS
	);
}

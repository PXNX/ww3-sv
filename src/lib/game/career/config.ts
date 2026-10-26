/*
 * Tuning for the career layer that sits above the individual games: the coins and XP a finished
 * run pays out, the level curve, the seven-day reward track and the challenge that unlocks it, and
 * the demo advert. Everything here is a plain number or list so the rules stay testable.
 */
import type { ModeId } from '#lib/modes/registry.js';

/**
 * Modes that end a run and pay out a career reward through the shared game-over sheet. The
 * puzzle modes with their own win panels (Belt & Road, Maze, Parking), the endless Tycoon and
 * Fleet Hunt games and the daily Wordle are not part of the career layer; see improvements.md
 * for how they could be added.
 */
export const CAREER_MODES = [
	'blocks',
	'minefield',
	'convoy',
	'merge',
	'shootdown',
	'pipeline',
	'flamingo',
	'fury',
	'chess',
	'dronewall',
	'slice',
	'whack',
	'runcomrade',
	'purrpentagram',
	'energiewende',
	'centrifuge',
	'venezuela',
	'sondage',
	'suez',
	'chipfab',
	'vault',
	'veto',
	'balloon',
	'dome',
	'gpsliar',
	'leakpatrol',
	'maple',
	'rareearth'
] as const satisfies readonly ModeId[];

export type CareerMode = (typeof CAREER_MODES)[number];

export function isCareerMode(id: string): id is CareerMode {
	return (CAREER_MODES as readonly string[]).includes(id);
}

// ---------------------------------------------------------------------------------------------
// Coins and XP per run

export const STARTING_COINS = 60;
export const STARTING_REVIVES = 2;

/** A run always pays a little, so even a quick loss moves the bar */
export const RUN_BASE_COINS = 5;
export const RUN_WIN_COINS = 3;
export const RUN_BEST_COINS = 8;
export const RUN_FIRST_COINS = 8;

export const RUN_BASE_XP = 25;
export const RUN_WIN_XP = 10;
export const RUN_BEST_XP = 20;
export const RUN_FIRST_XP = 15;

/**
 * How much a score is worth, independent of the game's scale: scores range from a handful of
 * points to tens of thousands, so the bonus grows with the logarithm of the score.
 */
export function scoreCoins(score: number): number {
	return Math.min(15, Math.round(Math.log10(1 + Math.max(0, score)) * 4));
}

export function scoreXp(score: number): number {
	return Math.min(40, Math.round(Math.log10(1 + Math.max(0, score)) * 10));
}

/** A soft daily ceiling on farming the same easy game over and over */
export const DAILY_COIN_CAP = 150;
export const DAILY_XP_CAP = 800;

// ---------------------------------------------------------------------------------------------
// Levels

export const MAX_CAREER_LEVEL = 40;

/** XP that takes the player from this level to the next */
export function xpToNextLevel(level: number): number {
	return level >= MAX_CAREER_LEVEL ? 0 : 100 + 50 * (level - 1);
}

export interface CareerRank {
	id: 'intern' | 'lobbyist' | 'fixer' | 'broker' | 'tycoon' | 'oligarch' | 'shadow' | 'survivor';
	fromLevel: number;
}

/** Ranks from bottom to top; the last one that has been reached wins */
export const CAREER_RANKS: readonly CareerRank[] = [
	{ id: 'intern', fromLevel: 1 },
	{ id: 'lobbyist', fromLevel: 3 },
	{ id: 'fixer', fromLevel: 6 },
	{ id: 'broker', fromLevel: 10 },
	{ id: 'tycoon', fromLevel: 15 },
	{ id: 'oligarch', fromLevel: 20 },
	{ id: 'shadow', fromLevel: 27 },
	{ id: 'survivor', fromLevel: 34 }
];

export type CareerRankId = CareerRank['id'];

export function rankFor(level: number): CareerRankId {
	let rank: CareerRankId = 'intern';
	for (const entry of CAREER_RANKS) {
		if (level >= entry.fromLevel) rank = entry.id;
	}
	return rank;
}

/** Coins paid for each level gained, and a revival token every this many levels */
export const LEVEL_UP_COINS = 25;
export const LEVEL_UP_REVIVE_EVERY = 3;

// ---------------------------------------------------------------------------------------------
// The daily reward

export interface StreakReward {
	coins: number;
	revives: number;
}

/** A seven-day loop; the eighth day starts the track again */
export const DAILY_TRACK: readonly StreakReward[] = [
	{ coins: 10, revives: 0 },
	{ coins: 15, revives: 0 },
	{ coins: 20, revives: 1 },
	{ coins: 25, revives: 0 },
	{ coins: 35, revives: 0 },
	{ coins: 50, revives: 0 },
	{ coins: 100, revives: 1 }
];

// ---------------------------------------------------------------------------------------------
// Daily challenge

export const DAILY_CHALLENGE_COINS = 60;
export const DAILY_CHALLENGE_XP = 100;
export const DAILY_CHALLENGE_REVIVES = 1;

// ---------------------------------------------------------------------------------------------
// Shop, revivals and the demo advert

export const REVIVE_COST = 120;
export const REVIVE_PACK_SIZE = 5;
export const REVIVE_PACK_COST = 450;

/** Coins a sponsor break pays, and how many of them a day there are */
export const AD_COINS = 10;
export const ADS_PER_DAY = 5;
/** A single advert never pays more than this, however good the run was */
export const MAX_AD_COINS = 150;
/** Length of the demo advert in seconds */
export const AD_SECONDS = 5;

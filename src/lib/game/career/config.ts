/*
 * Tuning for the career layer that sits above the individual games: the coins and XP a finished
 * run pays out, the level curve, the seven-day reward track that the daily challenge unlocks, and
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
	'rareearth',
	'redsquare',
	'petrobras'
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
 * How close a lost run has to come to the personal best, in percent, before the result sheet
 * treats it as a near miss and offers the revival in place of the advert. A share rather than a
 * fixed gap keeps the rule working for modes that score in the dozens and for modes that score in
 * the thousands. Whole numbers so the comparison stays exact at any score.
 */
export const NEAR_BEST_PERCENT = 85;

/** True when a finished run is worth a "so close" revival offer against the previous best */
export function isNearBest(score: number, best: number | null): boolean {
	return (
		best !== null &&
		best > 0 &&
		score > 0 &&
		score <= best &&
		score * 100 >= best * NEAR_BEST_PERCENT
	);
}

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

export interface DailyReward {
	coins: number;
	revives: number;
}

/**
 * The one reward of the day, opened by finishing a run in the featured game. It used to be two
 * payouts (a login track and a separate challenge bonus); folding the challenge bonus into the
 * track keeps the weekly total about the same. A seven-day loop; a missed day starts it over.
 */
export const DAILY_TRACK: readonly DailyReward[] = [
	{ coins: 60, revives: 1 },
	{ coins: 65, revives: 0 },
	{ coins: 75, revives: 1 },
	{ coins: 85, revives: 0 },
	{ coins: 95, revives: 1 },
	{ coins: 110, revives: 0 },
	{ coins: 160, revives: 2 }
];

/** XP that comes with every collected daily reward, whatever the slot */
export const DAILY_REWARD_XP = 100;

/** The run that completes the challenge pays this many times its own coins and XP */
export const CHALLENGE_RUN_MULTIPLIER = 2;

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

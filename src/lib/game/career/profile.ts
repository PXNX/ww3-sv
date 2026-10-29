/*
 * The career profile: one small, persistent layer above all the games. A finished run pays coins
 * and XP, levels unlock coin bonuses and revival tokens, one daily reward on a seven-day track opens
 * once a run in the featured game is done, and coins are spent in the supply depot. Everything is a pure
 * function on plain data, so the store only reads and writes it.
 */
import { createRandom, dayKey, randomInt, seedFromString } from '#lib/game/random.js';
import {
	newContest,
	enterContest,
	type ContestEntry,
	type ContestMedal,
	type ContestOutcome
} from '#lib/game/contest/contest.js';
import type { ContestTier } from '#lib/game/contest/config.js';
import {
	ADS_PER_DAY,
	CAREER_MODES,
	CHALLENGE_RUN_MULTIPLIER,
	DAILY_COIN_CAP,
	DAILY_REWARD_XP,
	DAILY_TRACK,
	DAILY_XP_CAP,
	LEVEL_UP_COINS,
	LEVEL_UP_REVIVE_EVERY,
	MAX_AD_COINS,
	MAX_CAREER_LEVEL,
	REVIVE_COST,
	REVIVE_PACK_COST,
	REVIVE_PACK_SIZE,
	RUN_BASE_COINS,
	RUN_BASE_XP,
	RUN_BEST_COINS,
	RUN_BEST_XP,
	RUN_FIRST_COINS,
	RUN_FIRST_XP,
	RUN_WIN_COINS,
	RUN_WIN_XP,
	STARTING_COINS,
	STARTING_REVIVES,
	isCareerMode,
	rankFor,
	scoreCoins,
	scoreXp,
	xpToNextLevel,
	type CareerMode,
	type CareerRankId
} from './config';

export interface ModeProgress {
	plays: number;
	/** Best score in this mode, so the start screen can show it */
	best: number;
	/** When the mode was last played, as milliseconds */
	lastPlayed: number;
}

export interface DailyChallenge {
	/** The day, such as "2026-10-26" */
	day: string;
	mode: CareerMode;
	done: boolean;
}

export interface DailyEarned {
	day: string;
	coins: number;
	xp: number;
}

export interface AdCounter {
	day: string;
	watched: number;
}

export interface CareerProfile {
	version: 1;
	/** Lifetime XP; the level and the progress to the next one are derived from it */
	xp: number;
	coins: number;
	revives: number;
	/** Consecutive days the daily reward was collected */
	streak: number;
	/** The longest such streak ever reached, so daily-loss never takes an unlocked look back */
	bestStreak: number;
	/** The last day the daily reward was collected, or null */
	lastBonusDay: string | null;
	challenge: DailyChallenge;
	/** Today's contest: the featured game, the best score entered and the medal already paid */
	contest: ContestEntry;
	/** Medals won in past contests, oldest first, capped by the contest config */
	medals: ContestMedal[];
	/** Profile items bought with Fake News, by unlock id */
	unlocked: string[];
	/** What was earned today, against the daily soft cap */
	earned: DailyEarned;
	ads: AdCounter;
	modes: Partial<Record<CareerMode, ModeProgress>>;
	runs: number;
}

// ---------------------------------------------------------------------------------------------
// Levels

export interface LevelInfo {
	level: number;
	/** XP gathered towards the next level */
	xpInto: number;
	/** XP the next level needs, or 0 at the top level */
	needed: number;
}

export function levelInfo(totalXp: number): LevelInfo {
	let remaining = Math.max(0, Math.floor(totalXp));
	let level = 1;
	while (level < MAX_CAREER_LEVEL) {
		const needed = xpToNextLevel(level);
		if (remaining < needed) return { level, xpInto: remaining, needed };
		remaining -= needed;
		level += 1;
	}
	return { level: MAX_CAREER_LEVEL, xpInto: 0, needed: 0 };
}

export function careerLevel(totalXp: number): number {
	return levelInfo(totalXp).level;
}

export function careerRank(totalXp: number): CareerRankId {
	return rankFor(careerLevel(totalXp));
}

// ---------------------------------------------------------------------------------------------
// The day

/** The mode the daily challenge asks for; the same for everyone on the same local day */
export function challengeMode(day: string): CareerMode {
	const random = createRandom(seedFromString(`career-challenge:${day}`));
	return CAREER_MODES[randomInt(random, 0, CAREER_MODES.length)];
}

export function newChallenge(now: Date = new Date()): DailyChallenge {
	const day = dayKey(now);
	return { day, mode: challengeMode(day), done: false };
}

export function newCareer(now: Date = new Date()): CareerProfile {
	const day = dayKey(now);
	return {
		version: 1,
		xp: 0,
		coins: STARTING_COINS,
		revives: STARTING_REVIVES,
		streak: 0,
		bestStreak: 0,
		lastBonusDay: null,
		challenge: newChallenge(now),
		contest: newContest(day),
		medals: [],
		unlocked: [],
		earned: { day, coins: 0, xp: 0 },
		ads: { day, watched: 0 },
		modes: {},
		runs: 0
	};
}

/** Moves the profile to today: a fresh challenge, a fresh daily cap and a fresh ad allowance */
export function withToday(profile: CareerProfile, now: Date = new Date()): CareerProfile {
	const day = dayKey(now);
	let next = profile;
	if (next.challenge.day !== day) next = { ...next, challenge: newChallenge(now) };
	if (next.contest.day !== day) next = { ...next, contest: newContest(day) };
	if (next.earned.day !== day) next = { ...next, earned: { day, coins: 0, xp: 0 } };
	if (next.ads.day !== day) next = { ...next, ads: { day, watched: 0 } };
	return next;
}

function isYesterday(day: string | null, now: Date): boolean {
	if (!day) return false;
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	return dayKey(yesterday) === day;
}

/**
 * When the daily-reward streak breaks: the local midnight after the day following the last claim,
 * since a claim keeps the streak only when it comes the next day. Null without a streak, or once
 * it is already broken.
 */
export function streakDeadline(profile: CareerProfile, now: Date = new Date()): Date | null {
	const match = profile.lastBonusDay?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match || profile.streak < 1) return null;
	const deadline = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 2);
	return deadline.getTime() > now.getTime() ? deadline : null;
}

// ---------------------------------------------------------------------------------------------
// A finished run

export interface RunInput {
	mode: CareerMode;
	score: number;
	outcome: 'won' | 'lost';
	isNewBest: boolean;
}

export interface RunReward {
	profile: CareerProfile;
	/** Everything this run added, including level-ups */
	coins: number;
	xp: number;
	/** The part that counts against the daily cap */
	runCoins: number;
	runXp: number;
	levelsGained: number;
	level: number;
	levelCoins: number;
	/** True when this run was the featured game's and opened today's daily reward */
	challengeCompleted: boolean;
	/** The contest medal this run earned or raised, or null when it was not today's contest game */
	contest: ContestOutcome | null;
	/** True when the daily cap trimmed the payout */
	capped: boolean;
}

/**
 * Banks a finished run. The base reward is the same for every game; the score only adds a
 * logarithmic bonus, so a game with small numbers is worth as much as one with big ones.
 */
export function awardRun(profile: CareerProfile, run: RunInput, now: Date = new Date()): RunReward {
	const today = withToday(profile, now);
	const day = dayKey(now);
	const previous = today.modes[run.mode];
	const firstPlay = previous === undefined;
	const score = Number.isFinite(run.score) ? Math.max(0, Math.round(run.score)) : 0;
	const challengeMatch =
		today.challenge.day === day &&
		today.challenge.mode === run.mode &&
		!today.challenge.done &&
		score > 0;
	const multiplier = challengeMatch ? CHALLENGE_RUN_MULTIPLIER : 1;

	const wantedCoins =
		(RUN_BASE_COINS +
			(run.outcome === 'won' ? RUN_WIN_COINS : 0) +
			(run.isNewBest ? RUN_BEST_COINS : 0) +
			(firstPlay ? RUN_FIRST_COINS : 0) +
			scoreCoins(score)) *
		multiplier;
	const wantedXp = Math.round(
		(RUN_BASE_XP +
			(run.outcome === 'won' ? RUN_WIN_XP : 0) +
			(run.isNewBest ? RUN_BEST_XP : 0) +
			(firstPlay ? RUN_FIRST_XP : 0) +
			scoreXp(score)) *
			multiplier
	);

	const coinRoom = Math.max(0, DAILY_COIN_CAP - today.earned.coins);
	const xpRoom = Math.max(0, DAILY_XP_CAP - today.earned.xp);
	const runCoins = Math.min(wantedCoins, coinRoom);
	const runXp = Math.min(wantedXp, xpRoom);
	const capped = runCoins < wantedCoins || runXp < wantedXp;
	const levels = levelUp(today.xp, runXp);

	const modes: CareerProfile['modes'] = {
		...today.modes,
		[run.mode]: {
			plays: (previous?.plays ?? 0) + 1,
			best: Math.max(previous?.best ?? 0, score),
			lastPlayed: now.getTime()
		}
	};

	// The contest runs alongside the ordinary payout. Its prize is a bonus outside the daily cap,
	// and the medal for a day only ever goes up, so a worse run later pays nothing.
	const contest = enterContest(
		today.contest,
		today.medals,
		{ mode: run.mode, score },
		previous?.best ?? null
	);
	const contestCoins = contest?.coins ?? 0;
	const contestRevives = contest?.revives ?? 0;

	const next: CareerProfile = {
		...today,
		xp: today.xp + runXp,
		coins: today.coins + runCoins + levels.coins + contestCoins,
		revives: today.revives + levels.revives + contestRevives,
		challenge: challengeMatch ? { ...today.challenge, done: true } : today.challenge,
		contest: contest?.contest ?? today.contest,
		medals: contest?.medals ?? today.medals,
		earned: { ...today.earned, coins: today.earned.coins + runCoins, xp: today.earned.xp + runXp },
		modes,
		runs: today.runs + 1
	};

	return {
		profile: next,
		coins: runCoins + levels.coins + contestCoins,
		xp: runXp,
		runCoins,
		runXp,
		levelsGained: levels.gained,
		level: levels.level,
		levelCoins: levels.coins,
		challengeCompleted: challengeMatch,
		contest,
		capped
	};
}

interface LevelUp {
	gained: number;
	/** The level after the XP was added */
	level: number;
	coins: number;
	revives: number;
}

/** What adding XP pays in level-up coins and revival tokens */
function levelUp(xpBefore: number, xpAdded: number): LevelUp {
	const before = careerLevel(xpBefore);
	const after = careerLevel(xpBefore + xpAdded);
	return {
		gained: after - before,
		level: after,
		coins: (after - before) * LEVEL_UP_COINS,
		revives: Math.floor(after / LEVEL_UP_REVIVE_EVERY) - Math.floor(before / LEVEL_UP_REVIVE_EVERY)
	};
}

// ---------------------------------------------------------------------------------------------
// The daily reward

export interface StreakClaim {
	profile: CareerProfile;
	/** Coins and revival tokens paid, including any level-up the reward XP caused */
	coins: number;
	revives: number;
	xp: number;
	levelsGained: number;
	/** The streak after this claim */
	streak: number;
	/** Index into DAILY_TRACK that was just paid */
	slot: number;
}

/** The slot the next claim would pay, for showing the track before it is collected */
export function nextStreakSlot(profile: CareerProfile, now: Date = new Date()): number {
	if (profile.lastBonusDay === dayKey(now)) {
		return Math.max(0, (profile.streak - 1) % DAILY_TRACK.length);
	}
	const streak = isYesterday(profile.lastBonusDay, now) ? profile.streak + 1 : 1;
	return (streak - 1) % DAILY_TRACK.length;
}

/**
 * The daily reward is collected, not just logged in for: it opens once today's challenge is done,
 * so the panel can show one goal and one button instead of two tracks side by side.
 */
export function canClaimDaily(profile: CareerProfile, now: Date = new Date()): boolean {
	const today = withToday(profile, now);
	return today.challenge.done && today.lastBonusDay !== dayKey(now);
}

/** Collects today's reward; null until the challenge is done and while it was already collected */
export function claimDaily(profile: CareerProfile, now: Date = new Date()): StreakClaim | null {
	const today = withToday(profile, now);
	const day = dayKey(now);
	if (!today.challenge.done || today.lastBonusDay === day) return null;
	const streak = isYesterday(today.lastBonusDay, now) ? today.streak + 1 : 1;
	const slot = (streak - 1) % DAILY_TRACK.length;
	const reward = DAILY_TRACK[slot];
	// The reward XP is not taken from the run cap, but it can still level the player up
	const levels = levelUp(today.xp, DAILY_REWARD_XP);
	return {
		profile: {
			...today,
			streak,
			bestStreak: Math.max(today.bestStreak, streak),
			lastBonusDay: day,
			xp: today.xp + DAILY_REWARD_XP,
			coins: today.coins + reward.coins + levels.coins,
			revives: today.revives + reward.revives + levels.revives
		},
		coins: reward.coins + levels.coins,
		revives: reward.revives + levels.revives,
		xp: DAILY_REWARD_XP,
		levelsGained: levels.gained,
		streak,
		slot
	};
}

// ---------------------------------------------------------------------------------------------
// Shop, revivals and the demo advert

/** What a number of revival tokens costs; the five-pack is discounted */
export function reviveCost(count: number): number {
	return count >= REVIVE_PACK_SIZE ? REVIVE_PACK_COST : count * REVIVE_COST;
}

/** Spends coins on revival tokens; null when there are not enough coins */
export function buyRevives(
	profile: CareerProfile,
	count: number,
	now: Date = new Date()
): CareerProfile | null {
	const today = withToday(profile, now);
	if (!Number.isInteger(count) || count <= 0) return null;
	const cost = reviveCost(count);
	if (today.coins < cost) return null;
	return { ...today, coins: today.coins - cost, revives: today.revives + count };
}

/** Takes one revival token; null when the player has none */
export function useRevive(profile: CareerProfile): CareerProfile | null {
	if (profile.revives <= 0) return null;
	return { ...profile, revives: profile.revives - 1 };
}

/**
 * Buys a profile item with Fake News. Null when it is already owned, the price is not a positive
 * whole number, or the wallet cannot cover it, so the shop can show one honest answer per tap.
 */
export function buyUnlock(
	profile: CareerProfile,
	id: string,
	price: number,
	now: Date = new Date()
): CareerProfile | null {
	const today = withToday(profile, now);
	if (!Number.isInteger(price) || price <= 0) return null;
	if (today.unlocked.includes(id)) return null;
	if (today.coins < price) return null;
	return { ...today, coins: today.coins - price, unlocked: [...today.unlocked, id] };
}

export interface AdResult {
	profile: CareerProfile;
	watched: boolean;
	coins: number;
	left: number;
}

/** Pays a sponsor break, up to ADS_PER_DAY a day; `coins` is what the break is worth */
export function watchAd(profile: CareerProfile, coins: number, now: Date = new Date()): AdResult {
	const today = withToday(profile, now);
	const left = Math.max(0, ADS_PER_DAY - today.ads.watched);
	if (left <= 0) return { profile: today, watched: false, coins: 0, left: 0 };
	const payout = Math.min(MAX_AD_COINS, Math.max(0, Math.round(coins)));
	return {
		profile: {
			...today,
			coins: today.coins + payout,
			ads: { ...today.ads, watched: today.ads.watched + 1 }
		},
		watched: true,
		coins: payout,
		left: left - 1
	};
}

export function adsLeft(profile: CareerProfile, now: Date = new Date()): number {
	if (profile.ads.day !== dayKey(now)) return ADS_PER_DAY;
	return Math.max(0, ADS_PER_DAY - profile.ads.watched);
}

export function coinsLeftToday(profile: CareerProfile, now: Date = new Date()): number {
	if (profile.earned.day !== dayKey(now)) return DAILY_COIN_CAP;
	return Math.max(0, DAILY_COIN_CAP - profile.earned.coins);
}

// ---------------------------------------------------------------------------------------------
// Collection

/** How many different games have been played at least once */
export function playedCount(profile: CareerProfile): number {
	return Object.keys(profile.modes).length;
}

/** The games played most recently, newest first */
export function recentModes(profile: CareerProfile, limit = 3): CareerMode[] {
	return (Object.entries(profile.modes) as [CareerMode, ModeProgress][])
		.sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
		.slice(0, limit)
		.map(([mode]) => mode);
}

// ---------------------------------------------------------------------------------------------
// Validation of what comes back from local storage

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isWholeCount = (value: unknown): value is number => isCount(value) && Number.isInteger(value);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isModeProgress(value: unknown): value is ModeProgress {
	return (
		isRecord(value) && isWholeCount(value.plays) && isCount(value.best) && isCount(value.lastPlayed)
	);
}

const isTier = (value: unknown): value is ContestTier =>
	value === 'bronze' || value === 'silver' || value === 'gold';

function isContestEntry(value: unknown): value is ContestEntry {
	return (
		isRecord(value) &&
		typeof value.day === 'string' &&
		DAY.test(value.day) &&
		typeof value.mode === 'string' &&
		isCareerMode(value.mode) &&
		isCount(value.best) &&
		(value.tier === null || isTier(value.tier))
	);
}

function isContestMedal(value: unknown): value is ContestMedal {
	return (
		isRecord(value) &&
		typeof value.day === 'string' &&
		DAY.test(value.day) &&
		typeof value.mode === 'string' &&
		isCareerMode(value.mode) &&
		isTier(value.tier) &&
		isCount(value.score)
	);
}

export function isCareerProfile(value: unknown): value is CareerProfile {
	if (!isRecord(value) || value.version !== 1) return false;
	const { challenge, contest, medals, unlocked, earned, ads, modes } = value;
	return (
		isWholeCount(value.xp) &&
		isWholeCount(value.coins) &&
		isWholeCount(value.revives) &&
		isWholeCount(value.streak) &&
		isWholeCount(value.bestStreak) &&
		isWholeCount(value.runs) &&
		(value.lastBonusDay === null ||
			(typeof value.lastBonusDay === 'string' && DAY.test(value.lastBonusDay))) &&
		isRecord(challenge) &&
		typeof challenge.day === 'string' &&
		DAY.test(challenge.day) &&
		typeof challenge.mode === 'string' &&
		isCareerMode(challenge.mode) &&
		typeof challenge.done === 'boolean' &&
		isContestEntry(contest) &&
		Array.isArray(medals) &&
		medals.every(isContestMedal) &&
		Array.isArray(unlocked) &&
		unlocked.every((id) => typeof id === 'string') &&
		isRecord(earned) &&
		typeof earned.day === 'string' &&
		DAY.test(earned.day) &&
		isCount(earned.coins) &&
		isCount(earned.xp) &&
		isRecord(ads) &&
		typeof ads.day === 'string' &&
		DAY.test(ads.day) &&
		isWholeCount(ads.watched) &&
		isRecord(modes) &&
		Object.entries(modes).every(
			([mode, progress]) => isCareerMode(mode) && isModeProgress(progress)
		)
	);
}

/** Fills in what a save from before the contest and the wardrobe does not have yet */
function withMissingFields(value: unknown, now: Date): unknown {
	if (!isRecord(value)) return value;
	const day = dayKey(now);
	let next = value;
	// Older saves predate the best streak; their current streak is the best we can prove
	if (next.bestStreak === undefined) next = { ...next, bestStreak: next.streak };
	if (next.contest === undefined) next = { ...next, contest: newContest(day) };
	if (next.medals === undefined) next = { ...next, medals: [] };
	if (next.unlocked === undefined) next = { ...next, unlocked: [] };
	return next;
}

/** A saved profile, or null if it is not one; an old profile moves on to today's challenge */
export function parseCareer(value: unknown, now: Date = new Date()): CareerProfile | null {
	const candidate = withMissingFields(value, now);
	if (!isCareerProfile(candidate)) return null;
	return withToday(candidate, now);
}

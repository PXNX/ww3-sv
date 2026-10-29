/*
 * The daily contest: one career game is featured per local day, and a finished run in that game
 * earns the day's medal. The medal depends on the player's own record in the game rather than on a
 * server ranking, because the game runs on the device and has no shared scoreboard: bronze for any
 * scoring run, silver for half the record, gold for a new record. A better run the same day raises
 * the medal and pays only the difference. Everything here is a pure function on plain data.
 */
import { CAREER_MODES, type CareerMode } from '#lib/game/career/config.js';
import { createRandom, randomInt, seedFromString } from '#lib/game/random.js';
import {
	CONTEST_PRIZES,
	CONTEST_TIERS,
	MEDAL_CASE_SIZE,
	SILVER_DIVISOR,
	type ContestPrize,
	type ContestTier
} from './config.js';

export interface ContestEntry {
	/** The day, such as "2026-10-29" */
	day: string;
	mode: CareerMode;
	/** Best score entered in today's featured game */
	best: number;
	/** The medal already paid today, or null before the first scoring run */
	tier: ContestTier | null;
}

export interface ContestMedal {
	day: string;
	mode: CareerMode;
	tier: ContestTier;
	score: number;
}

/** The game the contest asks for; the same for everyone on the same local day */
export function contestMode(day: string): CareerMode {
	const random = createRandom(seedFromString(`contest:${day}`));
	return CAREER_MODES[randomInt(random, 0, CAREER_MODES.length)];
}

export function newContest(day: string): ContestEntry {
	return { day, mode: contestMode(day), best: 0, tier: null };
}

/**
 * The medal a score is worth against the player's record in that game. A game never played before
 * has no record to beat, so it only pays bronze until there is one.
 */
export function contestTier(score: number, previousBest: number | null): ContestTier | null {
	const value = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
	if (value <= 0) return null;
	const best = previousBest !== null && previousBest > 0 ? Math.round(previousBest) : 0;
	if (best === 0) return 'bronze';
	if (value >= best) return 'gold';
	if (value * SILVER_DIVISOR >= best) return 'silver';
	return 'bronze';
}

/** Where a tier sits in the ladder, so an upgrade can be told from a worse run */
export function tierRank(tier: ContestTier | null): number {
	return tier === null ? -1 : CONTEST_TIERS.indexOf(tier);
}

/** What raising a medal from one tier to another still pays */
export function contestPrize(from: ContestTier | null, to: ContestTier): ContestPrize {
	const before = from === null ? { coins: 0, revives: 0 } : CONTEST_PRIZES[from];
	const after = CONTEST_PRIZES[to];
	return {
		coins: Math.max(0, after.coins - before.coins),
		revives: Math.max(0, after.revives - before.revives)
	};
}

/** Puts a medal in the case, replacing the one from the same day and dropping the oldest */
export function addMedal(medals: readonly ContestMedal[], medal: ContestMedal): ContestMedal[] {
	const kept = medals.filter((entry) => entry.day !== medal.day);
	return [...kept, medal].slice(-MEDAL_CASE_SIZE);
}

export interface ContestOutcome {
	contest: ContestEntry;
	medals: ContestMedal[];
	/** The tier today's medal stands at after this run */
	tier: ContestTier;
	/** True when this run raised the day's medal */
	improved: boolean;
	/** True when this run earned the day's first medal */
	first: boolean;
	coins: number;
	revives: number;
}

/**
 * Enters a finished run into today's contest. Null when the run was in another game or scored
 * nothing, so the caller can tell a contest run from an ordinary one.
 */
export function enterContest(
	contest: ContestEntry,
	medals: readonly ContestMedal[],
	run: { mode: CareerMode; score: number },
	previousBest: number | null
): ContestOutcome | null {
	if (run.mode !== contest.mode) return null;
	const score = Number.isFinite(run.score) ? Math.max(0, Math.round(run.score)) : 0;
	if (score <= 0) return null;

	const tier = contestTier(score, previousBest);
	if (tier === null) return null;

	const before = contest.tier;
	const improved = tierRank(tier) > tierRank(before);
	const contestAfter: ContestEntry = {
		...contest,
		best: Math.max(contest.best, score),
		tier: improved ? tier : before
	};

	if (!improved) {
		return {
			contest: contestAfter,
			medals: [...medals],
			tier: before ?? tier,
			improved: false,
			first: false,
			coins: 0,
			revives: 0
		};
	}

	const prize = contestPrize(before, tier);
	return {
		contest: contestAfter,
		medals: addMedal(medals, { day: contest.day, mode: contest.mode, tier, score }),
		tier,
		improved: true,
		first: before === null,
		coins: prize.coins,
		revives: prize.revives
	};
}

/** How many medals of each tier the case holds, for the profile shelf */
export function medalCounts(medals: readonly ContestMedal[]): Record<ContestTier, number> {
	const counts: Record<ContestTier, number> = { bronze: 0, silver: 0, gold: 0 };
	for (const medal of medals) counts[medal.tier] += 1;
	return counts;
}

/** The medals to show, newest first */
export function recentMedals(medals: readonly ContestMedal[], limit = 12): ContestMedal[] {
	return [...medals].reverse().slice(0, limit);
}

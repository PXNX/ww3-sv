/*
 * Tuning for the daily contest: one game is featured each day and the medal a run earns depends on
 * how it compares with the player's own record in that game, so the same rule works for a game that
 * scores in the dozens and for one that scores in the thousands.
 */
export const CONTEST_TIERS = ['bronze', 'silver', 'gold'] as const;

export type ContestTier = (typeof CONTEST_TIERS)[number];

export interface ContestPrize {
	coins: number;
	revives: number;
}

/**
 * What a medal is worth on its own. Raising the day's medal only pays the difference, so a player
 * who finishes bronze and later beats their record still ends the day with the gold prize.
 */
export const CONTEST_PRIZES: Record<ContestTier, ContestPrize> = {
	bronze: { coins: 20, revives: 0 },
	silver: { coins: 45, revives: 1 },
	gold: { coins: 90, revives: 2 }
};

/** A run worth at least this share of the record is silver: score * 2 >= best */
export const SILVER_DIVISOR = 2;

/** How many medals the case keeps; the oldest fall off once it is full */
export const MEDAL_CASE_SIZE = 60;

/*
 * Scoring, turn resolution (win and fail detection) and star ratings. Pure functions, so the
 * rules can be tested without running the physics engine.
 */
import type { Material } from './levels/schema';

export const BLOCK_POINTS: Record<Material, number> = { wood: 100, ice: 80, stone: 150 };
export const DOME_POINTS = 1000;
export const UNUSED_BIRD_BONUS = 2000;

/** Share of the blocks that must be destroyed for the block star */
export const STAR_BLOCK_SHARE = 0.5;

export function unusedBirdBonus(birdsLeft: number): number {
	return Math.max(0, Math.floor(birdsLeft)) * UNUSED_BIRD_BONUS;
}

export type TurnOutcome = 'won' | 'failed' | 'next-bird' | 'wait';

/**
 * Decides what happens after a shot. The level is won the moment every golden dome is gone, even
 * while things are still tumbling. Otherwise the game waits until the bodies have come to rest (or
 * the settle timeout has passed, which the caller reports as settled), then loads the next bird
 * or, with no birds left, fails the level.
 */
export function resolveTurn(state: {
	domesRemaining: number;
	birdsLeft: number;
	settled: boolean;
}): TurnOutcome {
	if (state.domesRemaining <= 0) return 'won';
	if (!state.settled) return 'wait';
	return state.birdsLeft > 0 ? 'next-bird' : 'failed';
}

/**
 * Three-star rating: one star for winning, one for finishing with at least one bird left over, and
 * one for destroying at least half of the blocks.
 */
export function calculateStars(result: {
	won: boolean;
	birdsLeft: number;
	blocksDestroyed: number;
	blocksTotal: number;
}): 0 | 1 | 2 | 3 {
	if (!result.won) return 0;
	let stars = 1;
	if (result.birdsLeft >= 1) stars++;
	const share = result.blocksTotal > 0 ? result.blocksDestroyed / result.blocksTotal : 1;
	if (share >= STAR_BLOCK_SHARE) stars++;
	return stars as 1 | 2 | 3;
}

/** Final score of a won level: points for everything destroyed plus the unused-bird bonus */
export function finalScore(destructionPoints: number, birdsLeft: number, won: boolean): number {
	return destructionPoints + (won ? unusedBirdBonus(birdsLeft) : 0);
}

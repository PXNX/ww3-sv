/*
 * Win and lose conditions of Sondage Surge. There are no lives: the poll decides. Whoever holds
 * more than half of the départements (an absolute majority) is called the winner on the spot, so
 * the rival can win before the last round. If nobody gets there, the larger map share wins after
 * the last round; a tie goes to the rival, who keeps the office.
 */
import { tally, type Board, type Side } from './board.js';

export const TOTAL_ROUNDS = 20;

export interface Outcome {
	winner: Side;
	/** 'majority': more than half of the map; 'final': the larger share after the last round */
	reason: 'majority' | 'final';
	/** The election was called before the last round */
	early: boolean;
}

/** Tiles needed for an absolute majority of the map */
export function majority(total: number): number {
	return Math.floor(total / 2) + 1;
}

/** Share of the map held by one side, 0..1 */
export function share(board: Board, side: Side): number {
	const counts = tally(board);
	return counts.total === 0 ? 0 : counts[side] / counts.total;
}

/**
 * Checks the board after a move. `round` is the round in progress, `roundOver` is true once both
 * sides have moved in it. Returns null while the race is still open.
 */
export function decide(board: Board, round: number, roundOver: boolean): Outcome | null {
	const counts = tally(board);
	const needed = majority(counts.total);
	const early = round < TOTAL_ROUNDS;
	if (counts.you >= needed) return { winner: 'you', reason: 'majority', early };
	if (counts.rival >= needed) return { winner: 'rival', reason: 'majority', early };
	if (roundOver && round >= TOTAL_ROUNDS) {
		return { winner: counts.you > counts.rival ? 'you' : 'rival', reason: 'final', early: false };
	}
	return null;
}

/** The score submitted to the high-score table */
export function finalScore(
	outcome: Outcome,
	yourTiles: number,
	flips: number,
	roundsLeft: number
): number {
	const bonus = outcome.winner === 'you' ? 250 + Math.max(0, roundsLeft) * 20 : 0;
	return yourTiles * 10 + flips * 3 + bonus;
}

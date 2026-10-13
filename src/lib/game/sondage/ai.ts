/*
 * La Candidate's greedy AI: every round she holds the rally that flips the most tiles right now.
 * Ties go to the safer tile (fewer neighbours, so it is harder to flip back), then to a seeded roll.
 * Now and then she makes a gaffe and rallies on a random free tile instead, which keeps a thinking
 * player ahead of her (a mirror match of two pure greedy players favours the one that moves last).
 */
import { pickOne, type Random } from '#lib/game/random.js';
import { flipsFor, neighborCount, rallyTiles, type Board, type Side } from './board.js';

/** A flip is worth far more than any positional bonus */
const FLIP_WEIGHT = 100;
/** A tile with fewer neighbours is safer: it sits on an edge of the map */
const EDGE_WEIGHT = 3;
const MAX_NEIGHBORS = 8;

/** Chance that La Candidate rallies on a random tile instead of the best one */
export const GAFFE_CHANCE = 0.25;

export interface RallyMove {
	index: number;
	flips: number[];
	/** She fluffed her lines and picked a random tile */
	gaffe: boolean;
}

/** The tile the AI would pick for `side`, or null when no rally can be held at all */
export function chooseMove(
	board: Board,
	side: Side,
	random: Random,
	gaffeChance = 0
): RallyMove | null {
	const tiles = rallyTiles(board);
	if (tiles.length === 0) return null;
	if (gaffeChance > 0 && random() < gaffeChance) {
		const index = pickOne(random, tiles);
		return { index, flips: flipsFor(board, index, side), gaffe: true };
	}
	let best: RallyMove | null = null;
	let bestScore = -Infinity;
	for (const index of tiles) {
		const flips = flipsFor(board, index, side);
		// The roll is below 1, so it only breaks exact ties of the other terms
		const score =
			flips.length * FLIP_WEIGHT +
			(MAX_NEIGHBORS - neighborCount(board, index)) * EDGE_WEIGHT +
			random();
		if (score > bestScore) {
			bestScore = score;
			best = { index, flips, gaffe: false };
		}
	}
	return best;
}

/*
 * Shadow Fleet Shuffle: the knobs. A run is a campaign of rounds; every round hides more ships
 * under cargo covers and shuffles them faster and trickier. Wrong picks cost lives.
 */
export const TOTAL_ROUNDS = 10;
export const STARTING_LIVES = 3;
export const START_PINGS = 1;
export const MAX_PINGS = 2;
/** A satellite ping is earned for every this many correct picks in a row */
export const PING_EVERY = 4;
export const MIN_SHIPS = 3;
export const MAX_SHIPS = 6;

export interface RoundConfig {
	round: number;
	ships: number;
	/** Moves in the shuffle (a swap, a crossing or a three-way rotation each) */
	moves: number;
	/** Milliseconds one move takes */
	moveMs: number;
	/** Milliseconds of rest between two moves */
	gapMs: number;
	/** Milliseconds the tanker stays marked before the covers drop */
	revealMs: number;
	/** Chance a move is a long crossing over the ships in between */
	crossChance: number;
	/** Chance a move rotates three covers at once */
	cycleChance: number;
	/** Covers that repaint their flag and name plate mid-shuffle */
	reflags: number;
	/** Covers that switch their AIS off (dim, no wake) mid-shuffle */
	darkDecoys: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Everything about round `round` (1-based); rounds past the last one keep the final difficulty */
export function roundConfig(round: number): RoundConfig {
	const r = clamp(Math.floor(round), 1, TOTAL_ROUNDS);
	const ships = clamp(MIN_SHIPS + Math.floor((r - 1) / 2), MIN_SHIPS, MAX_SHIPS);
	return {
		round: r,
		ships,
		moves: 3 + r + (ships - MIN_SHIPS),
		moveMs: Math.max(280, 640 - r * 38),
		gapMs: Math.max(40, 150 - r * 10),
		revealMs: Math.max(900, 1700 - r * 80),
		crossChance: r >= 3 ? Math.min(0.5, (r - 2) * 0.08) : 0,
		cycleChance: r >= 5 ? Math.min(0.35, (r - 4) * 0.07) : 0,
		reflags: r >= 3 ? Math.min(3, Math.floor(r / 3)) : 0,
		darkDecoys: r >= 4 ? Math.min(ships - 1, Math.floor((r - 2) / 2)) : 0
	};
}

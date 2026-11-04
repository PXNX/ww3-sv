/*
 * Combo scoring and the result of a hunt. Every hit cell is worth a few points and every ship
 * sunk its class points; strikes that keep finding ships build a streak that multiplies both,
 * and any strike that finds only water (or a decoy buoy) breaks it. A sunk fleet is rated one to
 * three stars by how few cells it took to find it, and the stars pay a bonus.
 */
import { SHIP_CLASSES, type CellOutcome, type Ship, type Shot } from './fleet';

/** Points for a ship cell that was hit, before the streak multiplier */
export const HIT_POINTS = 10;

/** The streak multiplier stops growing here */
export const MAX_STREAK_BONUS = 6;

/** Bonus per star when the fleet is sunk */
export const STAR_BONUS = 100;

/** The running numbers of the hunt in progress */
export interface RunStats {
	/** Strikes fired (a salvo or a depth charge is one strike) */
	strikes: number;
	/** Ship cells hit */
	hits: number;
	/** Consecutive ship cells hit; a strike without a hit sets it back to zero */
	streak: number;
	bestStreak: number;
	/** Points earned in this hunt, before the star bonus */
	points: number;
}

export function newRun(): RunStats {
	return { strikes: 0, hits: 0, streak: 0, bestStreak: 0, points: 0 };
}

/** 1x for a first hit, then +0.25x per hit in the streak, up to 2.5x */
export function comboMultiplier(streak: number): number {
	return 1 + 0.25 * Math.min(Math.max(streak - 1, 0), MAX_STREAK_BONUS);
}

/** Scores the cells of one volley in the order they landed */
export function scoreVolley(
	run: RunStats,
	outcomes: readonly CellOutcome[],
	ships: readonly Ship[]
): { run: RunStats; gained: number } {
	let { streak, hits, bestStreak } = run;
	let gained = 0;
	let anyHit = false;
	for (const outcome of outcomes) {
		if (outcome.kind === 'hit' || outcome.kind === 'sunk') {
			anyHit = true;
			streak += 1;
			hits += 1;
			bestStreak = Math.max(bestStreak, streak);
			const base =
				outcome.kind === 'sunk'
					? HIT_POINTS + SHIP_CLASSES[ships[outcome.ship].class].points
					: HIT_POINTS;
			gained += Math.round(base * comboMultiplier(streak));
		}
	}
	if (!anyHit) streak = 0;
	return {
		run: { strikes: run.strikes + 1, hits, streak, bestStreak, points: run.points + gained },
		gained
	};
}

export interface FleetResult {
	stars: 1 | 2 | 3;
	/** Ship cells hit as a share of all cells struck, 0 to 1 */
	accuracy: number;
	cellsStruck: number;
	strikes: number;
	hits: number;
	bestStreak: number;
	bonus: number;
	/** Points of the whole hunt, bonus included */
	points: number;
}

/** One to three stars by accuracy: half the cells struck were ships for three */
export function starsFor(accuracy: number): 1 | 2 | 3 {
	if (accuracy >= 0.5) return 3;
	return accuracy >= 0.34 ? 2 : 1;
}

export function fleetResult(
	ships: readonly Ship[],
	shots: readonly Shot[],
	run: RunStats
): FleetResult {
	const shipCells = ships.reduce((sum, ship) => sum + ship.cells.length, 0);
	const accuracy = shots.length === 0 ? 0 : Math.min(1, shipCells / shots.length);
	const stars = starsFor(accuracy);
	const bonus = stars * STAR_BONUS;
	return {
		stars,
		accuracy,
		cellsStruck: shots.length,
		strikes: run.strikes,
		hits: run.hits,
		bestStreak: run.bestStreak,
		bonus,
		points: run.points + bonus
	};
}

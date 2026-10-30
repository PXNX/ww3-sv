/*
 * What a finished job pays. Every job pays a base fee, plus a bonus for each of three stars:
 *  - unseen: the suspicion meter never went past half
 *  - quick: done within the par time
 *  - quiet: no guard or dog was ever drawn over by the sound of sprinting
 */
import { GHOST_LIMIT, PAYOUT } from './config.js';

export interface Stars {
	unseen: boolean;
	quick: boolean;
	quiet: boolean;
}

export interface JobStats {
	/** Highest suspicion reached, 0 to 1 */
	peakSuspicion: number;
	seconds: number;
	par: number;
	noiseAlarms: number;
}

export function earnedStars(stats: JobStats): Stars {
	return {
		unseen: stats.peakSuspicion < GHOST_LIMIT,
		quick: stats.seconds <= stats.par,
		quiet: stats.noiseAlarms === 0
	};
}

export const starCount = (stars: Stars): number =>
	Number(stars.unseen) + Number(stars.quick) + Number(stars.quiet);

export const payoutFor = (stars: number): number => PAYOUT.base + PAYOUT.perStar * stars;

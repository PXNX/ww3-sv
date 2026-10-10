/*
 * Score of a finished ritual: every happy cat earns hearts, every wrong stroke and every slow
 * second costs a little. The cats' hearts are also what the score screen shows in deep red.
 */
import {
	SCORE_BASE,
	SCORE_PER_HEART,
	SCORE_PER_MISTAKE,
	SCORE_TIME_MAX,
	SCORE_TIME_PER_S
} from './config';

export const MAX_HEARTS = 3;

/** One heart per third of happiness; the third needs a cat that is purring as steadily as it can */
export function catHearts(happiness: number): number {
	return Math.min(MAX_HEARTS, Math.max(0, Math.floor(happiness * MAX_HEARTS + 1e-9)));
}

export interface ScoreInput {
	mistakes: number;
	/** Hearts of all cats together */
	hearts: number;
	elapsedMs: number;
}

export function ritualScore({ mistakes, hearts, elapsedMs }: ScoreInput): number {
	const timeBonus = Math.max(0, SCORE_TIME_MAX - Math.floor(elapsedMs / 1000) * SCORE_TIME_PER_S);
	const score = SCORE_BASE + hearts * SCORE_PER_HEART + timeBonus - mistakes * SCORE_PER_MISTAKE;
	return Math.max(SCORE_PER_HEART, score);
}

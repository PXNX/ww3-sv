/*
 * Score of a finished ritual: every happy cat earns hearts, every wrong stroke and every slow
 * second costs a little. The cats' hearts are also what the score screen shows in deep red.
 */
import {
	SCORE_PER_CANDLE,
	SCORE_PER_COMBO,
	SCORE_PER_TREAT,
	STAR_THREE_SCORE,
	STAR_TWO_SCORE,
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
	/** Candles still burning at the end */
	candles?: number;
	/** Points the combos earned along the way */
	comboPoints?: number;
	/** Treats fed to the cats, each of which costs a little */
	treatsUsed?: number;
	/** The pact's multiplier */
	factor?: number;
}

/** The parts of a score, for the result screen; amounts before the pact multiplier */
export interface ScoreBreakdown {
	base: number;
	hearts: number;
	time: number;
	candles: number;
	combo: number;
	mistakes: number;
	treats: number;
	factor: number;
	total: number;
}

export function scoreBreakdown({
	mistakes,
	hearts,
	elapsedMs,
	candles = 0,
	comboPoints = 0,
	treatsUsed = 0,
	factor = 1
}: ScoreInput): ScoreBreakdown {
	const time = Math.max(0, SCORE_TIME_MAX - Math.floor(elapsedMs / 1000) * SCORE_TIME_PER_S);
	const parts = {
		base: SCORE_BASE,
		hearts: hearts * SCORE_PER_HEART,
		time,
		candles: candles * SCORE_PER_CANDLE,
		combo: comboPoints,
		mistakes: -mistakes * SCORE_PER_MISTAKE,
		treats: -treatsUsed * SCORE_PER_TREAT
	};
	const raw = Object.values(parts).reduce((sum, part) => sum + part, 0);
	return { ...parts, factor, total: Math.max(SCORE_PER_HEART, Math.round(raw * factor)) };
}

export function ritualScore(input: ScoreInput): number {
	return scoreBreakdown(input).total;
}

/** Stars for a completed ritual: one for finishing, more for a high score */
export function starsFor(score: number): 1 | 2 | 3 {
	return score >= STAR_THREE_SCORE ? 3 : score >= STAR_TWO_SCORE ? 2 : 1;
}

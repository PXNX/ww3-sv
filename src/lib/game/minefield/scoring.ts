/*
 * Minefield score (requirements Section 3): revealed water and correct buoy flags always count;
 * a win adds a channel bonus plus bonuses for speed, surviving tankers and unused submarines,
 * and a perfect-run bonus when no tanker was lost. The difficulty multiplier applies to the total.
 */
import { TANKER_COUNT, type Difficulty } from './difficulty';

export const SCORE_POINTS = {
	perRevealedCell: 5,
	perCorrectFlag: 25,
	/** Subtracted per buoy on safe water, so flagging everything does not pay off */
	perWrongFlag: 25,
	win: 500,
	perSecondUnderPar: 5,
	perTanker: 300,
	perSubmarine: 200,
	perfectRun: 500
} as const;

export interface ScoreInput {
	difficulty: Difficulty;
	won: boolean;
	seconds: number;
	tankersLeft: number;
	submarinesLeft: number;
	revealedCells: number;
	correctFlags: number;
	wrongFlags: number;
}

export interface ScoreBreakdown {
	revealed: number;
	flags: number;
	win: number;
	time: number;
	tankers: number;
	submarines: number;
	perfect: number;
	multiplier: number;
	total: number;
}

export function scoreGame(input: ScoreInput): ScoreBreakdown {
	const { difficulty, won } = input;
	const revealed = input.revealedCells * SCORE_POINTS.perRevealedCell;
	const flags = Math.max(
		0,
		input.correctFlags * SCORE_POINTS.perCorrectFlag - input.wrongFlags * SCORE_POINTS.perWrongFlag
	);
	const win = won ? SCORE_POINTS.win : 0;
	const time = won
		? Math.max(
				0,
				Math.round((difficulty.parSeconds - input.seconds) * SCORE_POINTS.perSecondUnderPar)
			)
		: 0;
	const tankers = won ? input.tankersLeft * SCORE_POINTS.perTanker : 0;
	const submarines = won ? input.submarinesLeft * SCORE_POINTS.perSubmarine : 0;
	const perfect = won && input.tankersLeft >= TANKER_COUNT ? SCORE_POINTS.perfectRun : 0;
	const multiplier = difficulty.scoreMultiplier;
	const total = Math.round(
		(revealed + flags + win + time + tankers + submarines + perfect) * multiplier
	);
	return { revealed, flags, win, time, tankers, submarines, perfect, multiplier, total };
}

/** Score shown in the header during play; flags are left out so it never hints where mines are */
export function liveScore(difficulty: Difficulty, revealedCells: number): number {
	return Math.round(revealedCells * SCORE_POINTS.perRevealedCell * difficulty.scoreMultiplier);
}

/** Formats seconds as minutes and seconds, for example 83 as 1:23 */
export function formatTime(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

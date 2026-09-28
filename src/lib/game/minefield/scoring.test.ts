import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TANKER_COUNT } from './difficulty';
import { formatTime, liveScore, scoreGame, SCORE_POINTS, type ScoreInput } from './scoring';

const easyWin: ScoreInput = {
	difficulty: DIFFICULTIES.easy,
	won: true,
	seconds: 60,
	tankersLeft: 2,
	submarinesLeft: 1,
	revealedCells: 20,
	correctFlags: 3,
	wrongFlags: 1
};

describe('scoreGame', () => {
	it('adds every part of a win', () => {
		const score = scoreGame(easyWin);
		expect(score).toEqual({
			revealed: 100,
			flags: 50,
			win: 500,
			time: 150,
			tankers: 600,
			submarines: 200,
			perfect: 0,
			multiplier: 1,
			total: 1600
		});
	});

	it('gives the perfect-run bonus only when no tanker was lost', () => {
		expect(scoreGame({ ...easyWin, tankersLeft: TANKER_COUNT }).perfect).toBe(
			SCORE_POINTS.perfectRun
		);
		expect(scoreGame({ ...easyWin, tankersLeft: TANKER_COUNT - 1 }).perfect).toBe(0);
	});

	it('counts only revealed water and flags on a loss', () => {
		const score = scoreGame({ ...easyWin, won: false, tankersLeft: 0 });
		expect(score).toMatchObject({ win: 0, time: 0, tankers: 0, submarines: 0, perfect: 0 });
		expect(score.total).toBe(150);
	});

	it('never lets misplaced buoys push the flag points below zero', () => {
		expect(scoreGame({ ...easyWin, correctFlags: 0, wrongFlags: 5 }).flags).toBe(0);
		expect(scoreGame({ ...easyWin, correctFlags: 2, wrongFlags: 2 }).flags).toBe(0);
	});

	it('gives no speed bonus when slower than par', () => {
		expect(scoreGame({ ...easyWin, seconds: 500 }).time).toBe(0);
	});

	it('scales the whole score by the difficulty multiplier', () => {
		const easy = scoreGame(easyWin);
		const hard = scoreGame({ ...easyWin, difficulty: DIFFICULTIES.hard, seconds: 270 });
		expect(hard.multiplier).toBe(2);
		expect(hard.total).toBe(easy.total * 2);
	});
});

describe('liveScore', () => {
	it('counts only revealed water, scaled by difficulty', () => {
		expect(liveScore(DIFFICULTIES.easy, 10)).toBe(50);
		expect(liveScore(DIFFICULTIES.normal, 10)).toBe(75);
	});
});

describe('formatTime', () => {
	it('shows minutes and padded seconds', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(83.9)).toBe('1:23');
		expect(formatTime(600)).toBe('10:00');
		expect(formatTime(-4)).toBe('0:00');
	});
});

import { describe, expect, it } from 'vitest';
import {
	MAX_STREAK_MULTIPLIER,
	NEARLY_FULL,
	NO_COMBO,
	POINTS_PER_LINE,
	STREAK_GRACE_MOVES,
	performanceMood,
	scoreMove,
	type Combo
} from './scoring';

describe('scoring', () => {
	it('awards a point per placed cell', () => {
		expect(scoreMove(4, 0, NO_COMBO).points).toBe(4);
		expect(scoreMove(9, 0, NO_COMBO).linePoints).toBe(0);
	});

	it('awards line points for a clear', () => {
		const score = scoreMove(2, 1, NO_COMBO);
		expect(score.linePoints).toBe(POINTS_PER_LINE);
		expect(score.points).toBe(2 + POINTS_PER_LINE);
		expect(score.combo).toEqual({ streak: 1, movesSinceClear: 0 });
	});

	it('multiplies by the number of lines cleared at once', () => {
		expect(scoreMove(0, 2, NO_COMBO).linePoints).toBe(POINTS_PER_LINE * 2 * 2);
		expect(scoreMove(0, 3, NO_COMBO).linePoints).toBe(POINTS_PER_LINE * 3 * 3);
		expect(scoreMove(0, 3, NO_COMBO).lineMultiplier).toBe(3);
		// Two lines at once are worth more than two single clears without a streak
		expect(scoreMove(0, 2, NO_COMBO).linePoints).toBeGreaterThan(
			2 * scoreMove(0, 1, NO_COMBO).linePoints
		);
	});

	it('multiplies again for consecutive clearing turns', () => {
		const first = scoreMove(2, 1, NO_COMBO);
		const second = scoreMove(2, 1, first.combo);
		expect(second.streakMultiplier).toBe(2);
		expect(second.linePoints).toBe(POINTS_PER_LINE * 2);
		const third = scoreMove(2, 2, second.combo);
		expect(third.linePoints).toBe(POINTS_PER_LINE * 2 * 2 * 3);
	});

	it('keeps a streak through a few placements without a clear, then drops it', () => {
		let combo: Combo = scoreMove(2, 1, NO_COMBO).combo;
		for (let i = 0; i < STREAK_GRACE_MOVES; i++) {
			combo = scoreMove(2, 0, combo).combo;
			expect(combo.streak).toBe(1);
		}
		expect(scoreMove(2, 1, combo).streakMultiplier).toBe(2);
		expect(scoreMove(2, 0, combo).combo).toEqual(NO_COMBO);
	});

	it('caps the streak multiplier', () => {
		let combo: Combo = NO_COMBO;
		for (let i = 0; i < MAX_STREAK_MULTIPLIER + 3; i++) combo = scoreMove(2, 1, combo).combo;
		expect(scoreMove(2, 1, combo).streakMultiplier).toBe(MAX_STREAK_MULTIPLIER);
	});

	it('reads the mood from the board and the streak', () => {
		expect(performanceMood({ fillRatio: 0.2, streak: 0, lastLines: 0 })).toBe('neutral');
		expect(performanceMood({ fillRatio: 0.2, streak: 2, lastLines: 1 })).toBe('winning');
		expect(performanceMood({ fillRatio: 0.2, streak: 1, lastLines: 2 })).toBe('winning');
		expect(performanceMood({ fillRatio: NEARLY_FULL, streak: 3, lastLines: 2 })).toBe('danger');
	});
});

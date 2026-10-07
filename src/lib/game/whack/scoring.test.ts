import { describe, expect, it } from 'vitest';
import { COMBO_MULTIPLIER_CAP, COMBO_WINDOW_MS } from './config';
import {
	breakCombo,
	comboActive,
	comboTimeLeft,
	createCombo,
	currentMultiplier,
	hitScore,
	multiplierFor,
	registerHit
} from './scoring';

describe('multiplierFor', () => {
	it('is x1 for the first two hits, then grows every three', () => {
		expect([0, 1, 2].map(multiplierFor)).toEqual([1, 1, 1]);
		expect([3, 4, 5].map(multiplierFor)).toEqual([2, 2, 2]);
		expect([6, 9].map(multiplierFor)).toEqual([3, 4]);
	});

	it('is capped', () => {
		expect(multiplierFor(12)).toBe(COMBO_MULTIPLIER_CAP);
		expect(multiplierFor(500)).toBe(COMBO_MULTIPLIER_CAP);
	});

	it('treats nonsense as no streak', () => {
		expect(multiplierFor(-3)).toBe(1);
	});
});

describe('registerHit', () => {
	it('starts a streak at 1', () => {
		const combo = createCombo();
		expect(registerHit(combo, 1000)).toEqual({ streak: 1, multiplier: 1 });
	});

	it('chains hits that follow each other within the window', () => {
		const combo = createCombo();
		let time = 0;
		const streaks: number[] = [];
		for (let i = 0; i < 4; i++) {
			time += COMBO_WINDOW_MS - 50;
			streaks.push(registerHit(combo, time).streak);
		}
		expect(streaks).toEqual([1, 2, 3, 4]);
		expect(currentMultiplier(combo, time)).toBe(2);
	});

	it('still counts a hit exactly at the end of the window', () => {
		const combo = createCombo();
		registerHit(combo, 0);
		expect(registerHit(combo, COMBO_WINDOW_MS).streak).toBe(2);
	});

	it('starts over when the window ran out', () => {
		const combo = createCombo();
		registerHit(combo, 0);
		registerHit(combo, 500);
		expect(registerHit(combo, 500 + COMBO_WINDOW_MS + 1).streak).toBe(1);
	});

	it('starts over after the combo was broken', () => {
		const combo = createCombo();
		registerHit(combo, 0);
		registerHit(combo, 300);
		breakCombo(combo);
		expect(comboActive(combo, 400)).toBe(false);
		expect(registerHit(combo, 400).streak).toBe(1);
	});

	it('scores later hits with the higher multiplier', () => {
		const combo = createCombo();
		const points = [0, 200, 400, 600, 800, 1000].map((time) =>
			hitScore(10, registerHit(combo, time).multiplier)
		);
		expect(points).toEqual([10, 10, 20, 20, 20, 30]);
	});
});

describe('combo state', () => {
	it('falls back to x1 and an empty timer once the window passed', () => {
		const combo = createCombo();
		for (const time of [0, 100, 200, 300]) registerHit(combo, time);
		expect(currentMultiplier(combo, 300 + COMBO_WINDOW_MS)).toBe(2);
		expect(currentMultiplier(combo, 300 + COMBO_WINDOW_MS + 1)).toBe(1);
		expect(comboTimeLeft(combo, 300 + COMBO_WINDOW_MS + 1)).toBe(0);
	});

	it('shows how much of the window is left', () => {
		const combo = createCombo();
		registerHit(combo, 1000);
		expect(comboTimeLeft(combo, 1000)).toBe(1);
		expect(comboTimeLeft(combo, 1000 + COMBO_WINDOW_MS / 2)).toBeCloseTo(0.5);
	});

	it('has no streak before the first hit', () => {
		const combo = createCombo();
		expect(comboActive(combo, 0)).toBe(false);
		expect(currentMultiplier(combo, 0)).toBe(1);
	});
});

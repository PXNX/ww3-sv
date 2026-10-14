import { describe, expect, it } from 'vitest';
import {
	BASE_FEEDBACK_MS,
	BASE_POINTS,
	BASE_WINDOW_MS,
	MIN_FEEDBACK_MS,
	MIN_WINDOW_MS,
	MULTIPLIER_MAX,
	PACE_STREAK
} from './config.js';
import {
	feedbackMs,
	isExpired,
	multiplier,
	paceLevel,
	pointsFor,
	speedBonus,
	speedTier,
	timeLeft,
	windowMs
} from './timing.js';

describe('timing windows', () => {
	it('starts every game with the full window', () => {
		expect(windowMs(0)).toBe(BASE_WINDOW_MS);
		expect(feedbackMs(0)).toBe(BASE_FEEDBACK_MS);
	});

	it('keeps the window while a streak builds towards the next speed-up', () => {
		expect(windowMs(PACE_STREAK - 1)).toBe(BASE_WINDOW_MS);
	});

	it('shortens the window with each speed-up', () => {
		const windows = [0, 1, 2, 3, 4, 5, 6].map((level) => windowMs(level * PACE_STREAK));
		for (let i = 1; i < windows.length; i++) expect(windows[i]).toBeLessThan(windows[i - 1]);
	});

	it('never goes below the floor, however long the streak', () => {
		expect(windowMs(10_000)).toBe(MIN_WINDOW_MS);
		expect(feedbackMs(10_000)).toBe(MIN_FEEDBACK_MS);
	});

	it('treats a negative streak like no streak', () => {
		expect(windowMs(-5)).toBe(BASE_WINDOW_MS);
		expect(paceLevel(-1)).toBe(0);
	});

	it('expires exactly when the elapsed time reaches the window', () => {
		expect(isExpired(BASE_WINDOW_MS - 1, BASE_WINDOW_MS)).toBe(false);
		expect(isExpired(BASE_WINDOW_MS, BASE_WINDOW_MS)).toBe(true);
	});

	it('reports the time left as a fraction clamped between 0 and 1', () => {
		expect(timeLeft(0, 4000)).toBe(1);
		expect(timeLeft(1000, 4000)).toBe(0.75);
		expect(timeLeft(9000, 4000)).toBe(0);
		expect(timeLeft(-50, 4000)).toBe(1);
		expect(timeLeft(10, 0)).toBe(0);
	});
});

describe('speed tiers and points', () => {
	it('grades answers by how much of the window they used', () => {
		expect(speedTier(100, 4000)).toBe('swift');
		expect(speedTier(1600, 4000)).toBe('swift');
		expect(speedTier(2000, 4000)).toBe('steady');
		expect(speedTier(3000, 4000)).toBe('steady');
		expect(speedTier(3900, 4000)).toBe('late');
	});

	it('pays more for faster answers', () => {
		expect(speedBonus('swift')).toBeGreaterThan(speedBonus('steady'));
		expect(speedBonus('steady')).toBeGreaterThan(speedBonus('late'));
		expect(speedBonus('late')).toBe(0);
	});

	it('raises the multiplier with the streak up to a cap', () => {
		expect(multiplier(1)).toBe(1);
		expect(multiplier(4)).toBe(1);
		expect(multiplier(5)).toBe(2);
		expect(multiplier(10)).toBe(3);
		expect(multiplier(1000)).toBe(MULTIPLIER_MAX);
	});

	it('multiplies the base points and the speed bonus by the streak multiplier', () => {
		expect(pointsFor('late', 1)).toBe(BASE_POINTS);
		expect(pointsFor('swift', 1)).toBe(BASE_POINTS + speedBonus('swift'));
		expect(pointsFor('steady', 5)).toBe((BASE_POINTS + speedBonus('steady')) * 2);
	});
});

describe('streak speed-up', () => {
	it('speeds up once per run of correct answers', () => {
		expect(paceLevel(0)).toBe(0);
		expect(paceLevel(PACE_STREAK - 1)).toBe(0);
		expect(paceLevel(PACE_STREAK)).toBe(1);
		expect(paceLevel(PACE_STREAK * 4 + 1)).toBe(4);
	});
});

import { describe, expect, it } from 'vitest';
import {
	calmPoints,
	fixPoints,
	FAST_MS,
	MAX_MULTIPLIER,
	multiplierFor,
	SLOW_MS,
	STREAK_STEP
} from './scoring.js';

describe('multiplier', () => {
	it('starts at 1 and rises by one every few correct decisions', () => {
		expect(multiplierFor(0)).toBe(1);
		expect(multiplierFor(STREAK_STEP - 1)).toBe(1);
		expect(multiplierFor(STREAK_STEP)).toBe(2);
		expect(multiplierFor(STREAK_STEP * 3)).toBe(4);
	});

	it('is capped and ignores junk', () => {
		expect(multiplierFor(1000)).toBe(MAX_MULTIPLIER);
		expect(multiplierFor(-5)).toBe(1);
	});
});

describe('calm points', () => {
	it('pay more for louder scares', () => {
		expect(calmPoints(0, 0)).toBe(8);
		expect(calmPoints(1, 0)).toBe(20);
		expect(calmPoints(0.5, 0)).toBe(14);
	});

	it('scale with the multiplier', () => {
		expect(calmPoints(1, STREAK_STEP)).toBe(40);
		expect(calmPoints(1, 100)).toBe(20 * MAX_MULTIPLIER);
	});

	it('clamp a silly intensity', () => {
		expect(calmPoints(7, 0)).toBe(20);
		expect(calmPoints(-1, 0)).toBe(8);
	});
});

describe('fix points', () => {
	it('pay the full bonus for a quick reaction and the base for a slow one', () => {
		expect(fixPoints(0, 0)).toBe(40);
		expect(fixPoints(FAST_MS, 0)).toBe(40);
		expect(fixPoints(SLOW_MS, 0)).toBe(15);
		expect(fixPoints(10_000, 0)).toBe(15);
	});

	it('fall off steadily in between', () => {
		const middle = fixPoints((FAST_MS + SLOW_MS) / 2, 0);
		expect(middle).toBeGreaterThan(15);
		expect(middle).toBeLessThan(40);
		expect(fixPoints(800, 0)).toBeGreaterThan(fixPoints(1400, 0));
	});

	it('scale with the multiplier', () => {
		expect(fixPoints(0, STREAK_STEP * 2)).toBe(120);
	});
});

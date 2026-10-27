import { describe, expect, it } from 'vitest';
import { estimateSecondsLeft } from './clips.js';

describe('estimateSecondsLeft', () => {
	it('extrapolates from the bytes so far', () => {
		expect(estimateSecondsLeft(500, 2_000, 1)).toBe(3);
		expect(estimateSecondsLeft(1_000, 2_000, 4)).toBe(4);
	});

	it('rounds up, so the line never promises more than it can show', () => {
		expect(estimateSecondsLeft(900, 1_000, 1)).toBe(1);
		expect(estimateSecondsLeft(990, 1_000, 1)).toBe(1);
	});

	it('says nothing when there is nothing to measure', () => {
		expect(estimateSecondsLeft(0, 1_000, 1)).toBeNull();
		expect(estimateSecondsLeft(500, 0, 1)).toBeNull();
		expect(estimateSecondsLeft(500, 1_000, 0)).toBeNull();
	});

	it('says nothing once everything has arrived', () => {
		expect(estimateSecondsLeft(1_000, 1_000, 2)).toBeNull();
		expect(estimateSecondsLeft(1_200, 1_000, 2)).toBeNull();
	});

	it('caps a hopeless estimate instead of showing minutes', () => {
		expect(estimateSecondsLeft(1, 1_000_000, 1)).toBe(599);
	});
});

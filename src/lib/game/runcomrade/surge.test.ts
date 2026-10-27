import { describe, expect, it } from 'vitest';
import {
	SURGE_FIRST_MS,
	SURGE_GAP_MIN_MS,
	SURGE_MIN_MS,
	SURGE_MIN_SPEED,
	SURGE_SPAN_MS
} from './config';
import { createSurge, stepSurge, surgeSpeedFactor } from './surge';

/** A random that returns a fixed value, so a surge is reproducible in a test */
const fixed = (value: number) => () => value;

describe('speed surges', () => {
	it('starts quiet and waits before the first tailwind', () => {
		const surge = createSurge();
		expect(surgeSpeedFactor(surge)).toBe(1);
		expect(surge.nextMs).toBe(SURGE_FIRST_MS);
		expect(stepSurge(surge, SURGE_FIRST_MS - 1, fixed(0)).started).toBe(false);
		expect(surgeSpeedFactor(surge)).toBe(1);
	});

	it('starts a surge of the shortest planned length and the mildest speed at random 0', () => {
		const surge = createSurge();
		const step = stepSurge(surge, SURGE_FIRST_MS, fixed(0));
		expect(step).toEqual({ started: true, ended: false });
		expect(surge.leftMs).toBe(SURGE_MIN_MS);
		expect(surge.factor).toBe(SURGE_MIN_SPEED);
		expect(surgeSpeedFactor(surge)).toBe(SURGE_MIN_SPEED);
	});

	it('rolls a longer, stronger surge at random almost 1', () => {
		const surge = createSurge();
		stepSurge(surge, SURGE_FIRST_MS, fixed(0.999));
		expect(surge.leftMs).toBeGreaterThanOrEqual(SURGE_MIN_MS);
		expect(surge.leftMs).toBeLessThanOrEqual(SURGE_MIN_MS + SURGE_SPAN_MS);
		expect(surge.factor).toBeGreaterThan(SURGE_MIN_SPEED);
		expect(surge.factor).toBeLessThan(1.16);
	});

	it('settles back to normal speed when the surge ends, and waits again', () => {
		const surge = createSurge();
		stepSurge(surge, SURGE_FIRST_MS, fixed(0));
		const ended = stepSurge(surge, SURGE_MIN_MS, fixed(0));
		expect(ended).toEqual({ started: false, ended: true });
		expect(surgeSpeedFactor(surge)).toBe(1);
		expect(surge.nextMs).toBe(SURGE_GAP_MIN_MS);
		expect(stepSurge(surge, SURGE_GAP_MIN_MS - 1, fixed(0)).started).toBe(false);
		expect(stepSurge(surge, 1, fixed(0)).started).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	FIRST_GLANCE_MS,
	createGlance,
	glanceAmount,
	glanceDurationMs,
	glanceIntervalMs,
	stepGlance
} from './glance';
import { createGame } from './state';
import { runnerPose } from './render';

const STEP = 1000 / 60;

/** Runs the schedule for a while at a fixed closeness and returns when each glance began */
function glanceTimes(seed: number, closeness: number, ms: number, suppressed = false): number[] {
	const glance = createGlance(seed);
	const starts: number[] = [];
	for (let t = 0; t < ms; t += STEP) {
		if (stepGlance(glance, STEP, closeness, suppressed)) starts.push(t);
	}
	return starts;
}

describe('glance schedule', () => {
	it('waits for the first glance, then glances at irregular intervals', () => {
		const starts = glanceTimes(3, 0.2, 120_000);
		expect(starts.length).toBeGreaterThan(4);
		expect(starts[0]).toBeGreaterThanOrEqual(FIRST_GLANCE_MS - STEP);
		const gaps = starts.slice(1).map((time, index) => time - starts[index]);
		expect(new Set(gaps.map((gap) => Math.round(gap / 50))).size).toBeGreaterThan(3);
	});

	it('is reproducible from a seed and differs between seeds', () => {
		expect(glanceTimes(5, 0.3, 60_000)).toEqual(glanceTimes(5, 0.3, 60_000));
		expect(glanceTimes(5, 0.3, 60_000)).not.toEqual(glanceTimes(6, 0.3, 60_000));
	});

	it('glances more often and for longer as the drone gets closer', () => {
		const far = glanceTimes(9, 0, 300_000);
		const near = glanceTimes(9, 1, 300_000);
		expect(near.length).toBeGreaterThan(far.length * 1.8);
		expect(glanceDurationMs(1)).toBeGreaterThan(glanceDurationMs(0));
		const random = createRandom(1);
		const sample = (closeness: number) =>
			Array.from({ length: 200 }, () => glanceIntervalMs(random, closeness)).reduce(
				(sum, value) => sum + value
			) / 200;
		expect(sample(1)).toBeLessThan(sample(0) * 0.5);
	});

	it('holds back while suppressed, for example when the drone is out of sight', () => {
		expect(glanceTimes(3, 1, 60_000, true)).toEqual([]);
	});

	it('turns the head quickly, holds, and turns back', () => {
		const glance = createGlance(1);
		glance.cooldownMs = 0;
		expect(stepGlance(glance, STEP, 0.5, false)).toBe(true);
		const amounts: number[] = [glanceAmount(glance)];
		while (glance.remainingMs > 0) {
			stepGlance(glance, STEP, 0.5, false);
			amounts.push(glanceAmount(glance));
		}
		expect(Math.max(...amounts)).toBe(1);
		expect(amounts[0]).toBeLessThan(0.1);
		expect(amounts.at(-1)).toBe(0);
		// it is up for a good part of the glance, not just a flash
		expect(amounts.filter((value) => value === 1).length).toBeGreaterThan(amounts.length * 0.4);
		expect(glanceAmount(createGlance(1))).toBe(0);
	});
});

describe('runner pose', () => {
	function glancing() {
		const state = createGame(4);
		state.glance.remainingMs = 600;
		state.glance.durationMs = 1200;
		return state;
	}

	it('turns smoothly with motion allowed', () => {
		const state = glancing();
		const pose = runnerPose(state, false);
		expect(pose.glance).toBeGreaterThan(0.9);
		expect(pose.still).toBe(false);
		state.glance.remainingMs = 1100;
		expect(runnerPose(state, false).glance).toBeLessThan(1);
	});

	it('swaps to a still shocked pose with reduced motion: no turning, no moving drops', () => {
		const state = glancing();
		state.glance.remainingMs = 1100;
		const pose = runnerPose(state, true);
		expect(pose.glance).toBe(1);
		expect(pose.still).toBe(true);
		expect(pose.time).toBe(0);
		state.glance.remainingMs = 0;
		expect(runnerPose(state, true).glance).toBe(0);
	});
});

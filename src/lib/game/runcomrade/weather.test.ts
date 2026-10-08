import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { LANE_COST_MS, REACTION_MS, VIEW_AHEAD } from './config';
import { createField, createGenerator, extendField, speedAt } from './patterns';
import {
	CLEAR_START,
	CLEAR_VIEW_SHARE,
	FOG_VIEW,
	MIN_VISIBILITY_SECONDS,
	TRANSITION,
	createWeatherPlan,
	extendWeather,
	fogHidesDrone,
	opacityAt,
	visibility,
	weatherAt
} from './weather';
import { createGame } from './state';
import { stepGame } from './step';

const sweep = (seed: number, until: number, stride = 5) => {
	const plan = createWeatherPlan(seed);
	const samples: { distance: number; dawn: number; fog: number }[] = [];
	for (let distance = 0; distance <= until; distance += stride) {
		samples.push({ distance, ...weatherAt(plan, distance) });
	}
	return samples;
};

describe('weather plan', () => {
	it('starts with a plain clear day', () => {
		for (const seed of [1, 2, 3, 4]) {
			for (const sample of sweep(seed, CLEAR_START)) {
				expect(sample.dawn).toBe(0);
				expect(sample.fog).toBe(0);
			}
		}
	});

	it('is reproducible from a seed, whatever order it is asked in', () => {
		const forward = sweep(8, 3000);
		const plan = createWeatherPlan(8);
		const backward = [...forward].reverse().map((sample) => ({
			distance: sample.distance,
			...weatherAt(plan, sample.distance)
		}));
		expect(backward.reverse()).toEqual(forward);
		expect(sweep(8, 3000)).not.toEqual(sweep(9, 3000));
	});

	it('brings every kind of weather over a long run, and stays within 0 to 1', () => {
		let dawn = 0;
		let fog = 0;
		for (const seed of [1, 2, 3, 4, 5]) {
			for (const sample of sweep(seed, 6000)) {
				expect(sample.dawn).toBeGreaterThanOrEqual(0);
				expect(sample.dawn).toBeLessThanOrEqual(1);
				expect(sample.fog).toBeGreaterThanOrEqual(0);
				expect(sample.fog).toBeLessThanOrEqual(1);
				if (sample.dawn > 0.9) dawn += 1;
				if (sample.fog > 0.9) fog += 1;
			}
		}
		expect(dawn).toBeGreaterThan(20);
		expect(fog).toBeGreaterThan(20);
	});

	it('changes smoothly: never a jump between two nearby distances', () => {
		const step = 1;
		const maxChange = 1.6 / TRANSITION;
		for (const seed of [1, 2, 3]) {
			const samples = sweep(seed, 6000, step);
			for (let i = 1; i < samples.length; i++) {
				expect(Math.abs(samples[i].fog - samples[i - 1].fog)).toBeLessThanOrEqual(maxChange);
				expect(Math.abs(samples[i].dawn - samples[i - 1].dawn)).toBeLessThanOrEqual(maxChange);
			}
		}
	});

	it('never repeats the same weather twice in a row', () => {
		const plan = createWeatherPlan(2);
		extendWeather(plan, 20_000);
		plan.stretches.forEach((stretch, index) => {
			if (index > 0) expect(stretch.kind).not.toBe(plan.stretches[index - 1].kind);
			if (index > 0) expect(stretch.start).toBe(plan.stretches[index - 1].end);
		});
	});
});

describe('visibility in fog', () => {
	it('is the full view on a clear day and shorter in fog', () => {
		expect(visibility({ dawn: 0, fog: 0 }, 7)).toBe(VIEW_AHEAD);
		expect(visibility({ dawn: 0, fog: 1 }, 7)).toBeLessThan(VIEW_AHEAD);
		expect(visibility({ dawn: 0, fog: 1 }, 7)).toBeGreaterThanOrEqual(FOG_VIEW);
	});

	it('never drops below what a runner needs to react, at any speed or distance', () => {
		const needed = REACTION_MS + 2 * LANE_COST_MS + 400;
		for (let distance = 0; distance < 3000; distance += 10) {
			const speed = speedAt(distance);
			const view = visibility({ dawn: 0, fog: 1 }, speed);
			expect(view / speed, `distance ${distance}`).toBeGreaterThanOrEqual(
				MIN_VISIBILITY_SECONDS - 1e-9
			);
			// the part that stays fully clear still gives time to react and change two lanes
			expect(((view * CLEAR_VIEW_SHARE) / speed) * 1000, `distance ${distance}`).toBeGreaterThan(
				needed
			);
		}
	});

	it('shows an obstacle at full strength until it is near the edge of the view', () => {
		expect(opacityAt(0, 30)).toBe(1);
		expect(opacityAt(30 * CLEAR_VIEW_SHARE, 30)).toBe(1);
		expect(opacityAt(27, 30)).toBeGreaterThan(0);
		expect(opacityAt(27, 30)).toBeLessThan(1);
		expect(opacityAt(30, 30)).toBe(0);
		expect(opacityAt(45, 30)).toBe(0);
	});

	it('shows every generated obstacle in the thickest fog early enough to avoid it', () => {
		// at the obstacle's own speed, the fully clear part of the view covers reaction plus two lane changes
		for (const seed of [1, 2, 3]) {
			const field = createField();
			extendField(field, createGenerator(), createRandom(seed), 3000);
			expect(field.rows.length).toBeGreaterThan(20);
			for (const row of field.rows) {
				const speed = speedAt(row.z);
				const view = visibility({ dawn: 0, fog: 1 }, speed);
				const clear = view * CLEAR_VIEW_SHARE;
				expect((clear / speed) * 1000).toBeGreaterThan(REACTION_MS + 2 * LANE_COST_MS + 400);
				// and the obstacle is fully opaque while it is inside that clear part
				expect(opacityAt(clear - 0.01, view)).toBe(1);
			}
		}
	});

	it('hides a far drone in thick fog but never one right behind the runner', () => {
		expect(fogHidesDrone({ dawn: 0, fog: 1 }, 8)).toBe(true);
		expect(fogHidesDrone({ dawn: 0, fog: 1 }, 1.5)).toBe(false);
		expect(fogHidesDrone({ dawn: 0, fog: 0.3 }, 8)).toBe(false);
		expect(fogHidesDrone({ dawn: 1, fog: 0.12 }, 8)).toBe(false);
	});
});

describe('weather in a run', () => {
	it('follows the runner along the plan and hides the drone in fog', () => {
		const state = createGame(5);
		state.generator.nextZ = Infinity;
		state.generator.nextPatchZ = Infinity;
		extendWeather(state.weatherPlan, 4000);
		const foggy = state.weatherPlan.stretches.find((stretch) => stretch.kind === 'fog')!;
		state.distance = foggy.start + TRANSITION + 20;
		state.drone.gap = 8;
		stepGame(state, createRandom(1), 1000 / 60);
		expect(state.weather.fog).toBeGreaterThan(0.9);
		expect(state.hidden).toBe(true);
		expect(state.covered).toBe(false);
	});
});

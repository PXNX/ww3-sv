import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	CEILING_Y,
	FLOOR_Y,
	HAZARD_FIRST_X,
	HAZARD_GAP_END,
	HAZARD_GAP_START,
	POI_END_MARGIN,
	TRACK_LENGTH
} from './config.js';
import { generateCourse, hazardGap } from './course.js';

describe('hazardGap', () => {
	it('shrinks from the start gap to the end gap along the track', () => {
		expect(hazardGap(0)).toBe(HAZARD_GAP_START);
		expect(hazardGap(TRACK_LENGTH)).toBe(HAZARD_GAP_END);
		expect(hazardGap(TRACK_LENGTH * 2)).toBe(HAZARD_GAP_END);
		expect(hazardGap(TRACK_LENGTH / 2)).toBeLessThan(hazardGap(TRACK_LENGTH / 4));
	});
});

describe('generateCourse', () => {
	it('is the same for the same seed and differs between seeds', () => {
		expect(generateCourse(createRandom(3))).toEqual(generateCourse(createRandom(3)));
		expect(generateCourse(createRandom(3))).not.toEqual(generateCourse(createRandom(4)));
	});

	it('places everything in order, inside the track and the sky', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const course = generateCourse(createRandom(seed));
			expect(course.hazards.length).toBeGreaterThan(10);
			expect(course.hazards[0].x).toBe(HAZARD_FIRST_X);
			for (const list of [course.hazards, course.puffs, course.pois]) {
				for (let i = 1; i < list.length; i++) expect(list[i].x).toBeGreaterThan(list[i - 1].x);
			}
			for (const hazard of course.hazards) {
				expect(hazard.x).toBeLessThan(TRACK_LENGTH);
				expect(hazard.baseY).toBeGreaterThanOrEqual(CEILING_Y);
				expect(hazard.baseY).toBeLessThanOrEqual(FLOOR_Y);
				expect(hazard.active).toBe(false);
			}
			for (const puff of course.puffs) {
				expect(puff.y).toBeGreaterThanOrEqual(CEILING_Y);
				expect(puff.y).toBeLessThanOrEqual(FLOOR_Y);
			}
			for (const poi of course.pois) expect(poi.x).toBeLessThan(TRACK_LENGTH - POI_END_MARGIN);
		}
	});

	it('packs hazards closer together near the coast than at the start', () => {
		const course = generateCourse(createRandom(11));
		const gaps = course.hazards.slice(1).map((hazard, i) => hazard.x - course.hazards[i].x);
		const half = Math.floor(gaps.length / 2);
		const mean = (list: number[]) => list.reduce((sum, gap) => sum + gap, 0) / list.length;
		expect(mean(gaps.slice(half))).toBeLessThan(mean(gaps.slice(0, half)));
	});

	it('offers several points of interest and puffs per run', () => {
		const course = generateCourse(createRandom(2));
		expect(course.pois.length).toBeGreaterThanOrEqual(5);
		expect(course.puffs.length).toBeGreaterThanOrEqual(8);
	});
});

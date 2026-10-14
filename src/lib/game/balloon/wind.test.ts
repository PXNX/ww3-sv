import { describe, expect, it } from 'vitest';
import {
	CHUNK_LENGTH,
	GROUND_Y,
	LAYER_COUNT,
	LAYER_HEIGHT,
	TRACK_LENGTH,
	WIND_SPEEDS
} from './config.js';
import { chunkOf, layerCentre, layerOf, runFraction, windAt, windPattern } from './wind.js';

describe('wind layers', () => {
	it('cuts the sky into equal layers with the top one first', () => {
		expect(LAYER_HEIGHT * LAYER_COUNT).toBe(GROUND_Y);
		expect(layerOf(0)).toBe(0);
		expect(layerOf(LAYER_HEIGHT + 1)).toBe(1);
		expect(layerOf(GROUND_Y - 1)).toBe(LAYER_COUNT - 1);
		expect(layerOf(-50)).toBe(0);
		expect(layerOf(GROUND_Y + 50)).toBe(LAYER_COUNT - 1);
		for (let layer = 0; layer < LAYER_COUNT; layer++) {
			expect(layerOf(layerCentre(layer))).toBe(layer);
		}
	});

	it('numbers chunks along the track', () => {
		expect(chunkOf(0)).toBe(0);
		expect(chunkOf(CHUNK_LENGTH - 1)).toBe(0);
		expect(chunkOf(CHUNK_LENGTH)).toBe(1);
		expect(chunkOf(-30)).toBe(0);
	});

	it('gives every chunk a fast, a slow and a back layer', () => {
		for (let chunk = 0; chunk < 6; chunk++) {
			const pattern = windPattern(1234, chunk);
			expect(pattern).toHaveLength(LAYER_COUNT);
			expect(Math.max(...pattern)).toBeGreaterThanOrEqual(90);
			expect(Math.min(...pattern)).toBeLessThan(0);
		}
		expect([...windPattern(1234, 3)].sort((a, b) => a - b)).toEqual([...WIND_SPEEDS]);
	});

	it('is deterministic per seed and chunk but reshuffles between chunks', () => {
		expect(windPattern(7, 2)).toEqual(windPattern(7, 2));
		const patterns = new Set(Array.from({ length: 12 }, (_, i) => windPattern(7, i + 1).join()));
		expect(patterns.size).toBeGreaterThan(6);
		expect(windPattern(7, 2)).not.toEqual(windPattern(8, 2));
	});

	it('reads the wind at a position and altitude', () => {
		const pattern = windPattern(5, 2);
		expect(windAt(5, 2 * CHUNK_LENGTH + 10, layerCentre(3))).toBe(pattern[3]);
	});

	it('reports the share of the run that is done', () => {
		expect(runFraction(0)).toBe(0);
		expect(runFraction(TRACK_LENGTH / 2)).toBe(0.5);
		expect(runFraction(TRACK_LENGTH * 3)).toBe(1);
		expect(runFraction(-5)).toBe(0);
	});
});

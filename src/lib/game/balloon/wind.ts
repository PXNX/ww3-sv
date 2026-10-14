/*
 * The wind layers. Every chunk of track has its own pattern: the five wind speeds shuffled over
 * the five layers. The pattern is derived from the run's seed and the chunk number alone, so it is
 * the same however the balloon wanders, and the renderer can show the next chunk's pattern early.
 */
import { createRandom, shuffle } from '#lib/game/random.js';
import { CHUNK_LENGTH, LAYER_COUNT, LAYER_HEIGHT, TRACK_LENGTH, WIND_SPEEDS } from './config.js';

/** The first chunk is fixed and gentle, so the first seconds teach the layers */
const FIRST_PATTERN: readonly number[] = [76, 44, 12, 108, -36];

export function chunkOf(trackX: number): number {
	return Math.max(0, Math.floor(trackX / CHUNK_LENGTH));
}

/** Layer index (0 is the top) for an altitude, clamped to the sky */
export function layerOf(y: number): number {
	return Math.min(LAYER_COUNT - 1, Math.max(0, Math.floor(y / LAYER_HEIGHT)));
}

export function layerCentre(layer: number): number {
	return (layer + 0.5) * LAYER_HEIGHT;
}

/** The wind speed of every layer in one chunk */
export function windPattern(seed: number, chunk: number): readonly number[] {
	if (chunk <= 0) return FIRST_PATTERN;
	return shuffle(createRandom((seed ^ Math.imul(chunk + 1, 0x9e3779b1)) >>> 0), WIND_SPEEDS);
}

/** Wind speed at a track position and altitude, in track units per second */
export function windAt(seed: number, trackX: number, y: number): number {
	return windPattern(seed, chunkOf(trackX))[layerOf(y)];
}

/** Share of the run that is done, 0 to 1 */
export function runFraction(trackX: number): number {
	return Math.min(1, Math.max(0, trackX / TRACK_LENGTH));
}

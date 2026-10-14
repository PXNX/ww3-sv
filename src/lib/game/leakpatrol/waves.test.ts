import { describe, expect, it } from 'vitest';
import {
	BASE_SPAWN_MS,
	DIALOG_WINDOW_MS,
	MAX_LEAKS_CAP,
	MIN_DIALOG_EVERY_MS,
	MIN_DIALOG_WINDOW_MS,
	MIN_SPAWN_MS,
	WAVE_MS
} from './config.js';
import {
	dialogEveryMs,
	dialogWindowMs,
	leakRate,
	maxLeaks,
	scoreFor,
	spawnMs,
	waveAt
} from './waves.js';

describe('waves', () => {
	it('starts at wave 1 and advances every WAVE_MS', () => {
		expect(waveAt(0)).toBe(1);
		expect(waveAt(WAVE_MS - 1)).toBe(1);
		expect(waveAt(WAVE_MS)).toBe(2);
		expect(waveAt(WAVE_MS * 4.5)).toBe(5);
		expect(waveAt(-50)).toBe(1);
	});

	it('spawns leaks faster every wave, down to a floor', () => {
		expect(spawnMs(1)).toBe(BASE_SPAWN_MS);
		expect(spawnMs(2)).toBeLessThan(spawnMs(1));
		expect(spawnMs(5)).toBeLessThan(spawnMs(2));
		expect(spawnMs(100)).toBe(MIN_SPAWN_MS);
	});

	it('allows more leaks at once, up to the cap', () => {
		expect(maxLeaks(2)).toBe(maxLeaks(1) + 1);
		expect(maxLeaks(100)).toBe(MAX_LEAKS_CAP);
	});

	it('makes the water flow faster every wave', () => {
		expect(leakRate(3)).toBeGreaterThan(leakRate(2));
		expect(leakRate(2)).toBeGreaterThan(leakRate(1));
	});

	it('brings the group chat sooner and gives less time to say no', () => {
		expect(dialogWindowMs(1)).toBe(DIALOG_WINDOW_MS);
		expect(dialogWindowMs(4)).toBeLessThan(dialogWindowMs(2));
		expect(dialogWindowMs(100)).toBe(MIN_DIALOG_WINDOW_MS);
		expect(dialogEveryMs(3)).toBeLessThan(dialogEveryMs(1));
		expect(dialogEveryMs(100)).toBe(MIN_DIALOG_EVERY_MS);
	});

	it('scores seconds survived times plugged leaks', () => {
		expect(scoreFor(10_999, 4)).toBe(40);
		expect(scoreFor(60_000, 0)).toBe(0);
		expect(scoreFor(-5, 3)).toBe(0);
	});
});

/* News cycles: how the pace of the leaks, pickups and the group chat dialog grows wave by wave */
import {
	BASE_MAX_LEAKS,
	BASE_SPAWN_MS,
	DIALOG_EVERY_MS,
	DIALOG_FACTOR,
	DIALOG_WINDOW_MS,
	LEAK_RATE,
	MAX_LEAKS_CAP,
	MIN_DIALOG_EVERY_MS,
	MIN_DIALOG_WINDOW_MS,
	MIN_SPAWN_MS,
	SPAWN_FACTOR,
	WAVE_MS,
	WAVE_RATE_GAIN
} from './config.js';

/** The wave a moment belongs to, counted from 1 */
export function waveAt(elapsedMs: number): number {
	return 1 + Math.floor(Math.max(0, elapsedMs) / WAVE_MS);
}

/** Time between two new leaks */
export function spawnMs(wave: number): number {
	return Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS * SPAWN_FACTOR ** (wave - 1));
}

/** Open leaks allowed at the same time */
export function maxLeaks(wave: number): number {
	return Math.min(MAX_LEAKS_CAP, BASE_MAX_LEAKS + wave - 1);
}

/** Meter level per second that one ordinary leak adds */
export function leakRate(wave: number): number {
	return LEAK_RATE * (1 + WAVE_RATE_GAIN * (wave - 1));
}

/** Time between group chat dialogs */
export function dialogEveryMs(wave: number): number {
	return Math.max(MIN_DIALOG_EVERY_MS, DIALOG_EVERY_MS * DIALOG_FACTOR ** (wave - 1));
}

/** Time the player has to say no */
export function dialogWindowMs(wave: number): number {
	return Math.max(MIN_DIALOG_WINDOW_MS, DIALOG_WINDOW_MS * DIALOG_FACTOR ** (wave - 1));
}

/** Score: seconds survived times leaks plugged */
export function scoreFor(elapsedMs: number, plugged: number): number {
	return Math.floor(Math.max(0, elapsedMs) / 1000) * plugged;
}

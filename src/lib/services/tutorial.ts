/*
 * Tracks whether a game mode's tutorial text has already been shown on this device, so it only
 * ever appears once per mode instead of cluttering every replay.
 */

import { localStore } from './storage';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * True only the first time this mode is played on this device. Marks it seen immediately, so a
 * reload or a second visit never shows the tutorial again.
 */
export function firstPlay(mode: string): boolean {
	const key = `tutorial:${mode}`;
	const seen = localStore().read(key, false, isBoolean);
	if (!seen) localStore().write(key, true);
	return !seen;
}

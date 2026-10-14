/*
 * Lighthouse blink patterns. A lighthouse shows its number as that many flashes in a row, then a
 * long dark pause, over and over: one flash, two flashes, three, four. That is how a sailor tells
 * lighthouses apart in the fog, and how you match what you see to the chart. Each lighthouse
 * starts its cycle at its own moment, so two with the same pattern do not blink in sync.
 */
import { FLASH_GAP_S, FLASH_S, PATTERN_PAUSE_S } from './config.js';

/** Length of one full cycle: all the flashes with their gaps, then the pause */
export function cycleLength(flashes: number): number {
	return flashes * (FLASH_S + FLASH_GAP_S) + PATTERN_PAUSE_S;
}

/** Whether a lighthouse with this many flashes is lit at a time (seconds); offset shifts its cycle */
export function lightOn(flashes: number, time: number, offset = 0): boolean {
	const cycle = cycleLength(flashes);
	const phase = (((time + offset) % cycle) + cycle) % cycle;
	const blinking = flashes * (FLASH_S + FLASH_GAP_S);
	if (phase >= blinking) return false;
	return phase % (FLASH_S + FLASH_GAP_S) < FLASH_S;
}

/** Each lighthouse gets its own start of cycle, derived from its place in the level */
export function lightOffset(index: number): number {
	return index * 0.83;
}

/*
 * Weather and sea state as pure functions of the clock: storms come and go on a schedule fixed by
 * the level, the current turns slowly, and a storm's wind shoves the boat in gusts. Rendering reads
 * the same numbers for rain, lightning, swell and the shrinking fog radius.
 */
import { STORM_FOG_LOSS, STORM_PUSH, STORM_RAMP_S } from './config.js';
import type { Level, Storm } from './level.js';
import type { Vec } from './lie.js';

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How strong the storm is at a time, 0 to 1, easing in and out at the edges of every storm */
export function stormAt(storms: readonly Storm[], time: number): number {
	let strongest = 0;
	for (const storm of storms) {
		const into = time - storm.start;
		const left = storm.start + storm.duration - time;
		if (into <= 0 || left <= 0) continue;
		strongest = Math.max(strongest, smooth(Math.min(1, into / STORM_RAMP_S, left / STORM_RAMP_S)));
	}
	return strongest;
}

/** The storm that is about to begin within the next seconds, or null */
export function stormSoon(storms: readonly Storm[], time: number, within: number): Storm | null {
	return storms.find((storm) => storm.start > time && storm.start - time <= within) ?? null;
}

/** The steady sea current at a time: it slowly turns around its base direction */
export function currentAt(level: Pick<Level, 'current'>, time: number): Vec {
	const base = level.current ?? { x: 0, y: 0 };
	const turn = Math.sin(time * 0.07) * 0.6;
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	return { x: base.x * cos - base.y * sin, y: base.x * sin + base.y * cos };
}

/** Everything that shoves the boat without the helm: the current plus a storm's gusty wind */
export function seaDrift(level: Pick<Level, 'current' | 'storms'>, time: number): Vec {
	const current = currentAt(level, time);
	const storm = stormAt(level.storms ?? [], time);
	if (storm <= 0) return current;
	// The wind blows across the current, in gusts
	const wind = Math.atan2(current.y, current.x || 0.001) + Math.PI / 2;
	const gust = (0.6 + 0.4 * Math.sin(time * 2.3) * Math.sin(time * 0.9 + 1)) * STORM_PUSH * storm;
	return { x: current.x + Math.cos(wind) * gust, y: current.y + Math.sin(wind) * gust };
}

/** How much of the fog radius is left in a storm */
export function fogFactor(storm: number): number {
	return 1 - STORM_FOG_LOSS * storm;
}

/** A lightning flash, 0 to 1: short bright bursts at irregular moments while a storm rages */
export function lightning(storm: number, time: number): number {
	if (storm < 0.6) return 0;
	const slot = Math.floor(time / 3.1);
	const at = (Math.sin(slot * 12.9898) * 43758.5453) % 1;
	const offset = time - slot * 3.1;
	const start = Math.abs(at) * 2.4;
	const flash = offset - start;
	return flash >= 0 && flash < 0.22 ? 1 - flash / 0.22 : 0;
}

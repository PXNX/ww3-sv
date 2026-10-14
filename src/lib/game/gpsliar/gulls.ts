/*
 * The seagull flock. Gulls always fly toward land, so even in thick fog the flock tells you where
 * the coast is. They are scenery driven by the clock: a handful of gulls stream past the boat,
 * wrapping around so there are always some in view.
 */
import { GULL_COUNT, GULL_SPAN, GULL_SPEED } from './config.js';
import { landVector, type Side } from './level.js';
import type { Vec } from './lie.js';

export interface Gull extends Vec {
	/** Unit vector the gull is flying in: toward the land */
	heading: Vec;
}

/** Where the gulls are at a time (seconds), spread around a point, all heading for land */
export function gullFlock(around: Vec, land: Side, time: number): Gull[] {
	const heading = landVector(land);
	// Sideways across the flight path
	const side = { x: -heading.y, y: heading.x };
	return Array.from({ length: GULL_COUNT }, (_, i) => {
		const along = ((time * GULL_SPEED + (i * GULL_SPAN) / GULL_COUNT) % GULL_SPAN) - GULL_SPAN / 2;
		const across = (i - (GULL_COUNT - 1) / 2) * 1.6 + Math.sin(time * 0.9 + i * 2.1) * 0.5;
		return {
			x: around.x + heading.x * along + side.x * across,
			y: around.y + heading.y * along + side.y * across,
			heading
		};
	});
}

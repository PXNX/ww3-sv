/*
 * Hover barges: slate planks that glide back and forth (or up and down) on jets of flame. Like the
 * helicopters they are a pure function of time, so a rider can read the pattern. A barge is a
 * catwalk that moves: it only holds up a body that comes down onto it from above, and whoever
 * stands on it is carried along (the world does the carrying).
 */
import type { Box } from './collision';
import type { PlatformSpot } from './level';

export const PLATFORM_W = 2.4;
export const PLATFORM_H = 0.3;
/** Half the travel of a sideways barge, in tiles */
export const PLATFORM_RANGE_X = 2.5;
/** Half the travel of a lift, in tiles */
export const PLATFORM_RANGE_Y = 2;
/** Seconds for one trip there and back */
export const PLATFORM_PERIOD_X = 6;
export const PLATFORM_PERIOD_Y = 5;

export interface Platform {
	id: number;
	axis: 'x' | 'y';
	/** Center of the travel: the middle of the barge, and the height of its top */
	cx: number;
	cy: number;
	range: number;
	period: number;
	/** Fraction of the period to start into, so neighbours do not move in lockstep */
	phase: number;
}

export function createPlatform(id: number, spot: PlatformSpot): Platform {
	const sideways = spot.axis === 'x';
	return {
		id,
		axis: spot.axis,
		cx: spot.x + 0.5,
		cy: spot.y,
		range: sideways ? PLATFORM_RANGE_X : PLATFORM_RANGE_Y,
		period: sideways ? PLATFORM_PERIOD_X : PLATFORM_PERIOD_Y,
		phase: (spot.x * 0.37 + spot.y * 0.13) % 1
	};
}

/** Where the barge is at a time: its left edge and the height of its top */
export function platformAt(platform: Platform, time: number): { x: number; y: number } {
	const swing = platform.range * Math.sin(2 * Math.PI * (time / platform.period + platform.phase));
	return {
		x: platform.cx - PLATFORM_W / 2 + (platform.axis === 'x' ? swing : 0),
		y: platform.cy + (platform.axis === 'y' ? swing : 0)
	};
}

/** A barge in a running world: its box (left edge, top) and how far it moved in the last step */
export interface PlatformState extends Box {
	platform: Platform;
	dx: number;
	dy: number;
}

export function createPlatformState(platform: Platform, time = 0): PlatformState {
	const at = platformAt(platform, time);
	return { platform, x: at.x, y: at.y, w: PLATFORM_W, h: PLATFORM_H, dx: 0, dy: 0 };
}

export function stepPlatform(state: PlatformState, time: number): void {
	const at = platformAt(state.platform, time);
	state.dx = at.x - state.x;
	state.dy = at.y - state.y;
	state.x = at.x;
	state.y = at.y;
}

/** Everything a barge ever covers: its whole travel, thickness included */
export function platformSweepBox(platform: Platform): Box {
	const sideways = platform.axis === 'x';
	return {
		x: platform.cx - PLATFORM_W / 2 - (sideways ? platform.range : 0),
		y: platform.cy - (sideways ? 0 : platform.range),
		w: PLATFORM_W + (sideways ? 2 * platform.range : 0),
		h: PLATFORM_H + (sideways ? 0 : 2 * platform.range)
	};
}

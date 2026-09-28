/*
 * Seeded, always-reachable gap generator for Flamingo Flight (requirements Section 8).
 * Each segment is a row of obstacle columns with one vertical gap each. Gaps start generous and
 * shrink to a fixed minimum; the vertical shift between consecutive gaps is capped by what the
 * fixed flap strength and gravity can actually cover in the time between two columns.
 */
import { pickOne, type Random } from '../random';
import {
	FLAMINGO_RADIUS,
	FLAP_VELOCITY,
	GROUND_Y,
	MAX_FALL_SPEED,
	SCROLL_SPEED,
	STEP_SECONDS,
	integrate,
	type Body,
	type Rect
} from './physics';

export const COLUMN_WIDTH = 56;
export const START_GAP = 200;
export const MIN_GAP = 132;
export const GAP_SHRINK_PER_GAP = 5;
export const GAP_SHRINK_PER_SEGMENT = 12;
/** Horizontal distance between the left edges of two consecutive columns */
export const START_SPACING = 250;
export const MIN_SPACING = 210;
export const SPACING_SHRINK_PER_SEGMENT = 8;
/** Largest vertical shift between consecutive gap centers, before the reach bound */
export const START_SHIFT = 70;
export const SHIFT_GROWTH_PER_SEGMENT = 12;
export const MAX_SHIFT = 130;
export const START_GAP_COUNT = 8;
export const MAX_GAP_COUNT = 14;
/** Minimum height of the obstacle above and below every gap */
export const EDGE_MARGIN = 60;
/** The first gap of a segment sits within this distance of the middle of the sky */
export const FIRST_GAP_SPREAD = 70;
/** The reach bound assumes no more than four taps per second, well within comfortable tapping */
export const TAP_INTERVAL_SECONDS = 0.25;
/** Only this share of the physically possible shift is ever used */
export const REACH_SAFETY = 0.7;

/** Bottom obstacles are radar masts or power pylons; the top is always a barrage balloon stack */
export type ColumnKind = 'radar' | 'pylon';

export interface GapColumn {
	/** Left edge in world units */
	x: number;
	gapTop: number;
	gapBottom: number;
	kind: ColumnKind;
}

export function gapCountFor(segment: number): number {
	return Math.min(START_GAP_COUNT + segment, MAX_GAP_COUNT);
}

export function gapSizeFor(segment: number, index: number): number {
	return Math.max(
		MIN_GAP,
		START_GAP - segment * GAP_SHRINK_PER_SEGMENT - index * GAP_SHRINK_PER_GAP
	);
}

export function spacingFor(segment: number): number {
	return Math.max(MIN_SPACING, START_SPACING - segment * SPACING_SHRINK_PER_SEGMENT);
}

/** Seconds between the flamingo clearing one column and touching the next */
export function transitSeconds(spacing: number): number {
	return (spacing - COLUMN_WIDTH - 2 * FLAMINGO_RADIUS) / SCROLL_SPEED;
}

function displacement(start: Body, seconds: number, tapEverySteps: number | null): number {
	let body = start;
	const steps = Math.floor(seconds / STEP_SECONDS);
	for (let step = 0; step < steps; step++) {
		body = integrate(body, tapEverySteps !== null && step % tapEverySteps === 0);
	}
	return body.y - start.y;
}

/** How far the flamingo can climb in the given time, starting from its fastest fall */
export function climbReach(seconds: number): number {
	const tapEverySteps = Math.round(TAP_INTERVAL_SECONDS / STEP_SECONDS);
	return -displacement({ y: 0, vy: MAX_FALL_SPEED }, seconds, tapEverySteps);
}

/** How far the flamingo can drop in the given time, starting right after a flap */
export function dropReach(seconds: number): number {
	return displacement({ y: 0, vy: FLAP_VELOCITY }, seconds, null);
}

export function maxShiftFor(segment: number): number {
	const seconds = transitSeconds(spacingFor(segment));
	const reach = Math.min(climbReach(seconds), dropReach(seconds));
	return Math.min(
		START_SHIFT + segment * SHIFT_GROWTH_PER_SEGMENT,
		MAX_SHIFT,
		Math.floor(REACH_SAFETY * reach)
	);
}

export function gapCenter(column: GapColumn): number {
	return (column.gapTop + column.gapBottom) / 2;
}

export function topRect(column: GapColumn): Rect {
	return { x: column.x, y: 0, width: COLUMN_WIDTH, height: column.gapTop };
}

export function bottomRect(column: GapColumn): Rect {
	return {
		x: column.x,
		y: column.gapBottom,
		width: COLUMN_WIDTH,
		height: GROUND_Y - column.gapBottom
	};
}

/** Generates the columns of one segment, the first one with its left edge at firstX */
export function generateGapSequence(random: Random, segment: number, firstX: number): GapColumn[] {
	const count = gapCountFor(segment);
	const spacing = spacingFor(segment);
	const maxShift = maxShiftFor(segment);
	const columns: GapColumn[] = [];
	let center = GROUND_Y / 2;

	for (let index = 0; index < count; index++) {
		const size = gapSizeFor(segment, index);
		const lowest = Math.ceil(EDGE_MARGIN + size / 2);
		const highest = Math.floor(GROUND_Y - EDGE_MARGIN - size / 2);
		const spread = index === 0 ? FIRST_GAP_SPREAD : maxShift;
		const base = index === 0 ? GROUND_Y / 2 : center;
		center = Math.min(highest, Math.max(lowest, Math.round(base + (random() * 2 - 1) * spread)));
		columns.push({
			x: firstX + index * spacing,
			gapTop: center - size / 2,
			gapBottom: center + size / 2,
			kind: pickOne(random, ['radar', 'pylon'] as const)
		});
	}
	return columns;
}

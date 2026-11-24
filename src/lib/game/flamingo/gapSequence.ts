/*
 * Seeded, always-reachable gap generator for Flamingo Flight (requirements Section 8).
 * Each segment is a row of obstacle columns with one vertical gap each. Gaps start generous and
 * shrink to a fixed minimum; the vertical shift between consecutive gaps is capped by what the
 * fixed flap strength and gravity can actually cover in the time between two columns.
 */
import { pickOne, pickWeighted, type Random } from '../random';
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

/**
 * Bottom obstacles are radar masts or Pantsir towers. The rare Crimea bridge is not an obstacle
 * but a target: it has open sky above it, and flying into it brings a span down for a lot of points
 */
export type ColumnKind = 'radar' | 'pantsir' | 'bridge';
/** The column kinds that end the run when touched */
export type ObstacleKind = Exclude<ColumnKind, 'bridge'>;
/** The top obstacle hangs from the sky: a drone net or a stack of barrage balloons */
export type TopKind = 'net' | 'balloon';
/** Chance per column that it is the rare Crimea bridge instead of a mast or tower */
export const BRIDGE_CHANCE = 0.06;
/** Points for striking a bridge, versus GAP_POINTS for clearing an everyday column */
export const BRIDGE_POINTS = 150;
/** The bridge reaches this far past its column on either side, to make it a big target */
export const BRIDGE_OVERHANG = 24;
/** Height of the truss arch above the bridge deck, which counts as part of the target */
export const BRIDGE_ARCH = 22;

export interface GapColumn {
	/** Left edge in world units */
	x: number;
	gapTop: number;
	gapBottom: number;
	kind: ColumnKind;
	/** Ignored on a bridge, which has open sky above it */
	top: TopKind;
	/** Set once a bridge has been struck: its span is down and it is no longer a target */
	struck?: boolean;
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

/** The hanging obstacle above the gap; a bridge has none, so its rect is empty */
export function topRect(column: GapColumn): Rect {
	if (column.kind === 'bridge') return { x: column.x, y: 0, width: COLUMN_WIDTH, height: 0 };
	return { x: column.x, y: 0, width: COLUMN_WIDTH, height: column.gapTop };
}

export function bottomRect(column: GapColumn): Rect {
	if (column.kind === 'bridge') return bridgeRect(column);
	return {
		x: column.x,
		y: column.gapBottom,
		width: COLUMN_WIDTH,
		height: GROUND_Y - column.gapBottom
	};
}

/** The whole bridge, arch and piers included: wider than a column and a big target */
export function bridgeRect(column: GapColumn): Rect {
	const top = column.gapBottom - BRIDGE_ARCH;
	return {
		x: column.x - BRIDGE_OVERHANG,
		y: top,
		width: COLUMN_WIDTH + 2 * BRIDGE_OVERHANG,
		height: GROUND_Y - top
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
			kind: pickWeighted(random, [
				{ item: 'radar', weight: (1 - BRIDGE_CHANCE) / 2 },
				{ item: 'pantsir', weight: (1 - BRIDGE_CHANCE) / 2 },
				{ item: 'bridge', weight: BRIDGE_CHANCE }
			]),
			top: 'net'
		});
	}
	// Picked after the gaps, so the shape of the gaps does not depend on it
	for (const column of columns) column.top = pickOne(random, ['net', 'balloon'] as const);
	return columns;
}

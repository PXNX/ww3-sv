/*
 * Course generator for Run Comrade. It lays out rows of obstacles (one cell per lane), pickups
 * between the rows and patches of tall sunflowers, ahead of the runner, from a seeded random.
 *
 * Fairness is the point of this file. Every candidate row is checked against a small model of what
 * the player can do between two rows (see advanceReach): stay in the lane and jump or duck, or slide
 * over one or two lanes, each needing reaction time, and a jump or duck needing time to finish. A row
 * is only placed if at least one lane can still be reached, and rows are spaced so that even the
 * worst case (a jump, then two lane changes) fits into the time between them at the speed of the
 * later row. So no pattern the generator produces is an unavoidable hit, and checkFairness can
 * verify any hand-made or generated sequence the same way.
 */
import { pickWeighted, randomInt, shuffle, type Random } from '#lib/game/random.js';
import {
	ACTION_COST_MS,
	BASE_SPEED,
	FIRST_ROW_Z,
	FULL_DENSITY_DISTANCE,
	KIND_UNLOCK,
	LANES,
	LANE_COST_MS,
	MAX_SPEED,
	MIN_GAP_MS,
	OBSTACLE_KINDS,
	REACTION_MS,
	REQUIRED_ACTION,
	SPEED_RAMP,
	START_GAP_MS,
	type Lane,
	type ObstacleKind,
	type PickupKind
} from './config';

export type Cell = ObstacleKind | null;
export type Cells = readonly [Cell, Cell, Cell];
export type Flags = readonly [boolean, boolean, boolean];

export interface Row {
	id: number;
	/** Distance along the course */
	z: number;
	cells: Cells;
	/** Which cells already did their job (the runner passed them), so they cannot hit twice */
	spent: [boolean, boolean, boolean];
}

export interface Pickup {
	id: number;
	kind: PickupKind;
	lane: Lane;
	z: number;
	taken: boolean;
}

/** Tall sunflowers that hide the drone from a runner in one of their lanes */
export interface Patch {
	id: number;
	zStart: number;
	zEnd: number;
	lanes: readonly Lane[];
}

export interface Field {
	rows: Row[];
	pickups: Pickup[];
	patches: Patch[];
}

export interface Generator {
	/** Where the generator tries to place its next row */
	nextZ: number;
	/** Distance of the last placed row, null before the first */
	lastZ: number | null;
	/** Lanes the player can be in after the last placed row */
	reach: Flags;
	/** Which lanes of the last placed row held an obstacle */
	busy: Flags;
	nextPickupZ: number;
	nextPatchZ: number;
	nextId: number;
}

export function createField(): Field {
	return { rows: [], pickups: [], patches: [] };
}

export function createGenerator(): Generator {
	return {
		nextZ: FIRST_ROW_Z,
		lastZ: null,
		reach: [false, true, false],
		busy: [false, false, false],
		nextPickupZ: FIRST_ROW_Z + 25,
		nextPatchZ: 50,
		nextId: 1
	};
}

/** Running speed on the course, before boosts and stumbles */
export function speedAt(distance: number): number {
	return Math.min(MAX_SPEED, BASE_SPEED + Math.max(0, distance) * SPEED_RAMP);
}

/** How crowded the field is, from 0 at the start to 1 at full density */
export function densityAt(distance: number): number {
	return Math.min(1, Math.max(0, distance / FULL_DENSITY_DISTANCE));
}

/** The planned time between two obstacle rows; it shrinks as the field gets denser */
export function gapMsAt(distance: number): number {
	const density = densityAt(distance);
	return START_GAP_MS + (MIN_GAP_MS - START_GAP_MS) * density;
}

export function isBlocking(cell: Cell): boolean {
	return cell !== null && REQUIRED_ACTION[cell] === 'dodge';
}

/** Time the player needs to get from one lane to another between two rows */
export function transitionCostMs(busyBefore: boolean, from: Lane, to: Lane): number {
	return (busyBefore ? ACTION_COST_MS : 0) + Math.abs(to - from) * LANE_COST_MS + REACTION_MS;
}

/**
 * The lanes the player can be in after clearing a row, given where they could be after the row
 * before and how much time lies between the two. A lane with a mine cannot be entered (mines can
 * only be sidestepped); a lane with a ditch or an arm can, by jumping or ducking.
 */
export function advanceReach(reach: Flags, busy: Flags, cells: Cells, gapMs: number): Flags {
	const next = LANES.map(
		(to) =>
			!isBlocking(cells[to]) &&
			LANES.some((from) => reach[from] && transitionCostMs(busy[from], from, to) <= gapMs)
	);
	return [next[0], next[1], next[2]];
}

export interface FairnessReport {
	fair: boolean;
	/** Index of the first row that cannot be survived or is too close to the one before */
	failedRow: number | null;
	reason: 'none' | 'blocked' | 'too-close';
}

/**
 * Checks a sequence of rows (sorted by distance) from the start: every row must leave a lane the
 * player can reach, and no two rows may be closer than MIN_GAP_MS at the speed of the later row.
 */
export function checkFairness(
	rows: readonly { z: number; cells: Cells }[],
	speed: (distance: number) => number = speedAt
): FairnessReport {
	let reach: Flags = [false, true, false];
	let busy: Flags = [false, false, false];
	let lastZ: number | null = null;
	for (let index = 0; index < rows.length; index++) {
		const { z, cells } = rows[index];
		const gapMs = lastZ === null ? Number.POSITIVE_INFINITY : ((z - lastZ) / speed(z)) * 1000;
		if (gapMs < MIN_GAP_MS) return { fair: false, failedRow: index, reason: 'too-close' };
		reach = advanceReach(reach, busy, cells, gapMs);
		if (!reach.some(Boolean)) return { fair: false, failedRow: index, reason: 'blocked' };
		busy = [cells[0] !== null, cells[1] !== null, cells[2] !== null];
		lastZ = z;
	}
	return { fair: true, failedRow: null, reason: 'none' };
}

/** A random row of obstacles for this stretch of the course (not yet checked for fairness) */
export function rollCells(random: Random, distance: number): Cells {
	const density = densityAt(distance);
	const count = pickWeighted(random, [
		{ item: 1, weight: 6 - 3 * density },
		{ item: 2, weight: 3 + density },
		{ item: 3, weight: 4 * Math.max(0, density - 0.2) }
	]);
	const kinds = OBSTACLE_KINDS.filter((kind) => distance >= KIND_UNLOCK[kind]);
	const weights: Record<ObstacleKind, number> = { ditch: 4, arm: 3, mine: 3 };
	const cells: Cell[] = [null, null, null];
	for (const lane of shuffle(random, LANES).slice(0, count)) {
		cells[lane] = pickWeighted(
			random,
			kinds.map((kind) => ({ item: kind, weight: weights[kind] }))
		);
	}
	return [cells[0], cells[1], cells[2]];
}

const MAX_ATTEMPTS = 8;
/** Pickups sit at least this far from any row */
const PICKUP_CLEARANCE = 3;

/**
 * Generates the course up to the given distance. Safe to call every frame: it only adds what is
 * missing. All randomness comes from the given random, so a seed reproduces a course.
 */
export function extendField(
	field: Field,
	generator: Generator,
	random: Random,
	until: number
): void {
	while (generator.nextZ <= until) {
		const z = generator.nextZ;
		const gapMs =
			generator.lastZ === null
				? Number.POSITIVE_INFINITY
				: ((z - generator.lastZ) / speedAt(z)) * 1000;
		let placed = false;

		if (gapMs >= MIN_GAP_MS) {
			for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
				const cells = rollCells(random, z);
				const reach = advanceReach(generator.reach, generator.busy, cells, gapMs);
				if (!reach.some(Boolean)) continue;
				placed = true;
				placeRow(field, generator, random, z, cells, reach);
			}
		}

		if (placed) {
			// Aim for the planned gap, converted at the speed further ahead (faster, so conservative)
			const jitter = 1 + random() * 0.35;
			generator.nextZ = z + (gapMsAt(z) / 1000) * jitter * speedAt(z + 50);
		} else {
			// A rare dead end: wait a little and try again with more time on the clock
			generator.nextZ = z + 4;
		}
	}
	extendPatches(field, generator, random, until);
}

function placeRow(
	field: Field,
	generator: Generator,
	random: Random,
	z: number,
	cells: Cells,
	reach: Flags
) {
	const previous = field.rows.at(-1);
	field.rows.push({ id: generator.nextId++, z, cells, spent: [false, false, false] });

	if (previous && z >= generator.nextPickupZ) {
		const middle = (previous.z + z) / 2;
		const free = LANES.filter((lane) => previous.cells[lane] === null && cells[lane] === null);
		if (free.length > 0 && middle - previous.z >= PICKUP_CLEARANCE) {
			const lane = free[randomInt(random, 0, free.length)];
			const kind: PickupKind = random() < 0.45 ? 'helmet' : 'rice';
			field.pickups.push({ id: generator.nextId++, kind, lane, z: middle, taken: false });
			generator.nextPickupZ = z + 55 + random() * 55;
		}
	}

	generator.reach = reach;
	generator.busy = [cells[0] !== null, cells[1] !== null, cells[2] !== null];
	generator.lastZ = z;
}

function extendPatches(field: Field, generator: Generator, random: Random, until: number) {
	while (generator.nextPatchZ <= until) {
		const zStart = generator.nextPatchZ;
		const length = 14 + random() * 10;
		const lanes: Lane[] =
			random() < 0.5
				? [LANES[randomInt(random, 0, LANES.length)]]
				: shuffle(random, LANES)
						.slice(0, 2)
						.sort((a, b) => a - b);
		field.patches.push({ id: generator.nextId++, zStart, zEnd: zStart + length, lanes });
		// Tall patches come more often as the field thickens
		const spacing = (50 + random() * 60) * (1 - 0.45 * densityAt(zStart));
		generator.nextPatchZ = zStart + length + spacing;
	}
}

/** Drops everything the runner has left far behind */
export function pruneField(field: Field, behindZ: number): void {
	field.rows = field.rows.filter((row) => row.z >= behindZ);
	field.pickups = field.pickups.filter((pickup) => pickup.z >= behindZ);
	field.patches = field.patches.filter((patch) => patch.zEnd >= behindZ);
}

/** Whether the runner at this distance and lane is inside tall sunflowers */
export function inTallSunflowers(field: Field, distance: number, lane: Lane, tail = 0): boolean {
	return field.patches.some(
		(patch) =>
			distance >= patch.zStart && distance <= patch.zEnd + tail && patch.lanes.includes(lane)
	);
}

/** The lane closest to a lane position, for hit tests and cover tests that take a whole lane */
export function nearestLane(position: number): Lane {
	return Math.min(2, Math.max(0, Math.round(position))) as Lane;
}

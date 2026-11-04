/*
 * Maple Reserve Heist levels: a warehouse grid with shelves, a cart start, a truck, barrels and
 * moose guards that patrol along a route, stand guard and turn, or walk a loop. Levels are written
 * as text rows: # shelf, . aisle, S cart start, T truck, B barrel, G golden barrel, L lever that
 * unlocks the truck, C coffee pad, H toque pad.
 */
import { BOSS_RANGE, GUARD_RANGE, SENTRY_TURN_EVERY } from './config.js';

export interface Cell {
	row: number;
	col: number;
}

export const DIRS = ['up', 'down', 'left', 'right'] as const;
export type Dir = (typeof DIRS)[number];

export const DELTAS: Record<Dir, Cell> = {
	up: { row: -1, col: 0 },
	down: { row: 1, col: 0 },
	left: { row: 0, col: -1 },
	right: { row: 0, col: 1 }
};

export function sameCell(a: Cell, b: Cell): boolean {
	return a.row === b.row && a.col === b.col;
}

/** The direction of a single step between two neighbouring cells, null when they are not */
export function directionBetween(from: Cell, to: Cell): Dir | null {
	return (
		DIRS.find((dir) =>
			sameCell({ row: from.row + DELTAS[dir].row, col: from.col + DELTAS[dir].col }, to)
		) ?? null
	);
}

export function opposite(dir: Dir): Dir {
	return { up: 'down', down: 'up', left: 'right', right: 'left' }[dir] as Dir;
}

export type GadgetKind = 'coffee' | 'toque';

/** How a moose moves: back and forth, around a closed loop, or on the spot turning clockwise */
export type GuardMode = 'patrol' | 'loop' | 'sentry';

/** A level as authored: waypoints are [row, col] corners of a straight-lined patrol route */
export interface GuardSpec {
	waypoints: readonly (readonly [number, number])[];
	/** The boss moose in the tiny tariff hat sees further */
	boss?: boolean;
	/** Defaults to a patrol; a loop closes the route by itself, a sentry uses the first waypoint only */
	mode?: GuardMode;
	/** A patrol stands still this many extra ticks at each end of its route */
	dwell?: number;
	/** A sentry turns a quarter clockwise every this many ticks */
	turnEvery?: number;
	/** Where a sentry looks at the start */
	facing?: Dir;
}

export interface LevelSpec {
	id: string;
	map: readonly string[];
	guards: readonly GuardSpec[];
	/** Barrels that must reach the truck to finish the level */
	quota: number;
	/** Fewest moves of a clean run that brings every barrel home */
	par: number;
}

export interface Guard {
	/** Every cell of the route, one step apart; the moose walks it there and back */
	route: readonly Cell[];
	boss: boolean;
	range: number;
	mode: GuardMode;
	dwell: number;
	turnEvery: number;
	/** Set for a sentry; the others look along their route */
	facing: Dir | null;
}

export interface Pad {
	cell: Cell;
	kind: GadgetKind;
}

export interface Level {
	id: string;
	width: number;
	height: number;
	walls: readonly (readonly boolean[])[];
	start: Cell;
	truck: Cell;
	barrels: readonly Cell[];
	/** Parallel to barrels: the golden ones are worth more and make the cart louder */
	golden: readonly boolean[];
	/** The lever that unlocks the truck; null when the truck is open from the start */
	lever: Cell | null;
	pads: readonly Pad[];
	guards: readonly Guard[];
	quota: number;
	par: number;
}

/** Fills in the cells between the waypoints, which must share a row or a column */
export function expandRoute(waypoints: GuardSpec['waypoints']): Cell[] {
	if (waypoints.length === 0) throw new Error('A guard route needs a waypoint');
	const route: Cell[] = [{ row: waypoints[0][0], col: waypoints[0][1] }];
	for (const [row, col] of waypoints.slice(1)) {
		let last = route[route.length - 1];
		if (last.row !== row && last.col !== col) throw new Error('Route corners must be aligned');
		while (last.row !== row || last.col !== col) {
			last = {
				row: last.row + Math.sign(row - last.row),
				col: last.col + Math.sign(col - last.col)
			};
			route.push(last);
		}
	}
	return route;
}

/** A closed route: the waypoints in order and then back to the first one, without repeating it */
export function expandLoop(waypoints: GuardSpec['waypoints']): Cell[] {
	const route = expandRoute([...waypoints, waypoints[0]]);
	return route.slice(0, -1);
}

const PAD_CHARS: Record<string, GadgetKind> = { C: 'coffee', H: 'toque' };

export function parseLevel(spec: LevelSpec): Level {
	const height = spec.map.length;
	const width = spec.map[0]?.length ?? 0;
	if (height === 0 || width === 0) throw new Error(`Level ${spec.id} is empty`);
	let start: Cell | null = null;
	let truck: Cell | null = null;
	const barrels: Cell[] = [];
	const golden: boolean[] = [];
	const pads: Pad[] = [];
	let lever: Cell | null = null;
	const walls = spec.map.map((line, row) => {
		if (line.length !== width) throw new Error(`Level ${spec.id} has a ragged row ${row}`);
		return [...line].map((char, col) => {
			if (char === 'S') start = { row, col };
			else if (char === 'T') truck = { row, col };
			else if (char === 'B' || char === 'G') {
				barrels.push({ row, col });
				golden.push(char === 'G');
			} else if (char === 'L') lever = { row, col };
			else if (char in PAD_CHARS) pads.push({ cell: { row, col }, kind: PAD_CHARS[char] });
			else if (char !== '#' && char !== '.')
				throw new Error(`Level ${spec.id}: bad cell "${char}"`);
			return char === '#';
		});
	});
	if (!start || !truck) throw new Error(`Level ${spec.id} needs a start and a truck`);
	return {
		id: spec.id,
		width,
		height,
		walls,
		start,
		truck,
		barrels,
		golden,
		lever,
		pads,
		guards: spec.guards.map(parseGuard),
		quota: spec.quota,
		par: spec.par
	};
}

function parseGuard(guard: GuardSpec): Guard {
	const mode = guard.mode ?? 'patrol';
	const route =
		mode === 'loop'
			? expandLoop(guard.waypoints)
			: mode === 'sentry'
				? expandRoute(guard.waypoints.slice(0, 1))
				: expandRoute(guard.waypoints);
	return {
		route,
		boss: guard.boss ?? false,
		range: guard.boss ? BOSS_RANGE : GUARD_RANGE,
		mode,
		dwell: guard.dwell ?? 0,
		turnEvery: guard.turnEvery ?? SENTRY_TURN_EVERY,
		facing: mode === 'sentry' ? (guard.facing ?? 'down') : null
	};
}

export function inBounds(level: Level, cell: Cell): boolean {
	return cell.row >= 0 && cell.col >= 0 && cell.row < level.height && cell.col < level.width;
}

/** Shelves and the outside of the warehouse block movement and sight */
export function isWall(level: Level, cell: Cell): boolean {
	return !inBounds(level, cell) || level.walls[cell.row][cell.col];
}

/**
 * The aisle cells a moose looking in a direction sees: a straight line ahead that widens to
 * three cells from the second step on. Shelves stop the sight, also sideways.
 */
export function visibleCells(level: Level, at: Cell, facing: Dir, range: number): Cell[] {
	const ahead = DELTAS[facing];
	const side = { row: ahead.col, col: ahead.row };
	const seen: Cell[] = [];
	for (let distance = 1; distance <= range; distance++) {
		const centre = { row: at.row + ahead.row * distance, col: at.col + ahead.col * distance };
		if (isWall(level, centre)) break;
		seen.push(centre);
		if (distance < 2) continue;
		for (const sign of [-1, 1]) {
			const cell = { row: centre.row + side.row * sign, col: centre.col + side.col * sign };
			if (!isWall(level, cell)) seen.push(cell);
		}
	}
	return seen;
}

export function clockwise(dir: Dir): Dir {
	return { up: 'right', right: 'down', down: 'left', left: 'up' }[dir] as Dir;
}

/** Aisle steps between two cells (breadth first through open cells), Infinity beyond the limit */
export function aisleDistance(level: Level, from: Cell, to: Cell, limit: number): number {
	if (sameCell(from, to)) return 0;
	const seen = new Set([`${from.row},${from.col}`]);
	let frontier = [from];
	for (let distance = 1; distance <= limit; distance++) {
		const next: Cell[] = [];
		for (const cell of frontier) {
			for (const dir of DIRS) {
				const step = { row: cell.row + DELTAS[dir].row, col: cell.col + DELTAS[dir].col };
				const key = `${step.row},${step.col}`;
				if (seen.has(key) || isWall(level, step)) continue;
				if (sameCell(step, to)) return distance;
				seen.add(key);
				next.push(step);
			}
		}
		frontier = next;
	}
	return Infinity;
}

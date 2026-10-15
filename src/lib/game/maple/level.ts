/*
 * Maple Reserve Heist levels: a warehouse grid with shelves, a cart start, a truck, barrels and
 * moose guards that patrol back and forth along a route. Levels are written as text rows:
 * # shelf, . aisle, S cart start, T truck, B barrel.
 */
import { BOSS_RANGE, GUARD_RANGE } from './config.js';

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

/** A level as authored: waypoints are [row, col] corners of a straight-lined patrol route */
export interface GuardSpec {
	waypoints: readonly (readonly [number, number])[];
	/** The boss moose in the tiny tariff hat sees further */
	boss?: boolean;
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
}

export interface Level {
	id: string;
	width: number;
	height: number;
	walls: readonly (readonly boolean[])[];
	start: Cell;
	truck: Cell;
	barrels: readonly Cell[];
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

export function parseLevel(spec: LevelSpec): Level {
	const height = spec.map.length;
	const width = spec.map[0]?.length ?? 0;
	if (height === 0 || width === 0) throw new Error(`Level ${spec.id} is empty`);
	let start: Cell | null = null;
	let truck: Cell | null = null;
	const barrels: Cell[] = [];
	const walls = spec.map.map((line, row) => {
		if (line.length !== width) throw new Error(`Level ${spec.id} has a ragged row ${row}`);
		return [...line].map((char, col) => {
			if (char === 'S') start = { row, col };
			else if (char === 'T') truck = { row, col };
			else if (char === 'B') barrels.push({ row, col });
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
		guards: spec.guards.map((guard) => ({
			route: expandRoute(guard.waypoints),
			boss: guard.boss ?? false,
			range: guard.boss ? BOSS_RANGE : GUARD_RANGE
		})),
		quota: spec.quota,
		par: spec.par
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

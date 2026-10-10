/*
 * The shape of a Bureaucracy Maze and the small helpers around it. A maze is a graph of offices
 * (rooms) laid out on a grid; the doors are the edges. A door may be locked behind a document the
 * player has to carry: a stamp or a form that lies in some other office. Some offices are closed
 * ("until Tuesday") and can never be entered in this run. Everything here is plain data and pure
 * functions, so generation, solving and play are all testable without a browser.
 */

export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DELTAS: Record<Direction, { row: number; col: number }> = {
	up: { row: -1, col: 0 },
	right: { row: 0, col: 1 },
	down: { row: 1, col: 0 },
	left: { row: 0, col: -1 }
};

export const OPPOSITE: Record<Direction, Direction> = {
	up: 'down',
	right: 'left',
	down: 'up',
	left: 'right'
};

/** The documents that unlock doors: three stamps and two forms */
export const ITEM_KINDS = [
	'entry-stamp',
	'approval-stamp',
	'form-27b',
	'form-annex',
	'seal'
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type ItemFamily = 'stamp' | 'form';

/** The seal counts as a stamp */
export function itemFamily(kind: ItemKind): ItemFamily {
	return kind === 'form-27b' || kind === 'form-annex' ? 'form' : 'stamp';
}

export interface Door {
	/** The room on the other side */
	to: number;
	/** The document needed to pass, or null for a door anybody may walk through */
	lock: ItemKind | null;
}

export interface Maze {
	seed: number;
	width: number;
	height: number;
	/** Room the player starts in */
	start: number;
	/** Room that holds the counter with Passierschein B-38 */
	goal: number;
	/** For each room the door in each of DIRECTIONS (same order), or null for a wall */
	doors: readonly (readonly (Door | null)[])[];
	/** The document lying in each room, or null */
	items: readonly (ItemKind | null)[];
	/** Rooms that are closed until Tuesday, sorted */
	closed: readonly number[];
}

export const roomCount = (maze: Pick<Maze, 'width' | 'height'>): number => maze.width * maze.height;
export const rowOf = (maze: Pick<Maze, 'width'>, room: number): number =>
	Math.floor(room / maze.width);
export const colOf = (maze: Pick<Maze, 'width'>, room: number): number => room % maze.width;

/** The room next to another in a direction, or null at the edge of the building */
export function neighbour(
	maze: Pick<Maze, 'width' | 'height'>,
	room: number,
	direction: Direction
): number | null {
	const row = Math.floor(room / maze.width) + DELTAS[direction].row;
	const col = (room % maze.width) + DELTAS[direction].col;
	if (row < 0 || col < 0 || row >= maze.height || col >= maze.width) return null;
	return row * maze.width + col;
}

export function doorAt(maze: Maze, room: number, direction: Direction): Door | null {
	return maze.doors[room][DIRECTIONS.indexOf(direction)];
}

export function isClosed(maze: Maze, room: number): boolean {
	return maze.closed.includes(room);
}

/** The direction from one room to an adjacent one, or null when they do not touch */
export function directionBetween(maze: Maze, from: number, to: number): Direction | null {
	return DIRECTIONS.find((direction) => neighbour(maze, from, direction) === to) ?? null;
}

/** Number of doors (each counted once) */
export function doorCount(maze: Maze): number {
	let count = 0;
	maze.doors.forEach((row, room) => {
		for (const door of row) if (door && door.to > room) count++;
	});
	return count;
}

/** Bit of an item kind in a "documents carried" mask */
export const itemBit = (kind: ItemKind): number => 1 << ITEM_KINDS.indexOf(kind);

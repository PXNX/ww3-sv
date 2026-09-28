/*
 * Pipe tile geometry for Pipeline Panic: the four tile kinds, their openings, and quarter-turn
 * rotation. Directions are numbered clockwise from north so rotating is simple modular addition.
 */

export type Direction = 0 | 1 | 2 | 3;

export const NORTH: Direction = 0;
export const EAST: Direction = 1;
export const SOUTH: Direction = 2;
export const WEST: Direction = 3;

export const DIRECTIONS: readonly Direction[] = [NORTH, EAST, SOUTH, WEST];

/** Row and column offsets of the neighbor in each direction */
export const DELTA: Record<Direction, { row: number; col: number }> = {
	0: { row: -1, col: 0 },
	1: { row: 0, col: 1 },
	2: { row: 1, col: 0 },
	3: { row: 0, col: -1 }
};

export type TileKind = 'straight' | 'elbow' | 'tee' | 'cross';

export const TILE_KINDS: readonly TileKind[] = ['straight', 'elbow', 'tee', 'cross'];

/** Number of clockwise quarter turns applied to the base shape */
export type Rotation = 0 | 1 | 2 | 3;

export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

/** Openings of each kind before rotation */
const BASE_OPENINGS: Record<TileKind, readonly Direction[]> = {
	straight: [NORTH, SOUTH],
	elbow: [NORTH, EAST],
	tee: [NORTH, EAST, SOUTH],
	cross: [NORTH, EAST, SOUTH, WEST]
};

export function opposite(direction: Direction): Direction {
	return ((direction + 2) % 4) as Direction;
}

export function rotateOnce(rotation: Rotation): Rotation {
	return ((rotation + 1) % 4) as Rotation;
}

/** Openings of a rotated tile, sorted clockwise from north */
export function openings(kind: TileKind, rotation: Rotation): Direction[] {
	return BASE_OPENINGS[kind]
		.map((direction) => ((direction + rotation) % 4) as Direction)
		.sort((a, b) => a - b);
}

export function hasOpening(kind: TileKind, rotation: Rotation, direction: Direction): boolean {
	return BASE_OPENINGS[kind].includes(((direction - rotation + 4) % 4) as Direction);
}

/** Every rotation of the kind that is open towards all the required directions */
export function rotationsFor(kind: TileKind, required: readonly Direction[]): Rotation[] {
	return ROTATIONS.filter((rotation) =>
		required.every((direction) => hasOpening(kind, rotation, direction))
	);
}

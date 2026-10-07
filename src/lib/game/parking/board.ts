/*
 * Tanker Parking rules (a sliding block puzzle). Ships sit on a grid and slide only along their own
 * axis; rocks never move. The tanker sits in its row and has to reach the exit at the right edge.
 *
 * A puzzle is described by a Level (plain JSON). The running state is just one number per piece:
 * where along its axis the piece starts. Everything here is pure, so the solver and the tests need
 * neither a DOM nor the store.
 */

export type Axis = 'h' | 'v';
export type Tier = 'easy' | 'medium' | 'hard';

export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

export interface ShipSpec {
	row: number;
	col: number;
	length: number;
	axis: Axis;
}

/** The tanker always lies horizontally; its exit is the right edge of the board in its row */
export interface TankerSpec {
	row: number;
	col: number;
	length: number;
}

export interface Level {
	id: string;
	tier: Tier;
	width: number;
	height: number;
	/** Fewest moves that solve the level (checked by the solver in the level tests) */
	par: number;
	tanker: TankerSpec;
	ships: ShipSpec[];
	/** Fixed rocks as [row, col] */
	rocks: [number, number][];
}

export interface Piece {
	axis: Axis;
	/** The fixed coordinate: the row of a horizontal piece, the column of a vertical one */
	line: number;
	length: number;
	isTanker: boolean;
}

/** Position of each piece along its axis (column for horizontal, row for vertical) */
export type Positions = readonly number[];

export interface Puzzle {
	width: number;
	height: number;
	/** The tanker is always piece 0 */
	pieces: Piece[];
	rocks: readonly (readonly [number, number])[];
	start: Positions;
}

export interface Range {
	min: number;
	max: number;
}

export const TANKER_INDEX = 0;
export const MAX_STARS = 3;

export function createPuzzle(level: Level): Puzzle {
	const pieces: Piece[] = [
		{ axis: 'h', line: level.tanker.row, length: level.tanker.length, isTanker: true }
	];
	const start: number[] = [level.tanker.col];
	for (const ship of level.ships) {
		pieces.push({
			axis: ship.axis,
			line: ship.axis === 'h' ? ship.row : ship.col,
			length: ship.length,
			isTanker: false
		});
		start.push(ship.axis === 'h' ? ship.col : ship.row);
	}
	return { width: level.width, height: level.height, pieces, rocks: level.rocks, start };
}

/** The cells a piece covers at a position, as [row, col] pairs */
export function cellsOf(piece: Piece, position: number): [number, number][] {
	return Array.from({ length: piece.length }, (_, step): [number, number] =>
		piece.axis === 'h' ? [piece.line, position + step] : [position + step, piece.line]
	);
}

/** Which piece sits in each cell (index, or -1 for water, -2 for a rock); row-major */
export function occupancy(puzzle: Puzzle, positions: Positions): Int16Array {
	const grid = new Int16Array(puzzle.width * puzzle.height).fill(-1);
	for (const [row, col] of puzzle.rocks) grid[row * puzzle.width + col] = -2;
	puzzle.pieces.forEach((piece, index) => {
		for (const [row, col] of cellsOf(piece, positions[index])) {
			grid[row * puzzle.width + col] = index;
		}
	});
	return grid;
}

/** How far a piece can slide from where it is: the free span along its axis, inclusive */
export function slideRange(
	puzzle: Puzzle,
	positions: Positions,
	index: number,
	grid: Int16Array = occupancy(puzzle, positions)
): Range {
	const piece = puzzle.pieces[index];
	const size = piece.axis === 'h' ? puzzle.width : puzzle.height;
	const free = (at: number) => {
		const cell =
			piece.axis === 'h' ? piece.line * puzzle.width + at : at * puzzle.width + piece.line;
		return grid[cell] === -1 || grid[cell] === index;
	};
	let min = positions[index];
	while (min > 0 && free(min - 1)) min--;
	let max = positions[index];
	while (max + piece.length < size && free(max + piece.length)) max++;
	return { min, max };
}

/** Whether the tanker has reached the exit at the right edge */
export function isSolved(puzzle: Puzzle, positions: Positions): boolean {
	return positions[TANKER_INDEX] + puzzle.pieces[TANKER_INDEX].length === puzzle.width;
}

export function samePositions(a: Positions, b: Positions): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** A copy of the positions with one piece moved; the target must lie in the piece's slide range */
export function withMove(positions: Positions, index: number, to: number): number[] {
	return positions.map((value, at) => (at === index ? to : value));
}

/**
 * Stars for a finished level: three for matching the par (the fewest possible moves), two for
 * staying within half again (at least two extra moves), one for any solution.
 */
export function starsFor(moves: number, par: number): number {
	if (moves <= par) return 3;
	if (moves <= par + Math.max(2, Math.ceil(par / 2))) return 2;
	return 1;
}

/** Structural problems of a level, empty when it is well formed (it does not check solvability) */
export function validateLevel(level: Level): string[] {
	const problems: string[] = [];
	const { width, height } = level;
	if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
		return [`${level.id}: the board size ${width}x${height} is not valid`];
	}
	if (!TIERS.includes(level.tier)) problems.push(`${level.id}: unknown tier "${level.tier}"`);
	if (!Number.isInteger(level.par) || level.par < 1)
		problems.push(`${level.id}: par must be 1 or more`);

	const seen = new Map<number, string>();
	const claim = (row: number, col: number, what: string) => {
		if (
			!Number.isInteger(row) ||
			!Number.isInteger(col) ||
			row < 0 ||
			col < 0 ||
			row >= height ||
			col >= width
		) {
			problems.push(`${level.id}: ${what} at ${row},${col} is outside the board`);
			return;
		}
		const key = row * width + col;
		const other = seen.get(key);
		if (other) problems.push(`${level.id}: ${what} overlaps ${other} at ${row},${col}`);
		else seen.set(key, what);
	};

	const { tanker } = level;
	if (tanker.length < 2) problems.push(`${level.id}: the tanker must be at least 2 long`);
	for (let step = 0; step < tanker.length; step++)
		claim(tanker.row, tanker.col + step, 'the tanker');
	level.ships.forEach((ship, index) => {
		if (ship.axis !== 'h' && ship.axis !== 'v')
			problems.push(`${level.id}: ship ${index} has no axis`);
		if (ship.length < 2 || ship.length > 3)
			problems.push(`${level.id}: ship ${index} must be 2 or 3 long`);
		for (let step = 0; step < ship.length; step++) {
			claim(
				ship.row + (ship.axis === 'v' ? step : 0),
				ship.col + (ship.axis === 'h' ? step : 0),
				`ship ${index}`
			);
		}
	});
	level.rocks.forEach(([row, col], index) => claim(row, col, `rock ${index}`));
	return problems;
}

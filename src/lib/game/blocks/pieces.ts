/*
 * Block Puzzle piece set (requirements Section 2): two-by-two and three-by-three squares, the
 * L-shape in four rotations, the Z- and S-shapes in two rotations each, and straight lines of
 * length two to five in both orientations. Pieces are theme-agnostic data; how a kind looks
 * (barrels, tankers, mines) is decided by the components.
 */

/** A cell as [row, column] */
export type Cell = readonly [row: number, col: number];

export type PieceKind = 'square' | 'l' | 'z' | 's' | 'line';

export interface Piece {
	/** Stable identifier, for example 'l-90' or 'line-4-v' */
	id: string;
	kind: PieceKind;
	/** Occupied cells relative to the top-left corner of the bounding box, sorted row by row */
	cells: readonly Cell[];
	width: number;
	height: number;
}

/** Parses a picture such as ['X.', 'XX'] (X = occupied) into cells */
export function parseShape(rows: readonly string[]): Cell[] {
	const cells: Cell[] = [];
	rows.forEach((line, row) => {
		[...line].forEach((char, col) => {
			if (char === 'X') cells.push([row, col]);
		});
	});
	return normalize(cells);
}

/** Moves the shape so its bounding box starts at [0, 0] and sorts the cells row by row */
export function normalize(cells: readonly Cell[]): Cell[] {
	const minRow = Math.min(...cells.map(([row]) => row));
	const minCol = Math.min(...cells.map(([, col]) => col));
	return cells
		.map(([row, col]): Cell => [row - minRow, col - minCol])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Rotates a shape a quarter turn clockwise */
export function rotateClockwise(cells: readonly Cell[]): Cell[] {
	return normalize(cells.map(([row, col]): Cell => [col, -row]));
}

/** A compact, order-independent text form of a shape, used to compare shapes */
export function shapeKey(cells: readonly Cell[]): string {
	return normalize(cells)
		.map(([row, col]) => `${row},${col}`)
		.join(' ');
}

function makePiece(id: string, kind: PieceKind, cells: readonly Cell[]): Piece {
	const normalized = normalize(cells);
	return {
		id,
		kind,
		cells: normalized,
		width: Math.max(...normalized.map(([, col]) => col)) + 1,
		height: Math.max(...normalized.map(([row]) => row)) + 1
	};
}

function rotations(cells: readonly Cell[], count: number): Cell[][] {
	const result = [normalize(cells)];
	while (result.length < count) result.push(rotateClockwise(result[result.length - 1]));
	return result;
}

const L_SHAPE = parseShape(['X.', 'X.', 'XX']);
const Z_SHAPE = parseShape(['XX.', '.XX']);
const S_SHAPE = parseShape(['.XX', 'XX.']);

export const LINE_LENGTHS = [2, 3, 4, 5] as const;

export const PIECES: readonly Piece[] = [
	makePiece('square-2', 'square', parseShape(['XX', 'XX'])),
	makePiece('square-3', 'square', parseShape(['XXX', 'XXX', 'XXX'])),
	...rotations(L_SHAPE, 4).map((cells, turn) => makePiece(`l-${turn * 90}`, 'l', cells)),
	...rotations(Z_SHAPE, 2).map((cells, turn) => makePiece(`z-${turn * 90}`, 'z', cells)),
	...rotations(S_SHAPE, 2).map((cells, turn) => makePiece(`s-${turn * 90}`, 's', cells)),
	...LINE_LENGTHS.flatMap((length) => [
		makePiece(
			`line-${length}-h`,
			'line',
			Array.from({ length }, (_, col): Cell => [0, col])
		),
		makePiece(
			`line-${length}-v`,
			'line',
			Array.from({ length }, (_, row): Cell => [row, 0])
		)
	])
];

export function pieceById(id: string): Piece | undefined {
	return PIECES.find((piece) => piece.id === id);
}

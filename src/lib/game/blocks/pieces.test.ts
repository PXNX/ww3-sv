import { describe, expect, it } from 'vitest';
import {
	LINE_LENGTHS,
	PIECES,
	parseShape,
	pieceById,
	rotateClockwise,
	shapeKey,
	type Cell,
	type Piece
} from './pieces';

function isConnected(cells: readonly Cell[]): boolean {
	const keys = new Set(cells.map(([row, col]) => `${row},${col}`));
	const seen = new Set<string>();
	const stack = [cells[0]];
	while (stack.length > 0) {
		const [row, col] = stack.pop()!;
		const key = `${row},${col}`;
		if (seen.has(key) || !keys.has(key)) continue;
		seen.add(key);
		stack.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]);
	}
	return seen.size === keys.size;
}

const byKind = (kind: Piece['kind']) => PIECES.filter((piece) => piece.kind === kind);

describe('piece set', () => {
	it('contains exactly the pieces from the requirements', () => {
		expect(byKind('square')).toHaveLength(2);
		expect(byKind('l')).toHaveLength(4);
		expect(byKind('z')).toHaveLength(2);
		expect(byKind('s')).toHaveLength(2);
		expect(byKind('line')).toHaveLength(LINE_LENGTHS.length * 2);
		expect(PIECES).toHaveLength(18);
	});

	it('has unique identifiers and unique shapes', () => {
		expect(new Set(PIECES.map((piece) => piece.id)).size).toBe(PIECES.length);
		expect(new Set(PIECES.map((piece) => shapeKey(piece.cells))).size).toBe(PIECES.length);
	});

	it.each(PIECES)('$id is a valid, normalized, connected shape', (piece) => {
		expect(piece.cells.length).toBeGreaterThan(1);
		expect(new Set(piece.cells.map(([row, col]) => `${row},${col}`)).size).toBe(piece.cells.length);
		expect(Math.min(...piece.cells.map(([row]) => row))).toBe(0);
		expect(Math.min(...piece.cells.map(([, col]) => col))).toBe(0);
		expect(piece.width).toBe(Math.max(...piece.cells.map(([, col]) => col)) + 1);
		expect(piece.height).toBe(Math.max(...piece.cells.map(([row]) => row)) + 1);
		expect(isConnected(piece.cells)).toBe(true);
		expect(pieceById(piece.id)).toBe(piece);
	});

	it('has full two-by-two and three-by-three squares', () => {
		expect(pieceById('square-2')?.cells).toHaveLength(4);
		expect(pieceById('square-3')?.cells).toHaveLength(9);
		expect(pieceById('square-3')).toMatchObject({ width: 3, height: 3 });
	});

	it('has the four rotations of the L-shape, each a quarter turn of the previous one', () => {
		const shapes = byKind('l').map((piece) => piece.cells);
		for (let i = 0; i < 4; i++) {
			expect(shapes[i]).toHaveLength(4);
			expect(shapeKey(rotateClockwise(shapes[i]))).toBe(shapeKey(shapes[(i + 1) % 4]));
		}
	});

	it('has two rotations each of the Z- and S-shapes, which mirror each other', () => {
		for (const kind of ['z', 's'] as const) {
			const [flat, upright] = byKind(kind).map((piece) => piece.cells);
			expect(shapeKey(rotateClockwise(flat))).toBe(shapeKey(upright));
			expect(shapeKey(rotateClockwise(upright))).toBe(shapeKey(flat));
		}
		const mirror = (cells: readonly Cell[]) => cells.map(([row, col]): Cell => [row, -col]);
		expect(shapeKey(mirror(pieceById('z-0')!.cells))).toBe(shapeKey(pieceById('s-0')!.cells));
	});

	it('has straight lines of length two to five in both orientations', () => {
		for (const length of LINE_LENGTHS) {
			expect(pieceById(`line-${length}-h`)).toMatchObject({ width: length, height: 1 });
			expect(pieceById(`line-${length}-v`)).toMatchObject({ width: 1, height: length });
		}
	});

	it('parses and rotates shapes independently of position', () => {
		expect(parseShape(['..', '.X', '.X'])).toEqual([
			[0, 0],
			[1, 0]
		]);
		expect(rotateClockwise(parseShape(['XXX']))).toEqual(parseShape(['X', 'X', 'X']));
	});
});

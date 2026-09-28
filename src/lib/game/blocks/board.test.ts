import { describe, expect, it } from 'vitest';
import {
	BOARD_SIZE,
	boardFromRows,
	canPlace,
	clampAnchor,
	clearLines,
	createBoard,
	fillRatio,
	findFullLines,
	fitsAnywhere,
	isFilled,
	isGameOver,
	legalAnchors,
	placePiece
} from './board';
import { pieceById, PIECES, type Piece } from './pieces';

const piece = (id: string): Piece => {
	const found = pieceById(id);
	if (!found) throw new Error(`Unknown piece ${id}`);
	return found;
};

/** Everything filled except the diagonal: no full lines, and no two empty cells touch */
const DIAGONAL = [
	'.XXXXXXX',
	'X.XXXXXX',
	'XX.XXXXX',
	'XXX.XXXX',
	'XXXX.XXX',
	'XXXXX.XX',
	'XXXXXX.X',
	'XXXXXXX.'
];

describe('board', () => {
	it('starts empty at the configured size', () => {
		const board = createBoard();
		expect(board.size).toBe(BOARD_SIZE);
		expect(board.cells).toHaveLength(BOARD_SIZE * BOARD_SIZE);
		expect(fillRatio(board)).toBe(0);
		expect(createBoard(10).cells).toHaveLength(100);
	});

	describe('placement legality', () => {
		it('allows placing inside the board on empty cells', () => {
			const board = createBoard();
			expect(canPlace(board, piece('square-3'), 0, 0)).toBe(true);
			expect(canPlace(board, piece('square-3'), 5, 5)).toBe(true);
			expect(canPlace(board, piece('line-5-h'), 7, 3)).toBe(true);
		});

		it('rejects placements that stick out of the board', () => {
			const board = createBoard();
			expect(canPlace(board, piece('square-3'), 6, 0)).toBe(false);
			expect(canPlace(board, piece('square-3'), 0, 6)).toBe(false);
			expect(canPlace(board, piece('line-2-h'), -1, 0)).toBe(false);
			expect(canPlace(board, piece('line-2-v'), 0, -1)).toBe(false);
			expect(canPlace(board, piece('line-5-v'), 4, 0)).toBe(false);
		});

		it('rejects overlaps but lets a shape wrap around filled cells', () => {
			const board = boardFromRows([
				'X.......',
				'........',
				'........',
				'........',
				'........',
				'........',
				'........',
				'........'
			]);
			expect(canPlace(board, piece('square-2'), 0, 0)).toBe(false);
			// The Z-shape leaves its bounding box's top-left cell free
			expect(canPlace(board, piece('s-0'), 0, 0)).toBe(true);
			expect(placePiece(board, piece('square-2'), 0, 0)).toBeNull();
		});

		it('lists every legal anchor', () => {
			expect(legalAnchors(createBoard(), piece('square-3'))).toHaveLength(36);
			expect(legalAnchors(boardFromRows(DIAGONAL), piece('line-2-h'))).toEqual([]);
		});

		it('clamps an anchor so the piece stays on the board', () => {
			const board = createBoard();
			expect(clampAnchor(board, piece('square-3'), 7, 7)).toEqual([5, 5]);
			expect(clampAnchor(board, piece('line-5-h'), 2, 6)).toEqual([2, 3]);
			expect(clampAnchor(board, piece('line-2-v'), 3, 4)).toEqual([3, 4]);
		});
	});

	describe('line clearing', () => {
		it('finds and clears a full row', () => {
			const board = boardFromRows([
				'........',
				'........',
				'XXXXXX..',
				'........',
				'........',
				'........',
				'........',
				'X.......'
			]);
			const result = placePiece(board, piece('line-2-h'), 2, 6)!;
			expect(result.cleared).toEqual({ rows: [2], cols: [] });
			expect(result.clearedCells).toHaveLength(8);
			expect(result.board.cells.filter(Boolean)).toHaveLength(1);
			expect(isFilled(result.board, 7, 0)).toBe(true);
		});

		it('clears a row and a column at the same time, counting the crossing cell once', () => {
			const board = boardFromRows([
				'....X...',
				'....X...',
				'....X...',
				'XXXX..XX',
				'....X...',
				'....X...',
				'....X...',
				'....X..X'
			]);
			const result = placePiece(board, piece('line-2-h'), 3, 4)!;
			expect(result.cleared).toEqual({ rows: [3], cols: [4] });
			expect(result.clearedCells).toHaveLength(15);
			expect(new Set(result.clearedCells).size).toBe(15);
			// Only the cell that belonged to neither line survives
			expect(result.board.cells.filter(Boolean)).toHaveLength(1);
			expect(isFilled(result.board, 7, 7)).toBe(true);
			expect(result.placed).toEqual([28, 29]);
		});

		it('clears several rows and columns with one piece', () => {
			// Rows 0 to 2 miss their last three cells; columns 5 to 7 miss their first three cells
			const board = boardFromRows([
				'XXXXX...',
				'XXXXX...',
				'XXXXX...',
				'.XXXXXXX',
				'X.XXXXXX',
				'XX.XXXXX',
				'XXX.XXXX',
				'XXXX.XXX'
			]);
			expect(findFullLines(board)).toEqual({ rows: [], cols: [] });
			const result = placePiece(board, piece('square-3'), 0, 5)!;
			expect(result.cleared).toEqual({ rows: [0, 1, 2], cols: [5, 6, 7] });
			expect(result.board.cells.filter(Boolean)).toHaveLength(20);
		});

		it('clears nothing when no line is full', () => {
			const board = boardFromRows(DIAGONAL);
			expect(findFullLines(board)).toEqual({ rows: [], cols: [] });
			expect(clearLines(board, { rows: [], cols: [] }).board).toEqual(board);
		});
	});

	describe('game over', () => {
		it('is not over on an empty board', () => {
			expect(isGameOver(createBoard(), PIECES.slice(0, 3))).toBe(false);
		});

		it('is over when none of the remaining pieces fits anywhere', () => {
			const board = boardFromRows(DIAGONAL);
			expect(PIECES.some((candidate) => fitsAnywhere(board, candidate))).toBe(false);
			expect(isGameOver(board, [piece('square-2'), piece('l-0'), piece('line-2-h')])).toBe(true);
		});

		it('is not over while at least one remaining piece fits', () => {
			const board = boardFromRows(['..XXXXXX', ...DIAGONAL.slice(1)]);
			expect(isGameOver(board, [piece('square-3'), piece('z-0'), piece('line-2-h')])).toBe(false);
			expect(isGameOver(board, [piece('square-3'), piece('z-0'), null])).toBe(true);
			expect(isGameOver(board, [null, null, piece('line-2-h')])).toBe(false);
		});

		it('ignores placed pieces and never ends on an empty tray', () => {
			expect(isGameOver(boardFromRows(DIAGONAL), [null, null, null])).toBe(false);
		});
	});
});

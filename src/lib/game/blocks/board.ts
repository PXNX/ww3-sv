/*
 * Block Puzzle board rules: placement legality, line clearing, and game-over detection.
 * Boards are immutable; every change returns a new board.
 */
import type { Cell, Piece, PieceKind } from './pieces';

/** Board edge length; the requirements allow eight or ten */
export const BOARD_SIZE = 8;

export interface Board {
	readonly size: number;
	/** Row-major cells; null is empty, otherwise the kind of piece that filled it */
	readonly cells: readonly (PieceKind | null)[];
}

export interface Lines {
	rows: number[];
	cols: number[];
}

export interface MoveResult {
	board: Board;
	/** Board indices the piece now covers (before clearing) */
	placed: number[];
	cleared: Lines;
	/** Board indices emptied by the clear, each listed once even where a row and column cross */
	clearedCells: number[];
}

export function createBoard(size = BOARD_SIZE): Board {
	return { size, cells: Array.from({ length: size * size }, () => null) };
}

/** Builds a board from a picture such as ['X..', '.X.'] (X = filled); handy for tests */
export function boardFromRows(rows: readonly string[], kind: PieceKind = 'square'): Board {
	const size = rows.length;
	if (rows.some((line) => line.length !== size)) throw new Error('Board rows must be square');
	return {
		size,
		cells: rows.flatMap((line) => [...line].map((char) => (char === 'X' ? kind : null)))
	};
}

export function cellIndex(board: Board, row: number, col: number): number {
	return row * board.size + col;
}

export function isFilled(board: Board, row: number, col: number): boolean {
	return board.cells[cellIndex(board, row, col)] !== null;
}

/** The absolute cells the piece would cover with its bounding box's top-left corner at the anchor */
export function cellsAt(piece: Piece, row: number, col: number): Cell[] {
	return piece.cells.map(([r, c]): Cell => [row + r, col + c]);
}

export function canPlace(board: Board, piece: Piece, row: number, col: number): boolean {
	return cellsAt(piece, row, col).every(
		([r, c]) => r >= 0 && c >= 0 && r < board.size && c < board.size && !isFilled(board, r, c)
	);
}

/**
 * Shifts an anchor so the piece stays inside the board. Tapping near the bottom or end edge
 * then still places a large piece flush against that edge instead of failing.
 */
export function clampAnchor(board: Board, piece: Piece, row: number, col: number): Cell {
	const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
	return [clamp(row, board.size - piece.height), clamp(col, board.size - piece.width)];
}

export function legalAnchors(board: Board, piece: Piece): Cell[] {
	const anchors: Cell[] = [];
	for (let row = 0; row <= board.size - piece.height; row++) {
		for (let col = 0; col <= board.size - piece.width; col++) {
			if (canPlace(board, piece, row, col)) anchors.push([row, col]);
		}
	}
	return anchors;
}

export function fitsAnywhere(board: Board, piece: Piece): boolean {
	for (let row = 0; row <= board.size - piece.height; row++) {
		for (let col = 0; col <= board.size - piece.width; col++) {
			if (canPlace(board, piece, row, col)) return true;
		}
	}
	return false;
}

export function findFullLines(board: Board): Lines {
	const range = Array.from({ length: board.size }, (_, index) => index);
	return {
		rows: range.filter((row) => range.every((col) => isFilled(board, row, col))),
		cols: range.filter((col) => range.every((row) => isFilled(board, row, col)))
	};
}

export function lineCount(lines: Lines): number {
	return lines.rows.length + lines.cols.length;
}

/** Empties the given rows and columns at the same time and lists the emptied cells */
export function clearLines(board: Board, lines: Lines): { board: Board; clearedCells: number[] } {
	const clearedCells = new Set<number>();
	for (const row of lines.rows) {
		for (let col = 0; col < board.size; col++) clearedCells.add(cellIndex(board, row, col));
	}
	for (const col of lines.cols) {
		for (let row = 0; row < board.size; row++) clearedCells.add(cellIndex(board, row, col));
	}
	const cells = board.cells.map((cell, index) => (clearedCells.has(index) ? null : cell));
	return {
		board: { size: board.size, cells },
		clearedCells: [...clearedCells].sort((a, b) => a - b)
	};
}

/** Places a piece and clears any completed lines; returns null if the placement is not legal */
export function placePiece(
	board: Board,
	piece: Piece,
	row: number,
	col: number
): MoveResult | null {
	if (!canPlace(board, piece, row, col)) return null;
	const placed = cellsAt(piece, row, col).map(([r, c]) => cellIndex(board, r, c));
	const cells = [...board.cells];
	for (const index of placed) cells[index] = piece.kind;
	const filled: Board = { size: board.size, cells };
	const cleared = findFullLines(filled);
	const result = clearLines(filled, cleared);
	return { board: result.board, placed, cleared, clearedCells: result.clearedCells };
}

/**
 * The game ends when none of the pieces still waiting in the tray (null = already placed) fits
 * anywhere. An empty tray is never game over, because it is refilled first.
 */
export function isGameOver(board: Board, tray: readonly (Piece | null)[]): boolean {
	const remaining = tray.filter((piece): piece is Piece => piece !== null);
	return remaining.length > 0 && remaining.every((piece) => !fitsAnywhere(board, piece));
}

export function fillRatio(board: Board): number {
	return board.cells.filter((cell) => cell !== null).length / board.cells.length;
}

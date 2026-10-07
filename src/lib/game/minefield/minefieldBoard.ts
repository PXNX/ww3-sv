/*
 * Minefield rules (requirements Section 3): mine placement with a safe first tap, sonar numbers,
 * flood reveal, buoy flags and chording. Every function is pure and returns a new board.
 */
import { shuffle, type Random } from '#lib/game/random.js';
import { hasMineFreeRoute } from './channelPathfinding';
import { neighborIndices, type GridSize } from './grid';

export type CellState = 'hidden' | 'flagged' | 'revealed' | 'detonated';

export interface Cell {
	mine: boolean;
	state: CellState;
	/** Sonar number: mines in the eight surrounding cells */
	adjacent: number;
	/** A submarine removed the mine that was here */
	defused: boolean;
}

export interface Board extends GridSize {
	readonly cells: readonly Cell[];
	/** Mines are only placed after the first tap, so the first reveal is always safe */
	readonly minesPlaced: boolean;
}

export interface BoardChange {
	board: Board;
	/** Cells that became revealed safe water */
	revealed: number[];
	/** Mines that exploded */
	detonated: number[];
}

/** Placement retries until at least one mine-free west-to-east route exists */
const PLACEMENT_ATTEMPTS = 50;

export function createBoard(columns: number, rows: number): Board {
	const cells = Array.from({ length: columns * rows }, () => emptyCell());
	return { columns, rows, cells, minesPlaced: false };
}

function emptyCell(): Cell {
	return { mine: false, state: 'hidden', adjacent: 0, defused: false };
}

function copyCells(board: Board): Cell[] {
	return board.cells.map((cell) => ({ ...cell }));
}

/** Number of mines for a board, leaving room for the three-by-three safe area of the first tap */
export function mineCountFor(columns: number, rows: number, density: number): number {
	const wanted = Math.round(columns * rows * density);
	return Math.max(0, Math.min(wanted, columns * rows - 9));
}

/** Recomputes every sonar number from the mines currently on the board */
export function withSonarNumbers(board: Board, cells: Cell[] = copyCells(board)): Board {
	for (let index = 0; index < cells.length; index++) {
		cells[index].adjacent = neighborIndices(board, index).filter((next) => cells[next].mine).length;
	}
	return { ...board, cells };
}

/** Builds a board with mines at the given cells; handy for tests and fixed layouts */
export function boardWithMines(columns: number, rows: number, mines: Iterable<number>): Board {
	const board = createBoard(columns, rows);
	const cells = copyCells(board);
	for (const index of mines) cells[index].mine = true;
	return withSonarNumbers({ ...board, minesPlaced: true }, cells);
}

/**
 * Places mines randomly, never on or directly next to the first tapped cell, so the first reveal
 * always opens an area. Retries a few times so the strait can always be crossed without mines.
 */
export function placeMines(
	board: Board,
	firstIndex: number,
	mineCount: number,
	random: Random
): Board {
	const safe = new Set(neighborIndices(board, firstIndex, true));
	const candidates = board.cells.map((_, index) => index).filter((index) => !safe.has(index));
	const count = Math.min(mineCount, candidates.length);

	let placed = board;
	for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
		const mines = shuffle(random, candidates).slice(0, count);
		const cells = copyCells(board);
		for (const cell of cells) cell.mine = false;
		for (const index of mines) cells[index].mine = true;
		placed = withSonarNumbers({ ...board, minesPlaced: true }, cells);
		if (hasMineFreeRoute(placed)) return placed;
	}
	return placed;
}

/**
 * Reveals safe cells starting from the given ones; any revealed zero also reveals its neighbors.
 * Mines and buoy flags are never touched. Mutates the given cells and returns what was revealed.
 */
function floodInto(size: GridSize, cells: Cell[], starts: Iterable<number>): number[] {
	const revealed: number[] = [];
	const stack = [...starts];
	while (stack.length > 0) {
		const index = stack.pop()!;
		const cell = cells[index];
		if (cell.state !== 'hidden' || cell.mine) continue;
		cell.state = 'revealed';
		revealed.push(index);
		if (cell.adjacent === 0) stack.push(...neighborIndices(size, index));
	}
	return revealed;
}

/** Flood reveal from several starting cells at once (used by the submarine sweep) */
export function floodReveal(board: Board, starts: Iterable<number>): BoardChange {
	const cells = copyCells(board);
	const revealed = floodInto(board, cells, starts);
	return { board: { ...board, cells }, revealed, detonated: [] };
}

/** Taps a cell: safe water shows its sonar number (zeros flood), a mine detonates */
export function revealCell(board: Board, index: number): BoardChange {
	const cell = board.cells[index];
	if (cell.state !== 'hidden') return { board, revealed: [], detonated: [] };
	if (cell.mine) {
		const cells = copyCells(board);
		cells[index].state = 'detonated';
		return { board: { ...board, cells }, revealed: [], detonated: [index] };
	}
	return floodReveal(board, [index]);
}

export function toggleFlag(board: Board, index: number): Board {
	const state = board.cells[index].state;
	if (state !== 'hidden' && state !== 'flagged') return board;
	const cells = copyCells(board);
	cells[index].state = state === 'hidden' ? 'flagged' : 'hidden';
	return { ...board, cells };
}

/** Flags plus already detonated mines around a cell: everything the player knows is a mine */
function knownMinesAround(board: Board, index: number): number {
	return neighborIndices(board, index).filter((next) => {
		const state = board.cells[next].state;
		return state === 'flagged' || state === 'detonated';
	}).length;
}

/** A revealed number can be chorded once the buoys around it match it and hidden cells remain */
export function canChord(board: Board, index: number): boolean {
	const cell = board.cells[index];
	if (cell.state !== 'revealed' || cell.adjacent === 0) return false;
	const hasHidden = neighborIndices(board, index).some(
		(next) => board.cells[next].state === 'hidden'
	);
	return hasHidden && knownMinesAround(board, index) === cell.adjacent;
}

/**
 * Chording: tapping a revealed number whose buoy count matches it reveals every other neighbor.
 * A misplaced buoy means a real mine gets revealed and detonates.
 */
export function chord(board: Board, index: number): BoardChange {
	if (!canChord(board, index)) return { board, revealed: [], detonated: [] };
	const cells = copyCells(board);
	const detonated: number[] = [];
	const safeStarts: number[] = [];
	for (const next of neighborIndices(board, index)) {
		if (cells[next].state !== 'hidden') continue;
		if (cells[next].mine) {
			cells[next].state = 'detonated';
			detonated.push(next);
		} else {
			safeStarts.push(next);
		}
	}
	const revealed = floodInto(board, cells, safeStarts);
	return { board: { ...board, cells }, revealed, detonated };
}

export function countFlags(board: Board): { correct: number; wrong: number } {
	let correct = 0;
	let wrong = 0;
	for (const cell of board.cells) {
		if (cell.state !== 'flagged') continue;
		if (cell.mine) correct++;
		else wrong++;
	}
	return { correct, wrong };
}

export function countRevealedSafe(board: Board): number {
	return board.cells.filter((cell) => cell.state === 'revealed').length;
}

export function countMines(board: Board): number {
	return board.cells.filter((cell) => cell.mine).length;
}

/** The mine counter shown to the player: live mines minus buoys placed (can go below zero) */
export function minesRemaining(board: Board, totalMines: number): number {
	let known = 0;
	for (const cell of board.cells) {
		if (cell.state === 'flagged' || cell.state === 'detonated' || cell.defused) known++;
	}
	return totalMines - known;
}

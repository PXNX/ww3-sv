/*
 * Merge Tankers rules (requirements Section 5): a 2048-style slide-and-merge board with fixed
 * mines. Everything here is pure: functions take a board or state and return new ones, and all
 * randomness comes from a seeded Random so games are reproducible in tests.
 */
import { pickOne, pickWeighted, type Random } from '../random';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** Tier 1 is the Rowboat, tier 8 the Mega-Tanker; two Mega-Tankers do not merge any further */
export const MIN_TIER = 1;
export const MAX_TIER = 8;

export const DEFAULT_SIZE = 5;
export const MIN_SIZE = 3;
export const MAX_SIZE = 8;
export const START_SHIPS = 2;
export const SUBMARINE_CHARGES = 1;
/** A mine is dropped after every MINE_INTERVAL-th board-changing move */
export const MINE_INTERVAL = 5;
/** Chance weights for the ship that appears after a move */
export const SPAWN_WEIGHTS = [
	{ item: 1, weight: 9 },
	{ item: 2, weight: 1 }
] as const;
/** Bonus for every merge beyond the first in a single move */
export const COMBO_BONUS = 10;
/** Bonus for every mine destroyed by a neighboring merge */
export const MINE_BONUS = 20;

export interface ShipTile {
	id: number;
	kind: 'ship';
	tier: number;
}

export interface MineTile {
	id: number;
	kind: 'mine';
}

export type Tile = ShipTile | MineTile;
export type Cell = Tile | null;
/** Indexed as board[row][column]; row 0 is the top, column 0 the left edge */
export type Board = Cell[][];

export interface Position {
	row: number;
	col: number;
}

export interface MergeState {
	size: number;
	board: Board;
	score: number;
	/** Number of moves that changed the board */
	moves: number;
	highestTier: number;
	submarines: number;
	minesDestroyed: number;
	/** Next tile id; ids stay stable while a tile slides, so the view can animate it */
	nextId: number;
}

export interface MergeEvent extends Position {
	/** Tier of the newly created ship */
	tier: number;
	/** The tile that stays (keeps its id) and the tile that is absorbed into it */
	keptId: number;
	absorbedId: number;
	/** Where the absorbed ship came from */
	absorbedFrom: Position;
}

export interface SlideResult {
	board: Board;
	changed: boolean;
	merges: MergeEvent[];
}

export interface DestroyedMine extends Position {
	id: number;
}

export interface MoveScore {
	/** Sum of the values of all newly created ships */
	shipPoints: number;
	comboBonus: number;
	mineBonus: number;
	total: number;
}

export interface MoveOutcome {
	state: MergeState;
	changed: boolean;
	merges: MergeEvent[];
	destroyedMines: DestroyedMine[];
	score: MoveScore;
	spawned: (Position & { tier: number }) | null;
	droppedMine: Position | null;
	/** Whether this move created at least one Mega-Tanker */
	createdMegaTanker: boolean;
}

/** Points for creating a ship of the given tier: 4 for a Fishing Boat, doubling per tier */
export function shipValue(tier: number): number {
	return 2 ** tier;
}

export function emptyBoard(size: number): Board {
	return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

export function cloneBoard(board: Board): Board {
	return board.map((row) => [...row]);
}

export function emptyCells(board: Board): Position[] {
	const cells: Position[] = [];
	board.forEach((row, rowIndex) =>
		row.forEach((cell, col) => {
			if (cell === null) cells.push({ row: rowIndex, col });
		})
	);
	return cells;
}

export function highestShipTier(board: Board): number {
	let highest = 0;
	for (const row of board) {
		for (const cell of row) if (cell?.kind === 'ship') highest = Math.max(highest, cell.tier);
	}
	return highest;
}

export function hasMine(board: Board): boolean {
	return board.some((row) => row.some((cell) => cell?.kind === 'mine'));
}

/**
 * The positions of every line in a direction, each ordered from the wall the ships slide toward
 * to the opposite edge. Sliding left, for example, yields each row from column 0 upward.
 */
function lines(size: number, direction: Direction): Position[][] {
	const indices = Array.from({ length: size }, (_, index) => index);
	const reversed = [...indices].reverse();
	return indices.map((line) => {
		switch (direction) {
			case 'left':
				return indices.map((col) => ({ row: line, col }));
			case 'right':
				return reversed.map((col) => ({ row: line, col }));
			case 'up':
				return indices.map((row) => ({ row, col: line }));
			case 'down':
				return reversed.map((row) => ({ row, col: line }));
		}
	});
}

/**
 * Slides every ship as far as possible toward the direction. Mines stay where they are and split
 * a line into separate stretches that ships cannot cross. Classic 2048 rules apply: ships merge
 * with the next ship of the same tier in front of them, each ship merges at most once per move,
 * and merges resolve from the wall outward, so [1, 1, 1, 1] becomes [2, 2].
 */
export function slide(board: Board, direction: Direction): SlideResult {
	const size = board.length;
	const next = emptyBoard(size);
	const merges: MergeEvent[] = [];

	for (const line of lines(size, direction)) {
		// Index in the line where the next ship lands, and the last ship placed in this stretch
		let target = 0;
		let last: { index: number; tile: ShipTile; merged: boolean } | null = null;

		line.forEach((position, index) => {
			const tile = board[position.row][position.col];
			if (tile === null) return;

			if (tile.kind === 'mine') {
				next[position.row][position.col] = tile;
				target = index + 1;
				last = null;
				return;
			}

			if (last && !last.merged && last.tile.tier === tile.tier && tile.tier < MAX_TIER) {
				const at = line[last.index];
				const merged: ShipTile = { id: last.tile.id, kind: 'ship', tier: tile.tier + 1 };
				next[at.row][at.col] = merged;
				last = { index: last.index, tile: merged, merged: true };
				merges.push({
					...at,
					tier: merged.tier,
					keptId: merged.id,
					absorbedId: tile.id,
					absorbedFrom: position
				});
				return;
			}

			const at = line[target];
			next[at.row][at.col] = tile;
			last = { index: target, tile, merged: false };
			target++;
		});
	}

	return { board: next, changed: !sameBoard(board, next), merges };
}

function sameBoard(a: Board, b: Board): boolean {
	return a.every((row, rowIndex) =>
		row.every((cell, col) => {
			const other = b[rowIndex][col];
			if (cell === null || other === null) return cell === other;
			if (cell.id !== other.id || cell.kind !== other.kind) return false;
			return cell.kind === 'mine' || (other.kind === 'ship' && cell.tier === other.tier);
		})
	);
}

const NEIGHBOR_OFFSETS: readonly Position[] = [
	{ row: -1, col: 0 },
	{ row: 1, col: 0 },
	{ row: 0, col: -1 },
	{ row: 0, col: 1 }
];

/** Removes every mine orthogonally adjacent to a cell where a merge happened */
export function destroyMinesNear(
	board: Board,
	merges: readonly Position[]
): { board: Board; destroyed: DestroyedMine[] } {
	const next = cloneBoard(board);
	const destroyed: DestroyedMine[] = [];
	for (const merge of merges) {
		for (const offset of NEIGHBOR_OFFSETS) {
			const row = merge.row + offset.row;
			const col = merge.col + offset.col;
			const cell = next[row]?.[col];
			if (cell?.kind !== 'mine') continue;
			next[row][col] = null;
			destroyed.push({ row, col, id: cell.id });
		}
	}
	return { board: next, destroyed };
}

export function scoreMove(merges: readonly { tier: number }[], minesDestroyed: number): MoveScore {
	const shipPoints = merges.reduce((sum, merge) => sum + shipValue(merge.tier), 0);
	const comboBonus = Math.max(0, merges.length - 1) * COMBO_BONUS;
	const mineBonus = minesDestroyed * MINE_BONUS;
	return { shipPoints, comboBonus, mineBonus, total: shipPoints + comboBonus + mineBonus };
}

/** Places a tile in a random empty cell; returns null when the board is full */
function placeRandom(
	board: Board,
	random: Random,
	tile: Tile
): { board: Board; position: Position } | null {
	const cells = emptyCells(board);
	if (cells.length === 0) return null;
	const position = pickOne(random, cells);
	const next = cloneBoard(board);
	next[position.row][position.col] = tile;
	return { board: next, position };
}

/** Spawns a Rowboat, or occasionally a Fishing Boat, in a random empty cell */
export function spawnShip(board: Board, random: Random, id: number) {
	const tier = pickWeighted(random, SPAWN_WEIGHTS);
	const placed = placeRandom(board, random, { id, kind: 'ship', tier });
	return placed && { ...placed, tier };
}

export function dropMine(board: Board, random: Random, id: number) {
	return placeRandom(board, random, { id, kind: 'mine' });
}

export function createGame(random: Random, size = DEFAULT_SIZE): MergeState {
	if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
		throw new Error(`Board size must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`);
	}
	let board = emptyBoard(size);
	let nextId = 1;
	for (let i = 0; i < START_SHIPS; i++) {
		const spawned = spawnShip(board, random, nextId++);
		if (spawned) board = spawned.board;
	}
	return {
		size,
		board,
		score: 0,
		moves: 0,
		highestTier: highestShipTier(board),
		submarines: SUBMARINE_CHARGES,
		minesDestroyed: 0,
		nextId
	};
}

/**
 * Plays one move: slide and merge, destroy mines next to merges, score, then (only if the board
 * changed) spawn a new ship and, on every fifth move, drop a mine.
 */
export function applyMove(state: MergeState, direction: Direction, random: Random): MoveOutcome {
	const slid = slide(state.board, direction);
	if (!slid.changed) {
		return {
			state,
			changed: false,
			merges: [],
			destroyedMines: [],
			score: scoreMove([], 0),
			spawned: null,
			droppedMine: null,
			createdMegaTanker: false
		};
	}

	const cleared = destroyMinesNear(slid.board, slid.merges);
	const score = scoreMove(slid.merges, cleared.destroyed.length);
	const moves = state.moves + 1;
	let board = cleared.board;
	let nextId = state.nextId;

	const spawned = spawnShip(board, random, nextId++);
	if (spawned) board = spawned.board;

	let droppedMine: Position | null = null;
	if (moves % MINE_INTERVAL === 0) {
		const dropped = dropMine(board, random, nextId++);
		if (dropped) {
			board = dropped.board;
			droppedMine = dropped.position;
		}
	}

	return {
		state: {
			...state,
			board,
			score: state.score + score.total,
			moves,
			highestTier: Math.max(state.highestTier, highestShipTier(board)),
			minesDestroyed: state.minesDestroyed + cleared.destroyed.length,
			nextId
		},
		changed: true,
		merges: slid.merges,
		destroyedMines: cleared.destroyed,
		score,
		spawned: spawned && { ...spawned.position, tier: spawned.tier },
		droppedMine,
		createdMegaTanker: slid.merges.some((merge) => merge.tier === MAX_TIER)
	};
}

/** Whether a slide in any direction would change the board */
export function canMove(board: Board): boolean {
	return DIRECTIONS.some((direction) => slide(board, direction).changed);
}

export function canUseSubmarine(state: MergeState): boolean {
	return state.submarines > 0 && hasMine(state.board);
}

/**
 * The game is over when no slide or merge is possible. An unused submarine that could still
 * clear a mine keeps the game alive, since removing the mine opens a cell.
 */
export function isGameOver(state: MergeState): boolean {
	return !canMove(state.board) && !canUseSubmarine(state);
}

/** Uses the submarine charge on the mine at the position; returns null if that is not allowed */
export function useSubmarine(state: MergeState, position: Position): MergeState | null {
	if (state.submarines <= 0) return null;
	if (state.board[position.row]?.[position.col]?.kind !== 'mine') return null;
	const board = cloneBoard(state.board);
	board[position.row][position.col] = null;
	return { ...state, board, submarines: state.submarines - 1 };
}

function isTile(value: unknown): value is Tile {
	if (typeof value !== 'object' || value === null) return false;
	const tile = value as Record<string, unknown>;
	if (!Number.isInteger(tile.id) || (tile.id as number) < 1) return false;
	if (tile.kind === 'mine') return true;
	return (
		tile.kind === 'ship' &&
		Number.isInteger(tile.tier) &&
		(tile.tier as number) >= MIN_TIER &&
		(tile.tier as number) <= MAX_TIER
	);
}

function isCount(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 0;
}

/** Validates a saved game read back from storage, so a corrupted save is simply ignored */
export function isMergeState(value: unknown): value is MergeState {
	if (typeof value !== 'object' || value === null) return false;
	const state = value as Record<string, unknown>;
	const size = state.size;
	if (!Number.isInteger(size) || (size as number) < MIN_SIZE || (size as number) > MAX_SIZE) {
		return false;
	}
	const board = state.board;
	if (!Array.isArray(board) || board.length !== size) return false;
	const ids = new Set<number>();
	for (const row of board) {
		if (!Array.isArray(row) || row.length !== size) return false;
		for (const cell of row) {
			if (cell === null) continue;
			if (!isTile(cell) || ids.has(cell.id)) return false;
			ids.add(cell.id);
		}
	}
	return (
		isCount(state.score) &&
		isCount(state.moves) &&
		isCount(state.highestTier) &&
		(state.highestTier as number) <= MAX_TIER &&
		isCount(state.submarines) &&
		(state.submarines as number) <= SUBMARINE_CHARGES &&
		isCount(state.minesDestroyed) &&
		isCount(state.nextId) &&
		[...ids].every((id) => id < (state.nextId as number))
	);
}

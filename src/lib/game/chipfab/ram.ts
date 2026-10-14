/*
 * Stage B, the RAM merge: a 4x4 grid of memory modules. Every swipe slides all modules as far as
 * they go; two modules of the same size that meet become one module of double the size (4 GB to
 * 8 GB to 16 GB and so on, up to 1 TB). Each module merges at most once per move, resolved from
 * the wall outward, so a row of four 4 GB modules becomes two 8 GB modules. After every move that
 * changes the board a new module arrives from the wafer's supply. The idea follows the Merge
 * Tankers mode, without mines and with a limited supply instead of an endless one.
 */
import { pickWeighted, type Random } from '../random';
import type { Direction } from '../merge/mergeBoard';

export const GRID_SIZE = 4;
export const MIN_TIER = 1;
/** Tier 9 is 1 TB; two 1 TB modules do not merge any further */
export const MAX_TIER = 9;
/** Modules on the board when Stage B starts, not taken from the supply */
export const START_MODULES = 2;
/** Bonus for every merge beyond the first in a single move */
export const COMBO_BONUS = 10;

export interface Module {
	/** Stable while the module slides, so the view can animate it */
	id: number;
	tier: number;
}

export type Cell = Module | null;
/** Indexed as board[row][column]; row 0 is the top, column 0 the left edge */
export type Board = Cell[][];

export interface Position {
	row: number;
	col: number;
}

export interface RamState {
	board: Board;
	/** New modules still to arrive from the wafer */
	supply: number;
	/** 0 to 1; better wafers deliver bigger modules more often */
	quality: number;
	nextId: number;
	moves: number;
	highestTier: number;
}

export interface MergeEvent extends Position {
	/** Tier of the newly created module */
	tier: number;
	keptId: number;
	absorbedId: number;
	absorbedFrom: Position;
}

export interface SlideResult {
	board: Board;
	changed: boolean;
	merges: MergeEvent[];
}

export interface MoveOutcome {
	state: RamState;
	changed: boolean;
	merges: MergeEvent[];
	spawned: (Position & { tier: number; id: number }) | null;
	/** Points for this move: the new modules' values plus a combo bonus */
	points: number;
}

/** Capacity of a module in GB: 4 GB at tier 1, doubling with every tier */
export function moduleGb(tier: number): number {
	return 4 * 2 ** (Math.min(Math.max(tier, MIN_TIER), MAX_TIER) - 1);
}

/** Label such as "16 GB" or "1 TB" */
export function moduleLabel(tier: number): string {
	const gb = moduleGb(tier);
	return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

/** Points for creating a module of the given tier */
export function moduleValue(tier: number): number {
	return 2 ** tier;
}

/** Chance that a new module arrives as 8 GB instead of 4 GB */
export function biggerSpawnChance(quality: number): number {
	return 0.1 + 0.3 * Math.min(1, Math.max(0, quality));
}

export function emptyBoard(size = GRID_SIZE): Board {
	return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
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

export function highestModuleTier(board: Board): number {
	let highest = 0;
	for (const row of board) for (const cell of row) if (cell) highest = Math.max(highest, cell.tier);
	return highest;
}

/** Every line in a direction, each ordered from the wall the modules slide toward outward */
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

/** Slides and merges one move; the input board is never changed */
export function slide(board: Board, direction: Direction): SlideResult {
	const size = board.length;
	const next = emptyBoard(size);
	const merges: MergeEvent[] = [];

	for (const line of lines(size, direction)) {
		let target = 0;
		let last: { index: number; tile: Module; merged: boolean } | null = null;

		line.forEach((position) => {
			const tile = board[position.row][position.col];
			if (tile === null) return;

			if (last && !last.merged && last.tile.tier === tile.tier && tile.tier < MAX_TIER) {
				const at = line[last.index];
				const merged: Module = { id: last.tile.id, tier: tile.tier + 1 };
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
			return cell.id === other.id && cell.tier === other.tier;
		})
	);
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** Whether any slide would change the board */
export function canMove(board: Board): boolean {
	return DIRECTIONS.some((direction) => slide(board, direction).changed);
}

/** Whether any slide would merge two modules */
export function canMerge(board: Board): boolean {
	return DIRECTIONS.some((direction) => slide(board, direction).merges.length > 0);
}

export function createRam(random: Random, supply: number, quality: number): RamState {
	let board = emptyBoard();
	let nextId = 1;
	for (let i = 0; i < START_MODULES; i++) {
		const spots = emptyCells(board);
		const spot = spots[Math.floor(random() * spots.length)];
		board = board.map((row) => [...row]);
		board[spot.row][spot.col] = { id: nextId++, tier: 1 };
	}
	return {
		board,
		supply: Math.max(0, Math.floor(supply)),
		quality,
		nextId,
		moves: 0,
		highestTier: highestModuleTier(board)
	};
}

/**
 * Plays one move: slide and merge, then (only if the board changed and the supply lasts) one new
 * module arrives in a random empty cell. Points are the values of the new modules plus a combo
 * bonus for every merge after the first.
 */
export function moveRam(state: RamState, direction: Direction, random: Random): MoveOutcome {
	const slid = slide(state.board, direction);
	if (!slid.changed) {
		return { state, changed: false, merges: [], spawned: null, points: 0 };
	}

	let board = slid.board;
	let nextId = state.nextId;
	let supply = state.supply;
	let spawned: MoveOutcome['spawned'] = null;

	if (supply > 0) {
		const spots = emptyCells(board);
		if (spots.length > 0) {
			const spot = spots[Math.floor(random() * spots.length)];
			const chance = biggerSpawnChance(state.quality);
			const tier = pickWeighted(random, [
				{ item: 1, weight: 1 - chance },
				{ item: 2, weight: chance }
			]);
			board = board.map((row) => [...row]);
			const id = nextId++;
			board[spot.row][spot.col] = { id, tier };
			supply--;
			spawned = { ...spot, tier, id };
		}
	}

	const points =
		slid.merges.reduce((sum, merge) => sum + moduleValue(merge.tier), 0) +
		Math.max(0, slid.merges.length - 1) * COMBO_BONUS;

	return {
		state: {
			...state,
			board,
			supply,
			nextId,
			moves: state.moves + 1,
			highestTier: Math.max(state.highestTier, highestModuleTier(board))
		},
		changed: true,
		merges: slid.merges,
		spawned,
		points
	};
}

/**
 * Stage B is over when the board is jammed, or when the supply has run dry and no two modules
 * can merge any more.
 */
export function isRamDone(state: RamState): boolean {
	if (!canMove(state.board)) return true;
	return state.supply <= 0 && !canMerge(state.board);
}

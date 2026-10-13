/*
 * Sondage Surge board: a stylized map of French départements as a grid of abstract tiles (the
 * Hexagon), with Othello-style flips. You hold a rally on an empty tile; in each of the eight
 * directions, a run of rival tiles that ends at one of your own tiles flips to you. The board is a
 * plain mutable object, the functions here change it in place.
 */

export type Side = 'you' | 'rival';

export interface Cell {
	/** Département name; null for the sea around the Hexagon (not part of the map) */
	name: string | null;
	owner: Side | null;
	/** Rounds this rally is still frozen by a scandal: it cannot anchor or be flipped */
	frozen: number;
	/** Rounds this département is still blocked by a strike: nobody can use it */
	blocked: number;
}

export interface Board {
	cols: number;
	rows: number;
	cells: Cell[];
}

/** The map, row by row. Names are stylized, the geography is only loosely kept. null is sea. */
export const LAYOUT: readonly (readonly (string | null)[])[] = [
	[null, null, 'Nord', 'Aisne', 'Ardennes', null, null, null],
	[null, 'Manche', 'Somme', 'Oise', 'Marne', 'Meuse', 'Moselle', null],
	['Finistère', 'Orne', 'Eure', 'Paris', 'Aube', 'Vosges', 'Jura', 'Bas-Rhin'],
	['Morbihan', 'Sarthe', 'Loiret', 'Yonne', "Côte-d'Or", 'Doubs', 'Ain', 'Savoie'],
	['Vendée', 'Mayenne', 'Cher', 'Nièvre', 'Saône', 'Rhône', 'Isère', 'Alpes'],
	[null, 'Charente', 'Vienne', 'Indre', 'Allier', 'Loire', 'Drôme', 'Var'],
	[null, 'Gironde', 'Dordogne', 'Creuse', 'Cantal', 'Lozère', 'Gard', null],
	[null, null, 'Landes', 'Lot', 'Aveyron', 'Hérault', 'Vaucluse', null],
	[null, null, null, 'Gers', 'Tarn', 'Aude', null, 'Corse']
];

export const COLS = 8;
export const ROWS = LAYOUT.length;

/** The eight directions of a line, as [row, column] steps */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1]
];

/** Where each side starts: a 2 by 2 cross in the middle of the Hexagon, as in Othello */
const START: readonly (readonly [Side, number, number])[] = [
	['rival', 3, 3],
	['you', 3, 4],
	['you', 4, 3],
	['rival', 4, 4]
];

/** Display colors shared by the HUD, the result map and the share card: you red, the rival navy */
export const SIDE_COLOR: Record<Side | 'free', string> = {
	you: '#e5484d',
	rival: '#1f3a6e',
	free: '#ffffff'
};

export function otherSide(side: Side): Side {
	return side === 'you' ? 'rival' : 'you';
}

export function createBoard(): Board {
	const cells: Cell[] = LAYOUT.flat().map((name) => ({
		name,
		owner: null,
		frozen: 0,
		blocked: 0
	}));
	for (const [side, row, col] of START) cells[row * COLS + col].owner = side;
	return { cols: COLS, rows: ROWS, cells };
}

export function isLand(cell: Cell): boolean {
	return cell.name !== null;
}

/** A tile that takes part in lines: land, not blocked by a strike and not frozen by a scandal */
export function isLive(cell: Cell): boolean {
	return isLand(cell) && cell.blocked === 0 && cell.frozen === 0;
}

/** The land tile at a position, or undefined outside the grid and in the sea */
export function cellAt(board: Board, row: number, col: number): Cell | undefined {
	if (row < 0 || col < 0 || row >= board.rows || col >= board.cols) return undefined;
	const cell = board.cells[row * board.cols + col];
	return isLand(cell) ? cell : undefined;
}

/** Land tiles touching this one, in all eight directions */
export function neighborCount(board: Board, index: number): number {
	const row = Math.floor(index / board.cols);
	const col = index % board.cols;
	return DIRECTIONS.filter(([dr, dc]) => cellAt(board, row + dr, col + dc)).length;
}

/** Whether a rally can be held here: an empty land tile that no strike blocks */
export function canRally(board: Board, index: number): boolean {
	const cell = board.cells[index];
	return cell !== undefined && isLand(cell) && cell.owner === null && cell.blocked === 0;
}

/** Every tile a rally can be held on */
export function rallyTiles(board: Board): number[] {
	const tiles: number[] = [];
	for (let i = 0; i < board.cells.length; i++) if (canRally(board, i)) tiles.push(i);
	return tiles;
}

/**
 * The tiles that flip to `side` when it holds a rally at `index`. In each direction a run of rival
 * tiles counts only if the run ends at a tile of `side`; blocked and frozen tiles break a line
 * (a frozen tile can neither anchor a line nor be flipped). Returns [] for a tile where no rally
 * can be held.
 */
export function flipsFor(board: Board, index: number, side: Side): number[] {
	if (!canRally(board, index)) return [];
	const row = Math.floor(index / board.cols);
	const col = index % board.cols;
	const foe = otherSide(side);
	const flips: number[] = [];
	for (const [dr, dc] of DIRECTIONS) {
		const run: number[] = [];
		for (let step = 1; ; step++) {
			const r = row + dr * step;
			const c = col + dc * step;
			const cell = cellAt(board, r, c);
			if (!cell || !isLive(cell) || cell.owner === null) break;
			if (cell.owner === foe) {
				run.push(r * board.cols + c);
				continue;
			}
			// Our own live tile closes the line
			flips.push(...run);
			break;
		}
	}
	return flips;
}

/** Holds a rally: claims the tile and flips every line. Returns the flipped tiles, or null if illegal. */
export function holdRally(board: Board, index: number, side: Side): number[] | null {
	if (!canRally(board, index)) return null;
	const flips = flipsFor(board, index, side);
	board.cells[index].owner = side;
	for (const flipped of flips) board.cells[flipped].owner = side;
	return flips;
}

export interface Tally {
	you: number;
	rival: number;
	free: number;
	total: number;
}

export function tally(board: Board): Tally {
	let you = 0;
	let rival = 0;
	let total = 0;
	for (const cell of board.cells) {
		if (!isLand(cell)) continue;
		total += 1;
		if (cell.owner === 'you') you += 1;
		else if (cell.owner === 'rival') rival += 1;
	}
	return { you, rival, free: total - you - rival, total };
}

/** The order in which the map swings at the election result: a wave from west to east */
export function swingOrder(board: Board): number[] {
	const order: number[] = [];
	for (let col = 0; col < board.cols; col++) {
		for (let row = 0; row < board.rows; row++) {
			const index = row * board.cols + col;
			if (isLand(board.cells[index])) order.push(index);
		}
	}
	return order;
}

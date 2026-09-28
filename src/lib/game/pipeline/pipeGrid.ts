/*
 * Pipeline Panic board: layout generation with a guaranteed solvable route, and oil flow detection
 * by breadth-first search from the pumping station. The station sits on the north edge and feeds
 * the top row; the export terminal sits on the opposite (south) edge below the bottom row, which
 * suits a portrait phone screen.
 */
import { pickWeighted, randomInt, type Random } from '$lib/game/random';
import {
	DELTA,
	DIRECTIONS,
	NORTH,
	ROTATIONS,
	SOUTH,
	hasOpening,
	opposite,
	rotationsFor,
	type Direction,
	type Rotation,
	type TileKind
} from './tiles';

export interface Tile {
	kind: TileKind;
	rotation: Rotation;
	/** A broken tile shows a crack and a leak and blocks the flow until it is repaired */
	broken: boolean;
	/** Repair progress of a broken tile, from 0 to 1 */
	repair: number;
}

export interface PipeGrid {
	rows: number;
	cols: number;
	/** Column of the top-row tile fed by the pumping station */
	stationCol: number;
	/** Column of the bottom-row tile that empties into the export terminal */
	terminalCol: number;
	/** Row-major list of tiles */
	tiles: Tile[];
}

export interface Layout {
	grid: PipeGrid;
	/** Cells of the guaranteed route, from the station tile to the terminal tile */
	route: number[];
	/** For each route cell, a rotation that connects it to its route neighbors */
	solution: Rotation[];
}

export interface Flow {
	/** Tiles that oil reaches from the station */
	filled: boolean[];
	/** Breadth-first distance from the station tile, or -1 where oil does not reach */
	distance: number[];
	reachesTerminal: boolean;
	/** Number of tiles on the shortest flowing route to the terminal, 0 while flow is cut */
	pathLength: number;
}

export function cellIndex(grid: Pick<PipeGrid, 'cols'>, row: number, col: number): number {
	return row * grid.cols + col;
}

export function cellRow(grid: Pick<PipeGrid, 'cols'>, cell: number): number {
	return Math.floor(cell / grid.cols);
}

export function cellCol(grid: Pick<PipeGrid, 'cols'>, cell: number): number {
	return cell % grid.cols;
}

export function stationCell(grid: PipeGrid): number {
	return cellIndex(grid, 0, grid.stationCol);
}

export function terminalCell(grid: PipeGrid): number {
	return cellIndex(grid, grid.rows - 1, grid.terminalCol);
}

/** The neighboring cell in a direction, or null at the edge of the grid */
export function neighbor(
	grid: Pick<PipeGrid, 'rows' | 'cols'>,
	cell: number,
	direction: Direction
): number | null {
	const row = cellRow(grid, cell) + DELTA[direction].row;
	const col = cellCol(grid, cell) + DELTA[direction].col;
	if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
	return cellIndex(grid, row, col);
}

function directionBetween(grid: Pick<PipeGrid, 'cols'>, from: number, to: number): Direction {
	const rowStep = cellRow(grid, to) - cellRow(grid, from);
	const colStep = cellCol(grid, to) - cellCol(grid, from);
	const direction = DIRECTIONS.find((d) => DELTA[d].row === rowStep && DELTA[d].col === colStep);
	if (direction === undefined) throw new Error('Cells are not neighbors');
	return direction;
}

/** Oil can pass from a cell to its neighbor: both intact and both open towards each other */
export function connects(grid: PipeGrid, cell: number, direction: Direction): boolean {
	const other = neighbor(grid, cell, direction);
	if (other === null) return false;
	const a = grid.tiles[cell];
	const b = grid.tiles[other];
	return (
		!a.broken &&
		!b.broken &&
		hasOpening(a.kind, a.rotation, direction) &&
		hasOpening(b.kind, b.rotation, opposite(direction))
	);
}

/** Breadth-first search from the station through every connected, intact tile */
export function computeFlow(grid: PipeGrid): Flow {
	const count = grid.rows * grid.cols;
	const distance = new Array<number>(count).fill(-1);
	const start = stationCell(grid);
	const first = grid.tiles[start];

	if (!first.broken && hasOpening(first.kind, first.rotation, NORTH)) {
		distance[start] = 0;
		const queue = [start];
		for (let head = 0; head < queue.length; head++) {
			const cell = queue[head];
			for (const direction of DIRECTIONS) {
				if (!connects(grid, cell, direction)) continue;
				const next = neighbor(grid, cell, direction)!;
				if (distance[next] !== -1) continue;
				distance[next] = distance[cell] + 1;
				queue.push(next);
			}
		}
	}

	const end = terminalCell(grid);
	const last = grid.tiles[end];
	const reachesTerminal = distance[end] !== -1 && hasOpening(last.kind, last.rotation, SOUTH);
	return {
		filled: distance.map((d) => d !== -1),
		distance,
		reachesTerminal,
		pathLength: reachesTerminal ? distance[end] + 1 : 0
	};
}

/**
 * A simple path from start to end by iterative depth-first search with a global visited set,
 * which always succeeds on a connected grid. Moves towards the terminal are slightly preferred so
 * the route winds but does not usually fill the whole board.
 */
function findRoute(random: Random, rows: number, cols: number, start: number, end: number) {
	const grid = { rows, cols };
	const endCol = cellCol(grid, end);
	const visited = new Array<boolean>(rows * cols).fill(false);

	const orderedNeighbors = (cell: number): number[] => {
		const col = cellCol(grid, cell);
		const candidates = DIRECTIONS.flatMap((direction) => {
			const next = neighbor(grid, cell, direction);
			if (next === null) return [];
			const towardsEndCol = (direction === 1 && col < endCol) || (direction === 3 && col > endCol);
			const weight = direction === SOUTH ? 3 : direction === NORTH ? 1 : towardsEndCol ? 2.5 : 1.5;
			return [{ item: next, weight }];
		});
		const ordered: number[] = [];
		while (candidates.length > 0) {
			const pick = pickWeighted(random, candidates);
			ordered.push(pick);
			candidates.splice(
				candidates.findIndex((candidate) => candidate.item === pick),
				1
			);
		}
		return ordered;
	};

	const path = [start];
	const options = [orderedNeighbors(start)];
	visited[start] = true;
	while (path.length > 0) {
		const cell = path[path.length - 1];
		if (cell === end) return path;
		const choices = options[options.length - 1];
		const next = choices.shift();
		if (next === undefined) {
			path.pop();
			options.pop();
		} else if (!visited[next]) {
			visited[next] = true;
			path.push(next);
			options.push(orderedNeighbors(next));
		}
	}
	throw new Error('No route found');
}

const FILLER_KINDS: readonly { item: TileKind; weight: number }[] = [
	{ item: 'straight', weight: 34 },
	{ item: 'elbow', weight: 34 },
	{ item: 'tee', weight: 24 },
	{ item: 'cross', weight: 8 }
];

/**
 * Generates a scrambled board that always contains at least one solvable route from the station
 * to the terminal. The board never starts out already connected.
 */
export function generateLayout(random: Random, rows: number, cols: number): Layout {
	if (rows < 2 || cols < 2) throw new Error('The grid needs at least two rows and two columns');
	const stationCol = randomInt(random, 0, cols);
	const terminalCol = randomInt(random, 0, cols);
	const shape = { rows, cols };
	const start = cellIndex(shape, 0, stationCol);
	const end = cellIndex(shape, rows - 1, terminalCol);

	// A few attempts, keeping the shortest, so the route stays a puzzle rather than a maze
	const maxLength = Math.ceil(rows * cols * 0.55);
	let route = findRoute(random, rows, cols, start, end);
	for (let attempt = 0; attempt < 12 && route.length > maxLength; attempt++) {
		const candidate = findRoute(random, rows, cols, start, end);
		if (candidate.length < route.length) route = candidate;
	}

	const tiles: Tile[] = Array.from({ length: rows * cols }, () => ({
		kind: pickWeighted(random, FILLER_KINDS),
		rotation: 0 as Rotation,
		broken: false,
		repair: 0
	}));

	const solution = route.map((cell, index) => {
		const entry = index === 0 ? NORTH : directionBetween(shape, cell, route[index - 1]);
		const exit =
			index === route.length - 1 ? SOUTH : directionBetween(shape, cell, route[index + 1]);
		const plain: TileKind = entry === opposite(exit) ? 'straight' : 'elbow';
		// The first tile is never a cross, so it can always be turned away from the station
		const kind = pickWeighted(random, [
			{ item: plain, weight: 80 },
			{ item: 'tee' as const, weight: 15 },
			{ item: 'cross' as const, weight: index === 0 ? 0 : 5 }
		]);
		tiles[cell].kind = kind;
		const fitting = rotationsFor(kind, [entry, exit]);
		return fitting[randomInt(random, 0, fitting.length)];
	});

	for (const tile of tiles) tile.rotation = ROTATIONS[randomInt(random, 0, 4)];

	const grid: PipeGrid = { rows, cols, stationCol, terminalCol, tiles };
	if (computeFlow(grid).reachesTerminal) {
		const first = tiles[start];
		first.rotation = ROTATIONS.find((rotation) => !hasOpening(first.kind, rotation, NORTH))!;
	}
	return { grid, route, solution };
}

/** Turns every route tile into its solved rotation (used by tests and as a reference solution) */
export function applySolution(
	grid: PipeGrid,
	route: readonly number[],
	solution: readonly Rotation[]
) {
	route.forEach((cell, index) => (grid.tiles[cell].rotation = solution[index]));
}

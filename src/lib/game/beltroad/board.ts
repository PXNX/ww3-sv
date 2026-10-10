/*
 * Belt & Road: Fill Grid rules (a flow-style puzzle). Port pairs sit on a grid; every pair gets one
 * trade route (a line of orthogonally adjacent cells) that joins its two ports, routes never share a
 * cell, and EVERY cell of the grid has to be covered by a route.
 *
 * A level is plain JSON. The running state is one path per pair: the cells in drawing order,
 * starting at one of the pair's ports ([] when the pair has not been touched). Everything here is
 * pure, so the solver, the generator script and the tests need neither a DOM nor the store.
 */

export type Cell = readonly [row: number, col: number];

export type Tier = 'easy' | 'medium' | 'hard';
export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

/** The ports in the game; each one has a fixed color and cartoon icon (see ports.ts) */
export const PORTS = [
	'shanghai',
	'piraeus',
	'hamburg',
	'rotterdam',
	'singapore',
	'mombasa',
	'colombo',
	'trieste',
	'djibouti'
] as const;
export type PortId = (typeof PORTS)[number];

export interface PortPair {
	port: PortId;
	a: Cell;
	b: Cell;
}

export interface Level {
	id: string;
	tier: Tier;
	width: number;
	height: number;
	pairs: PortPair[];
	/**
	 * One pre-verified solution, a route per pair in pair order, written as the steps from port a to
	 * port b: U, D, L and R (up, down, left, right), for example "RRDL"
	 */
	solution: string[];
}

/** One path per pair, indexed like Level.pairs */
export type Paths = readonly (readonly Cell[])[];

export const DEBT_PER_MOVE = 25;
export const MAX_STARS = 3;

const STEPS: Record<string, readonly [number, number]> = {
	U: [-1, 0],
	D: [1, 0],
	L: [0, -1],
	R: [0, 1]
};

/** The cells of a route written as steps (see Level.solution), starting at a given cell */
export function decodeRoute(start: Cell, steps: string): Cell[] {
	const cells: Cell[] = [start];
	let [row, col] = start;
	for (const letter of steps) {
		const delta = STEPS[letter];
		if (!delta) throw new Error(`Unknown step ${letter}`);
		row += delta[0];
		col += delta[1];
		cells.push([row, col]);
	}
	return cells;
}

/** The steps from one cell of a route to the next, the inverse of decodeRoute */
export function encodeRoute(cells: readonly Cell[]): string {
	return cells
		.slice(1)
		.map((cell, index) => {
			const dRow = cell[0] - cells[index][0];
			const dCol = cell[1] - cells[index][1];
			const letter = Object.entries(STEPS).find(([, d]) => d[0] === dRow && d[1] === dCol)?.[0];
			if (!letter) throw new Error('Route cells are not adjacent');
			return letter;
		})
		.join('');
}

/** The stored solution of a level as paths, ready for validate() */
export function solutionPaths(level: Level): Paths {
	return level.pairs.map((pair, index) => decodeRoute(pair.a, level.solution[index] ?? ''));
}

export function emptyPaths(level: Level): Paths {
	return level.pairs.map(() => []);
}

export const sameCell = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

export const adjacent = (a: Cell, b: Cell): boolean =>
	Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export function inBounds(level: Pick<Level, 'width' | 'height'>, cell: Cell): boolean {
	return (
		Number.isInteger(cell[0]) &&
		Number.isInteger(cell[1]) &&
		cell[0] >= 0 &&
		cell[1] >= 0 &&
		cell[0] < level.height &&
		cell[1] < level.width
	);
}

export function cellCount(level: Pick<Level, 'width' | 'height'>): number {
	return level.width * level.height;
}

/** The fewest moves a level can take: every route drawn in a single stroke */
export function parFor(level: Pick<Level, 'pairs'>): number {
	return level.pairs.length;
}

/** The stars a finished level earns: close to par is three, within double par is two */
export function starsFor(moves: number, par: number): number {
	if (moves <= movesForStars(par, 3)) return 3;
	if (moves <= movesForStars(par, 2)) return 2;
	return 1;
}

/** Highest move count that still earns the given star rating */
export function movesForStars(par: number, stars: 2 | 3): number {
	return stars === 3 ? par + Math.ceil(par / 3) : par * 2;
}

/** The debt (in billions) after a number of moves: every stroke adds to it */
export function debtFor(moves: number): number {
	return Math.max(0, moves) * DEBT_PER_MOVE;
}

/** Which pair and which end a port cell belongs to, or null for an ordinary cell */
export function portAt(level: Level, cell: Cell): { pair: number; end: 'a' | 'b' } | null {
	for (let pair = 0; pair < level.pairs.length; pair++) {
		if (sameCell(level.pairs[pair].a, cell)) return { pair, end: 'a' };
		if (sameCell(level.pairs[pair].b, cell)) return { pair, end: 'b' };
	}
	return null;
}

/** The port of a pair at the other end from the given one */
export function otherPort(pair: PortPair, from: Cell): Cell {
	return sameCell(pair.a, from) ? pair.b : pair.a;
}

/** The pair whose route covers a cell, or -1 (the first one if a broken state covers it twice) */
export function ownerOf(paths: Paths, cell: Cell): number {
	for (let pair = 0; pair < paths.length; pair++) {
		if (paths[pair].some((step) => sameCell(step, cell))) return pair;
	}
	return -1;
}

/** Owner of every cell, row by row: the pair index or -1 for an empty cell */
export function ownerGrid(level: Level, paths: Paths): Int8Array {
	const grid = new Int8Array(cellCount(level)).fill(-1);
	paths.forEach((path, pair) => {
		for (const cell of path) {
			if (inBounds(level, cell)) grid[cell[0] * level.width + cell[1]] = pair;
		}
	});
	return grid;
}

/** How many cells carry a route */
export function coveredCount(level: Level, paths: Paths): number {
	return ownerGrid(level, paths).reduce((sum, owner) => sum + (owner >= 0 ? 1 : 0), 0);
}

function isContiguous(path: readonly Cell[]): boolean {
	return path.every((cell, index) => index === 0 || adjacent(path[index - 1], cell));
}

/** Whether a pair's route is complete: it runs without gaps from one of its ports to the other */
export function isConnected(level: Level, paths: Paths, pair: number): boolean {
	const path = paths[pair];
	if (!path || path.length < 2) return false;
	const { a, b } = level.pairs[pair];
	const first = path[0];
	const last = path[path.length - 1];
	const joinsPorts =
		(sameCell(first, a) && sameCell(last, b)) || (sameCell(first, b) && sameCell(last, a));
	return joinsPorts && isContiguous(path);
}

export interface Validation {
	/** Cells that no route covers (full coverage fails) */
	uncovered: Cell[];
	/** Cells that more than one route (or one route twice) covers */
	overlapping: Cell[];
	/** Pairs whose route has a gap, leaves the grid or runs over a foreign port */
	broken: number[];
	/** Pairs whose ports are not joined by their route */
	unconnected: number[];
	solved: boolean;
}

/** The win check: full coverage, no overlap, every pair connected end to end */
export function validate(level: Level, paths: Paths): Validation {
	const uses = new Int16Array(cellCount(level));
	const broken: number[] = [];
	const unconnected: number[] = [];
	for (let pair = 0; pair < level.pairs.length; pair++) {
		const path = paths[pair] ?? [];
		let bad = !isContiguous(path);
		for (const cell of path) {
			if (!inBounds(level, cell)) {
				bad = true;
				continue;
			}
			uses[cell[0] * level.width + cell[1]]++;
			const port = portAt(level, cell);
			if (port && port.pair !== pair) bad = true;
		}
		if (bad) broken.push(pair);
		if (!isConnected(level, paths, pair)) unconnected.push(pair);
	}
	const uncovered: Cell[] = [];
	const overlapping: Cell[] = [];
	for (let row = 0; row < level.height; row++) {
		for (let col = 0; col < level.width; col++) {
			const used = uses[row * level.width + col];
			if (used === 0) uncovered.push([row, col]);
			else if (used > 1) overlapping.push([row, col]);
		}
	}
	return {
		uncovered,
		overlapping,
		broken,
		unconnected,
		solved:
			uncovered.length === 0 &&
			overlapping.length === 0 &&
			broken.length === 0 &&
			unconnected.length === 0
	};
}

export function isSolved(level: Level, paths: Paths): boolean {
	return validate(level, paths).solved;
}

/** Problems with a level definition itself (empty when it is well formed) */
export function validateLevel(level: Level): string[] {
	const problems: string[] = [];
	if (!Number.isInteger(level.width) || !Number.isInteger(level.height)) problems.push('size');
	if (level.width < 2 || level.height < 2) problems.push('size too small');
	if (level.pairs.length === 0) problems.push('no pairs');
	const seenPorts = new Set<string>();
	const seenCells = new Set<string>();
	for (const pair of level.pairs) {
		if (!PORTS.includes(pair.port)) problems.push(`unknown port ${pair.port}`);
		if (seenPorts.has(pair.port)) problems.push(`port ${pair.port} twice`);
		seenPorts.add(pair.port);
		for (const cell of [pair.a, pair.b]) {
			if (!inBounds(level, cell)) problems.push(`${pair.port} port outside the grid`);
			const key = `${cell[0]},${cell[1]}`;
			if (seenCells.has(key)) problems.push(`two ports share ${key}`);
			seenCells.add(key);
		}
		if (sameCell(pair.a, pair.b)) problems.push(`${pair.port} ports coincide`);
	}
	if (level.solution.length !== level.pairs.length) problems.push('solution is missing pairs');
	return problems;
}

// ---------------------------------------------------------------------------------------------
// Drawing. A stroke starts on a port or on a cell of an existing route and then grows cell by cell.
// ---------------------------------------------------------------------------------------------

function withPath(paths: Paths, pair: number, path: readonly Cell[]): Paths {
	return paths.map((existing, index) => (index === pair ? path : existing));
}

/**
 * Where a press lands. On a port the route of that pair starts over from that port. On a cell of a
 * route the route is cut back to that cell and carries on from there. Anywhere else nothing starts.
 */
export function startStroke(
	level: Level,
	paths: Paths,
	cell: Cell
): { paths: Paths; pair: number } | null {
	if (!inBounds(level, cell)) return null;
	const port = portAt(level, cell);
	if (port) return { paths: withPath(paths, port.pair, [cell]), pair: port.pair };
	const pair = ownerOf(paths, cell);
	if (pair < 0) return null;
	const index = paths[pair].findIndex((step) => sameCell(step, cell));
	return { paths: withPath(paths, pair, paths[pair].slice(0, index + 1)), pair };
}

export type StepResult =
	| 'moved'
	| 'retracted'
	| 'cut'
	| 'completed'
	/** The cell is not free to enter (another pair's port, or the route is already complete) */
	| 'blocked'
	/** The cell is not next to the tip, or off the grid */
	| 'ignored';

/**
 * Moves the tip of a pair's route one cell:
 *  - into a free cell: the route grows;
 *  - back over its own line: the route retracts to that cell;
 *  - over another pair's route: that route is cut off right before the cell;
 *  - onto its own other port: the pair is connected;
 *  - onto any other port: blocked.
 */
export function stepStroke(
	level: Level,
	paths: Paths,
	pair: number,
	to: Cell
): { paths: Paths; result: StepResult } {
	const path = paths[pair];
	if (!path || path.length === 0 || !inBounds(level, to)) return { paths, result: 'ignored' };
	const tip = path[path.length - 1];
	if (!adjacent(tip, to)) return { paths, result: 'ignored' };

	const ownIndex = path.findIndex((step) => sameCell(step, to));
	if (ownIndex >= 0) {
		return { paths: withPath(paths, pair, path.slice(0, ownIndex + 1)), result: 'retracted' };
	}

	const target = otherPort(level.pairs[pair], path[0]);
	if (sameCell(tip, target)) return { paths, result: 'blocked' };

	const port = portAt(level, to);
	if (port) {
		if (port.pair === pair && sameCell(to, target)) {
			return { paths: withPath(paths, pair, [...path, to]), result: 'completed' };
		}
		return { paths, result: 'blocked' };
	}

	const owner = ownerOf(paths, to);
	if (owner >= 0) {
		const cutAt = paths[owner].findIndex((step) => sameCell(step, to));
		const cutPaths = paths.map((existing, index) => {
			if (index === owner) return existing.slice(0, cutAt);
			if (index === pair) return [...path, to];
			return existing;
		});
		return { paths: cutPaths, result: 'cut' };
	}
	return { paths: withPath(paths, pair, [...path, to]), result: 'moved' };
}

/** The neighbor of a cell that lies in the direction of another cell (the longer axis first) */
export function stepToward(from: Cell, to: Cell): Cell {
	const dRow = to[0] - from[0];
	const dCol = to[1] - from[1];
	if (Math.abs(dCol) >= Math.abs(dRow) && dCol !== 0) return [from[0], from[1] + Math.sign(dCol)];
	return [from[0] + Math.sign(dRow), from[1]];
}

/**
 * Drags the tip of a route to a cell, step by step, so a fast pointer that skips cells still draws
 * a connected line. Stops at the first cell that cannot be entered.
 */
export function dragStroke(
	level: Level,
	paths: Paths,
	pair: number,
	to: Cell
): { paths: Paths; results: StepResult[] } {
	let current = paths;
	const results: StepResult[] = [];
	const limit = 2 * (level.width + level.height);
	for (let guard = 0; guard < limit; guard++) {
		const path = current[pair];
		if (!path || path.length === 0) break;
		const tip = path[path.length - 1];
		if (sameCell(tip, to)) break;
		const step = stepStroke(level, current, pair, stepToward(tip, to));
		results.push(step.result);
		if (step.result === 'blocked' || step.result === 'ignored') break;
		current = step.paths;
	}
	return { paths: current, results };
}

export function samePaths(a: Paths, b: Paths): boolean {
	return (
		a.length === b.length &&
		a.every(
			(path, pair) =>
				path.length === b[pair].length &&
				path.every((cell, index) => sameCell(cell, b[pair][index]))
		)
	);
}

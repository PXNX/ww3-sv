/*
 * Belt & Road solver: a depth-first search that grows all routes at once. At every step it picks the
 * route that has the fewest ways to continue (zero means a dead end) and tries each of them. Two
 * cheap checks cut the search down: every empty cell needs two neighbors it could still be joined to,
 * and every empty region has to touch the tip of a route that is still growing.
 *
 * It finds a full solution (every cell covered, every pair joined), counts solutions up to a limit
 * (to prove a level has exactly one) and reports how many nodes it visited (a difficulty measure).
 */
import type { Cell, Level, Paths } from './board';

export interface SolveOptions {
	/** Stop after this many solutions (default 1) */
	limit?: number;
	/** Give up after visiting this many nodes (default 2 million) */
	maxNodes?: number;
}

export interface SolveResult {
	/** The first solution found, as a path per pair from port a to port b; null if none exists */
	paths: Paths | null;
	/** Solutions found, at most `limit` */
	count: number;
	nodes: number;
	/** True when the search stopped at maxNodes, so a count of zero proves nothing */
	exhausted: boolean;
}

export function solve(level: Level, options: SolveOptions = {}): SolveResult {
	const { limit = 1, maxNodes = 2_000_000 } = options;
	const { width, height } = level;
	const total = width * height;
	const pairCount = level.pairs.length;

	const neighbors: number[][] = Array.from({ length: total }, (_, index) => {
		const row = Math.floor(index / width);
		const col = index % width;
		const list: number[] = [];
		if (row > 0) list.push(index - width);
		if (row < height - 1) list.push(index + width);
		if (col > 0) list.push(index - 1);
		if (col < width - 1) list.push(index + 1);
		return list;
	});

	const grid = new Int8Array(total).fill(-1);
	const head = new Int32Array(pairCount);
	const target = new Int32Array(pairCount);
	const done = new Uint8Array(pairCount);
	const trail: number[][] = [];
	level.pairs.forEach((pair, index) => {
		head[index] = pair.a[0] * width + pair.a[1];
		target[index] = pair.b[0] * width + pair.b[1];
		grid[head[index]] = index;
		grid[target[index]] = index;
		trail.push([head[index]]);
	});
	let empty = total - 2 * pairCount;
	let unfinished = pairCount;

	let nodes = 0;
	let count = 0;
	let aborted = false;
	let first: Paths | null = null;

	/** Dead-end checks on the current position; false means no solution can follow */
	function viable(): boolean {
		const seen = new Uint8Array(total);
		const stack: number[] = [];
		for (let start = 0; start < total; start++) {
			if (grid[start] !== -1) continue;
			let open = 0;
			for (const next of neighbors[start]) {
				const owner = grid[next];
				if (owner === -1) open++;
				else if (!done[owner] && (head[owner] === next || target[owner] === next)) open++;
			}
			if (open < 2) return false;
			if (seen[start]) continue;
			// Flood the empty region and look for a route tip that can grow into it
			let touchesHead = false;
			seen[start] = 1;
			stack.push(start);
			while (stack.length > 0) {
				const cell = stack.pop() as number;
				for (const next of neighbors[cell]) {
					const owner = grid[next];
					if (owner === -1) {
						if (!seen[next]) {
							seen[next] = 1;
							stack.push(next);
						}
					} else if (!done[owner] && head[owner] === next) {
						touchesHead = true;
					}
				}
			}
			if (!touchesHead) return false;
		}
		return true;
	}

	function record() {
		count++;
		if (first) return;
		first = level.pairs.map((_, index) =>
			trail[index].map((cell): Cell => [Math.floor(cell / width), cell % width])
		);
	}

	function search() {
		if (aborted || count >= limit) return;
		if (++nodes > maxNodes) {
			aborted = true;
			return;
		}
		if (unfinished === 0) {
			if (empty === 0) record();
			return;
		}

		// The route with the fewest continuations goes first
		let best = -1;
		let bestMoves: number[] = [];
		for (let pair = 0; pair < pairCount; pair++) {
			if (done[pair]) continue;
			const moves = neighbors[head[pair]].filter(
				(next) => grid[next] === -1 || next === target[pair]
			);
			if (best === -1 || moves.length < bestMoves.length) {
				best = pair;
				bestMoves = moves;
				if (moves.length === 0) return;
			}
		}

		const from = head[best];
		for (const next of bestMoves) {
			if (next === target[best]) {
				// Joining the pair is only worth it if the rest can still be covered
				done[best] = 1;
				unfinished--;
				trail[best].push(next);
				if (viable()) search();
				trail[best].pop();
				unfinished++;
				done[best] = 0;
			} else {
				grid[next] = best;
				head[best] = next;
				empty--;
				trail[best].push(next);
				if (viable()) search();
				trail[best].pop();
				empty++;
				head[best] = from;
				grid[next] = -1;
			}
			if (aborted || count >= limit) return;
		}
	}

	if (viable()) search();
	return { paths: first, count, nodes, exhausted: aborted };
}

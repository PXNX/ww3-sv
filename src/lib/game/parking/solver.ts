/*
 * Breadth-first solver for Tanker Parking. A move slides one ship any distance along its axis, so
 * the number of moves is the number of drags a player needs; the BFS finds the fewest, which is
 * the level's par. It also powers the level validator and the level generator script.
 */
import { isSolved, occupancy, slideRange, withMove, type Positions, type Puzzle } from './board';

export interface Step {
	piece: number;
	from: number;
	to: number;
}

export interface Solution {
	/** Fewest moves from the starting positions */
	moves: number;
	path: Step[];
	/** How many distinct positions the search visited */
	visited: number;
}

export interface SolveOptions {
	from?: Positions;
	/** Give up (return null) after visiting this many positions */
	maxStates?: number;
}

const keyOf = (positions: Positions) => String.fromCharCode(...positions);

/** The shortest solution, or null when there is none (or the state limit was hit) */
export function solve(
	puzzle: Puzzle,
	{ from = puzzle.start, maxStates = Infinity }: SolveOptions = {}
): Solution | null {
	if (isSolved(puzzle, from)) return { moves: 0, path: [], visited: 1 };

	const parents = new Map<string, { parent: string; step: Step }>();
	const states = new Map<string, Positions>();
	const startKey = keyOf(from);
	states.set(startKey, from);
	let frontier: Positions[] = [from];

	for (let depth = 1; frontier.length > 0; depth++) {
		const next: Positions[] = [];
		for (const positions of frontier) {
			const parentKey = keyOf(positions);
			const grid = occupancy(puzzle, positions);
			for (let piece = 0; piece < puzzle.pieces.length; piece++) {
				const { min, max } = slideRange(puzzle, positions, piece, grid);
				for (let to = min; to <= max; to++) {
					if (to === positions[piece]) continue;
					const moved = withMove(positions, piece, to);
					const key = keyOf(moved);
					if (states.has(key)) continue;
					states.set(key, moved);
					parents.set(key, { parent: parentKey, step: { piece, from: positions[piece], to } });
					if (isSolved(puzzle, moved)) {
						return { moves: depth, path: pathTo(parents, key, startKey), visited: states.size };
					}
					next.push(moved);
				}
			}
			if (states.size > maxStates) return null;
		}
		frontier = next;
	}
	return null;
}

function pathTo(
	parents: Map<string, { parent: string; step: Step }>,
	goal: string,
	start: string
): Step[] {
	const path: Step[] = [];
	for (let key = goal; key !== start;) {
		const entry = parents.get(key);
		if (!entry) break;
		path.push(entry.step);
		key = entry.parent;
	}
	return path.reverse();
}

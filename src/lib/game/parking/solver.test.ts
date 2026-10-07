import { describe, expect, it } from 'vitest';
import { createPuzzle, isSolved, slideRange, withMove, type Level } from './board';
import { solve } from './solver';

function level(partial: Partial<Level> & Pick<Level, 'tanker' | 'ships'>): Level {
	return { id: 't', tier: 'easy', width: 5, height: 5, par: 1, rocks: [], ...partial };
}

describe('solve', () => {
	it('needs zero moves when the tanker already sits at the exit', () => {
		const puzzle = createPuzzle(level({ tanker: { row: 2, col: 3, length: 2 }, ships: [] }));
		expect(solve(puzzle)).toMatchObject({ moves: 0, path: [] });
	});

	it('counts a long slide as one move', () => {
		const puzzle = createPuzzle(level({ tanker: { row: 2, col: 0, length: 2 }, ships: [] }));
		expect(solve(puzzle)?.moves).toBe(1);
	});

	it('moves a blocking ship out of the way first', () => {
		// A vertical ship in column 3 sits in the tanker's row and can drop clear in one move
		const puzzle = createPuzzle(
			level({
				tanker: { row: 1, col: 0, length: 2 },
				ships: [{ axis: 'v', length: 2, row: 0, col: 3 }]
			})
		);
		const solution = solve(puzzle);
		expect(solution?.moves).toBe(2);
		expect(solution?.path[0].piece).toBe(1);
		expect(solution?.path[1].piece).toBe(0);
	});

	it('finds the shortest of several routes', () => {
		// The blocker in column 2 can leave downwards in one move; the decoy ship does not matter
		const puzzle = createPuzzle(
			level({
				height: 6,
				tanker: { row: 2, col: 0, length: 2 },
				ships: [
					{ axis: 'v', length: 3, row: 1, col: 2 },
					{ axis: 'h', length: 2, row: 5, col: 0 }
				]
			})
		);
		expect(solve(puzzle)?.moves).toBe(2);
	});

	it('returns null when a rock blocks the exit row', () => {
		const puzzle = createPuzzle(
			level({ tanker: { row: 2, col: 0, length: 2 }, ships: [], rocks: [[2, 4]] })
		);
		expect(solve(puzzle)).toBeNull();
	});

	it('returns null for a ship that cannot get out of the way', () => {
		// A vertical ship spanning the whole column can never leave the tanker's row
		const puzzle = createPuzzle(
			level({
				height: 3,
				width: 4,
				tanker: { row: 1, col: 0, length: 2 },
				ships: [{ axis: 'v', length: 3, row: 0, col: 3 }]
			})
		);
		expect(solve(puzzle)).toBeNull();
	});

	it('gives a path that replays legally and ends solved', () => {
		const puzzle = createPuzzle(
			level({
				tanker: { row: 2, col: 0, length: 2 },
				ships: [
					{ axis: 'v', length: 2, row: 1, col: 2 },
					{ axis: 'h', length: 2, row: 0, col: 1 },
					{ axis: 'h', length: 2, row: 3, col: 2 },
					{ axis: 'v', length: 2, row: 3, col: 4 }
				]
			})
		);
		const solution = solve(puzzle);
		expect(solution).not.toBeNull();
		let positions = puzzle.start;
		for (const step of solution?.path ?? []) {
			expect(positions[step.piece]).toBe(step.from);
			const { min, max } = slideRange(puzzle, positions, step.piece);
			expect(step.to).toBeGreaterThanOrEqual(min);
			expect(step.to).toBeLessThanOrEqual(max);
			positions = withMove(positions, step.piece, step.to);
		}
		expect(isSolved(puzzle, positions)).toBe(true);
		expect(solution?.path).toHaveLength(solution?.moves ?? -1);
		expect(solution?.moves).toBe(3);
	});

	it('can continue from a position the player reached', () => {
		const puzzle = createPuzzle(
			level({
				tanker: { row: 1, col: 0, length: 2 },
				ships: [{ axis: 'v', length: 2, row: 0, col: 3 }]
			})
		);
		const cleared = withMove(puzzle.start, 1, 2);
		expect(solve(puzzle, { from: cleared })?.moves).toBe(1);
	});

	it('gives up at the state limit', () => {
		const puzzle = createPuzzle(
			level({
				tanker: { row: 1, col: 0, length: 2 },
				ships: [{ axis: 'v', length: 2, row: 0, col: 3 }]
			})
		);
		expect(solve(puzzle, { maxStates: 1 })).toBeNull();
	});
});

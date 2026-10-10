import { describe, expect, it } from 'vitest';
import { DIRECTIONS, type Door, type ItemKind, type Maze } from './maze';
import { isSolvable, parSteps, reachableIgnoringLocks, solve } from './solver';

/**
 * Builds a one-row maze from corridor doors: rooms 0..n-1 in a line, each pair joined by a door,
 * optionally with a lock on the door between room i and i+1.
 */
function corridor(
	length: number,
	options: { locks?: Record<number, ItemKind>; items?: Record<number, ItemKind>; closed?: number[] }
): Maze {
	const doors: (Door | null)[][] = Array.from({ length }, () => DIRECTIONS.map(() => null));
	const right = DIRECTIONS.indexOf('right');
	const left = DIRECTIONS.indexOf('left');
	for (let room = 0; room < length - 1; room++) {
		const lock = options.locks?.[room] ?? null;
		doors[room][right] = { to: room + 1, lock };
		doors[room + 1][left] = { to: room, lock };
	}
	return {
		seed: 0,
		width: length,
		height: 1,
		start: 0,
		goal: length - 1,
		doors,
		items: Array.from({ length }, (_, room) => options.items?.[room] ?? null),
		closed: options.closed ?? []
	};
}

describe('solve', () => {
	it('walks a plain corridor', () => {
		expect(solve(corridor(4, {}))).toEqual(['right', 'right', 'right']);
		expect(parSteps(corridor(4, {}))).toBe(3);
	});

	it('is blocked by a lock whose document cannot be reached', () => {
		const maze = corridor(4, { locks: { 1: 'seal' } });
		expect(solve(maze)).toBeNull();
		expect(isSolvable(maze)).toBe(false);
		expect(parSteps(maze)).toBe(Infinity);
	});

	it('opens a lock with a document collected earlier', () => {
		const maze = corridor(4, { locks: { 2: 'form-27b' }, items: { 1: 'form-27b' } });
		expect(solve(maze)).toEqual(['right', 'right', 'right']);
	});

	it('is blocked when the document lies behind its own lock', () => {
		const maze = corridor(4, { locks: { 1: 'seal' }, items: { 2: 'seal' } });
		expect(solve(maze)).toBeNull();
	});

	it('cannot pass a closed office', () => {
		expect(solve(corridor(4, { closed: [2] }))).toBeNull();
	});

	it('finds the shortest of two routes', () => {
		// A 2x2 block: 0 1 / 2 3, with every door open
		const doors: (Door | null)[][] = [
			[null, { to: 1, lock: null }, { to: 2, lock: null }, null],
			[null, null, { to: 3, lock: null }, { to: 0, lock: null }],
			[{ to: 0, lock: null }, { to: 3, lock: null }, null, null],
			[{ to: 1, lock: null }, null, null, { to: 2, lock: null }]
		];
		const maze: Maze = {
			seed: 0,
			width: 2,
			height: 2,
			start: 0,
			goal: 3,
			doors,
			items: [null, null, null, null],
			closed: []
		};
		expect(parSteps(maze)).toBe(2);
	});
});

describe('reachableIgnoringLocks', () => {
	it('ignores locks but stops at closed offices', () => {
		const locked = corridor(4, { locks: { 1: 'seal' } });
		expect(reachableIgnoringLocks(locked).size).toBe(4);
		const closed = corridor(4, { closed: [2] });
		expect([...reachableIgnoringLocks(closed)].sort()).toEqual([0, 1]);
	});
});

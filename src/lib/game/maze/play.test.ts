import { describe, expect, it } from 'vitest';
import { SIZES } from './difficulty';
import { generateMaze } from './generate';
import { DIRECTIONS, type Door, type ItemKind, type Maze } from './maze';
import {
	directionOfVector,
	directionToward,
	move,
	seenRooms,
	starsFor,
	startState,
	type PlayState
} from './play';
import { solve } from './solver';

/** Rooms 0..length-1 in a row, doors between neighbours; locks and closed offices as given */
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

describe('move', () => {
	it('starts in the start office with nothing done', () => {
		const state = startState(corridor(3, {}));
		expect(state).toMatchObject({ room: 0, steps: 0, collected: [], knownClosed: [], won: false });
		expect(state.visited).toEqual([true, false, false]);
	});

	it('walks through an open door and counts a step', () => {
		const maze = corridor(3, {});
		const result = move(maze, startState(maze), 'right');
		expect(result.outcome).toBe('moved');
		expect(result.state.room).toBe(1);
		expect(result.state.steps).toBe(1);
		expect(result.state.visited).toEqual([true, true, false]);
	});

	it('does not count a bump into a plain wall', () => {
		const maze = corridor(3, {});
		const state = startState(maze);
		for (const direction of ['up', 'down', 'left'] as const) {
			const result = move(maze, state, direction);
			expect(result.outcome).toBe('wall');
			expect(result.state).toBe(state);
		}
	});

	it('picks a document up when entering its office, once', () => {
		const maze = corridor(4, { items: { 1: 'seal' } });
		const first = move(maze, startState(maze), 'right');
		expect(first.pickup).toBe('seal');
		expect(first.state.collected).toEqual(['seal']);
		const back = move(maze, first.state, 'left');
		const again = move(maze, back.state, 'right');
		expect(again.pickup).toBeNull();
		expect(again.state.collected).toEqual(['seal']);
	});

	it('refuses a locked door, costs a step, and says what is missing', () => {
		const maze = corridor(3, { locks: { 0: 'form-27b' } });
		const result = move(maze, startState(maze), 'right');
		expect(result.outcome).toBe('locked');
		expect(result.missing).toBe('form-27b');
		expect(result.state.room).toBe(0);
		expect(result.state.steps).toBe(1);
	});

	it('opens the locked door once the document is carried', () => {
		const maze = corridor(3, { locks: { 1: 'seal' } });
		const carrying: PlayState = { ...startState(maze), room: 1, collected: ['seal'] };
		const result = move(maze, carrying, 'right');
		expect(result.outcome).toBe('won');
	});

	it('bumps into a closed office, learns it is closed, and has to turn around', () => {
		const maze = corridor(4, { closed: [2] });
		let state = move(maze, startState(maze), 'right').state;
		const bump = move(maze, state, 'right');
		expect(bump.outcome).toBe('closed');
		expect(bump.state.room).toBe(1);
		expect(bump.state.steps).toBe(2);
		expect(bump.state.knownClosed).toEqual([2]);
		// A second bump costs again but the office is only remembered once
		state = bump.state;
		expect(move(maze, state, 'right').state.knownClosed).toEqual([2]);
		expect(move(maze, state, 'right').state.steps).toBe(3);
	});

	it('wins on entering the goal and then stops accepting moves', () => {
		const maze = corridor(2, {});
		const won = move(maze, startState(maze), 'right');
		expect(won.outcome).toBe('won');
		expect(won.state.won).toBe(true);
		expect(move(maze, won.state, 'left').state).toBe(won.state);
	});

	it('does not change the state it was given', () => {
		const maze = corridor(3, { items: { 1: 'seal' } });
		const state = startState(maze);
		const copy = structuredClone(state);
		move(maze, state, 'right');
		expect(state).toEqual(copy);
	});

	it('plays the generated solution to the goal with exactly the par step count', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const maze = generateMaze(seed, SIZES.large);
			const path = solve(maze)!;
			let state = startState(maze);
			for (const direction of path) {
				const result = move(maze, state, direction);
				expect(['moved', 'won']).toContain(result.outcome);
				state = result.state;
			}
			expect(state.won).toBe(true);
			expect(state.steps).toBe(path.length);
			expect(state.room).toBe(maze.goal);
		}
	});
});

describe('seenRooms', () => {
	it('shows visited offices and the ones behind their doors', () => {
		const maze = corridor(5, { locks: { 1: 'seal' } });
		const start = startState(maze);
		expect(seenRooms(maze, start)).toEqual([true, true, false, false, false]);
		const next = move(maze, start, 'right').state;
		// Room 2 is behind the locked door but can be seen
		expect(seenRooms(maze, next)).toEqual([true, true, true, false, false]);
	});

	it('does not reveal that a neighbouring office is closed', () => {
		const maze = corridor(3, { closed: [1] });
		const state = startState(maze);
		expect(state.knownClosed).toEqual([]);
		expect(seenRooms(maze, state)[1]).toBe(true);
	});
});

describe('input helpers', () => {
	it('turns a swipe vector into the dominant direction', () => {
		expect(directionOfVector(30, 5)).toBe('right');
		expect(directionOfVector(-30, 5)).toBe('left');
		expect(directionOfVector(4, 40)).toBe('down');
		expect(directionOfVector(4, -40)).toBe('up');
		expect(directionOfVector(0, 0)).toBeNull();
	});

	it('steps towards a tapped office along the longer axis', () => {
		const maze = { ...corridor(1, {}), width: 4, height: 4 };
		expect(directionToward(maze, 5, 7)).toBe('right');
		expect(directionToward(maze, 5, 4)).toBe('left');
		expect(directionToward(maze, 5, 13)).toBe('down');
		expect(directionToward(maze, 5, 1)).toBe('up');
		expect(directionToward(maze, 5, 15)).toBe('down');
		expect(directionToward(maze, 5, 5)).toBeNull();
	});
});

describe('starsFor', () => {
	it('rewards walking close to the shortest way', () => {
		expect(starsFor(20, 20)).toBe(3);
		expect(starsFor(36, 20)).toBe(3);
		expect(starsFor(37, 20)).toBe(2);
		expect(starsFor(60, 20)).toBe(2);
		expect(starsFor(61, 20)).toBe(1);
	});
});

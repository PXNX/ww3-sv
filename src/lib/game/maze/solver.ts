/*
 * Solving a maze: a breadth-first search over (room, documents carried). Picking up a document is
 * automatic when you enter its room, a locked door only opens with the matching document, closed
 * offices cannot be entered. The shortest path is the "par" of a maze.
 */
import { DIRECTIONS, ITEM_KINDS, itemBit, roomCount, type Direction, type Maze } from './maze';

/** The fewest moves that bring the player from the start to the goal office, or null if impossible */
export function solve(maze: Maze): Direction[] | null {
	const masks = 1 << ITEM_KINDS.length;
	const closed = new Set(maze.closed);
	const seen = new Int32Array(roomCount(maze) * masks).fill(-1);
	const via = new Array<Direction | null>(roomCount(maze) * masks).fill(null);
	const startMask = 0;
	const startState = maze.start * masks + startMask;
	seen[startState] = startState;
	const queue = [startState];
	for (let head = 0; head < queue.length; head++) {
		const state = queue[head];
		const room = Math.floor(state / masks);
		const mask = state % masks;
		if (room === maze.goal) {
			const path: Direction[] = [];
			for (let at = state; at !== startState; at = seen[at]) path.push(via[at] as Direction);
			return path.reverse();
		}
		for (const direction of DIRECTIONS) {
			const door = maze.doors[room][DIRECTIONS.indexOf(direction)];
			if (!door || closed.has(door.to)) continue;
			if (door.lock && (mask & itemBit(door.lock)) === 0) continue;
			const item = maze.items[door.to];
			const nextMask = item ? mask | itemBit(item) : mask;
			const next = door.to * masks + nextMask;
			if (seen[next] !== -1) continue;
			seen[next] = state;
			via[next] = direction;
			queue.push(next);
		}
	}
	return null;
}

export function isSolvable(maze: Maze): boolean {
	return solve(maze) !== null;
}

/** The fewest moves to the goal; Infinity when the maze cannot be solved */
export function parSteps(maze: Maze): number {
	return solve(maze)?.length ?? Infinity;
}

/**
 * The rooms that can be reached from the start when every lock is ignored. Used by the generator to
 * make sure that closing offices never cuts a part of the building off.
 */
export function reachableIgnoringLocks(maze: Maze): Set<number> {
	const closed = new Set(maze.closed);
	const reached = new Set<number>([maze.start]);
	const stack = [maze.start];
	while (stack.length > 0) {
		const room = stack.pop() as number;
		for (const direction of DIRECTIONS) {
			const door = maze.doors[room][DIRECTIONS.indexOf(direction)];
			if (!door || closed.has(door.to) || reached.has(door.to)) continue;
			reached.add(door.to);
			stack.push(door.to);
		}
	}
	return reached;
}

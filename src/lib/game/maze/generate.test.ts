import { describe, expect, it } from 'vitest';
import { SIZE_IDS, SIZES, type SizeId } from './difficulty';
import { generateMaze } from './generate';
import {
	DIRECTIONS,
	ITEM_KINDS,
	directionBetween,
	doorCount,
	neighbour,
	roomCount,
	type Maze
} from './maze';
import { parSteps, reachableIgnoringLocks, solve } from './solver';

const SEEDS = 200;

function eachMaze(check: (maze: Maze, size: SizeId, seed: number) => void) {
	for (const size of SIZE_IDS) {
		for (let seed = 1; seed <= SEEDS; seed++) check(generateMaze(seed, SIZES[size]), size, seed);
	}
}

/** The lock doors of a maze, each once */
function lockedDoors(maze: Maze) {
	const found: { from: number; to: number; lock: string }[] = [];
	maze.doors.forEach((row, room) => {
		for (const door of row)
			if (door?.lock && door.to > room) found.push({ from: room, to: door.to, lock: door.lock });
	});
	return found;
}

describe('generateMaze', () => {
	it('is deterministic: the same seed gives the same maze', () => {
		for (const size of SIZE_IDS) {
			for (const seed of [0, 1, 42, 99999, 4294967295]) {
				expect(generateMaze(seed, SIZES[size])).toEqual(generateMaze(seed, SIZES[size]));
			}
		}
	});

	it('gives different mazes for different seeds', () => {
		const layouts = new Set<string>();
		for (let seed = 1; seed <= 50; seed++) {
			layouts.add(JSON.stringify(generateMaze(seed, SIZES.medium).doors));
		}
		expect(layouts.size).toBeGreaterThan(40);
	});

	it('guarantees a valid path to the goal on every seed and size', () => {
		eachMaze((maze, size, seed) => {
			const path = solve(maze);
			expect(path, `${size} seed ${seed}`).not.toBeNull();
			expect(path!.length).toBeGreaterThan(0);
		});
	});

	it('has a valid path that walks the rules: locks only open with a collected document', () => {
		eachMaze((maze) => {
			let room = maze.start;
			const carried = new Set<string>();
			for (const direction of solve(maze)!) {
				const door = maze.doors[room][DIRECTIONS.indexOf(direction)];
				expect(door).not.toBeNull();
				if (door!.lock) expect(carried.has(door!.lock)).toBe(true);
				expect(maze.closed).not.toContain(door!.to);
				room = door!.to;
				const item = maze.items[room];
				if (item) carried.add(item);
			}
			expect(room).toBe(maze.goal);
		});
	});

	it('has the configured size, a distinct start and goal, and a lock count as configured', () => {
		eachMaze((maze, size) => {
			const config = SIZES[size];
			expect(maze.width).toBe(config.width);
			expect(maze.height).toBe(config.height);
			expect(maze.doors).toHaveLength(roomCount(maze));
			expect(maze.items).toHaveLength(roomCount(maze));
			expect(maze.start).not.toBe(maze.goal);
			const locks = lockedDoors(maze);
			expect(locks).toHaveLength(config.locks);
			expect(new Set(locks.map((lock) => lock.lock)).size).toBe(config.locks);
		});
	});

	it('hides exactly one document per lock, never at the start or goal', () => {
		eachMaze((maze) => {
			const locks = lockedDoors(maze).map((lock) => lock.lock);
			const found = maze.items.filter((item) => item !== null);
			expect([...found].sort()).toEqual([...locks].sort());
			expect(maze.items[maze.start]).toBeNull();
			expect(maze.items[maze.goal]).toBeNull();
			for (const item of found) expect(ITEM_KINDS).toContain(item);
		});
	});

	it('makes every document necessary: without it the goal cannot be reached', () => {
		eachMaze((maze) => {
			for (const kind of new Set(maze.items.filter((item) => item !== null))) {
				const without = { ...maze, items: maze.items.map((item) => (item === kind ? null : item)) };
				expect(solve(without)).toBeNull();
			}
		});
	});

	it('builds doors that are symmetric, between neighbours, with the same lock on both sides', () => {
		eachMaze((maze) => {
			maze.doors.forEach((row, room) => {
				expect(row).toHaveLength(4);
				DIRECTIONS.forEach((direction, index) => {
					const door = row[index];
					if (!door) return;
					expect(neighbour(maze, room, direction)).toBe(door.to);
					const back = directionBetween(maze, door.to, room)!;
					const reverse = maze.doors[door.to][DIRECTIONS.indexOf(back)];
					expect(reverse).toEqual({ to: room, lock: door.lock });
				});
			});
		});
	});

	it('connects every office: a spanning graph with at least tree many doors', () => {
		eachMaze((maze) => {
			const open = { ...maze, closed: [] };
			expect(reachableIgnoringLocks(open).size).toBe(roomCount(maze));
			expect(doorCount(maze)).toBeGreaterThanOrEqual(roomCount(maze) - 1);
		});
	});

	it('closes offices only where it cannot trap the player or cut offices off', () => {
		let withClosed = 0;
		eachMaze((maze, size) => {
			expect(maze.closed.length).toBeLessThanOrEqual(SIZES[size].closed);
			expect([...maze.closed]).toEqual([...maze.closed].sort((a, b) => a - b));
			for (const room of maze.closed) {
				expect(room).not.toBe(maze.start);
				expect(room).not.toBe(maze.goal);
				expect(maze.items[room]).toBeNull();
			}
			// Nothing else is cut off by the closed offices
			expect(reachableIgnoringLocks(maze).size).toBe(roomCount(maze) - maze.closed.length);
			if (maze.closed.length > 0) withClosed++;
		});
		// "Closed until Tuesday" is a regular feature, not a rarity
		expect(withClosed).toBeGreaterThan(SEEDS * SIZE_IDS.length * 0.97);
	});

	it('reaches the configured number of closed offices on most mazes', () => {
		let full = 0;
		for (let seed = 1; seed <= SEEDS; seed++) {
			if (generateMaze(seed, SIZES.large).closed.length === SIZES.large.closed) full++;
		}
		expect(full).toBeGreaterThan(SEEDS * 0.8);
	});

	it('makes the shortest way longer on bigger buildings, with detours for the documents', () => {
		const average = (size: SizeId) => {
			let sum = 0;
			for (let seed = 1; seed <= 100; seed++) sum += parSteps(generateMaze(seed, SIZES[size]));
			return sum / 100;
		};
		expect(average('small')).toBeLessThan(average('medium'));
		expect(average('medium')).toBeLessThan(average('large'));
	});

	it('works for any 32-bit seed', () => {
		for (const seed of [0, 1, 2 ** 31, 2 ** 32 - 1]) {
			expect(solve(generateMaze(seed, SIZES.large))).not.toBeNull();
		}
	});
});

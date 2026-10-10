/*
 * The maze generator, graph based. The offices are the nodes of a grid, the doors the edges.
 *
 * 1. A random spanning tree (growing tree: winding corridors with dead-end branches) connects every office: there is
 *    exactly one way between any two offices, so the way to the goal is known. The goal is the
 *    office farthest from the start.
 * 2. Locks go on doors along that way, spread out evenly. A lock's document is hidden in a side
 *    office that can be reached with the documents of the earlier locks only, which makes the
 *    maze solvable by construction (and each document really necessary).
 * 3. A few extra doors add loops, but only inside one "region" (offices between the same two
 *    locks), so they can never be used to walk around a lock.
 * 4. Offices are closed until Tuesday, but only when the maze stays solvable and no other office
 *    gets cut off. A closed office is a trap to bump into, never a requirement.
 *
 * The same seed and size always give the same maze.
 */
import { createRandom, pickOne, randomInt, shuffle, type Random } from '../random';
import type { MazeConfig } from './difficulty';
import {
	DIRECTIONS,
	ITEM_KINDS,
	neighbour,
	OPPOSITE,
	type Door,
	type ItemKind,
	type Maze
} from './maze';
import { reachableIgnoringLocks, solve } from './solver';

const MAX_ATTEMPTS = 500;

/** Builds the maze for a seed; throws only if a config is too small for its number of locks */
export function generateMaze(seed: number, config: MazeConfig): Maze {
	const random = createRandom(seed);
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const maze = attemptMaze(random, seed, config);
		if (maze) return maze;
	}
	throw new Error(`No ${config.width}x${config.height} maze with ${config.locks} locks found`);
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function attemptMaze(random: Random, seed: number, config: MazeConfig): Maze | null {
	const { width, height, locks } = config;
	const total = width * height;
	const size = { width, height };
	const rooms = Array.from({ length: total }, (_, room) => room);

	// 1. Spanning tree by the growing-tree algorithm
	const start = randomInt(random, 0, total);
	const treeLinks: number[][] = rooms.map(() => []);
	const parent = new Array<number>(total).fill(-1);
	const depth = new Array<number>(total).fill(-1);
	depth[start] = 0;
	const active = [start];
	while (active.length > 0) {
		// Mostly the newest office (long winding corridors), sometimes a random one (side branches)
		const index =
			random() < config.winding ? active.length - 1 : randomInt(random, 0, active.length);
		const room = active[index];
		const options = shuffle(random, DIRECTIONS)
			.map((direction) => neighbour(size, room, direction))
			.filter((next): next is number => next !== null && depth[next] === -1);
		if (options.length === 0) {
			active.splice(index, 1);
			continue;
		}
		const next = options[0];
		treeLinks[room].push(next);
		treeLinks[next].push(room);
		parent[next] = room;
		depth[next] = depth[room] + 1;
		active.push(next);
	}

	// The goal is a farthest office; the way there is the critical path
	const deepest = Math.max(...depth);
	const goal = pickOne(
		random,
		rooms.filter((room) => depth[room] === deepest)
	);
	const path: number[] = [];
	for (let room = goal; room !== -1; room = parent[room]) path.push(room);
	path.reverse();
	const length = path.length - 1;
	if (length < locks * 2) return null;
	const onPath = new Set(path);

	// 2. Locks on the way, one in each equal slice of it, with a document each
	const kinds = shuffle(random, ITEM_KINDS).slice(0, locks);
	const lockOf = new Map<string, ItemKind>();
	for (let index = 0; index < locks; index++) {
		const low = Math.floor((index * length) / locks);
		const high = Math.floor(((index + 1) * length) / locks);
		const at = randomInt(random, low, high);
		lockOf.set(edgeKey(path[at], path[at + 1]), kinds[index]);
	}

	// Level of an office: how many locks lie between it and the start
	const level = new Array<number>(total).fill(0);
	const visited = new Array<boolean>(total).fill(false);
	visited[start] = true;
	const order = [start];
	for (let head = 0; head < order.length; head++) {
		const room = order[head];
		for (const next of treeLinks[room]) {
			if (visited[next]) continue;
			visited[next] = true;
			level[next] = level[room] + (lockOf.has(edgeKey(room, next)) ? 1 : 0);
			order.push(next);
		}
	}

	// Distance from the critical path: a document deep in a side branch costs a real detour
	const detour = new Array<number>(total).fill(-1);
	const frontier = [...path];
	for (const room of path) detour[room] = 0;
	for (let head = 0; head < frontier.length; head++) {
		const room = frontier[head];
		for (const next of treeLinks[room]) {
			if (detour[next] !== -1) continue;
			detour[next] = detour[room] + 1;
			frontier.push(next);
		}
	}

	// The document of lock i lies in an office reachable before lock i (level <= i)
	const items = new Array<ItemKind | null>(total).fill(null);
	for (let index = 0; index < locks; index++) {
		const candidates = shuffle(
			random,
			rooms.filter(
				(room) => room !== start && room !== goal && items[room] === null && level[room] <= index
			)
		);
		const sideRooms = candidates.filter((room) => !onPath.has(room));
		const pool = (sideRooms.length > 0 ? sideRooms : candidates).sort(
			(a, b) => detour[b] - detour[a]
		);
		if (pool.length === 0) return null;
		items[pickOne(random, pool.slice(0, Math.ceil(pool.length / 3)))] = kinds[index];
	}

	// Doors: the tree, with its locks
	const doors: (Door | null)[][] = rooms.map(() => DIRECTIONS.map(() => null));
	const connect = (a: number, b: number, lock: ItemKind | null) => {
		for (const direction of DIRECTIONS) {
			if (neighbour(size, a, direction) !== b) continue;
			doors[a][DIRECTIONS.indexOf(direction)] = { to: b, lock };
			doors[b][DIRECTIONS.indexOf(OPPOSITE[direction])] = { to: a, lock };
		}
	};
	treeLinks.forEach((links, room) => {
		for (const next of links) {
			if (room < next) connect(room, next, lockOf.get(edgeKey(room, next)) ?? null);
		}
	});

	// 3. Loops, only within one region so that no lock can be walked around
	for (const room of rooms) {
		for (const direction of ['right', 'down'] as const) {
			const next = neighbour(size, room, direction);
			if (next === null || doors[room][DIRECTIONS.indexOf(direction)]) continue;
			if (level[room] === level[next] && random() < config.loops) connect(room, next, null);
		}
	}

	// 4. Offices closed until Tuesday
	let maze: Maze = { seed, width, height, start, goal, doors, items, closed: [] };
	const closedRooms: number[] = [];
	const closable = shuffle(
		random,
		rooms.filter((room) => room !== start && room !== goal && items[room] === null)
	);
	for (const room of closable) {
		if (closedRooms.length >= config.closed) break;
		const trial: Maze = { ...maze, closed: [...closedRooms, room].sort((a, b) => a - b) };
		if (reachableIgnoringLocks(trial).size !== total - trial.closed.length) continue;
		if (!solve(trial)) continue;
		closedRooms.push(room);
		maze = trial;
	}

	return solve(maze) ? maze : null;
}

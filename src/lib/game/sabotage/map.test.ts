import { describe, expect, it } from 'vitest';
import {
	angleDiff,
	castRay,
	findPath,
	hasLineOfSight,
	moveCircle,
	parseMap,
	reachableTiles,
	tileAt,
	tileUnder,
	walkClear
} from './map.js';

const ROOM = ['######', '#S...#', '#.#..#', '#...E#', '######'];

describe('parseMap', () => {
	it('reads size, start, exit and targets', () => {
		const map = parseMap(['#####', '#S.T#', '#T.E#', '#####']);
		expect(map.grid.width).toBe(5);
		expect(map.grid.height).toBe(4);
		expect(map.start).toEqual({ x: 1.5, y: 1.5 });
		expect(map.exit).toEqual({ x: 3.5, y: 2.5 });
		expect(map.targets).toEqual([
			{ x: 3.5, y: 1.5 },
			{ x: 1.5, y: 2.5 }
		]);
	});

	it('knows the tile kinds', () => {
		const { grid } = parseMap(['#fbD', 'x,:S', '.TE.']);
		expect(tileAt(grid, 0, 0)).toBe('wall');
		expect(tileAt(grid, 1, 0)).toBe('fence');
		expect(tileAt(grid, 2, 0)).toBe('bush');
		expect(tileAt(grid, 3, 0)).toBe('door');
		expect(tileAt(grid, 0, 1)).toBe('crate');
		expect(tileAt(grid, 1, 1)).toBe('shadow');
		expect(tileAt(grid, 2, 1)).toBe('paved');
		expect(tileAt(grid, 3, 1)).toBe('paved');
		expect(tileAt(grid, 1, 2)).toBe('target');
		expect(tileUnder(grid, { x: 2.4, y: 0.9 })).toBe('bush');
	});

	it('treats everything outside the map as wall', () => {
		const { grid } = parseMap(ROOM);
		expect(tileAt(grid, -1, 0)).toBe('wall');
		expect(tileAt(grid, 0, 99)).toBe('wall');
	});

	it('rejects broken maps', () => {
		expect(() => parseMap([])).toThrow();
		expect(() => parseMap(['#S#', '##'])).toThrow(/expected/);
		expect(() => parseMap(['#S?E#'])).toThrow(/Unknown/);
		expect(() => parseMap(['#SS#E'])).toThrow(/start/);
		expect(() => parseMap(['#S.#'])).toThrow(/No exit/);
		expect(() => parseMap(['#.E#'])).toThrow(/No start/);
	});
});

describe('moveCircle', () => {
	const { grid } = parseMap(ROOM);

	it('moves freely in the open', () => {
		const moved = moveCircle(grid, { x: 1.5, y: 1.5 }, 0.5, 0, 0.3);
		expect(moved.x).toBeCloseTo(2, 5);
		expect(moved.y).toBeCloseTo(1.5, 5);
	});

	it('stops at a wall instead of passing through it', () => {
		const moved = moveCircle(grid, { x: 4.4, y: 1.5 }, 2, 0, 0.3);
		expect(moved.x).toBeLessThanOrEqual(5 - 0.3 + 1e-6);
	});

	it('slides along a wall', () => {
		// Pushing diagonally into the top wall keeps the sideways motion
		const moved = moveCircle(grid, { x: 1.5, y: 1.3 }, 0.4, -0.4, 0.3);
		expect(moved.x).toBeGreaterThan(1.8);
		expect(moved.y).toBeGreaterThanOrEqual(1.3 - 1e-6);
	});

	it('is blocked by fences, crates and targets but not by bushes or doors', () => {
		const rows = parseMap(['########', '#SfxTbDE', '########']);
		const blocked = (x: number) => moveCircle(rows.grid, { x, y: 1.5 }, 0.3, 0, 0.3).x;
		expect(blocked(2.5 - 0.31)).toBeLessThan(2.0); // fence at x 2
		expect(blocked(3.5 - 0.31)).toBeLessThan(3.0); // crate at x 3
		expect(blocked(4.5 - 0.31)).toBeLessThan(4.0); // target at x 4
		expect(moveCircle(rows.grid, { x: 5.5, y: 1.5 }, 0.3, 0, 0.3).x).toBeCloseTo(5.8, 5);
	});

	it('pushes a circle that starts inside a solid tile back out', () => {
		const moved = moveCircle(grid, { x: 2.5, y: 2.5 }, 0, 0, 0.3);
		const inside = Math.floor(moved.x) === 2 && Math.floor(moved.y) === 2;
		expect(inside).toBe(false);
	});
});

describe('line of sight', () => {
	it('sees across open floor and is stopped by a wall', () => {
		const { grid } = parseMap(['########', '#S..#.E#', '########']);
		expect(hasLineOfSight(grid, { x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 })).toBe(true);
		expect(hasLineOfSight(grid, { x: 1.5, y: 1.5 }, { x: 5.5, y: 1.5 })).toBe(false);
	});

	it('is not stopped by fences or bushes, but crates and closed doors block it', () => {
		const clear = parseMap(['#S.f.b.E#']).grid;
		expect(hasLineOfSight(clear, { x: 1.5, y: 0.5 }, { x: 7.5, y: 0.5 })).toBe(true);
		const crate = parseMap(['#S.x.E#']).grid;
		expect(hasLineOfSight(crate, { x: 1.5, y: 0.5 }, { x: 5.5, y: 0.5 })).toBe(false);
		const door = parseMap(['#S.D.E#']).grid;
		expect(hasLineOfSight(door, { x: 1.5, y: 0.5 }, { x: 5.5, y: 0.5 })).toBe(false);
	});

	it('lets a watcher on a wall tile look out of it, and sees someone standing in a doorway', () => {
		const wall = parseMap(['#S...E#']).grid;
		expect(hasLineOfSight(wall, { x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 })).toBe(true);
		const door = parseMap(['#S.D.E#']).grid;
		expect(hasLineOfSight(door, { x: 1.5, y: 0.5 }, { x: 3.5, y: 0.5 })).toBe(true);
	});

	it('stops a ray aimed along or into the wall a camera is mounted on', () => {
		const { grid } = parseMap(['#######', '#S...E#', '#######']);
		const camera = { x: 3.5, y: 0.5 };
		expect(castRay(grid, camera, -Math.PI / 2, 5)).toBeLessThan(1);
		expect(castRay(grid, camera, 0.05, 5)).toBeLessThan(1.5);
		expect(castRay(grid, camera, Math.PI / 2, 5)).toBeGreaterThan(0.9);
		expect(hasLineOfSight(grid, { x: 0.5, y: 0.5 }, { x: 2.5, y: 1.5 })).toBe(false);
	});

	it('casts a ray up to the first wall', () => {
		const { grid } = parseMap(['#S...#E#']);
		const distance = castRay(grid, { x: 1.5, y: 0.5 }, 0, 10);
		expect(distance).toBeGreaterThan(3.4);
		expect(distance).toBeLessThan(3.7);
		expect(castRay(grid, { x: 1.5, y: 0.5 }, 0, 2)).toBe(2);
	});
});

describe('walking helpers', () => {
	const { grid } = parseMap(ROOM);

	it('finds a path around the pillar, in tile centres, without the start tile', () => {
		const path = findPath(grid, { x: 1.5, y: 1.5 }, { x: 4.5, y: 3.5 });
		expect(path).not.toBeNull();
		expect(path![path!.length - 1]).toEqual({ x: 4.5, y: 3.5 });
		expect(path!.some((p) => p.x === 1.5 && p.y === 1.5)).toBe(false);
		for (const point of path!)
			expect(tileAt(grid, Math.floor(point.x), Math.floor(point.y))).not.toBe('wall');
	});

	it('does not cut corners past a solid tile', () => {
		const path = findPath(grid, { x: 1.5, y: 2.5 }, { x: 2.5, y: 1.5 })!;
		expect(path.length).toBeGreaterThan(1);
	});

	it('returns an empty path at the goal and null when walled off or when the goal is solid', () => {
		expect(findPath(grid, { x: 1.5, y: 1.5 }, { x: 1.6, y: 1.6 })).toEqual([]);
		expect(findPath(grid, { x: 1.5, y: 1.5 }, { x: 2.5, y: 2.5 })).toBeNull();
		const split = parseMap(['#S#.E#']).grid;
		expect(findPath(split, { x: 1.5, y: 0.5 }, { x: 4.5, y: 0.5 })).toBeNull();
	});

	it('checks a straight walk for solid tiles', () => {
		expect(walkClear(grid, { x: 1.5, y: 1.5 }, { x: 4.5, y: 1.5 })).toBe(true);
		expect(walkClear(grid, { x: 1.5, y: 2.5 }, { x: 3.5, y: 2.5 })).toBe(false);
	});

	it('lists what can be reached', () => {
		const split = parseMap(['#S.#.E#']).grid;
		const reachable = reachableTiles(split, { x: 1.5, y: 0.5 });
		expect(reachable.has(2)).toBe(true);
		expect(reachable.has(5)).toBe(false);
	});
});

describe('angleDiff', () => {
	it('takes the short way round', () => {
		expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2, 6);
		expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2, 6);
		expect(Math.abs(angleDiff(7, 0))).toBeLessThan(Math.PI);
	});
});

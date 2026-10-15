import { describe, expect, it } from 'vitest';
import { BOSS_RANGE, GUARD_RANGE } from './config.js';
import {
	directionBetween,
	expandRoute,
	isWall,
	opposite,
	parseLevel,
	visibleCells,
	type Cell
} from './level.js';

const cells = (list: readonly Cell[]) => list.map(({ row, col }) => `${row},${col}`).sort();

describe('parseLevel', () => {
	it('reads the map, the guards and their ranges', () => {
		const level = parseLevel({
			id: 'test',
			map: ['#####', '#S.B#', '#..T#', '#####'],
			guards: [
				{
					waypoints: [
						[1, 1],
						[1, 3]
					]
				},
				{ waypoints: [[2, 1]], boss: true }
			],
			quota: 1,
			par: 5
		});
		expect(level.width).toBe(5);
		expect(level.height).toBe(4);
		expect(level.start).toEqual({ row: 1, col: 1 });
		expect(level.truck).toEqual({ row: 2, col: 3 });
		expect(level.barrels).toEqual([{ row: 1, col: 3 }]);
		expect(level.guards[0].route).toHaveLength(3);
		expect(level.guards[0].range).toBe(GUARD_RANGE);
		expect(level.guards[1].range).toBe(BOSS_RANGE);
		expect(level.guards[1].boss).toBe(true);
	});

	it('rejects broken maps', () => {
		const spec = { id: 'bad', guards: [], quota: 1, par: 1 };
		expect(() => parseLevel({ ...spec, map: [] })).toThrow();
		expect(() => parseLevel({ ...spec, map: ['###', '#S#'] })).toThrow(/truck/);
		expect(() => parseLevel({ ...spec, map: ['####', '#ST', '###'] })).toThrow(/ragged/);
		expect(() => parseLevel({ ...spec, map: ['#ST?#'] })).toThrow(/bad cell/);
	});

	it('treats everything outside the map as a wall', () => {
		const level = parseLevel({ id: 't', map: ['#ST#'], guards: [], quota: 1, par: 1 });
		expect(isWall(level, { row: 0, col: 0 })).toBe(true);
		expect(isWall(level, { row: 0, col: 1 })).toBe(false);
		expect(isWall(level, { row: -1, col: 1 })).toBe(true);
		expect(isWall(level, { row: 0, col: 9 })).toBe(true);
	});
});

describe('expandRoute', () => {
	it('fills in every cell between the corners', () => {
		expect(
			expandRoute([
				[1, 1],
				[1, 3],
				[3, 3]
			])
		).toEqual([
			{ row: 1, col: 1 },
			{ row: 1, col: 2 },
			{ row: 1, col: 3 },
			{ row: 2, col: 3 },
			{ row: 3, col: 3 }
		]);
	});

	it('refuses diagonal legs and empty routes', () => {
		expect(() =>
			expandRoute([
				[0, 0],
				[2, 2]
			])
		).toThrow();
		expect(() => expandRoute([])).toThrow();
	});
});

describe('directions', () => {
	it('finds the direction between neighbours only', () => {
		expect(directionBetween({ row: 1, col: 1 }, { row: 1, col: 2 })).toBe('right');
		expect(directionBetween({ row: 1, col: 1 }, { row: 0, col: 1 })).toBe('up');
		expect(directionBetween({ row: 1, col: 1 }, { row: 3, col: 1 })).toBeNull();
	});

	it('knows the opposite way', () => {
		expect(opposite('left')).toBe('right');
		expect(opposite('up')).toBe('down');
	});
});

describe('visibleCells', () => {
	const open = parseLevel({
		id: 'open',
		map: [
			'#########',
			'#.......#',
			'#.......#',
			'#.......#',
			'#.......#',
			'#...ST..#',
			'#########'
		],
		guards: [],
		quota: 1,
		par: 1
	});

	it('is one cell wide first and three cells wide from the second step', () => {
		expect(cells(visibleCells(open, { row: 1, col: 4 }, 'down', 3))).toEqual(
			cells([
				{ row: 2, col: 4 },
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 3, col: 5 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 },
				{ row: 4, col: 5 }
			])
		);
	});

	it('looks further for a longer range', () => {
		const far = visibleCells(open, { row: 1, col: 1 }, 'right', BOSS_RANGE);
		expect(far.some((cell) => cell.col === 5)).toBe(true);
		expect(far.some((cell) => cell.col === 6)).toBe(false);
	});

	it('is stopped by shelves', () => {
		const shelf = parseLevel({
			id: 'shelf',
			map: ['#######', '#..#..#', '#..#..#', '#ST...#', '#######'],
			guards: [],
			quota: 1,
			par: 1
		});
		expect(visibleCells(shelf, { row: 1, col: 1 }, 'right', 3)).toEqual([{ row: 1, col: 2 }]);
		// Looking along the open aisle, the cells behind a shelf stay hidden
		const aisle = cells(visibleCells(shelf, { row: 3, col: 2 }, 'right', 3));
		expect(aisle).toContain('3,3');
		expect(aisle).not.toContain('2,3');
		expect(aisle).not.toContain('1,3');
	});
});

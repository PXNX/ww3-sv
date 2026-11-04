/*
 * The ten levels of the heist. Each map is a warehouse floor: # shelf, . aisle, S cart start,
 * T truck, B barrel, G golden barrel, L lever (the truck stays locked until it is pulled), C
 * coffee pad, H toque pad. Guard routes are lists of [row, col] corners that the moose walks:
 * back and forth (a patrol, which may dwell at its ends), around a closed loop, or on the spot
 * turning clockwise (a sentry). Quota is how many barrels end the level once they reach the truck;
 * par is the fewest moves of a clean run with every barrel and without gadgets (the solver test
 * checks it) plus a little slack.
 *
 * The curve: level 1 teaches the sentry and noise, 2 the patrol and its pauses, 3 the coffee,
 * 4 the lever and the loop, 5 the boss and the toque, 6 the golden barrel; from there the levels
 * mix everything, and the last ones ask for several lanes at once.
 */
import { parseLevel, type Level, type LevelSpec } from './level.js';

export const LEVEL_SPECS: readonly LevelSpec[] = [
	{
		id: 'night-shift',
		map: ['#########', '#S.....T#', '#.##.##.#', '#B.....B#', '#########'],
		guards: [{ mode: 'sentry', waypoints: [[1, 4]], facing: 'up', turnEvery: 3 }],
		quota: 2,
		par: 17
	},
	{
		id: 'moose-on-patrol',
		map: [
			'###########',
			'#S..B...B.#',
			'#.#.#.#.#.#',
			'#.........#',
			'#.#.#.#.#.#',
			'#B.......T#',
			'###########'
		],
		guards: [
			{
				dwell: 2,
				waypoints: [
					[3, 1],
					[3, 9]
				]
			}
		],
		quota: 2,
		par: 23
	},
	{
		id: 'two-lanes',
		map: [
			'###########',
			'#S...B....#',
			'#.#.#.#.#.#',
			'#.........#',
			'#.#.#.#.#.#',
			'#B.C.B...T#',
			'###########'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 9]
				]
			},
			{
				dwell: 1,
				waypoints: [
					[1, 9],
					[5, 9]
				]
			}
		],
		quota: 2,
		par: 23
	},
	{
		id: 'heavy-load',
		map: [
			'###########',
			'#S.......L#',
			'#.#.#.#.#.#',
			'#.B.B.B...#',
			'#.#.#.#.#.#',
			'#H.......T#',
			'###########'
		],
		guards: [
			{
				mode: 'loop',
				waypoints: [
					[1, 3],
					[1, 7],
					[5, 7],
					[5, 3]
				]
			}
		],
		quota: 2,
		par: 29
	},
	{
		id: 'tariff-boss',
		map: [
			'###########',
			'#S...B....#',
			'#.#.#.#.#.#',
			'#H...B....#',
			'#.#.#.#.#.#',
			'#B.......T#',
			'###########'
		],
		guards: [
			{
				boss: true,
				dwell: 1,
				waypoints: [
					[3, 1],
					[3, 9]
				]
			},
			{ mode: 'sentry', waypoints: [[5, 5]], facing: 'left', turnEvery: 3 }
		],
		quota: 2,
		par: 70
	},
	{
		id: 'long-shelves',
		map: [
			'#############',
			'#S....#.....#',
			'#.###.#.###.#',
			'#.B...#...B.#',
			'#.#.#####.#.#',
			'#.#...G...#.#',
			'#.###.#.###.#',
			'#.....#....T#',
			'#############'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[7, 1]
				]
			},
			{
				dwell: 1,
				waypoints: [
					[7, 7],
					[7, 11]
				]
			}
		],
		quota: 2,
		par: 29
	},
	{
		id: 'night-patrol',
		map: [
			'#############',
			'#S....#.....#',
			'#.#.#.#.#.#.#',
			'#B..B.....B.#',
			'#.#.#.#.#.#.#',
			'#...........#',
			'#.#.#.#.#.#.#',
			'#B.........T#',
			'#############'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 11]
				]
			},
			{
				dwell: 1,
				waypoints: [
					[5, 11],
					[5, 1]
				]
			},
			{ mode: 'sentry', waypoints: [[7, 6]], facing: 'left', turnEvery: 3 }
		],
		quota: 3,
		par: 97
	},
	{
		id: 'crossfire',
		map: [
			'#############',
			'#S.........L#',
			'#.#.#.#.#.#.#',
			'#B....B.....#',
			'#.#.#.#.#.#.#',
			'#....B...B.C#',
			'#.#.#.#.#.#.#',
			'#..........T#',
			'#############'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 11]
				]
			},
			{
				dwell: 1,
				waypoints: [
					[1, 9],
					[7, 9]
				]
			},
			{
				boss: true,
				waypoints: [
					[5, 11],
					[5, 1]
				]
			}
		],
		quota: 3,
		par: 85
	},
	{
		id: 'double-boss',
		map: [
			'#############',
			'#S....#.....#',
			'#.#.#.#.#.#.#',
			'#B.....B....#',
			'#.#.#.#.#.#.#',
			'#H....#.....#',
			'#.#.#.#.#.#.#',
			'#..........T#',
			'#############'
		],
		guards: [
			{
				boss: true,
				waypoints: [
					[3, 1],
					[3, 11]
				]
			},
			{
				boss: true,
				waypoints: [
					[7, 11],
					[7, 1]
				]
			}
		],
		quota: 2,
		par: 77
	},
	{
		id: 'the-reserve',
		map: [
			'#############',
			'#S....#....L#',
			'#.#.#.#.#.#.#',
			'#B...G....B.#',
			'#.#.#.#.#.#.#',
			'#C.........H#',
			'#.#.#.#.#.#.#',
			'#.....B....T#',
			'#############'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 11]
				]
			},
			{
				boss: true,
				waypoints: [
					[5, 11],
					[5, 1]
				]
			}
		],
		quota: 4,
		par: 122
	}
];

export const LEVELS: readonly Level[] = LEVEL_SPECS.map(parseLevel);

export const LEVEL_IDS: readonly string[] = LEVEL_SPECS.map((spec) => spec.id);

export function levelAt(index: number): Level {
	const level = LEVELS[index];
	if (!level) throw new Error(`There is no level ${index}`);
	return level;
}

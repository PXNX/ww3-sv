/*
 * The ten levels of the heist. Each map is a warehouse floor: # shelf, . aisle, S cart start,
 * T truck, B barrel. Guard routes are lists of [row, col] corners that the moose walks back and
 * forth. Quota is how many barrels end the level once they reach the truck; par is the
 * fewest moves of a clean run with every barrel (the solver test checks it) plus a little slack.
 */
import { parseLevel, type Level, type LevelSpec } from './level.js';

export const LEVEL_SPECS: readonly LevelSpec[] = [
	{
		id: 'night-shift',
		map: ['#########', '#S..B..T#', '#.##.##.#', '#B......#', '#########'],
		guards: [],
		quota: 1,
		par: 12
	},
	{
		id: 'moose-on-patrol',
		map: [
			'###########',
			'#S..B.....#',
			'#.#.#.#.#.#',
			'#.........#',
			'#.#.#.#.#.#',
			'#B.......T#',
			'###########'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 9]
				]
			}
		],
		quota: 1,
		par: 21
	},
	{
		id: 'two-lanes',
		map: [
			'###########',
			'#S...B....#',
			'#.#.#.#.#.#',
			'#.........#',
			'#.#.#.#.#.#',
			'#B...B...T#',
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
				waypoints: [
					[1, 9],
					[5, 9]
				]
			}
		],
		quota: 2,
		par: 25
	},
	{
		id: 'heavy-load',
		map: [
			'###########',
			'#S........#',
			'#.#.#.#.#.#',
			'#.B.B.B...#',
			'#.#.#.#.#.#',
			'#........T#',
			'###########'
		],
		guards: [
			{
				waypoints: [
					[1, 9],
					[5, 9]
				]
			}
		],
		quota: 2,
		par: 14
	},
	{
		id: 'tariff-boss',
		map: [
			'###########',
			'#S...B....#',
			'#.#.#.#.#.#',
			'#....B....#',
			'#.#.#.#.#.#',
			'#B.......T#',
			'###########'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 9]
				],
				boss: true
			}
		],
		quota: 2,
		par: 38
	},
	{
		id: 'long-shelves',
		map: [
			'#############',
			'#S....#.....#',
			'#.###.#.###.#',
			'#.B...#...B.#',
			'#.#.#####.#.#',
			'#.#...B...#.#',
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
				waypoints: [
					[7, 7],
					[7, 11]
				]
			}
		],
		quota: 2,
		par: 25
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
				waypoints: [
					[5, 11],
					[5, 1]
				]
			}
		],
		quota: 3,
		par: 59
	},
	{
		id: 'crossfire',
		map: [
			'#############',
			'#S..........#',
			'#.#.#.#.#.#.#',
			'#B....B.....#',
			'#.#.#.#.#.#.#',
			'#....B...B..#',
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
				waypoints: [
					[1, 11],
					[7, 11]
				]
			},
			{
				waypoints: [
					[5, 11],
					[5, 1]
				],
				boss: true
			}
		],
		quota: 3,
		par: 58
	},
	{
		id: 'double-boss',
		map: [
			'#############',
			'#S....#.....#',
			'#.#.#.#.#.#.#',
			'#B.....B....#',
			'#.#.#.#.#.#.#',
			'#.....#.....#',
			'#.#.#.#.#.#.#',
			'#B.........T#',
			'#############'
		],
		guards: [
			{
				waypoints: [
					[3, 1],
					[3, 11]
				],
				boss: true
			},
			{
				waypoints: [
					[7, 11],
					[7, 1]
				],
				boss: true
			}
		],
		quota: 2,
		par: 92
	},
	{
		id: 'the-reserve',
		map: [
			'#############',
			'#S....#.....#',
			'#.#.#.#.#.#.#',
			'#B...B....B.#',
			'#.#.#.#.#.#.#',
			'#...........#',
			'#.#.#.#.#.#.#',
			'#B....B....T#',
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
				waypoints: [
					[5, 11],
					[5, 1]
				],
				boss: true
			},
			{
				waypoints: [
					[1, 5],
					[7, 5]
				]
			}
		],
		quota: 4,
		par: 79
	}
];

export const LEVELS: readonly Level[] = LEVEL_SPECS.map(parseLevel);

export const LEVEL_IDS: readonly string[] = LEVEL_SPECS.map((spec) => spec.id);

export function levelAt(index: number): Level {
	const level = LEVELS[index];
	if (!level) throw new Error(`There is no level ${index}`);
	return level;
}

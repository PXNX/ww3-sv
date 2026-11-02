/*
 * The nine jobs, three each at a power line, an ammo depot and a shell factory. Maps are ASCII (see
 * map.ts for the legend) and portrait, so they fill a phone screen. Guards, dogs and sensors are
 * listed next to the map by tile coordinates; camera angles are degrees (0 east, 90 south). Par times
 * are about three times what a perfect run takes (checked by the bot in solvable.test.ts).
 */
import { parseMap, type Grid, type Vec } from './map.js';

export type Theme = 'power' | 'depot' | 'factory';
export type TargetKind = 'pylon' | 'transformer' | 'ammo' | 'press';

export interface GuardDef {
	kind: 'guard' | 'dog';
	/** Waypoints [x, y] in tiles; the guard walks them and waits at each one */
	route: [number, number][];
	/** Seconds spent at every waypoint */
	wait: number;
	/** Index of the waypoint the guard starts at, so two guards need not walk in step */
	startAt?: number;
}

export interface SensorDef {
	kind: 'camera' | 'floodlight';
	/** Tile the sensor is mounted on (usually a wall or fence) */
	at: [number, number];
	/** Centre direction in degrees */
	angle: number;
	/** Cameras swing this many degrees to either side of the centre */
	sweep: number;
	period: number;
	phase: number;
	range: number;
	/** Full opening angle in degrees; 360 for a floodlight */
	fov: number;
	/** Floodlights: seconds on and off */
	onSeconds: number;
	offSeconds: number;
}

export interface JobCard {
	channel: string;
	poster: string;
	message: string;
}

export interface LevelDef {
	id: string;
	theme: Theme;
	targetKind: TargetKind;
	/** Par time in seconds for the "quick" star */
	par: number;
	map: string[];
	guards: GuardDef[];
	sensors: SensorDef[];
	card: JobCard;
	title: string;
}

export interface Level extends LevelDef {
	grid: Grid;
	start: Vec;
	exit: Vec;
	targets: Vec[];
}

const camera = (
	at: [number, number],
	angle: number,
	sweep: number,
	period: number,
	range: number,
	phase = 0
): SensorDef => ({
	kind: 'camera',
	at,
	angle,
	sweep,
	period,
	phase,
	range,
	fov: 50,
	onSeconds: 1,
	offSeconds: 0
});

const floodlight = (
	at: [number, number],
	range: number,
	onSeconds: number,
	offSeconds: number,
	phase = 0
): SensorDef => ({
	kind: 'floodlight',
	at,
	angle: 0,
	sweep: 0,
	period: 1,
	phase,
	range,
	fov: 360,
	onSeconds,
	offSeconds
});

const guard = (route: [number, number][], wait: number, startAt = 0): GuardDef => ({
	kind: 'guard',
	route,
	wait,
	startAt
});

const dog = (route: [number, number][], wait: number, startAt = 0): GuardDef => ({
	kind: 'dog',
	route,
	wait,
	startAt
});

const DEFINITIONS: LevelDef[] = [
	{
		id: 'cut-the-line',
		theme: 'power',
		targetKind: 'pylon',
		title: 'Cut the line',
		par: 30,
		card: {
			channel: 'Easy Money EU',
			poster: 'Kolya Recruiter',
			message:
				'Hi friend! Easy field job. One power pylon, one bored guard. Cut the line, walk away. 50 euro in crypto. No experience needed (we can tell).'
		},
		map: [
			'ffffffffffff',
			'f..........f',
			'f..b....T..f',
			'f..,,.....bf',
			'f..,,..#...f',
			'f......#...f',
			'f.b........f',
			'f..........f',
			'f......b...f',
			'f.##.......f',
			'f.##...,,..f',
			'f......,,.bf',
			'fS........Ef',
			'ffffffffffff'
		],
		guards: [
			guard(
				[
					[2, 7],
					[9, 7]
				],
				1.5
			)
		],
		sensors: []
	},
	{
		id: 'substation-sunday',
		theme: 'power',
		targetKind: 'transformer',
		title: 'Substation Sunday',
		par: 45,
		card: {
			channel: 'Easy Money EU',
			poster: 'Kolya Recruiter',
			message:
				'Two transformers behind a fence. One guard, one camera. The camera is old, it only turns. Do not wave at it.'
		},
		map: [
			'ffffffffffff',
			'f..........f',
			'f.T..,,..T.f',
			'f..b....b..f',
			'f..........f',
			'f.####..##.f',
			'f.####..##.f',
			'f..........f',
			'f.b..,,..b.f',
			'f..........f',
			'f..,,..b...f',
			'f..........f',
			'fS........Ef',
			'ffffffffffff'
		],
		guards: [
			guard(
				[
					[6, 3],
					[6, 9]
				],
				1.2
			)
		],
		sensors: [camera([11, 4], 180, 35, 6, 7)]
	},
	{
		id: 'ring-main',
		theme: 'power',
		targetKind: 'transformer',
		title: 'Ring main',
		par: 60,
		card: {
			channel: 'Easy Money EU',
			poster: 'Kolya Recruiter',
			message:
				'Three boxes this time, one inside the shed: use the door. Guards get lonely so they walk a lot. Wear something dark.'
		},
		map: [
			'ffffffffffff',
			'f..........f',
			'f.T.....T..f',
			'f..,,..,,..f',
			'f.b.......bf',
			'f..#####...f',
			'f..#T..#...f',
			'f..##D##...f',
			'f..........f',
			'f.b..,,..b.f',
			'f..........f',
			'f.##...,,..f',
			'f.##.b.....f',
			'fS........Ef',
			'ffffffffffff'
		],
		guards: [
			guard(
				[
					[1, 8],
					[10, 8]
				],
				1
			),
			guard(
				[
					[2, 3],
					[9, 3]
				],
				1.5,
				1
			)
		],
		sensors: [camera([11, 10], 180, 40, 7, 7)]
	},
	{
		id: 'ammo-depot',
		theme: 'depot',
		targetKind: 'ammo',
		title: 'Ammo depot',
		par: 60,
		card: {
			channel: 'Side Hustle Hub',
			poster: 'Sergei HR',
			message:
				'Crates, crates, crates. Two stacks to ruin, one inside the warehouse. Crates block eyes. Crates are friends.'
		},
		map: [
			'############',
			'#..........#',
			'#.T.xx..xx.#',
			'#..........#',
			'#,,..,,....#',
			'#..#######.#',
			'#..#..x.T#.#',
			'#..D.....#.#',
			'#..#######.#',
			'#..........#',
			'#.b..,,..b.#',
			'#..........#',
			'#.xx.....x.#',
			'#S........E#',
			'############'
		],
		guards: [
			guard(
				[
					[1, 9],
					[10, 9]
				],
				1.5
			),
			guard(
				[
					[1, 3],
					[10, 3]
				],
				1.5,
				1
			)
		],
		sensors: []
	},
	{
		id: 'night-shift',
		theme: 'depot',
		targetKind: 'ammo',
		title: 'Night shift',
		par: 60,
		card: {
			channel: 'Side Hustle Hub',
			poster: 'Sergei HR',
			message:
				'They got a dog now. Dogs hear running, so walk! Shadows hide you. The dog does not care about shadows.'
		},
		map: [
			'############',
			'#E..,,...T.#',
			'#..,,.....b#',
			'#.##.xx.##.#',
			'#.##....##.#',
			'#..........#',
			'#.b..,,..b.#',
			'#...,,,....#',
			'#.###..###.#',
			'#.#T.....#.#',
			'#.#......#.#',
			'#.########.#',
			'#..........#',
			'#S.......b.#',
			'############'
		],
		guards: [
			guard(
				[
					[1, 5],
					[10, 5]
				],
				1.5
			),
			dog(
				[
					[2, 2],
					[8, 2]
				],
				2
			)
		],
		sensors: []
	},
	{
		id: 'floodlit',
		theme: 'depot',
		targetKind: 'ammo',
		title: 'Floodlit',
		par: 65,
		card: {
			channel: 'Side Hustle Hub',
			poster: 'Sergei HR',
			message:
				'Big lights now. They blink, so count. Three stacks, a dog, a guard and a camera. We believe in you. 50 euro.'
		},
		map: [
			'############',
			'#..........#',
			'#.x..T..x..#',
			'#..........#',
			'#.xx.,,.xx.#',
			'#..........#',
			'#T..#..#..T#',
			'#...#..#...#',
			'#...#..#...#',
			'#..........#',
			'#.b.,,,,.b.#',
			'#..........#',
			'#.xx.....xx#',
			'#S........E#',
			'############'
		],
		guards: [
			guard(
				[
					[1, 9],
					[10, 9]
				],
				1.2
			),
			dog(
				[
					[5, 4],
					[5, 8]
				],
				2,
				1
			)
		],
		sensors: [camera([11, 4], 180, 30, 6, 7), floodlight([6, 14], 3.6, 2.5, 2)]
	},
	{
		id: 'shell-factory',
		theme: 'factory',
		targetKind: 'press',
		title: 'Shell factory',
		par: 65,
		card: {
			channel: 'Gig Heroes',
			poster: 'Vlad Talent',
			message:
				'Shell presses, two halls, two cameras. Use the doors. Touch nothing else, nothing else is insured.'
		},
		map: [
			'############',
			'#.....#....#',
			'#.T...D....#',
			'#.....#..T.#',
			'###D####D###',
			'#..........#',
			'#.##....##.#',
			'#.##....##.#',
			'#..........#',
			'#,,..xx..,,#',
			'#..........#',
			'####D##D####',
			'#.b......b.#',
			'#S........E#',
			'############'
		],
		guards: [
			guard(
				[
					[1, 8],
					[10, 8]
				],
				1
			),
			guard(
				[
					[1, 5],
					[1, 10]
				],
				1.5,
				1
			)
		],
		sensors: [camera([6, 1], 0, 30, 6, 5), camera([6, 3], 180, 30, 7, 5.5, 1.5)]
	},
	{
		id: 'shell-line',
		theme: 'factory',
		targetKind: 'press',
		title: 'Shell line',
		par: 100,
		card: {
			channel: 'Gig Heroes',
			poster: 'Vlad Talent',
			message:
				'Three presses, a long hall, lights, a dog and cameras. This is the big one. Bonus pay if you are not caught.'
		},
		map: [
			'##############',
			'#T....##....T#',
			'#.....##.....#',
			'#.xx..##..xx.#',
			'#............#',
			'#.##.,,,,.##.#',
			'#.##......##.#',
			'#............#',
			'#.b..xx..xx..#',
			'#............#',
			'####D####D####',
			'#..........T.#',
			'#.b........b.#',
			'#S........E..#',
			'##############'
		],
		guards: [
			guard(
				[
					[1, 4],
					[12, 4]
				],
				1
			),
			guard(
				[
					[12, 9],
					[1, 9]
				],
				1
			),
			dog(
				[
					[1, 2],
					[5, 2]
				],
				2.5
			)
		],
		sensors: [
			camera([6, 1], 180, 30, 6, 6),
			camera([7, 1], 0, 30, 6, 6, 3),
			floodlight([10, 6], 3.3, 2.5, 2)
		]
	},
	{
		id: 'final-batch',
		theme: 'factory',
		targetKind: 'press',
		title: 'Final batch',
		par: 90,
		card: {
			channel: 'Gig Heroes',
			poster: 'Vlad Talent',
			message: 'Last shift! The whole plant. Finish and you keep the vest. Payment may arrive.'
		},
		map: [
			'##############',
			'#..T...#....T#',
			'#......D.xx..#',
			'#.,,...#.....#',
			'###D#######D##',
			'#............#',
			'#.xx......xx.#',
			'#.##......##.#',
			'#.##,,,,..##.#',
			'#............#',
			'#.b..xx..b...#',
			'###D######D###',
			'#.T.,,......E#',
			'#............#',
			'#S..b....b...#',
			'##############'
		],
		guards: [
			guard(
				[
					[1, 5],
					[12, 5]
				],
				1
			),
			guard(
				[
					[12, 9],
					[1, 9]
				],
				1.2
			),
			dog(
				[
					[5, 13],
					[12, 13]
				],
				2.5
			)
		],
		sensors: [
			camera([7, 1], 180, 30, 6, 6),
			camera([7, 3], 0, 30, 6.5, 5.5, 2),
			floodlight([3, 8], 3.5, 2.5, 2),
			floodlight([7, 15], 3.6, 2, 2.5, 1)
		]
	}
];

export const LEVELS: Level[] = DEFINITIONS.map((definition) => ({
	...definition,
	...parseMap(definition.map)
}));

export const LEVEL_IDS: readonly string[] = LEVELS.map((level) => level.id);
export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index: number): Level {
	return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index))];
}

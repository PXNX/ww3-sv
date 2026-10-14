/*
 * The twelve levels of GPS Liar. Each is a spec for the generator (level.ts): how big the sea is,
 * where the land is, how many harbours, rocks, shallows, buoys and lighthouses there are, whether
 * the shadow-fleet tanker patrols, how far the boat can see and how badly the GPS lies. The
 * early levels only drift a little; later ones jump, rotate and finally mirror the position. A
 * test builds and checks every one.
 */
import { buildLevel, type Level, type LevelSpec } from './level.js';
import { NO_LIE, type LieParams } from './lie.js';

const lie = (params: Partial<LieParams>): LieParams => ({ ...NO_LIE, ...params });

export const LEVEL_SPECS: readonly LevelSpec[] = [
	{
		id: 'gpsliar-1',
		seed: 1101,
		width: 22,
		height: 16,
		land: 'north',
		stops: 1,
		rocks: 2,
		shallows: 0,
		buoys: 2,
		lighthouses: 1,
		tanker: false,
		lie: lie({ base: 1, growth: 0.03, max: 2.2, drift: 0.12 }),
		fogRadius: 5.5,
		crossChecks: 3
	},
	{
		id: 'gpsliar-2',
		seed: 1202,
		width: 24,
		height: 16,
		land: 'west',
		stops: 1,
		rocks: 3,
		shallows: 1,
		buoys: 3,
		lighthouses: 2,
		tanker: false,
		lie: lie({ base: 1.5, growth: 0.04, max: 3, drift: 0.15 }),
		fogRadius: 5.2,
		crossChecks: 3
	},
	{
		id: 'gpsliar-3',
		seed: 1303,
		width: 26,
		height: 18,
		land: 'south',
		stops: 2,
		rocks: 4,
		shallows: 2,
		buoys: 3,
		lighthouses: 2,
		tanker: false,
		lie: lie({ base: 2, growth: 0.05, max: 3.5, drift: 0.18 }),
		fogRadius: 5,
		crossChecks: 3
	},
	{
		id: 'gpsliar-4',
		seed: 1404,
		width: 26,
		height: 18,
		land: 'east',
		stops: 2,
		rocks: 4,
		shallows: 2,
		buoys: 4,
		lighthouses: 3,
		tanker: false,
		lie: lie({ base: 1.5, growth: 0.04, max: 4, drift: 0.2, jumpEvery: 15, jumpSize: 1.5 }),
		fogRadius: 4.8,
		crossChecks: 3
	},
	{
		id: 'gpsliar-5',
		seed: 1505,
		width: 28,
		height: 20,
		land: 'north',
		stops: 2,
		rocks: 5,
		shallows: 2,
		buoys: 4,
		lighthouses: 3,
		tanker: true,
		lie: lie({ base: 2, growth: 0.05, max: 4, drift: 0.2, jumpEvery: 18, jumpSize: 1.5 }),
		fogRadius: 4.6,
		crossChecks: 3
	},
	{
		id: 'gpsliar-6',
		seed: 1606,
		width: 30,
		height: 20,
		land: 'west',
		stops: 3,
		rocks: 5,
		shallows: 3,
		buoys: 5,
		lighthouses: 3,
		tanker: true,
		lie: lie({ base: 2.5, growth: 0.06, max: 4.5, drift: 0.25, jumpEvery: 14, jumpSize: 2 }),
		fogRadius: 4.4,
		crossChecks: 3
	},
	{
		id: 'gpsliar-7',
		seed: 1707,
		width: 30,
		height: 20,
		land: 'south',
		stops: 3,
		rocks: 6,
		shallows: 3,
		buoys: 5,
		lighthouses: 4,
		tanker: true,
		lie: lie({ base: 1.5, growth: 0.04, max: 3, drift: 0.15, rotate: 0.5 }),
		fogRadius: 4.4,
		crossChecks: 2
	},
	{
		id: 'gpsliar-8',
		seed: 1808,
		width: 30,
		height: 22,
		land: 'east',
		stops: 3,
		rocks: 6,
		shallows: 3,
		buoys: 6,
		lighthouses: 4,
		tanker: false,
		lie: lie({ base: 1.5, growth: 0.05, max: 3.5, drift: 0.2, mirror: true }),
		fogRadius: 4.2,
		crossChecks: 2
	},
	{
		id: 'gpsliar-9',
		seed: 1909,
		width: 32,
		height: 22,
		land: 'north',
		stops: 3,
		rocks: 7,
		shallows: 4,
		buoys: 6,
		lighthouses: 4,
		tanker: true,
		lie: lie({
			base: 2,
			growth: 0.05,
			max: 4,
			drift: 0.2,
			rotate: 1.2,
			jumpEvery: 16,
			jumpSize: 2
		}),
		fogRadius: 4,
		crossChecks: 2
	},
	{
		id: 'gpsliar-10',
		seed: 2010,
		width: 34,
		height: 22,
		land: 'west',
		stops: 4,
		rocks: 7,
		shallows: 4,
		buoys: 7,
		lighthouses: 4,
		tanker: true,
		lie: lie({
			base: 2,
			growth: 0.06,
			max: 4.5,
			drift: 0.25,
			mirror: true,
			rotate: 0.6,
			jumpEvery: 15,
			jumpSize: 2
		}),
		fogRadius: 3.9,
		crossChecks: 2
	},
	{
		id: 'gpsliar-11',
		seed: 2111,
		width: 34,
		height: 24,
		land: 'south',
		stops: 4,
		rocks: 8,
		shallows: 4,
		buoys: 7,
		lighthouses: 4,
		tanker: true,
		lie: lie({
			base: 3,
			growth: 0.08,
			max: 6,
			drift: 0.3,
			rotate: 2.2,
			jumpEvery: 12,
			jumpSize: 2.5
		}),
		fogRadius: 3.8,
		crossChecks: 2
	},
	{
		id: 'gpsliar-12',
		seed: 2212,
		width: 36,
		height: 24,
		land: 'east',
		stops: 4,
		rocks: 8,
		shallows: 5,
		buoys: 8,
		lighthouses: 4,
		tanker: true,
		lie: lie({
			base: 3,
			growth: 0.1,
			max: 7,
			drift: 0.35,
			mirror: true,
			rotate: 1,
			jumpEvery: 10,
			jumpSize: 3
		}),
		fogRadius: 3.6,
		crossChecks: 2
	}
];

export const LEVEL_IDS: readonly string[] = LEVEL_SPECS.map((spec) => spec.id);

const built = new Map<string, Level>();

/** The generated level at an index (clamped to the existing levels) */
export function levelAt(index: number): Level {
	const spec = LEVEL_SPECS[Math.min(Math.max(index, 0), LEVEL_SPECS.length - 1)];
	let level = built.get(spec.id);
	if (!level) {
		level = buildLevel(spec);
		built.set(spec.id, level);
	}
	return level;
}

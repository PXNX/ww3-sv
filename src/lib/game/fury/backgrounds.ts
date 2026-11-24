/*
 * Background themes of Magyar's Birds. The scenery changes every few levels and cycles through
 * the themes forever, so the generated levels keep changing their look too. A theme is only flat
 * colors plus an optional sun, moon or stars, a kind of weather and, now and then, a landmark far
 * off; the renderer draws it in the usual thick-outline style. All of it is scenery: nothing here
 * touches the physics or the level.
 */

export type BackgroundId =
	'meadow' | 'sunset' | 'strait' | 'night' | 'desert' | 'winter' | 'dawn' | 'storm' | 'autumn';

/** Weather drawn over the scenery, behind every piece */
export type FuryWeather = 'clear' | 'rain' | 'snow' | 'fog' | 'wind';

/**
 * What stands in the far distance: the usual ridge of hills, or the Kerch strait with the Crimea
 * bridge and its twin steel arches across it
 */
export type Scenery = 'hills' | 'kerchBridge';

export type Celestial = 'sun' | 'lowSun' | 'moon' | 'none';

export interface Backdrop {
	id: BackgroundId;
	sky: string;
	cloud: string;
	/** The faraway ridge, drawn first */
	hillFar: string;
	/** The nearer rolling hills */
	hillNear: string;
	ground: string;
	celestial: Celestial;
	celestialColor: string;
	stars: boolean;
	weather: FuryWeather;
	scenery: Scenery;
	/** Color of the weather: rain streaks, flakes, fog banks or gusts */
	weatherColor: string;
}

export const BACKGROUNDS: readonly Backdrop[] = [
	{
		id: 'meadow',
		sky: '#cfe3ec',
		cloud: '#ffffff',
		hillFar: '#a9bb86',
		hillNear: '#7c8c5c',
		ground: '#e8e1bc',
		celestial: 'sun',
		celestialColor: '#fbe38e',
		stars: false,
		weather: 'clear',
		weatherColor: '#ffffff',
		scenery: 'hills'
	},
	{
		id: 'sunset',
		sky: '#f6c9a0',
		cloud: '#fde8d2',
		hillFar: '#c9876a',
		hillNear: '#9a5c48',
		ground: '#dcbf93',
		celestial: 'lowSun',
		celestialColor: '#f27a3d',
		stars: false,
		weather: 'wind',
		weatherColor: '#fde8d2',
		scenery: 'hills'
	},
	{
		id: 'strait',
		sky: '#f2b48c',
		cloud: '#fbd9c0',
		hillFar: '#4f6f8f',
		hillNear: '#8c7a5a',
		ground: '#d8c79c',
		celestial: 'lowSun',
		celestialColor: '#f0643a',
		stars: false,
		weather: 'clear',
		weatherColor: '#ffffff',
		scenery: 'kerchBridge'
	},
	{
		id: 'night',
		sky: '#2b3a67',
		cloud: '#5c6a98',
		hillFar: '#46567f',
		hillNear: '#33426a',
		ground: '#5d6488',
		celestial: 'moon',
		celestialColor: '#f4efd0',
		stars: true,
		weather: 'clear',
		weatherColor: '#ffffff',
		scenery: 'hills'
	},
	{
		id: 'desert',
		sky: '#f3e2b3',
		cloud: '#fff6df',
		hillFar: '#e4bd7a',
		hillNear: '#d09a52',
		ground: '#efd89f',
		celestial: 'sun',
		celestialColor: '#f5c83a',
		stars: false,
		weather: 'wind',
		weatherColor: '#e4bd7a',
		scenery: 'hills'
	},
	{
		id: 'winter',
		sky: '#dfe9f2',
		cloud: '#ffffff',
		hillFar: '#c5d6e4',
		hillNear: '#eef4f9',
		ground: '#fafcff',
		celestial: 'none',
		celestialColor: '#ffffff',
		stars: false,
		weather: 'snow',
		weatherColor: '#ffffff',
		scenery: 'hills'
	},
	{
		id: 'dawn',
		sky: '#efd3cb',
		cloud: '#fff3ee',
		hillFar: '#b8a7b4',
		hillNear: '#8f9a7a',
		ground: '#e3dcc0',
		celestial: 'lowSun',
		celestialColor: '#f9a66c',
		stars: false,
		weather: 'fog',
		weatherColor: '#ffffff',
		scenery: 'hills'
	},
	{
		id: 'storm',
		sky: '#aeb9c2',
		cloud: '#7e8b96',
		hillFar: '#86948a',
		hillNear: '#667562',
		ground: '#cfc8aa',
		celestial: 'none',
		celestialColor: '#ffffff',
		stars: false,
		weather: 'rain',
		weatherColor: '#5d6e86',
		scenery: 'hills'
	},
	{
		id: 'autumn',
		sky: '#e3d2b4',
		cloud: '#f7eddc',
		hillFar: '#c98d4e',
		hillNear: '#9c5f33',
		ground: '#d9b98a',
		celestial: 'sun',
		celestialColor: '#f5c83a',
		stars: false,
		weather: 'wind',
		weatherColor: '#c4572a',
		scenery: 'hills'
	}
];

/** The scenery stays the same for this many levels in a row */
export const LEVELS_PER_BACKGROUND = 3;

/** The backdrop of a level, by its zero-based index; it changes every LEVELS_PER_BACKGROUND levels */
export function backgroundFor(levelIndex: number): Backdrop {
	const block = Math.floor(Math.max(0, levelIndex) / LEVELS_PER_BACKGROUND);
	return BACKGROUNDS[block % BACKGROUNDS.length];
}

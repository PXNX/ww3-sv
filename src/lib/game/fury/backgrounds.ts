/*
 * Background themes of Magyar's Birds. The scenery changes every few levels and cycles through
 * the themes forever, so the generated levels keep changing their look too. A theme is only flat
 * colors plus an optional sun, moon or stars; the renderer draws it in the usual thick-outline style.
 */

export type BackgroundId = 'meadow' | 'sunset' | 'night' | 'desert' | 'winter' | 'storm';

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
		stars: false
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
		stars: false
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
		stars: true
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
		stars: false
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
		stars: false
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
		stars: false
	}
];

/** The scenery stays the same for this many levels in a row */
export const LEVELS_PER_BACKGROUND = 3;

/** The backdrop of a level, by its zero-based index; it changes every LEVELS_PER_BACKGROUND levels */
export function backgroundFor(levelIndex: number): Backdrop {
	const block = Math.floor(Math.max(0, levelIndex) / LEVELS_PER_BACKGROUND);
	return BACKGROUNDS[block % BACKGROUNDS.length];
}

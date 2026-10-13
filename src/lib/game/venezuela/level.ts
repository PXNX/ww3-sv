/*
 * Levels are JSON: an id and rows of characters, one character per tile.
 *
 *   .  empty        #  ground (solid)        W  crate (solid)
 *   =  catwalk (solid only from above)       ^  barbed barricade (hurts)
 *   P  start        G  flag (pole base)      C  checkpoint lamp
 *   o  oil barrel   e  rig-guard goon        j  hopping goon        h  helicopter
 *
 * Rows are LEVEL_ROWS tall and all the same length. Falling off the bottom costs a heart.
 */
import { LEVEL_ROWS, VIEW_W } from './config';

export interface RawLevel {
	id: string;
	rows: readonly string[];
}

export type TileKind = 'empty' | 'solid' | 'oneway' | 'hazard';

export interface Spot {
	/** Tile column and row */
	x: number;
	y: number;
}

export interface LevelData {
	id: string;
	rows: readonly string[];
	width: number;
	height: number;
	start: Spot;
	goal: Spot;
	checkpoints: Spot[];
	barrels: Spot[];
	goons: Spot[];
	jumpers: Spot[];
	helicopters: Spot[];
}

const SOLID = new Set(['#', 'W']);
const KNOWN = new Set(['.', '#', 'W', '=', '^', 'P', 'G', 'C', 'o', 'e', 'j', 'h']);

export function kindOfChar(char: string): TileKind {
	if (SOLID.has(char)) return 'solid';
	if (char === '=') return 'oneway';
	if (char === '^') return 'hazard';
	return 'empty';
}

/**
 * The tile at a column and row. Left and right of the level are solid walls (nobody leaves the
 * level sideways); above and below it is open air, so a pit really is a fall.
 */
export function tileAt(level: LevelData, tx: number, ty: number): TileKind {
	if (tx < 0 || tx >= level.width) return 'solid';
	if (ty < 0 || ty >= level.height) return 'empty';
	return kindOfChar(level.rows[ty][tx]);
}

/** Everything wrong with a raw level; an empty list means it can be parsed and played */
export function structureProblems(raw: RawLevel): string[] {
	const problems: string[] = [];
	if (typeof raw.id !== 'string' || raw.id === '') problems.push('missing id');
	if (!Array.isArray(raw.rows) || raw.rows.length !== LEVEL_ROWS) {
		problems.push(`needs exactly ${LEVEL_ROWS} rows`);
		return problems;
	}
	const width = raw.rows[0].length;
	if (width < VIEW_W) problems.push(`narrower than the view (${VIEW_W} tiles)`);
	const counts = new Map<string, number>();
	raw.rows.forEach((row, index) => {
		if (row.length !== width) problems.push(`row ${index} has a different length`);
		for (const char of row) {
			if (!KNOWN.has(char)) problems.push(`unknown tile "${char}" in row ${index}`);
			counts.set(char, (counts.get(char) ?? 0) + 1);
		}
	});
	if ((counts.get('P') ?? 0) !== 1) problems.push('needs exactly one start (P)');
	if ((counts.get('G') ?? 0) !== 1) problems.push('needs exactly one flag (G)');
	return problems;
}

function collect(rows: readonly string[], char: string): Spot[] {
	const spots: Spot[] = [];
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) if (row[x] === char) spots.push({ x, y });
	});
	return spots;
}

/** Turns a structurally valid raw level into level data; throws on a broken one */
export function parseLevel(raw: RawLevel): LevelData {
	const problems = structureProblems(raw);
	if (problems.length > 0) throw new Error(`Level ${raw.id}: ${problems.join('; ')}`);
	const rows = raw.rows;
	return {
		id: raw.id,
		rows,
		width: rows[0].length,
		height: rows.length,
		start: collect(rows, 'P')[0],
		goal: collect(rows, 'G')[0],
		checkpoints: collect(rows, 'C'),
		barrels: collect(rows, 'o'),
		goons: collect(rows, 'e'),
		jumpers: collect(rows, 'j'),
		helicopters: collect(rows, 'h')
	};
}

/*
 * Test helper: builds a grid from a compact text picture, one row per string, one token per tile.
 * Token = kind letter (s straight, e elbow, t tee, x cross) + rotation digit, for example "e1".
 * A trailing "!" marks the tile as broken.
 */
import type { PipeGrid, Tile } from './pipeGrid';
import type { Rotation, TileKind } from './tiles';

const KINDS: Record<string, TileKind> = { s: 'straight', e: 'elbow', t: 'tee', x: 'cross' };

export function gridFrom(rows: string[], stationCol: number, terminalCol: number): PipeGrid {
	const tiles: Tile[] = rows.flatMap((row) =>
		row
			.trim()
			.split(/\s+/)
			.map((token) => ({
				kind: KINDS[token[0]],
				rotation: Number(token[1]) as Rotation,
				broken: token.endsWith('!'),
				repair: 0
			}))
	);
	const cols = tiles.length / rows.length;
	return { rows: rows.length, cols, stationCol, terminalCol, tiles };
}

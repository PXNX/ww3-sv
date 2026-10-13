/*
 * The levels of El Presidente, from levels.json (see level.ts for the tile characters). The unit
 * tests check every one: a start and a flag, the flag and all barrels reachable with the jump
 * physics, and enemies that do not start inside walls.
 */
import data from './levels.json';
import { parseLevel, type LevelData, type RawLevel } from './level';

export const RAW_LEVELS: readonly RawLevel[] = data as RawLevel[];

export const LEVEL_IDS: readonly string[] = RAW_LEVELS.map((level) => level.id);

const parsed = new Map<string, LevelData>();

/** The parsed level at an index (clamped to the existing levels) */
export function levelAt(index: number): LevelData {
	const raw = RAW_LEVELS[Math.min(Math.max(index, 0), RAW_LEVELS.length - 1)];
	let level = parsed.get(raw.id);
	if (!level) {
		level = parseLevel(raw);
		parsed.set(raw.id, level);
	}
	return level;
}

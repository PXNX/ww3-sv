/*
 * The fifteen hand-authored levels, bundled at build time and validated on load, and the endless
 * generated levels that follow them. A file that fails validation is a programming error, so it
 * throws (the level test catches it first).
 */
import { generateLevel } from './generate';
import { validateLevel, type LevelData } from './schema';

const files = import.meta.glob<unknown>('./level-*.json', { eager: true, import: 'default' });

export function loadLevels(sources: Record<string, unknown>): LevelData[] {
	return Object.keys(sources)
		.sort()
		.map((path) => {
			const result = validateLevel(sources[path]);
			if (!result.ok) throw new Error(`${path}: ${result.errors.join('; ')}`);
			return result.level;
		});
}

export const LEVELS: readonly LevelData[] = loadLevels(files);

/** How many prepared levels there are; every level after them is generated */
export const PREPARED_LEVEL_COUNT = LEVELS.length;

const generated = new Map<number, LevelData>();

export function levelIdAt(index: number): string {
	return `level-${String(index + 1).padStart(2, '0')}`;
}

/** The level at a zero-based index: a prepared one, or a generated one that never runs out */
export function levelAt(index: number): LevelData {
	if (index < LEVELS.length) return LEVELS[index];
	let level = generated.get(index);
	if (!level) {
		level = generateLevel(index + 1);
		generated.set(index, level);
	}
	return level;
}

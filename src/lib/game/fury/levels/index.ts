/*
 * The fifteen hand-authored levels, bundled at build time and validated on load. A file that
 * fails validation is a programming error, so it throws (the level test catches it first).
 */
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

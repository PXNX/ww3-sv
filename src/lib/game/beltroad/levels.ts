/*
 * The 18 Belt & Road levels in three tiers of six. The JSON is produced by
 * scripts/generate-beltroad-levels.ts and levels.test.ts solves every level again.
 */
import data from './levels.json';
import { type Level } from './board';

export const LEVELS: readonly Level[] = data as unknown as Level[];

export const LEVELS_PER_TIER = 6;

export function levelAt(index: number): Level {
	const clamped = Math.min(Math.max(index, 0), LEVELS.length - 1);
	return LEVELS[index >= LEVELS.length ? 0 : clamped];
}

export function tierLevels(tier: import('./board').Tier): { level: Level; index: number }[] {
	return LEVELS.flatMap((level, index) => (level.tier === tier ? [{ level, index }] : []));
}

export { TIERS } from './board';

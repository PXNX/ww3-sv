/*
 * The 18 Belt & Road levels in three tiers of six. The JSON is produced by
 * scripts/generate-beltroad-levels.ts and levels.test.ts solves every level again.
 */
import data from './levels.json';
import { TIERS, type Level, type Tier } from './board';

export const LEVELS: readonly Level[] = data as unknown as Level[];

export const LEVELS_PER_TIER = 6;

export function levelAt(index: number): Level {
	return LEVELS[Math.min(Math.max(index, 0), LEVELS.length - 1)];
}

export function tierLevels(tier: Tier): { level: Level; index: number }[] {
	return LEVELS.flatMap((level, index) => (level.tier === tier ? [{ level, index }] : []));
}

export { TIERS };

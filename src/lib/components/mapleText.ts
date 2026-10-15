/*
 * Message lookups for Maple Reserve Heist: the level names, one per level in levels.ts (a test
 * checks that there is a name for every level).
 */
import { m } from '#lib/paraglide/messages.js';

export const LEVEL_NAMES: readonly (() => string)[] = [
	m.maple_level_1_name,
	m.maple_level_2_name,
	m.maple_level_3_name,
	m.maple_level_4_name,
	m.maple_level_5_name,
	m.maple_level_6_name,
	m.maple_level_7_name,
	m.maple_level_8_name,
	m.maple_level_9_name,
	m.maple_level_10_name
];

/** The name of the level at an index, empty when there is none */
export function levelName(index: number): string {
	return LEVEL_NAMES[index]?.() ?? '';
}

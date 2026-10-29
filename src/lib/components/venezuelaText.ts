/*
 * Message lookups for El Presidente: the level names, one per level in levels.json (a test checks
 * that there is a name for every level).
 */
import { m } from '#lib/paraglide/messages.js';

export const LEVEL_NAMES: readonly (() => string)[] = [
	m.venezuela_level_1_name,
	m.venezuela_level_2_name,
	m.venezuela_level_3_name,
	m.venezuela_level_4_name,
	m.venezuela_level_5_name,
	m.venezuela_level_6_name,
	m.venezuela_level_7_name
];

/** The name of the level at an index, empty when there is none */
export function levelName(index: number): string {
	return LEVEL_NAMES[index]?.() ?? '';
}

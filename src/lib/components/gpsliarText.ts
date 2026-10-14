/*
 * Message lookups for GPS Liar: the level names, one per level in levels.ts (a test checks that
 * there is a name for every level), the cargo names and the texts for what the boat hit.
 */
import type { Cargo } from '#lib/game/gpsliar/level.js';
import type { HitCause } from '#lib/game/gpsliar/state.js';
import { m } from '#lib/paraglide/messages.js';

export const LEVEL_NAMES: readonly (() => string)[] = [
	m.gpsliar_level_1_name,
	m.gpsliar_level_2_name,
	m.gpsliar_level_3_name,
	m.gpsliar_level_4_name,
	m.gpsliar_level_5_name,
	m.gpsliar_level_6_name,
	m.gpsliar_level_7_name,
	m.gpsliar_level_8_name,
	m.gpsliar_level_9_name,
	m.gpsliar_level_10_name,
	m.gpsliar_level_11_name,
	m.gpsliar_level_12_name
];

/** The name of the level at an index, empty when there is none */
export function levelName(index: number): string {
	return LEVEL_NAMES[index]?.() ?? '';
}

const CARGO_NAMES: Record<Cargo, () => string> = {
	herring: m.gpsliar_cargo_herring,
	stones: m.gpsliar_cargo_stones
};

const HIT_NAMES: Record<HitCause, () => string> = {
	rock: m.gpsliar_popup_rock,
	lighthouse: m.gpsliar_popup_lighthouse,
	tanker: m.gpsliar_popup_tanker,
	anchor: m.gpsliar_popup_anchor
};

export function cargoName(cargo: Cargo): string {
	return CARGO_NAMES[cargo]();
}

export function hitText(cause: HitCause): string {
	return HIT_NAMES[cause]();
}

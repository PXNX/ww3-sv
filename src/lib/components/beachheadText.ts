/*
 * Names shown for beachhead islands, buildings and upgrades. The strings live in the message
 * files, so every language can name them for itself.
 */
import { m } from '#lib/paraglide/messages.js';
import type { BuildingKind } from '#lib/game/beachhead/config.js';

const ISLAND_NAMES = [
	m.beachhead_island_1_name,
	m.beachhead_island_2_name,
	m.beachhead_island_3_name,
	m.beachhead_island_4_name,
	m.beachhead_island_5_name,
	m.beachhead_island_6_name
];

export function islandName(index: number): string {
	const name = ISLAND_NAMES[index];
	return name ? name() : m.beachhead_island_label({ index: index + 1 });
}

export function buildingName(kind: BuildingKind): string {
	switch (kind) {
		case 'hq':
			return m.beachhead_building_hq();
		case 'field-cannon':
			return m.beachhead_building_field_cannon();
		case 'mortar':
			return m.beachhead_building_mortar();
		case 'fpv-nest':
			return m.beachhead_building_fpv();
		case 'air-defence':
			return m.beachhead_building_air();
		case 'sniper':
			return m.beachhead_building_sniper();
		case 'mg':
			return m.beachhead_building_mg();
		case 'flame':
			return m.beachhead_building_flame();
		case 'depot':
			return m.beachhead_building_depot();
	}
}

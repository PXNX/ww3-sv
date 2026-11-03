/*
 * Names shown for beachhead islands, buildings and upgrades. The strings live in the message
 * files, so every language can name them for itself.
 */
import { m } from '#lib/paraglide/messages.js';
import type { BuildingKind, TroopKind } from '#lib/game/beachhead/config.js';

const ISLAND_NAMES = [
	m.beachhead_island_1_name,
	m.beachhead_island_2_name,
	m.beachhead_island_3_name,
	m.beachhead_island_4_name,
	m.beachhead_island_5_name,
	m.beachhead_island_6_name,
	m.beachhead_island_7_name,
	m.beachhead_island_8_name,
	m.beachhead_island_9_name
];

export function islandName(index: number): string {
	const name = ISLAND_NAMES[index];
	return name ? name() : m.beachhead_island_label({ index: index + 1 });
}

export function achievementName(id: string): string {
	switch (id) {
		case 'first-landing':
			return m.beachhead_achievement_first_landing();
		case 'archipelago':
			return m.beachhead_achievement_archipelago();
		case 'armada':
			return m.beachhead_achievement_armada();
		case 'veteran':
			return m.beachhead_achievement_veteran();
		case 'no-support':
			return m.beachhead_achievement_no_support();
		case 'heroic':
			return m.beachhead_achievement_heroic();
		case 'top-hq':
			return m.beachhead_achievement_top_hq();
		case 'all-stars':
			return m.beachhead_achievement_all_stars();
		case 'fortress':
			return m.beachhead_achievement_fortress();
		default:
			return id;
	}
}

export function achievementHint(id: string): string {
	switch (id) {
		case 'first-landing':
			return m.beachhead_achievement_first_landing_hint();
		case 'archipelago':
			return m.beachhead_achievement_archipelago_hint();
		case 'armada':
			return m.beachhead_achievement_armada_hint();
		case 'veteran':
			return m.beachhead_achievement_veteran_hint();
		case 'no-support':
			return m.beachhead_achievement_no_support_hint();
		case 'heroic':
			return m.beachhead_achievement_heroic_hint();
		case 'top-hq':
			return m.beachhead_achievement_top_hq_hint();
		case 'all-stars':
			return m.beachhead_achievement_all_stars_hint();
		case 'fortress':
			return m.beachhead_achievement_fortress_hint();
		default:
			return '';
	}
}

export function troopName(kind: TroopKind): string {
	switch (kind) {
		case 'assault':
			return m.beachhead_troop_assault();
		case 'tank':
			return m.beachhead_troop_tank();
		case 'mortar':
			return m.beachhead_troop_mortar();
		case 'drone':
			return m.beachhead_troop_drone();
		case 'medic':
			return m.beachhead_troop_medic();
		case 'hero':
			return m.beachhead_troop_hero();
		case 'artillery':
			return m.beachhead_troop_artillery();
		case 'apc':
			return m.beachhead_troop_apc();
		case 'demo':
			return m.beachhead_troop_demo();
		case 'heavy':
			return m.beachhead_troop_heavy();
	}
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

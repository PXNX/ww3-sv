/*
 * Names shown for beachhead islands, buildings and upgrades. The strings live in the message
 * files, so every language can name them for itself.
 */
import { m } from '#lib/paraglide/messages.js';
import { ISLANDS, type BuildingKind, type TroopKind } from '#lib/game/beachhead/config.js';
import type { CrystalType } from '#lib/game/beachhead/crystals.js';

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
	if (name) return name();
	// The islands beyond the hand-made ones are named after their biome and counted within it
	const island = ISLANDS[index];
	const sameBiome = ISLANDS.slice(0, index + 1).filter(
		(other) => other.theme === island?.theme
	).length;
	switch (island?.theme) {
		case 'ice':
			return m.beachhead_island_name_ice({ number: sameBiome });
		case 'jungle':
			return m.beachhead_island_name_jungle({ number: sameBiome });
		case 'desert':
			return m.beachhead_island_name_desert({ number: sameBiome });
		default:
			return m.beachhead_island_label({ index: index + 1 });
	}
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
		case 'azov':
			return m.beachhead_troop_azov();
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
		case 'himars':
			return m.beachhead_building_himars();
		case 'patriot':
			return m.beachhead_building_patriot();
		case 'jammer':
			return m.beachhead_building_jammer();
		case 'ice-cannon':
			return m.beachhead_building_ice_cannon();
		case 'ice-spire':
			return m.beachhead_building_ice_spire();
		case 'dart-hut':
			return m.beachhead_building_dart_hut();
		case 'totem':
			return m.beachhead_building_totem();
		case 'sand-mortar':
			return m.beachhead_building_sand_mortar();
		case 'scorpion-nest':
			return m.beachhead_building_scorpion_nest();
		case 'catapult':
			return m.beachhead_building_catapult();
		case 'ballista':
			return m.beachhead_building_ballista();
		case 'mine-personnel':
			return m.beachhead_building_mine_personnel();
		case 'mine-at':
			return m.beachhead_building_mine_at();
		case 'mine-emp':
			return m.beachhead_building_mine_emp();
	}
}

export function crystalName(type: CrystalType): string {
	switch (type) {
		case 'aegis':
			return m.beachhead_crystal_aegis();
		case 'regen':
			return m.beachhead_crystal_regen();
		case 'reach':
			return m.beachhead_crystal_reach();
		case 'haste':
			return m.beachhead_crystal_haste();
		case 'fortify':
			return m.beachhead_crystal_fortify();
		case 'might':
			return m.beachhead_crystal_might();
		case 'vigor':
			return m.beachhead_crystal_vigor();
		case 'power':
			return m.beachhead_crystal_power();
		case 'bulwark':
			return m.beachhead_crystal_bulwark();
		case 'fortune':
			return m.beachhead_crystal_fortune();
		case 'plunder':
			return m.beachhead_crystal_plunder();
		case 'industry':
			return m.beachhead_crystal_industry();
	}
}

export function crystalHint(type: CrystalType): string {
	switch (type) {
		case 'aegis':
			return m.beachhead_crystal_aegis_hint();
		case 'regen':
			return m.beachhead_crystal_regen_hint();
		case 'reach':
			return m.beachhead_crystal_reach_hint();
		case 'haste':
			return m.beachhead_crystal_haste_hint();
		case 'fortify':
			return m.beachhead_crystal_fortify_hint();
		case 'might':
			return m.beachhead_crystal_might_hint();
		case 'vigor':
			return m.beachhead_crystal_vigor_hint();
		case 'power':
			return m.beachhead_crystal_power_hint();
		case 'bulwark':
			return m.beachhead_crystal_bulwark_hint();
		case 'fortune':
			return m.beachhead_crystal_fortune_hint();
		case 'plunder':
			return m.beachhead_crystal_plunder_hint();
		case 'industry':
			return m.beachhead_crystal_industry_hint();
	}
}

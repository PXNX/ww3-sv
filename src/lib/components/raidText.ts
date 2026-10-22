/* Translated names of the raid's maps, bosses, weapons, armour and rarities */
import type { MapId, Rarity, SkillId, WeaponKind } from '#lib/game/raid/config.js';
import type { GearItem } from '#lib/game/raid/items.js';
import { m } from '#lib/paraglide/messages.js';

export const MAP_NAMES: Record<MapId, () => string> = {
	sunflower: m.raid_map_sunflower_name,
	strait: m.raid_map_strait_name,
	arctic: m.raid_map_arctic_name
};

export const MAP_DESCRIPTIONS: Record<MapId, () => string> = {
	sunflower: m.raid_map_sunflower_description,
	strait: m.raid_map_strait_description,
	arctic: m.raid_map_arctic_description
};

export const BOSS_NAMES: Record<MapId, () => string> = {
	sunflower: m.raid_boss_sunflower,
	strait: m.raid_boss_strait,
	arctic: m.raid_boss_arctic
};

export const WEAPON_NAMES: Record<WeaponKind, () => string> = {
	rifle: m.raid_weapon_rifle,
	marksman: m.raid_weapon_marksman,
	shotgun: m.raid_weapon_shotgun,
	smg: m.raid_weapon_smg,
	launcher: m.raid_weapon_launcher
};

export const WEAPON_TRAITS: Record<WeaponKind, () => string> = {
	rifle: m.raid_weapon_rifle_trait,
	marksman: m.raid_weapon_marksman_trait,
	shotgun: m.raid_weapon_shotgun_trait,
	smg: m.raid_weapon_smg_trait,
	launcher: m.raid_weapon_launcher_trait
};

export const RARITY_NAMES: Record<Rarity, () => string> = {
	common: m.raid_rarity_common,
	uncommon: m.raid_rarity_uncommon,
	rare: m.raid_rarity_rare,
	epic: m.raid_rarity_epic,
	legendary: m.raid_rarity_legendary
};

export function itemName(item: GearItem): string {
	if (item.type === 'weapon') return WEAPON_NAMES[item.kind]();
	return item.slot === 'helmet' ? m.raid_armor_helmet() : m.raid_armor_vest();
}

/** Minutes and seconds, such as 4:07 */
export function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const SKILL_NAMES: Record<SkillId, () => string> = {
	heal: m.raid_skill_heal,
	grenade: m.raid_skill_grenade,
	focus: m.raid_skill_focus,
	railshot: m.raid_skill_railshot,
	dash: m.raid_skill_dash,
	blast: m.raid_skill_blast,
	overdrive: m.raid_skill_overdrive,
	nova: m.raid_skill_nova,
	barrage: m.raid_skill_barrage,
	mine: m.raid_skill_mine
};

export const SKILL_HINTS: Record<SkillId, () => string> = {
	heal: m.raid_skill_heal_hint,
	grenade: m.raid_skill_grenade_hint,
	focus: m.raid_skill_focus_hint,
	railshot: m.raid_skill_railshot_hint,
	dash: m.raid_skill_dash_hint,
	blast: m.raid_skill_blast_hint,
	overdrive: m.raid_skill_overdrive_hint,
	nova: m.raid_skill_nova_hint,
	barrage: m.raid_skill_barrage_hint,
	mine: m.raid_skill_mine_hint
};

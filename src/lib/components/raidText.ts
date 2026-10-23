/*
 * Translated names of the raid's maps, bosses, enemies, weapons, armour and its perks, crystals,
 * rarities and season rewards
 */
import type {
	Archetype,
	ArmorPerk,
	ArmorSlot,
	CrystalKind,
	MapId,
	Rarity,
	SkillId,
	WeaponKind
} from '#lib/game/raid/config.js';
import { crystalBonus, type Crystal, type GearItem } from '#lib/game/raid/items.js';
import type { SeasonReward } from '#lib/game/raid/season.js';
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
	launcher: m.raid_weapon_launcher,
	flamethrower: m.raid_weapon_flamethrower,
	dronenest: m.raid_weapon_dronenest
};

export const WEAPON_TRAITS: Record<WeaponKind, () => string> = {
	rifle: m.raid_weapon_rifle_trait,
	marksman: m.raid_weapon_marksman_trait,
	shotgun: m.raid_weapon_shotgun_trait,
	smg: m.raid_weapon_smg_trait,
	launcher: m.raid_weapon_launcher_trait,
	flamethrower: m.raid_weapon_flamethrower_trait,
	dronenest: m.raid_weapon_dronenest_trait
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
	const name = ARMOR_NAMES[item.slot]();
	return item.perk ? m.raid_armor_with_perk({ armor: name, perk: PERK_NAMES[item.perk]() }) : name;
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
	mine: m.raid_skill_mine,
	flashpoint: m.raid_skill_flashpoint,
	napalm: m.raid_skill_napalm,
	swarm: m.raid_skill_swarm,
	overclock: m.raid_skill_overclock
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
	mine: m.raid_skill_mine_hint,
	flashpoint: m.raid_skill_flashpoint_hint,
	napalm: m.raid_skill_napalm_hint,
	swarm: m.raid_skill_swarm_hint,
	overclock: m.raid_skill_overclock_hint
};

export const ARMOR_NAMES: Record<ArmorSlot, () => string> = {
	helmet: m.raid_armor_helmet,
	vest: m.raid_armor_vest,
	boots: m.raid_armor_boots
};

export const PERK_NAMES: Record<ArmorPerk, () => string> = {
	jammer: m.raid_perk_jammer,
	spikes: m.raid_perk_spikes,
	trail: m.raid_perk_trail,
	sprint: m.raid_perk_sprint
};

export const PERK_HINTS: Record<ArmorPerk, () => string> = {
	jammer: m.raid_perk_jammer_hint,
	spikes: m.raid_perk_spikes_hint,
	trail: m.raid_perk_trail_hint,
	sprint: m.raid_perk_sprint_hint
};

/** What each weapon's base attack does, for the weapon details */
export const ATTACK_HINTS: Record<WeaponKind, () => string> = {
	rifle: m.raid_attack_rifle,
	marksman: m.raid_attack_marksman,
	shotgun: m.raid_attack_shotgun,
	smg: m.raid_attack_smg,
	launcher: m.raid_attack_launcher,
	flamethrower: m.raid_attack_flamethrower,
	dronenest: m.raid_attack_dronenest
};

export const CRYSTAL_NAMES: Record<CrystalKind, () => string> = {
	damage: m.raid_crystal_damage,
	crit: m.raid_crystal_crit,
	fire: m.raid_crystal_fire,
	status: m.raid_crystal_status
};

/** The crystal's kind and rarity, such as "Damage crystal (Rare)" */
export function crystalName(crystal: Crystal): string {
	return m.raid_crystal_name({
		crystal: CRYSTAL_NAMES[crystal.kind](),
		rarity: RARITY_NAMES[crystal.rarity]()
	});
}

/** What a crystal adds, such as "+16% damage" */
export function crystalEffect(crystal: Crystal): string {
	const value = Math.round(crystalBonus(crystal) * 100);
	switch (crystal.kind) {
		case 'damage':
			return m.raid_crystal_damage_hint({ value });
		case 'crit':
			return m.raid_crystal_crit_hint({ value });
		case 'fire':
			return m.raid_crystal_fire_hint({ value });
		case 'status':
			return m.raid_crystal_status_hint({ value });
	}
}

/** Plural names of the enemy types, for the results */
export const ENEMY_NAMES: Record<Archetype, () => string> = {
	grunt: m.raid_enemy_grunt,
	fast: m.raid_enemy_fast,
	heavy: m.raid_enemy_heavy,
	ranged: m.raid_enemy_ranged,
	drone: m.raid_enemy_drone,
	medic: m.raid_enemy_medic,
	mortar: m.raid_enemy_mortar,
	artillery: m.raid_enemy_artillery,
	boss: m.raid_enemy_boss
};

export function seasonRewardText(reward: SeasonReward): string {
	switch (reward.type) {
		case 'gold':
			return m.raid_reward_gold({ amount: reward.amount });
		case 'scrap':
			return m.raid_reward_scrap({ amount: reward.amount });
		case 'crystal':
			return m.raid_reward_crystal({ count: reward.count, crystal: crystalName(reward.crystal) });
		case 'weapon':
			return m.raid_reward_weapon({
				weapon: WEAPON_NAMES[reward.kind](),
				rarity: RARITY_NAMES[reward.rarity]()
			});
	}
}

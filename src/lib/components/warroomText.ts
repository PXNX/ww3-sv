/*
 * Translated names for the War Room's regions, resources, equipment, factories, terrains and
 * division templates, plus the few derived labels the panels show.
 */
import type {
	EquipmentId,
	FactoryId,
	RegionId,
	ResourceId,
	TemplateId,
	Terrain
} from '#lib/game/warroom/config.js';
import { TERRAIN_DEFENCE } from '#lib/game/warroom/config.js';
import type { CrisisId, DirectiveId, Effect } from '#lib/game/warroom/council.js';
import { m } from '#lib/paraglide/messages.js';

const REGION_NAMES: Record<RegionId, () => string> = {
	capital: m.warroom_region_capital,
	rustbelt: m.warroom_region_rustbelt,
	ridge: m.warroom_region_ridge,
	grain: m.warroom_region_grain,
	tar: m.warroom_region_tar,
	marsh: m.warroom_region_marsh,
	plains: m.warroom_region_plains,
	foundry: m.warroom_region_foundry,
	wells: m.warroom_region_wells,
	redcapital: m.warroom_region_redcapital
};

const RESOURCE_NAMES: Record<ResourceId, () => string> = {
	steel: m.warroom_resource_steel,
	oil: m.warroom_resource_oil,
	rare: m.warroom_resource_rare,
	grain: m.warroom_resource_grain
};

const EQUIPMENT_NAMES: Record<EquipmentId, () => string> = {
	rifles: m.warroom_equipment_rifles,
	armour: m.warroom_equipment_armour,
	guns: m.warroom_equipment_guns,
	trucks: m.warroom_equipment_trucks
};

const FACTORY_NAMES: Record<FactoryId, () => string> = {
	arms: m.warroom_factory_arms,
	tanks: m.warroom_factory_tanks,
	guns: m.warroom_factory_guns,
	trucks: m.warroom_factory_trucks
};

const TEMPLATE_NAMES: Record<TemplateId, () => string> = {
	infantry: m.warroom_template_infantry,
	armour: m.warroom_template_armour,
	artillery: m.warroom_template_artillery,
	mech: m.warroom_template_mech
};

const TEMPLATE_NOTES: Record<TemplateId, () => string> = {
	infantry: m.warroom_template_infantry_note,
	armour: m.warroom_template_armour_note,
	artillery: m.warroom_template_artillery_note,
	mech: m.warroom_template_mech_note
};

const TERRAIN_NAMES: Record<Terrain, () => string> = {
	plains: m.warroom_terrain_plains,
	urban: m.warroom_terrain_urban,
	mountains: m.warroom_terrain_mountains,
	marsh: m.warroom_terrain_marsh,
	desert: m.warroom_terrain_desert
};

export const regionName = (id: RegionId) => REGION_NAMES[id]();
export const resourceName = (id: ResourceId) => RESOURCE_NAMES[id]();
export const equipmentName = (id: EquipmentId) => EQUIPMENT_NAMES[id]();
export const factoryName = (id: FactoryId) => FACTORY_NAMES[id]();
export const templateName = (id: TemplateId) => TEMPLATE_NAMES[id]();
export const templateNote = (id: TemplateId) => TEMPLATE_NOTES[id]();
export const terrainName = (id: Terrain) => TERRAIN_NAMES[id]();

/** The defender's terrain bonus as a whole percent, for the region details */
export function terrainBonus(terrain: Terrain): number {
	return Math.round((TERRAIN_DEFENCE[terrain] - 1) * 100);
}

/** A resource cost as "30 Steel · 5 Rare earth" */
export function resourceCost(cost: Partial<Record<ResourceId, number>>): string {
	return Object.entries(cost)
		.map(([id, amount]) => `${amount} ${resourceName(id as ResourceId)}`)
		.join(' · ');
}

/** An equipment cost as "12 Rifles · 2 Trucks" */
export function equipmentCost(cost: Partial<Record<EquipmentId, number>>): string {
	return Object.entries(cost)
		.map(([id, amount]) => `${amount} ${equipmentName(id as EquipmentId)}`)
		.join(' · ');
}

/** A rough attack-to-defence readout, shown before an attack */
export function oddsLabel(attack: number, defence: number): string {
	return m.warroom_odds({ attack: Math.round(attack), defence: Math.round(defence) });
}

// Council: crises, directives and the effect chips that show what a choice does
const CRISIS_TITLES: Record<CrisisId, () => string> = {
	sabotage: m.warroom_crisis_sabotage_title,
	strike: m.warroom_crisis_strike_title,
	defector: m.warroom_crisis_defector_title,
	aid: m.warroom_crisis_aid_title,
	scandal: m.warroom_crisis_scandal_title,
	debt: m.warroom_crisis_debt_title,
	mutiny: m.warroom_crisis_mutiny_title,
	rumour: m.warroom_crisis_rumour_title,
	hero: m.warroom_crisis_hero_title
};

const CRISIS_BODIES: Record<CrisisId, () => string> = {
	sabotage: m.warroom_crisis_sabotage_body,
	strike: m.warroom_crisis_strike_body,
	defector: m.warroom_crisis_defector_body,
	aid: m.warroom_crisis_aid_body,
	scandal: m.warroom_crisis_scandal_body,
	debt: m.warroom_crisis_debt_body,
	mutiny: m.warroom_crisis_mutiny_body,
	rumour: m.warroom_crisis_rumour_body,
	hero: m.warroom_crisis_hero_body
};

const CRISIS_OPTIONS: Record<CrisisId, [() => string, () => string]> = {
	sabotage: [m.warroom_crisis_sabotage_a, m.warroom_crisis_sabotage_b],
	strike: [m.warroom_crisis_strike_a, m.warroom_crisis_strike_b],
	defector: [m.warroom_crisis_defector_a, m.warroom_crisis_defector_b],
	aid: [m.warroom_crisis_aid_a, m.warroom_crisis_aid_b],
	scandal: [m.warroom_crisis_scandal_a, m.warroom_crisis_scandal_b],
	debt: [m.warroom_crisis_debt_a, m.warroom_crisis_debt_b],
	mutiny: [m.warroom_crisis_mutiny_a, m.warroom_crisis_mutiny_b],
	rumour: [m.warroom_crisis_rumour_a, m.warroom_crisis_rumour_b],
	hero: [m.warroom_crisis_hero_a, m.warroom_crisis_hero_b]
};

const DIRECTIVE_NAMES: Record<DirectiveId, () => string> = {
	propaganda: m.warroom_directive_propaganda_name,
	mobilise: m.warroom_directive_mobilise_name,
	counterintel: m.warroom_directive_counterintel_name,
	austerity: m.warroom_directive_austerity_name
};

const DIRECTIVE_NOTES: Record<DirectiveId, () => string> = {
	propaganda: m.warroom_directive_propaganda_note,
	mobilise: m.warroom_directive_mobilise_note,
	counterintel: m.warroom_directive_counterintel_note,
	austerity: m.warroom_directive_austerity_note
};

export const crisisTitle = (id: CrisisId) => CRISIS_TITLES[id]();
export const crisisBody = (id: CrisisId) => CRISIS_BODIES[id]();
export const crisisOptionLabel = (id: CrisisId, option: number) => CRISIS_OPTIONS[id][option]();
export const directiveName = (id: DirectiveId) => DIRECTIVE_NAMES[id]();
export const directiveNote = (id: DirectiveId) => DIRECTIVE_NOTES[id]();

const signed = (amount: number) => (amount > 0 ? `+${amount}` : `${amount}`);

/** One effect as a short chip text, such as "Home front +10" */
export function effectLabel(effect: Effect): string {
	switch (effect.kind) {
		case 'stability':
			return m.warroom_effect_stability({ delta: signed(effect.amount) });
		case 'morale':
			return m.warroom_effect_morale({ delta: signed(effect.amount) });
		case 'experience':
			return m.warroom_effect_experience({ delta: signed(effect.amount) });
		case 'resource':
			return m.warroom_effect_stock({
				delta: signed(effect.amount),
				name: resourceName(effect.id)
			});
		case 'equipment':
			return m.warroom_effect_stock({
				delta: signed(effect.amount),
				name: equipmentName(effect.id)
			});
		case 'enemyReinforce':
			return m.warroom_effect_reinforce({ count: effect.amount });
		case 'enemyMorale':
			return m.warroom_effect_enemy_morale({ delta: signed(effect.amount) });
		case 'intel':
			return m.warroom_effect_intel({ days: effect.days });
		case 'flag':
			return m.warroom_effect_flag();
	}
}

/** The final rank for the result screen, 0 (worst) to 4 */
export function rankOf(score: number, outcome: string | null): number {
	if (outcome === 'won') return score >= 1800 ? 4 : 3;
	return score >= 1100 ? 2 : score >= 600 ? 1 : 0;
}

export const rankName = (rank: number) =>
	[m.warroom_rank_0, m.warroom_rank_1, m.warroom_rank_2, m.warroom_rank_3, m.warroom_rank_4][
		Math.max(0, Math.min(4, rank))
	]();

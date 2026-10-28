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

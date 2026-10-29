/*
 * Text for the Drone Works playfield: the names and one-line descriptions of the buildings, the
 * drones and the resources, all through the message files so every language stays complete.
 */
import type { BuildingId, DroneId, ResourceId } from '#lib/game/droneworks/config.js';
import { m } from '#lib/paraglide/messages.js';

export function resourceName(id: ResourceId): string {
	const names: Record<ResourceId, () => string> = {
		ore: m.droneworks_res_ore,
		steel: m.droneworks_res_steel,
		chips: m.droneworks_res_chips,
		engines: m.droneworks_res_engines,
		airframes: m.droneworks_res_airframes
	};
	return names[id]();
}

export function buildingName(id: BuildingId): string {
	const names: Record<BuildingId, () => string> = {
		mine: m.droneworks_building_mine,
		smelter: m.droneworks_building_smelter,
		chipfab: m.droneworks_building_chipfab,
		engine: m.droneworks_building_engine,
		airframe: m.droneworks_building_airframe,
		assembly: m.droneworks_building_assembly,
		flak: m.droneworks_building_flak
	};
	return names[id]();
}

export function buildingAbout(id: BuildingId): string {
	const about: Record<BuildingId, () => string> = {
		mine: m.droneworks_about_mine,
		smelter: m.droneworks_about_smelter,
		chipfab: m.droneworks_about_chipfab,
		engine: m.droneworks_about_engine,
		airframe: m.droneworks_about_airframe,
		assembly: m.droneworks_about_assembly,
		flak: m.droneworks_about_flak
	};
	return about[id]();
}

export function droneName(id: DroneId): string {
	const names: Record<DroneId, () => string> = {
		flamingo: m.droneworks_drone_flamingo,
		freyja: m.droneworks_drone_freyja,
		pelikan: m.droneworks_drone_pelikan
	};
	return names[id]();
}

export function droneRecipe(id: DroneId): string {
	const recipes: Record<DroneId, () => string> = {
		flamingo: m.droneworks_recipe_flamingo,
		freyja: m.droneworks_recipe_freyja,
		pelikan: m.droneworks_recipe_pelikan
	};
	return recipes[id]();
}

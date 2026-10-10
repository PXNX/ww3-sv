/* Names and descriptions of Drone Wall things, looked up by kind, shared by its components */
import type { DefenseKind, PowerKind, WeatherKind } from '#lib/game/dronewall/config.js';
import { m } from '#lib/paraglide/messages.js';

export const DEFENSE_NAMES: Record<DefenseKind, () => string> = {
	squad: m.dronewall_squad_name,
	mortar: m.dronewall_mortar_name,
	nest: m.dronewall_nest_name,
	patriot: m.dronewall_patriot_name,
	trench: m.dronewall_trench_name,
	azov: m.dronewall_azov_name,
	leopard: m.dronewall_leopard_name,
	himars: m.dronewall_himars_name,
	sniper: m.dronewall_sniper_name,
	jammer: m.dronewall_jammer_name,
	gepard: m.dronewall_gepard_name,
	pion: m.dronewall_pion_name
};

export const DEFENSE_ROLES: Record<DefenseKind, () => string> = {
	squad: m.dronewall_squad_role,
	mortar: m.dronewall_mortar_role,
	nest: m.dronewall_nest_role,
	patriot: m.dronewall_patriot_role,
	trench: m.dronewall_trench_role,
	azov: m.dronewall_azov_role,
	leopard: m.dronewall_leopard_role,
	himars: m.dronewall_himars_role,
	sniper: m.dronewall_sniper_role,
	jammer: m.dronewall_jammer_role,
	gepard: m.dronewall_gepard_role,
	pion: m.dronewall_pion_role
};

export const WEATHER_NAMES: Record<WeatherKind, () => string> = {
	clear: m.dronewall_weather_clear,
	fog: m.dronewall_weather_fog,
	rain: m.dronewall_weather_rain,
	snow: m.dronewall_weather_snow
};

export const WEATHER_EFFECTS: Record<WeatherKind, () => string> = {
	clear: m.dronewall_weather_clear_effect,
	fog: m.dronewall_weather_fog_effect,
	rain: m.dronewall_weather_rain_effect,
	snow: m.dronewall_weather_snow_effect
};

export const POWER_NAMES: Record<PowerKind, () => string> = {
	airstrike: m.dronewall_power_airstrike_name,
	stormshadow: m.dronewall_power_stormshadow_name
};

export const POWER_ROLES: Record<PowerKind, () => string> = {
	airstrike: m.dronewall_power_airstrike_role,
	stormshadow: m.dronewall_power_stormshadow_role
};

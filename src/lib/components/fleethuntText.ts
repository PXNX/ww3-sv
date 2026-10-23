/* Translated names of the Black Sea Fleet Hunt's ship classes and weapons */
import type { ShipClass, Weapon } from '#lib/game/fleethunt/fleet.js';
import { m } from '#lib/paraglide/messages.js';

export const SHIP_NAMES: Record<ShipClass, () => string> = {
	moskva: m.fleethunt_ship_moskva,
	ropucha: m.fleethunt_ship_ropucha,
	kilo: m.fleethunt_ship_kilo,
	buyan: m.fleethunt_ship_buyan,
	tarantul: m.fleethunt_ship_tarantul
};

export const WEAPON_NAMES: Record<Weapon, () => string> = {
	neptune: m.fleethunt_weapon_neptune,
	usv: m.fleethunt_weapon_usv
};

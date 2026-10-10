/*
 * Weather: each wave brings one kind, drawn from the map's climate, and the player sees the
 * forecast for the next wave while building. Fog blinds the FPV drones, rain bogs down vehicles
 * (tanks, armored cars and buggies, and the Leopard of the player too), snow slows infantry and
 * freezes enemy soldiers on the spot now and then.
 */
import type { Random } from '#lib/game/random.js';
import { SOLDIERS, type SoldierKind, type WeatherKind } from './config';

export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'fog', 'rain', 'snow'];

export interface WeatherEffect {
	/** Share of its damage an FPV drone deals */
	fpvPower: number;
	/** Share of its reach a drone nest keeps (it cannot see as far) */
	fpvRange: number;
	/** Speed of vehicles */
	vehicleSpeed: number;
	/** Speed of enemy infantry */
	infantrySpeed: number;
	/** Speed of the player's own infantry units (snow slows them less) */
	friendlyInfantrySpeed: number;
	/** Chance per second for an enemy infantry soldier to freeze solid */
	freezeChance: number;
}

const CLEAR: WeatherEffect = {
	fpvPower: 1,
	fpvRange: 1,
	vehicleSpeed: 1,
	infantrySpeed: 1,
	friendlyInfantrySpeed: 1,
	freezeChance: 0
};

export const WEATHER: Record<WeatherKind, WeatherEffect> = {
	clear: CLEAR,
	fog: { ...CLEAR, fpvPower: 0.5, fpvRange: 0.7 },
	rain: { ...CLEAR, vehicleSpeed: 0.58 },
	snow: { ...CLEAR, infantrySpeed: 0.72, friendlyInfantrySpeed: 0.88, freezeChance: 0.07 }
};

/** A frozen soldier stands still this long, then cannot freeze again for a while */
export const FREEZE_MS: readonly [number, number] = [1500, 2600];
export const THAW_MS = 4500;

/** The first waves are always clear, so the player learns the game before the weather */
export const CLEAR_WAVES = 2;

/**
 * The weather of a wave: clear for the first waves, then drawn from the map's climate. The same
 * weather rarely comes twice in a row.
 */
export function pickWeather(
	random: Random,
	wave: number,
	climate: readonly WeatherKind[],
	previous: WeatherKind
): WeatherKind {
	if (wave <= CLEAR_WAVES || climate.length === 0) return 'clear';
	let pick = climate[Math.floor(random() * climate.length)];
	if (pick === previous && pick !== 'clear' && random() < 0.7) {
		pick = climate[Math.floor(random() * climate.length)];
	}
	return pick;
}

/** The speed multiplier the weather puts on an enemy soldier */
export function enemySpeedFactor(weather: WeatherKind, kind: SoldierKind): number {
	const effect = WEATHER[weather];
	return SOLDIERS[kind].vehicle ? effect.vehicleSpeed : effect.infantrySpeed;
}

/** Enemy infantry can freeze in snow; vehicles cannot */
export function canFreeze(weather: WeatherKind, kind: SoldierKind): boolean {
	return WEATHER[weather].freezeChance > 0 && !SOLDIERS[kind].vehicle;
}

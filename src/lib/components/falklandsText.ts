/*
 * Text helpers for Falklands: weather labels and their effect on the day, plus the speed names.
 * Kept out of the component so a missing message fails loudly and the mapping is testable.
 */
import type { Speed } from '#lib/game/falklands/state.js';
import type { Weather } from '#lib/game/falklands/weather.js';
import { m } from '#lib/paraglide/messages.js';

export function weatherText(weather: Weather): string {
	if (weather === 'fog') return m.falklands_weather_fog();
	if (weather === 'storm') return m.falklands_weather_storm();
	return m.falklands_weather_clear();
}

export function weatherEffect(weather: Weather): string {
	if (weather === 'fog') return m.falklands_weather_effect_fog();
	if (weather === 'storm') return m.falklands_weather_effect_storm();
	return m.falklands_weather_effect_clear();
}

export function speedLabel(speed: Speed): string {
	if (speed === 'cruise') return m.falklands_action_cruise();
	if (speed === 'flank') return m.falklands_action_flank();
	return m.falklands_action_slow();
}

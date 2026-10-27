/*
 * South Atlantic weather for Falklands. The front is generated once per run from the seeded random
 * source, so the same seed gives the same forecast. Day one is always clear, and two storms never
 * come back to back; a storm also stops the task force from sprinting.
 */
import type { Random } from '../random.js';
import { STORM_EXTRA_FUEL, WEATHER_DAYS } from './config.js';
import type { Speed } from './state.js';

export type Weather = 'clear' | 'fog' | 'storm';

function nextWeather(random: Random, previous: Weather): Weather {
	const roll = random();
	if (previous === 'storm') return roll < 0.5 ? 'clear' : 'fog';
	if (roll < 0.5) return 'clear';
	if (roll < 0.78) return 'fog';
	return 'storm';
}

/** A forecast of WEATHER_DAYS days, with a clear first day and no two storms in a row */
export function createWeather(random: Random): Weather[] {
	const days: Weather[] = ['clear'];
	while (days.length < WEATHER_DAYS) {
		days.push(nextWeather(random, days[days.length - 1]));
	}
	return days;
}

/** The weather of a given day; the forecast repeats if a cautious run lasts longer */
export function weatherAt(weather: readonly Weather[], day: number): Weather {
	return weather[day % weather.length];
}

/** Whether a speed is allowed in this weather */
export function allowsSpeed(weather: Weather, speed: Speed): boolean {
	return speed !== 'flank' || weather === 'clear';
}

/** Fuel a move costs in this weather */
export function moveCost(fuel: number, weather: Weather): number {
	return fuel + (weather === 'storm' ? STORM_EXTRA_FUEL : 0);
}

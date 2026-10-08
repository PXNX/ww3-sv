/*
 * Weather and light over a run: clear day, pink dawn with a low warm sun, or thick dark fog. A
 * seeded plan cuts the course into stretches and blends smoothly from one to the next over a short
 * distance, so the same seed gives the same weather at the same distance.
 *
 * Fog shortens how far the player can see, but never below what a runner needs to react to an
 * obstacle (MIN_VISIBILITY_SECONDS of running at the current speed), so every obstacle is still on
 * screen early enough to avoid. Heavy fog also hides a drone that is still far away; the buzz
 * (drone.ts) always stays.
 */
import { createRandom, pickWeighted, type Random } from '#lib/game/random.js';
import { VIEW_AHEAD } from './config';
import { speedAt } from './patterns';

export type WeatherKind = 'clear' | 'dawn' | 'fog';

export interface Weather {
	/** 0 to 1: how pink and low the morning sun is */
	dawn: number;
	/** 0 to 1: how thick and dark the fog is */
	fog: number;
}

const LEVELS: Record<WeatherKind, Weather> = {
	clear: { dawn: 0, fog: 0 },
	dawn: { dawn: 1, fog: 0.12 },
	fog: { dawn: 0, fog: 1 }
};

export interface Stretch {
	kind: WeatherKind;
	start: number;
	end: number;
}

export interface WeatherPlan {
	random: Random;
	stretches: Stretch[];
}

/** The first stretch is a plain clear day, so the first lessons are easy to read */
export const CLEAR_START = 140;
export const STRETCH_MIN = 170;
export const STRETCH_SPAN = 130;
/** Distance over which one stretch's weather melts into the next */
export const TRANSITION = 55;
/** Fog never takes the view below this many seconds of running */
export const MIN_VISIBILITY_SECONDS = 1.6;
/** The thickest fog's view, in units, at a standstill */
export const FOG_VIEW = 26;
/** Heavy fog hides a drone further away than this many units */
export const FOG_HIDES_ABOVE = 0.6;
export const FOG_HIDE_GAP = 3;

export function createWeatherPlan(seed: number): WeatherPlan {
	return {
		random: createRandom((seed ^ 0x7f4a7c15) >>> 0),
		stretches: [{ kind: 'clear', start: 0, end: CLEAR_START }]
	};
}

/** Lays out stretches until the plan reaches the given distance */
export function extendWeather(plan: WeatherPlan, until: number): void {
	while ((plan.stretches.at(-1)?.end ?? 0) <= until) {
		const last = plan.stretches.at(-1)!;
		const kind = pickWeighted(plan.random, [
			{ item: 'clear' as WeatherKind, weight: last.kind === 'clear' ? 0 : 3 },
			{ item: 'dawn' as WeatherKind, weight: last.kind === 'dawn' ? 0 : 3 },
			{ item: 'fog' as WeatherKind, weight: last.kind === 'fog' ? 0 : 3 }
		]);
		const length = STRETCH_MIN + plan.random() * STRETCH_SPAN;
		plan.stretches.push({ kind, start: last.end, end: last.end + length });
	}
}

const smooth = (t: number) => {
	const x = Math.min(1, Math.max(0, t));
	return x * x * (3 - 2 * x);
};

/** The weather at a distance; extends the plan as needed */
export function weatherAt(plan: WeatherPlan, distance: number): Weather {
	extendWeather(plan, distance + TRANSITION);
	const index = plan.stretches.findIndex((stretch) => distance < stretch.end);
	const stretch = plan.stretches[Math.max(0, index)];
	const now = LEVELS[stretch.kind];
	const before = LEVELS[plan.stretches[Math.max(0, index - 1)].kind];
	const mix = index <= 0 ? 1 : smooth((distance - stretch.start) / TRANSITION);
	return {
		dawn: before.dawn + (now.dawn - before.dawn) * mix,
		fog: before.fog + (now.fog - before.fog) * mix
	};
}

/**
 * How far ahead the player can see, in units. Fog pulls it in, but never below the distance a
 * runner at this speed covers in MIN_VISIBILITY_SECONDS.
 */
export function visibility(weather: Weather, speed: number): number {
	const foggy = VIEW_AHEAD + (FOG_VIEW - VIEW_AHEAD) * weather.fog;
	return Math.min(VIEW_AHEAD, Math.max(foggy, speed * MIN_VISIBILITY_SECONDS));
}

/** Whether fog hides the drone: only thick fog, and only while the drone is not right behind */
export function fogHidesDrone(weather: Weather, gap: number): boolean {
	return weather.fog >= FOG_HIDES_ABOVE && gap > FOG_HIDE_GAP;
}

/** The visibility at a distance on the course, at the speed the runner has there */
export function visibilityAt(plan: WeatherPlan, distance: number): number {
	return visibility(weatherAt(plan, distance), speedAt(distance));
}

/** The share of the view in which things are fully clear; beyond it they fade into the fog */
export const CLEAR_VIEW_SHARE = 0.75;

/** How visible something is at a distance ahead of the runner, from 1 (clear) to 0 (lost in fog) */
export function opacityAt(ahead: number, view: number): number {
	const clearUntil = view * CLEAR_VIEW_SHARE;
	if (ahead <= clearUntil) return 1;
	return Math.max(0, (view - ahead) / (view - clearUntil));
}

/*
 * Photo composition: a snapshot scores on three readable criteria instead of being a flat bonus
 * for hovering over a point of interest. Everything is derived from the run state at the moment
 * the shutter fires, so the same run always produces the same photos.
 */
import { PHOTO_POINTS, PHOTO_RANGE, WIND_SPEEDS } from './config.js';
import { layerCentre } from './wind.js';
import type { BalloonState } from './state.js';
import type { Poi } from './course.js';

/** Layer the camera likes: high enough above the subject, low enough to see it clearly */
export const PHOTO_IDEAL_LAYER = 1;

export interface PhotoScore {
	points: number;
	/** 0 to 100 for each criterion, shown after the snap */
	altitude: number;
	framing: number;
	weather: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const percent = (value: number) => Math.round(clamp(value) * 100);

/** Grades the photo the balloon is about to take of a point of interest */
export function photoScore(state: BalloonState, poi: Poi): PhotoScore {
	const idealY = layerCentre(PHOTO_IDEAL_LAYER, state.field);
	const altitude = clamp(1 - Math.abs(state.y - idealY) / (state.field.layerHeight * 1.5));
	const framing = clamp(1 - Math.abs(state.progress - poi.x) / PHOTO_RANGE);
	const fastest = Math.max(...WIND_SPEEDS.map(Math.abs));
	const weather = clamp(1 - Math.abs(state.wind) / fastest);
	const quality = (altitude + framing + weather) / 3;
	return {
		points: Math.round(PHOTO_POINTS * (1 + 1.2 * quality)),
		altitude: percent(altitude),
		framing: percent(framing),
		weather: percent(weather)
	};
}

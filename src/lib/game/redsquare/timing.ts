/*
 * Red Square timing rules: the slot length and the cue band narrow with every wave, and the score
 * grows with how close to the centre of the band the cue landed. All pure numbers so the state
 * machine and its tests share one source.
 */
import {
	INTERCEPTORS_BASE,
	INTERCEPTORS_STEP,
	HITS_PER_WAVE,
	POINTS_MAX,
	POINTS_MIN,
	POINTS_STEP,
	SLOT_BASE_MS,
	SLOT_MIN_MS,
	SLOT_STEP_MS,
	STREAK_BONUS,
	STREAK_BONUS_MAX,
	WINDOW_BASE,
	WINDOW_CENTRE,
	WINDOW_MIN,
	WINDOW_STEP
} from './config.js';

export interface CueWindow {
	start: number;
	end: number;
	centre: number;
}

/** Milliseconds a column takes to cross the square in this wave */
export function slotMs(wave: number): number {
	return Math.max(SLOT_MIN_MS, SLOT_BASE_MS - (wave - 1) * SLOT_STEP_MS);
}

/** Share of the crossing that counts as the tribune in this wave */
export function windowShare(wave: number): number {
	return Math.max(WINDOW_MIN, WINDOW_BASE - (wave - 1) * WINDOW_STEP);
}

export function cueWindow(wave: number): CueWindow {
	const share = windowShare(wave);
	return {
		start: WINDOW_CENTRE - share / 2,
		end: WINDOW_CENTRE + share / 2,
		centre: WINDOW_CENTRE
	};
}

/** How clean a cue inside the band was, 1 in the centre and 0 at the edges */
export function accuracyAt(position: number, window: CueWindow): number {
	if (position < window.start || position > window.end) return 0;
	const half = (window.end - window.start) / 2;
	if (half <= 0) return 1;
	return Math.max(0, Math.min(1, 1 - Math.abs(position - window.centre) / half));
}

/** Points for a cue, rounded to the score step so the numbers stay readable */
export function pointsFor(accuracy: number): number {
	const raw = POINTS_MIN + (POINTS_MAX - POINTS_MIN) * Math.max(0, Math.min(1, accuracy));
	return Math.round(raw / POINTS_STEP) * POINTS_STEP;
}

/** Extra points for a run of hits, growing every hit and then capped */
export function streakBonus(streak: number): number {
	return Math.min(STREAK_BONUS_MAX, Math.max(0, streak) * STREAK_BONUS);
}

/** The wave the parade has reached after this many hits */
export function waveFor(hits: number): number {
	return 1 + Math.floor(Math.max(0, hits) / HITS_PER_WAVE);
}

/** Interceptors the radio still claims are up, one fewer every wave */
export function interceptorsFor(wave: number): number {
	return Math.max(1, INTERCEPTORS_BASE - (wave - 1) * INTERCEPTORS_STEP);
}

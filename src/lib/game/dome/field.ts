/*
 * The shape of the playfield. On landscape screens the world is the standard 640 by 400 strip. A
 * portrait screen (a phone, Telegram's game browser) gets a taller world instead, so the canvas
 * fills the height that is left: the ground and the city stay where they are and the sky grows
 * upwards, into negative world y. The shape is picked when a run starts and kept for the whole run.
 *
 * Rockets keep their flight times on a taller sky: they start higher and fly faster, so a wave is
 * as hard as on the standard field, and interceptors fly faster by the same factor to keep up.
 */
import { GROUND_Y, INTERCEPTOR_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';

export interface DomeField {
	/** World height of the whole picture */
	height: number;
	/** World y of the top edge: 0 on the standard field, negative on a taller one */
	top: number;
	/** How many times longer the drop from the top edge to the ground is than on the standard field */
	stretch: number;
	/** Interceptor speed on this field, in world units per second */
	interceptorSpeed: number;
}

/** A playfield box at least this tall for its width counts as portrait and gets a taller sky */
export const TALL_FROM = 0.95;
/** The sky stops growing at this height for the width; a taller box leaves room below the field */
export const MAX_TALL_RATIO = 1.45;

export function domeField(height: number = WORLD_HEIGHT): DomeField {
	const total = Math.max(WORLD_HEIGHT, Math.round(height));
	const top = WORLD_HEIGHT - total;
	const stretch = (GROUND_Y - top) / GROUND_Y;
	return { height: total, top, stretch, interceptorSpeed: INTERCEPTOR_SPEED * stretch };
}

export const BASE_FIELD: DomeField = domeField();

/**
 * World height for a playfield box of the given size in CSS pixels: the standard height on a
 * landscape box, as tall as the box on a portrait one (up to MAX_TALL_RATIO of the width)
 */
export function fieldHeightFor(boxWidth: number, boxHeight: number): number {
	if (!(boxWidth > 0) || !(boxHeight > 0)) return WORLD_HEIGHT;
	const ratio = boxHeight / boxWidth;
	if (ratio < TALL_FROM) return WORLD_HEIGHT;
	return Math.max(WORLD_HEIGHT, Math.round(WORLD_WIDTH * Math.min(ratio, MAX_TALL_RATIO)));
}

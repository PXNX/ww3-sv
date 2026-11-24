/*
 * The shape of the playfield. On landscape screens the world is the standard 640 by 400 strip. A
 * portrait screen (a phone, Telegram's game browser) gets a taller world instead, so the canvas
 * fills the height that is left: the ground strip stays where it is and the sky grows upwards,
 * into negative world y. The five wind layers share the taller sky, so each one is taller. The
 * shape is picked when a run starts and kept for the whole run.
 *
 * A taller sky plays like the standard one: the burner moves the balloon faster by the same
 * factor, so a climb from one layer to the next takes as long as before, the course has more
 * hazards so the balloon meets them as often, and a patrol jet pass fills its taller layer with
 * more jets.
 */
import { CEILING_Y, FLOOR_Y, GROUND_Y, LAYER_COUNT, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';

export interface BalloonField {
	/** World height of the whole picture */
	height: number;
	/** World y of the top edge: 0 on the standard field, negative on a taller one */
	top: number;
	/** Height of one wind layer; layer 0 starts at the top edge */
	layerHeight: number;
	/** The balloon's highest and lowest altitude */
	ceilingY: number;
	floorY: number;
	/** How many times taller the sky is than on the standard field */
	stretch: number;
}

/** A playfield box at least this tall for its width counts as portrait and gets a taller sky */
export const TALL_FROM = 0.95;
/** The sky stops growing at this height for the width; a taller box leaves room below the field */
export const MAX_TALL_RATIO = 1.35;

export function balloonField(height: number = WORLD_HEIGHT): BalloonField {
	const total = Math.max(WORLD_HEIGHT, Math.round(height));
	const top = WORLD_HEIGHT - total;
	return {
		height: total,
		top,
		layerHeight: (GROUND_Y - top) / LAYER_COUNT,
		ceilingY: top + CEILING_Y,
		floorY: FLOOR_Y,
		stretch: (GROUND_Y - top) / GROUND_Y
	};
}

export const BASE_FIELD: BalloonField = balloonField();

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

/** Top edge of a wind layer */
export function layerTop(layer: number, field: BalloonField = BASE_FIELD): number {
	return field.top + layer * field.layerHeight;
}

/** The rows a patrol jet pass flies in: one jet per standard layer height, spread over the layer */
export function jetRows(layer: number, field: BalloonField = BASE_FIELD): number[] {
	const count = Math.max(1, Math.round(field.stretch));
	const top = layerTop(layer, field);
	return Array.from({ length: count }, (_, i) => top + (field.layerHeight * (i + 0.5)) / count);
}

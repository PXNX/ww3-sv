/*
 * Canvas drawing for Stage A, the wafer stacker, in world units (WORLD_WIDTH by WORLD_HEIGHT),
 * plus the small picture of the final tower on the share card. Flat colors and thick ink
 * outlines like the rest of the app. Drawing only reads the state; it never changes it.
 */
import { FIELD_WIDTH, LAYER_HEIGHT } from './config';
import { moduleLabel } from './ram';
import { topLayer, type Layer, type StackerState } from './stacker';

export const WORLD_WIDTH = FIELD_WIDTH;
export const WORLD_HEIGHT = 140;
/** World y of the top of the floor the tower stands on */
export const FLOOR_Y = 128;

const INK = '#111111';
const SAND = '#e8e1bc';
const PAPER = '#ffffff';
/** Layer colors, cycling: silicon, copper, oxide and friends, all from the app palette */
const LAYER_COLORS = ['#4fa8d8', '#ddb93c', '#7c8c5c', '#aeb4be', '#f6c9a0', '#6a7c9b'] as const;
const BASE_COLOR = '#cfc693';

export type Effect =
	| {
			/** An overhanging piece falling off the tower */
			kind: 'cut';
			left: number;
			width: number;
			y: number;
			color: number;
			ageMs: number;
			durationMs: number;
	  }
	| {
			/** A flash along a perfectly aligned layer */
			kind: 'flash';
			left: number;
			width: number;
			y: number;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
}

/** Fill color of the layer at an index (the base is index 0) */
export function layerColor(index: number): string {
	return index === 0 ? BASE_COLOR : LAYER_COLORS[(index - 1) % LAYER_COLORS.length];
}

/** World y of the top edge of the layer at an index */
export function layerY(index: number): number {
	return FLOOR_Y - (index + 1) * LAYER_HEIGHT;
}

function slabShape(
	context: CanvasRenderingContext2D,
	layer: Layer,
	y: number,
	fill: string,
	dashed = false
) {
	context.lineWidth = 0.9;
	context.strokeStyle = INK;
	context.fillStyle = fill;
	context.fillRect(layer.left, y, layer.width, LAYER_HEIGHT);
	context.strokeRect(layer.left, y, layer.width, LAYER_HEIGHT);
	// A light strip on top and a few pads make it read as a silicon layer, not a plain bar
	context.fillStyle = 'rgba(255,255,255,0.35)';
	context.fillRect(layer.left + 0.9, y + 0.9, layer.width - 1.8, 1.2);
	context.fillStyle = 'rgba(17,17,17,0.35)';
	for (let pad = layer.left + 3; pad < layer.left + layer.width - 2; pad += 5) {
		context.fillRect(pad, y + LAYER_HEIGHT - 2.1, 1.6, 1.2);
	}
	if (dashed) {
		context.setLineDash([2, 1.6]);
		context.strokeStyle = PAPER;
		context.strokeRect(layer.left + 0.5, y + 0.5, layer.width - 1, LAYER_HEIGHT - 1);
		context.setLineDash([]);
	}
}

/** Draws the whole stacker scene, assuming the context is already scaled to world units */
export function drawStacker(
	context: CanvasRenderingContext2D,
	stacker: StackerState,
	extras: SceneExtras
) {
	context.lineJoin = 'round';
	context.lineCap = 'round';

	// Clean-room backdrop with a faint grid
	context.fillStyle = SAND;
	context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	context.strokeStyle = 'rgba(17,17,17,0.07)';
	context.lineWidth = 0.4;
	for (let x = 10; x < WORLD_WIDTH; x += 10) {
		context.beginPath();
		context.moveTo(x, 0);
		context.lineTo(x, FLOOR_Y);
		context.stroke();
	}
	for (let y = 10; y < FLOOR_Y; y += 10) {
		context.beginPath();
		context.moveTo(0, y);
		context.lineTo(WORLD_WIDTH, y);
		context.stroke();
	}

	// The floor: a wafer chuck
	context.fillStyle = '#7c8c5c';
	context.fillRect(0, FLOOR_Y, WORLD_WIDTH, WORLD_HEIGHT - FLOOR_Y);
	context.lineWidth = 1;
	context.strokeStyle = INK;
	context.beginPath();
	context.moveTo(0, FLOOR_Y);
	context.lineTo(WORLD_WIDTH, FLOOR_Y);
	context.stroke();

	const count = stacker.layers.length;
	const top = topLayer(stacker);

	// Guide lines at the edges of the layer to match, from the tower up to the sliding layer
	if (stacker.status === 'running') {
		context.strokeStyle = 'rgba(229,72,77,0.7)';
		context.lineWidth = 0.5;
		context.setLineDash([2, 2]);
		for (const x of [top.left, top.left + top.width]) {
			context.beginPath();
			context.moveTo(x, layerY(count - 1));
			context.lineTo(x, 0);
			context.stroke();
		}
		context.setLineDash([]);
	}

	stacker.layers.forEach((layer, index) =>
		slabShape(context, layer, layerY(index), layerColor(index))
	);

	if (stacker.status === 'running') {
		const slab = { left: stacker.slab.x, width: stacker.slab.width };
		slabShape(context, slab, layerY(count), layerColor(count), true);
	}

	for (const effect of extras.effects) {
		const t = Math.min(1, effect.ageMs / effect.durationMs);
		if (effect.kind === 'cut') {
			const seconds = effect.ageMs / 1000;
			context.globalAlpha = 1 - t * t;
			slabShape(
				context,
				{ left: effect.left, width: effect.width },
				effect.y + (extras.reducedMotion ? t * 6 : 0.5 * 260 * seconds * seconds),
				layerColor(effect.color)
			);
			context.globalAlpha = 1;
		} else {
			context.globalAlpha = (1 - t) * 0.9;
			context.fillStyle = PAPER;
			const grow = extras.reducedMotion ? 0 : t * 2;
			context.fillRect(
				effect.left - grow,
				effect.y - grow,
				effect.width + grow * 2,
				LAYER_HEIGHT + grow * 2
			);
			context.globalAlpha = 1;
		}
	}
}

/** Draws the finished tower and its biggest module into a square, for the share score card */
export function drawScenePreview(
	context: CanvasRenderingContext2D,
	stacker: StackerState,
	highestTier: number,
	x: number,
	y: number,
	size: number
) {
	context.save();
	context.fillStyle = SAND;
	context.fillRect(x, y, size, size);
	const scale = size / WORLD_WIDTH;
	const floor = size * 0.9;
	context.fillStyle = '#7c8c5c';
	context.fillRect(x, y + floor, size, size - floor);
	context.lineWidth = Math.max(1, scale * 0.9);
	context.strokeStyle = INK;
	context.lineJoin = 'round';
	// Squash tall towers so they always fit
	const height = Math.min(
		LAYER_HEIGHT * scale,
		(floor * 0.85) / Math.max(1, stacker.layers.length)
	);
	stacker.layers.forEach((layer, index) => {
		context.fillStyle = layerColor(index);
		const left = x + layer.left * scale;
		const top = y + floor - (index + 1) * height;
		context.fillRect(left, top, layer.width * scale, height);
		context.strokeRect(left, top, layer.width * scale, height);
	});
	if (highestTier > 0) {
		context.fillStyle = INK;
		context.textAlign = 'center';
		context.textBaseline = 'top';
		context.font = `700 ${Math.round(size * 0.12)}px 'Baloo 2', system-ui, sans-serif`;
		context.fillText(moduleLabel(highestTier), x + size / 2, y + size * 0.04);
	}
	context.restore();
}

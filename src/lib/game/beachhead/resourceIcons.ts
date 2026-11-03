/*
 * The four resource pictures, as shapes on a 24 × 24 board: a stack of logs, a chunk of rock, a pair
 * of iron ingots and a stack of gold coins. The same shapes feed the SVG icon in the interface and
 * the little loot pieces that fly across the canvas, so a coin looks like a coin everywhere. Thick
 * ink outlines and flat fills, like the rest of the game.
 */
export type ResourceId = 'wood' | 'stone' | 'iron' | 'gold';

export interface IconShape {
	d: string;
	fill: string;
	/** Drawn without an outline, for highlights */
	soft?: boolean;
}

export const ICON_INK = '#111111';
export const ICON_STROKE = 1.5;

/** A circle as a path, so every shape can be drawn the same way */
function circle(cx: number, cy: number, r: number): string {
	return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

export const RESOURCE_SHAPES: Record<ResourceId, readonly IconShape[]> = {
	wood: [
		// Three log ends in a pile: bark ring, pale wood, a heart ring
		{ d: circle(7.2, 16, 4.6), fill: '#8a5a2b' },
		{ d: circle(7.2, 16, 2.9), fill: '#e2b277', soft: true },
		{ d: circle(16.8, 16, 4.6), fill: '#8a5a2b' },
		{ d: circle(16.8, 16, 2.9), fill: '#e2b277', soft: true },
		{ d: circle(12, 8.6, 4.6), fill: '#9b6a3c' },
		{ d: circle(12, 8.6, 2.9), fill: '#efc48c', soft: true },
		{ d: circle(12, 8.6, 1.1), fill: '#b9854d', soft: true }
	],
	stone: [
		{ d: 'M3 17.5 6.5 8l6-3.5L19 7l2.5 10.5-9 3z', fill: '#a9acb3' },
		{ d: 'M6.5 8l6-3.5L19 7l-6.5 4.5z', fill: '#d6d8dd', soft: true },
		{ d: 'M12.5 11.5 19 7l2.5 10.5-9 3z', fill: '#7e828b', soft: true },
		{ d: 'M3 17.5 6.5 8l6 3.5 0 9z', fill: '#93969e', soft: true }
	],
	iron: [
		// Two ingots, the top one shifted so the stack reads at small sizes
		{ d: 'M2.5 19.5 4.5 13h8l2 6.5z', fill: '#7c8796' },
		{ d: 'M4.5 13h8l1 2.2h-8.6z', fill: '#c4ccd6', soft: true },
		{ d: 'M9.5 19.5 11.5 13h9l2 6.5z', fill: '#8b97a6' },
		{ d: 'M11.5 13h9l1 2.2h-9.6z', fill: '#d5dce5', soft: true },
		{ d: 'M6 10.5 7.6 5.5h8l1.6 5z', fill: '#99a5b4' },
		{ d: 'M7.6 5.5h8l.7 2h-9.4z', fill: '#e0e6ee', soft: true }
	],
	gold: [
		// A stack of two coins and one standing in front, with a star-ish shine
		{ d: 'M4 14.5v3.6c0 1.7 3.6 3 8 3s8-1.3 8-3v-3.6z', fill: '#c28d12' },
		{ d: 'M12 11.5c-4.4 0-8 1.3-8 3s3.6 3 8 3 8-1.3 8-3-3.6-3-8-3z', fill: '#f2c53d' },
		{ d: 'M5.5 8.6v3c0 1.4 2.9 2.4 6.5 2.4s6.5-1 6.5-2.4v-3z', fill: '#c28d12' },
		{
			d: 'M12 5.6c-3.6 0-6.5 1-6.5 2.5S8.4 10.6 12 10.6s6.5-1 6.5-2.5S15.6 5.6 12 5.6z',
			fill: '#ffdc5e'
		},
		{ d: 'M9.6 7.6c.6-.5 1.6-.7 2.4-.7', fill: 'none', soft: true }
	]
};

/** Draws a resource into a canvas, centred on a point; size is the width of the whole picture */
export function drawResourceGlyph(
	context: CanvasRenderingContext2D,
	resource: ResourceId,
	cx: number,
	cy: number,
	size: number
) {
	context.save();
	context.translate(cx - size / 2, cy - size / 2);
	context.scale(size / 24, size / 24);
	context.lineJoin = 'round';
	context.lineWidth = ICON_STROKE;
	context.strokeStyle = ICON_INK;
	for (const shape of RESOURCE_SHAPES[resource]) {
		const path = new Path2D(shape.d);
		if (shape.fill !== 'none') {
			context.fillStyle = shape.fill;
			context.fill(path);
		}
		if (!shape.soft) context.stroke(path);
	}
	context.restore();
}

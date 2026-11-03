/*
 * Isometric projection for Beachhead. The simulation stays on a flat grid of cells (x runs along the
 * island towards the headquarters, y across it); this file turns grid positions into screen
 * positions for a 2:1 diamond view, plus the few solid shapes the buildings are made of. Nothing
 * here knows about the game rules, so the shore base and the battle canvas share it.
 */

export interface IsoPoint {
	x: number;
	y: number;
}

export interface IsoView {
	cols: number;
	rows: number;
	/** Half the width and half the height of one grid cell as it appears on screen */
	halfW: number;
	halfH: number;
	/** Extra water cells around the grid on every side */
	pad: number;
	/** Size of the whole picture, in view units */
	width: number;
	height: number;
	/** Where grid point (0, 0) lands */
	originX: number;
	originY: number;
	/** Grid cell and height above the ground to a view position */
	project(x: number, y: number, z?: number): IsoPoint;
	/** A view position on the ground plane back to a grid position */
	unproject(sx: number, sy: number): IsoPoint;
}

export interface IsoViewOptions {
	halfW?: number;
	halfH?: number;
	pad?: number;
	/** Room above the grid for tall buildings */
	headroom?: number;
	/** Room below the grid for the thickness of the island slab */
	depth?: number;
}

export function createIsoView(
	cols: number,
	rows: number,
	{ halfW = 0.9, halfH = 0.45, pad = 0, headroom = 1.7, depth = 0.7 }: IsoViewOptions = {}
): IsoView {
	const originX = (rows + 2 * pad) * halfW;
	const originY = 2 * pad * halfH + headroom;
	return {
		cols,
		rows,
		halfW,
		halfH,
		pad,
		width: (cols + rows + 4 * pad) * halfW,
		height: (cols + rows + 4 * pad) * halfH + headroom + depth,
		originX,
		originY,
		project(x, y, z = 0) {
			return { x: originX + (x - y) * halfW, y: originY + (x + y) * halfH - z };
		},
		unproject(sx, sy) {
			const a = (sx - originX) / halfW;
			const b = (sy - originY) / halfH;
			return { x: (a + b) / 2, y: (b - a) / 2 };
		}
	};
}

/** Runs a drawing function in grid coordinates, so flat shapes on the ground can be drawn as before */
export function onGround(context: CanvasRenderingContext2D, view: IsoView, draw: () => void) {
	context.save();
	context.transform(view.halfW, view.halfH, -view.halfW, view.halfH, view.originX, view.originY);
	draw();
	context.restore();
}

/** Depth for painter's-algorithm sorting: things further down the screen are drawn later */
export function depthOf(x: number, y: number): number {
	return x + y;
}

function hexToRgb(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value;
	const n = Number.parseInt(full, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lightens (positive) or darkens (negative) a #rrggbb colour by a fraction */
export function shade(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	const mix = (channel: number) =>
		Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
	return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

export interface SolidPalette {
	top: string;
	left: string;
	right: string;
}

/** Three face colours for a solid: lit top, mid-tone left (south-west) side, dark right (south-east) side */
export function paletteOf(base: string): SolidPalette {
	return { top: shade(base, 0.22), left: base, right: shade(base, -0.24) };
}

const OUTLINE = '#111111';

function polygon(
	context: CanvasRenderingContext2D,
	points: readonly IsoPoint[],
	fill: string,
	lineWidth: number
) {
	context.beginPath();
	context.moveTo(points[0].x, points[0].y);
	for (let index = 1; index < points.length; index++)
		context.lineTo(points[index].x, points[index].y);
	context.closePath();
	context.fillStyle = fill;
	context.fill();
	if (lineWidth > 0) {
		context.lineWidth = lineWidth;
		context.lineJoin = 'round';
		context.strokeStyle = OUTLINE;
		context.stroke();
	}
}

/**
 * A solid block standing on the ground from height z0 to z1, with a lit top and two shaded sides.
 * The footprint is x..x+w by y..y+h in grid cells.
 */
export function drawBox(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	w: number,
	h: number,
	z0: number,
	z1: number,
	palette: SolidPalette,
	lineWidth = 0.05
) {
	const p = view.project;
	polygon(
		context,
		[p(x, y + h, z1), p(x + w, y + h, z1), p(x + w, y + h, z0), p(x, y + h, z0)],
		palette.left,
		lineWidth
	);
	polygon(
		context,
		[p(x + w, y, z1), p(x + w, y + h, z1), p(x + w, y + h, z0), p(x + w, y, z0)],
		palette.right,
		lineWidth
	);
	polygon(
		context,
		[p(x, y, z1), p(x + w, y, z1), p(x + w, y + h, z1), p(x, y + h, z1)],
		palette.top,
		lineWidth
	);
}

/** A pyramid roof over a footprint, from height z up by rise */
export function drawRoof(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	w: number,
	h: number,
	z: number,
	rise: number,
	palette: SolidPalette,
	lineWidth = 0.05
) {
	const p = view.project;
	const apex = p(x + w / 2, y + h / 2, z + rise);
	polygon(context, [p(x, y + h, z), p(x + w, y + h, z), apex], palette.left, lineWidth);
	polygon(context, [p(x + w, y, z), p(x + w, y + h, z), apex], palette.right, lineWidth);
}

/** An upright cylinder centred on a grid point */
export function drawCylinder(
	context: CanvasRenderingContext2D,
	view: IsoView,
	cx: number,
	cy: number,
	radius: number,
	z0: number,
	z1: number,
	palette: SolidPalette,
	lineWidth = 0.05
) {
	const base = view.project(cx, cy, z0);
	const top = view.project(cx, cy, z1);
	const rx = view.halfW * radius * Math.SQRT2;
	const ry = view.halfH * radius * Math.SQRT2;
	context.beginPath();
	context.moveTo(base.x - rx, base.y);
	context.lineTo(top.x - rx, top.y);
	context.ellipse(top.x, top.y, rx, ry, 0, Math.PI, 0, true);
	context.lineTo(base.x + rx, base.y);
	context.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI, false);
	context.closePath();
	context.fillStyle = palette.left;
	context.fill();
	context.lineWidth = lineWidth;
	context.strokeStyle = OUTLINE;
	context.stroke();
	context.beginPath();
	context.ellipse(top.x, top.y, rx, ry, 0, 0, Math.PI * 2);
	context.fillStyle = palette.top;
	context.fill();
	context.stroke();
}

/** A little round blob, such as a sandbag or a lamp, sitting at a grid point and height */
export function drawBlob(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	z: number,
	radius: number,
	fill: string,
	lineWidth = 0.035
) {
	const point = view.project(x, y, z);
	context.beginPath();
	context.ellipse(point.x, point.y, radius, radius * 0.8, 0, 0, Math.PI * 2);
	context.fillStyle = fill;
	context.fill();
	if (lineWidth > 0) {
		context.lineWidth = lineWidth;
		context.strokeStyle = OUTLINE;
		context.stroke();
	}
}

/** A straight bar between two points in the world, such as a gun barrel, mast or pole */
export function drawBar(
	context: CanvasRenderingContext2D,
	view: IsoView,
	from: { x: number; y: number; z: number },
	to: { x: number; y: number; z: number },
	color: string,
	width: number
) {
	const a = view.project(from.x, from.y, from.z);
	const b = view.project(to.x, to.y, to.z);
	context.lineCap = 'round';
	context.strokeStyle = OUTLINE;
	context.lineWidth = width + 0.07;
	context.beginPath();
	context.moveTo(a.x, a.y);
	context.lineTo(b.x, b.y);
	context.stroke();
	context.strokeStyle = color;
	context.lineWidth = width;
	context.stroke();
	context.lineCap = 'butt';
}

/** The flat diamond of a footprint on the ground, for tiles, shadows and placement markers */
export function footprintPath(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	w: number,
	h: number,
	z = 0
) {
	const p = view.project;
	const corners = [p(x, y, z), p(x + w, y, z), p(x + w, y + h, z), p(x, y + h, z)];
	context.beginPath();
	context.moveTo(corners[0].x, corners[0].y);
	for (let index = 1; index < corners.length; index++)
		context.lineTo(corners[index].x, corners[index].y);
	context.closePath();
}

/** A soft ground shadow under a building, offset a little away from the light */
export function drawShadow(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	w: number,
	h: number
) {
	context.save();
	context.globalAlpha = 0.18;
	footprintPath(context, view, x + 0.1, y + 0.1, w + 0.15, h + 0.15);
	context.fillStyle = OUTLINE;
	context.fill();
	context.restore();
}

/*
 * Isometric drawings of the enemy base: the headquarters, the guns, the depots and the mines. Every
 * building is a few solid blocks, bars and blobs from iso.ts, so it keeps its outline whatever the
 * zoom. A building is described by its footprint in grid cells; the picture rises above it.
 */
import type { Building } from './battle.js';
import type { BuildingKind, IslandTheme } from './config.js';
import {
	drawBar,
	drawBlob,
	drawBox,
	drawCylinder,
	drawRoof,
	drawShadow,
	paletteOf,
	shade,
	type IsoView
} from './iso.js';
import {
	BANNER_SLATE,
	EXPLOSION_YELLOW,
	FLARE_ORANGE,
	INK,
	KHAKI,
	MUSTARD,
	PAPER,
	SAND_DARK,
	SMOKE,
	STEEL,
	TIE_RED
} from './palette.js';

/** What the art needs to know about a structure: where it stands and how big it is */
export interface Placement {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A panel on the south-west wall of a block (the plane y = yPlane), from x0 to x1 and z0 to z1 */
export function wallLeft(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x0: number,
	x1: number,
	yPlane: number,
	z0: number,
	z1: number,
	fill: string
) {
	const p = view.project;
	context.beginPath();
	context.moveTo(p(x0, yPlane, z1).x, p(x0, yPlane, z1).y);
	context.lineTo(p(x1, yPlane, z1).x, p(x1, yPlane, z1).y);
	context.lineTo(p(x1, yPlane, z0).x, p(x1, yPlane, z0).y);
	context.lineTo(p(x0, yPlane, z0).x, p(x0, yPlane, z0).y);
	context.closePath();
	context.fillStyle = fill;
	context.fill();
}

/** A panel on the south-east wall of a block (the plane x = xPlane), from y0 to y1 and z0 to z1 */
export function wallRight(
	context: CanvasRenderingContext2D,
	view: IsoView,
	xPlane: number,
	y0: number,
	y1: number,
	z0: number,
	z1: number,
	fill: string
) {
	const p = view.project;
	context.beginPath();
	context.moveTo(p(xPlane, y0, z1).x, p(xPlane, y0, z1).y);
	context.lineTo(p(xPlane, y1, z1).x, p(xPlane, y1, z1).y);
	context.lineTo(p(xPlane, y1, z0).x, p(xPlane, y1, z0).y);
	context.lineTo(p(xPlane, y0, z0).x, p(xPlane, y0, z0).y);
	context.closePath();
	context.fillStyle = fill;
	context.fill();
}

/** A pole with a waving pennant on top; shared by the enemy and the home headquarters */
export function drawFlag(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	z: number,
	height: number,
	color: string,
	timeMs: number,
	size = 1
) {
	drawBar(context, view, { x, y, z }, { x, y, z: z + height }, STEEL, 0.07);
	const top = view.project(x, y, z + height);
	const wave = Math.sin(timeMs / 260) * 0.07 * size;
	context.beginPath();
	context.moveTo(top.x, top.y);
	context.lineTo(top.x + 0.62 * size, top.y + 0.1 * size + wave);
	context.lineTo(top.x, top.y + 0.28 * size);
	context.closePath();
	context.fillStyle = color;
	context.fill();
	context.lineWidth = 0.04;
	context.strokeStyle = INK;
	context.stroke();
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
	context.beginPath();
	for (let point = 0; point < 10; point++) {
		const angle = -Math.PI / 2 + (point * Math.PI) / 5;
		const r = point % 2 === 0 ? radius : radius * 0.45;
		context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
	}
	context.closePath();
	context.fillStyle = EXPLOSION_YELLOW;
	context.fill();
	context.lineWidth = 0.03;
	context.strokeStyle = INK;
	context.stroke();
}

function drawEnemyHq(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const { x, y, width: w, height: h } = b;
	drawBox(context, view, x + 0.06, y + 0.06, w - 0.12, h - 0.12, 0, 0.85, paletteOf(BANNER_SLATE));
	// A strip of windows and the door on the south-west wall
	const wallY = y + h - 0.06;
	for (const t of [0.22, 0.62]) {
		wallLeft(context, view, x + w * t, x + w * t + 0.28, wallY, 0.42, 0.68, '#cfe6f5');
	}
	wallLeft(context, view, x + w * 0.42, x + w * 0.42 + 0.3, wallY, 0, 0.36, INK);
	drawBox(context, view, x + 0.42, y + 0.42, w - 0.84, h - 0.84, 0.85, 1.3, paletteOf(STEEL));
	drawRoof(context, view, x + 0.36, y + 0.36, w - 0.72, h - 0.72, 1.3, 0.22, paletteOf(TIE_RED));
	const star = view.project(x + w / 2, y + h - 0.06, 0.62);
	drawStar(context, star.x, star.y, 0.17);
	drawFlag(context, view, x + w / 2, y + h / 2, 1.5, 0.75, TIE_RED, timeMs);
}

function drawCannonArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.1, b.y + 0.1, 0.8, 0.8, 0, 0.26, paletteOf(KHAKI));
	drawCylinder(context, view, cx, cy, 0.24, 0.26, 0.46, paletteOf(STEEL));
	drawBar(
		context,
		view,
		{ x: cx, y: cy, z: 0.42 },
		{ x: cx - 0.05, y: cy + 0.62, z: 0.5 },
		STEEL,
		0.12
	);
}

function drawSniperArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.3, b.y + 0.3, 0.4, 0.4, 0, 0.95, paletteOf(BANNER_SLATE));
	drawBox(context, view, b.x + 0.18, b.y + 0.18, 0.64, 0.64, 0.95, 1.08, paletteOf(STEEL));
	drawBar(context, view, { x: cx, y: cy, z: 1.2 }, { x: cx, y: cy + 0.5, z: 1.28 }, INK, 0.06);
	drawBlob(context, view, cx, cy, 1.22, 0.07, EXPLOSION_YELLOW);
}

function sandbags(
	context: CanvasRenderingContext2D,
	view: IsoView,
	cx: number,
	cy: number,
	radius: number,
	count: number
) {
	// A horseshoe of bags that opens towards the beach (the +y side of the plain view), back to front
	const bags: { x: number; y: number }[] = [];
	for (let bag = 0; bag < count; bag++) {
		const angle = -Math.PI / 2 + (bag / (count - 1)) * Math.PI;
		bags.push({ x: cx + Math.sin(angle) * radius, y: cy - Math.cos(angle) * radius });
	}
	bags
		.sort((a, c) => a.x + a.y - (c.x + c.y))
		.forEach((bag) => drawBlob(context, view, bag.x, bag.y, 0.1, 0.17, KHAKI, 0.04));
}

function drawMgArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.14, 0, 0.3, paletteOf(STEEL));
	drawBar(context, view, { x: cx, y: cy, z: 0.34 }, { x: cx, y: cy + 0.5, z: 0.36 }, STEEL, 0.08);
	sandbags(context, view, cx, cy - 0.1, 0.34, 6);
}

function drawMortarArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.26, 0, 0.12, paletteOf(STEEL));
	drawBar(
		context,
		view,
		{ x: cx + 0.04, y: cy - 0.04, z: 0.1 },
		{ x: cx - 0.1, y: cy + 0.12, z: 0.8 },
		STEEL,
		0.16
	);
	drawBlob(context, view, cx - 0.1, cy + 0.12, 0.82, 0.09, INK);
	sandbags(context, view, cx, cy - 0.12, 0.38, 7);
}

function drawFpvArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.25, b.y + 0.25, 0.5, 0.5, 0, 0.36, paletteOf(STEEL));
	drawBar(context, view, { x: cx, y: cy, z: 0.36 }, { x: cx, y: cy, z: 1.15 }, INK, 0.07);
	drawBlob(context, view, cx, cy, 1.18, 0.09, EXPLOSION_YELLOW);
	// A drone circles the mast: an X of rotors with a red eye
	const orbit = timeMs / 520;
	const dx = cx + Math.cos(orbit) * 0.55;
	const dy = cy + Math.sin(orbit) * 0.55;
	const drone = view.project(dx, dy, 1.4 + Math.sin(orbit * 2) * 0.05);
	context.strokeStyle = INK;
	context.lineWidth = 0.05;
	context.beginPath();
	context.moveTo(drone.x - 0.14, drone.y - 0.05);
	context.lineTo(drone.x + 0.14, drone.y + 0.05);
	context.moveTo(drone.x + 0.14, drone.y - 0.05);
	context.lineTo(drone.x - 0.14, drone.y + 0.05);
	context.stroke();
	context.beginPath();
	context.arc(drone.x, drone.y, 0.06, 0, Math.PI * 2);
	context.fillStyle = TIE_RED;
	context.fill();
}

function drawAirArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.14, b.y + 0.14, 0.72, 0.72, 0, 0.3, paletteOf(KHAKI));
	drawCylinder(context, view, cx, cy, 0.2, 0.3, 0.42, paletteOf(STEEL));
	for (const offset of [-0.2, 0, 0.2]) {
		drawBar(
			context,
			view,
			{ x: cx + offset, y: cy + offset * 0.5, z: 0.4 },
			{ x: cx + offset, y: cy + 0.24 + offset * 0.5, z: 0.98 },
			STEEL,
			0.09
		);
		drawBlob(context, view, cx + offset, cy + 0.24 + offset * 0.5, 1.0, 0.07, TIE_RED);
	}
}

function drawFlameArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx - 0.2, cy - 0.12, 0.17, 0, 0.5, paletteOf(TIE_RED));
	drawCylinder(context, view, cx + 0.2, cy - 0.12, 0.17, 0, 0.5, paletteOf(MUSTARD));
	drawBar(context, view, { x: cx, y: cy, z: 0.4 }, { x: cx, y: cy + 0.48, z: 0.34 }, INK, 0.1);
	const tip = view.project(cx, cy + 0.52, 0.34);
	const flicker = 0.07 + Math.sin(timeMs / 90) * 0.025;
	context.beginPath();
	context.moveTo(tip.x - 0.02, tip.y + 0.05);
	context.lineTo(tip.x - 0.1 - flicker, tip.y - 0.1 - flicker * 2);
	context.lineTo(tip.x + 0.08, tip.y - 0.02);
	context.closePath();
	context.fillStyle = FLARE_ORANGE;
	context.fill();
	drawBlob(context, view, cx, cy + 0.52, 0.38, flicker, EXPLOSION_YELLOW, 0);
}

function drawDepotArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	drawBox(context, view, b.x + 0.08, b.y + 0.36, 0.52, 0.52, 0, 0.46, paletteOf(MUSTARD));
	drawBox(context, view, b.x + 0.5, b.y + 0.1, 0.42, 0.42, 0, 0.36, paletteOf(SAND_DARK));
	drawBox(context, view, b.x + 0.16, b.y + 0.44, 0.36, 0.36, 0.46, 0.7, paletteOf(SAND_DARK));
	// Strapping on the big crate
	wallLeft(context, view, b.x + 0.08, b.x + 0.6, b.y + 0.88, 0.18, 0.24, INK);
}

/** A mine is a low disc in the ground; the kind tells the player what will hurt */
export function drawMineArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	kind: BuildingKind,
	x: number,
	y: number,
	timeMs: number,
	alpha = 1
) {
	const centre = view.project(x + 0.5, y + 0.5, 0.02);
	const rx = view.halfW * 0.34;
	const ry = view.halfH * 0.34;
	context.save();
	context.globalAlpha = alpha;
	// A scraped patch of dirt first, so the mine reads as dug in
	context.beginPath();
	context.ellipse(centre.x, centre.y + 0.02, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);
	context.fillStyle = 'rgba(80,60,30,0.35)';
	context.fill();
	const body = kind === 'mine-emp' ? '#2f4a7c' : kind === 'mine-at' ? STEEL : '#6b705a';
	context.beginPath();
	context.ellipse(centre.x, centre.y - 0.05, rx, ry, 0, 0, Math.PI * 2);
	context.fillStyle = shade(body, 0.1);
	context.fill();
	context.lineWidth = 0.04;
	context.strokeStyle = INK;
	context.stroke();
	if (kind === 'mine-at') {
		context.beginPath();
		context.ellipse(centre.x, centre.y - 0.05, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
		context.strokeStyle = TIE_RED;
		context.lineWidth = 0.05;
		context.stroke();
	} else if (kind === 'mine-emp') {
		const pulse = 0.5 + Math.sin(timeMs / 260) * 0.5;
		context.beginPath();
		context.moveTo(centre.x + 0.02, centre.y - 0.2);
		context.lineTo(centre.x - 0.07, centre.y - 0.04);
		context.lineTo(centre.x + 0.01, centre.y - 0.04);
		context.lineTo(centre.x - 0.03, centre.y + 0.1);
		context.lineTo(centre.x + 0.09, centre.y - 0.08);
		context.lineTo(centre.x + 0.01, centre.y - 0.08);
		context.closePath();
		context.fillStyle = `rgba(160,230,255,${0.65 + pulse * 0.35})`;
		context.fill();
	} else {
		// Three little prongs around the fuse
		for (let prong = 0; prong < 3; prong++) {
			const angle = (prong / 3) * Math.PI * 2 + Math.PI / 6;
			context.beginPath();
			context.arc(
				centre.x + Math.cos(angle) * rx * 0.55,
				centre.y - 0.05 + Math.sin(angle) * ry * 0.55,
				0.035,
				0,
				Math.PI * 2
			);
			context.fillStyle = TIE_RED;
			context.fill();
		}
	}
	context.restore();
}

/** What is left of a destroyed building: a dark slab, broken blocks and a thread of smoke */
export function drawRubbleArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const { x, y, width: w, height: h } = b;
	drawShadow(context, view, x, y, w, h);
	drawBox(context, view, x + 0.08, y + 0.08, w - 0.16, h - 0.16, 0, 0.06, paletteOf(SMOKE));
	drawBox(context, view, x + w * 0.15, y + h * 0.2, w * 0.35, h * 0.3, 0.06, 0.2, paletteOf(STEEL));
	drawBox(context, view, x + w * 0.5, y + h * 0.5, w * 0.3, h * 0.28, 0.06, 0.14, paletteOf(SMOKE));
	context.fillStyle = SMOKE;
	for (let puff = 0; puff < 3; puff++) {
		const rise = ((timeMs / 1600 + puff / 3) % 1) * 0.9;
		const at = view.project(
			x + w / 2 + Math.sin(puff * 2 + timeMs / 1200) * 0.12,
			y + h / 2,
			0.25 + rise
		);
		context.globalAlpha = 0.35 * (1 - rise / 0.9);
		context.beginPath();
		context.arc(at.x, at.y, 0.17 + rise * 0.12, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
}

/** The standing building, without its damage smoke, health bar and hit flash */
const ORC_WOOD = '#5a4632';
const ORC_GREEN = '#5f8a3a';
const BONE = '#e8e2c8';

/** The orc stronghold: a palisade of spiked logs around a dark hall under a green banner and a skull */
function drawOrcHq(context: CanvasRenderingContext2D, view: IsoView, b: Placement, timeMs: number) {
	const { x, y, width: w, height: h } = b;
	drawBox(context, view, x + 0.04, y + 0.04, w - 0.08, h - 0.08, 0, 0.5, paletteOf(ORC_WOOD));
	// Spikes along the front of the palisade
	for (let step = 0; step < 8; step++) {
		const t = (step + 0.5) / 8;
		drawRoof(
			context,
			view,
			x + 0.06 + t * (w - 0.3),
			y + h - 0.2,
			0.18,
			0.16,
			0.5,
			0.34,
			paletteOf(BONE),
			0.03
		);
		drawRoof(
			context,
			view,
			x + w - 0.26,
			y + 0.06 + t * (h - 0.3),
			0.16,
			0.18,
			0.5,
			0.34,
			paletteOf(BONE),
			0.03
		);
	}
	drawBox(context, view, x + 0.4, y + 0.4, w - 0.8, h - 0.8, 0.5, 1.15, paletteOf('#3f3226'));
	drawRoof(context, view, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 1.15, 0.45, paletteOf(ORC_GREEN));
	// Horns on the roof and a skull over the gate
	drawBar(
		context,
		view,
		{ x: x + 0.5, y: y + h / 2, z: 1.5 },
		{ x: x + 0.25, y: y + h / 2 - 0.2, z: 2.0 },
		BONE,
		0.09
	);
	drawBar(
		context,
		view,
		{ x: x + w - 0.5, y: y + h / 2, z: 1.5 },
		{ x: x + w - 0.25, y: y + h / 2 + 0.2, z: 2.0 },
		BONE,
		0.09
	);
	const skull = view.project(x + w / 2, y + h - 0.1, 0.78);
	context.beginPath();
	context.arc(skull.x, skull.y, 0.17, 0, Math.PI * 2);
	context.fillStyle = BONE;
	context.fill();
	context.lineWidth = 0.04;
	context.strokeStyle = INK;
	context.stroke();
	context.fillStyle = INK;
	context.fillRect(skull.x - 0.09, skull.y - 0.04, 0.06, 0.07);
	context.fillRect(skull.x + 0.03, skull.y - 0.04, 0.06, 0.07);
	drawFlag(context, view, x + w / 2, y + h / 2, 1.6, 0.8, ORC_GREEN, timeMs);
}

function drawCatapultArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.15, b.y + 0.2, 0.7, 0.55, 0.12, 0.3, paletteOf(ORC_WOOD));
	for (const side of [-0.32, 0.32]) {
		drawCylinder(context, view, cx + side, cy, 0.17, 0, 0.3, paletteOf('#3f3226'));
	}
	// The throwing arm, cocked back, with a bucket of boulders at the end
	drawBar(
		context,
		view,
		{ x: cx, y: cy - 0.1, z: 0.3 },
		{ x: cx, y: cy + 0.5, z: 1.0 },
		ORC_WOOD,
		0.1
	);
	drawBlob(context, view, cx, cy + 0.5, 1.04, 0.13, '#7a7a7a');
	drawBar(
		context,
		view,
		{ x: cx, y: cy - 0.12, z: 0.3 },
		{ x: cx, y: cy - 0.12, z: 0.62 },
		BONE,
		0.07
	);
}

function drawBallistaArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.28, b.y + 0.2, 0.44, 0.6, 0, 0.3, paletteOf(ORC_WOOD));
	// A huge bow across the front and a bolt laid on the rail pointing at the beach
	drawBar(
		context,
		view,
		{ x: cx - 0.45, y: cy + 0.25, z: 0.5 },
		{ x: cx, y: cy + 0.05, z: 0.55 },
		BONE,
		0.07
	);
	drawBar(
		context,
		view,
		{ x: cx + 0.45, y: cy + 0.25, z: 0.5 },
		{ x: cx, y: cy + 0.05, z: 0.55 },
		BONE,
		0.07
	);
	drawBar(
		context,
		view,
		{ x: cx - 0.45, y: cy + 0.25, z: 0.5 },
		{ x: cx + 0.45, y: cy + 0.25, z: 0.5 },
		'#8a8a8a',
		0.03
	);
	drawBar(
		context,
		view,
		{ x: cx, y: cy - 0.1, z: 0.42 },
		{ x: cx, y: cy + 0.55, z: 0.5 },
		INK,
		0.06
	);
	drawBlob(context, view, cx, cy + 0.58, 0.5, 0.06, STEEL);
}

const ICE = '#bcd9e6';
const ICE_DARK = '#7fa9c0';
const THATCH = '#b89a4a';
const SANDSTONE = '#d8b878';

function drawIceCannonArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.1, b.y + 0.1, 0.8, 0.8, 0, 0.28, paletteOf(ICE));
	drawCylinder(context, view, cx, cy, 0.24, 0.28, 0.46, paletteOf(ICE_DARK));
	drawBar(
		context,
		view,
		{ x: cx, y: cy, z: 0.42 },
		{ x: cx, y: cy + 0.62, z: 0.5 },
		'#e6f4fb',
		0.13
	);
	drawBlob(context, view, cx, cy + 0.66, 0.52, 0.08, '#9fe3ff');
	drawRoof(context, view, cx - 0.14, cy - 0.34, 0.28, 0.28, 0.28, 0.35, paletteOf('#e6f4fb'), 0.03);
}

function drawIceSpireArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.2, b.y + 0.2, 0.6, 0.6, 0, 0.2, paletteOf(ICE_DARK));
	drawRoof(context, view, b.x + 0.22, b.y + 0.22, 0.56, 0.56, 0.2, 0.9, paletteOf(ICE));
	drawRoof(context, view, b.x + 0.3, b.y + 0.3, 0.4, 0.4, 0.75, 0.75, paletteOf('#e6f4fb'));
	const glow = 0.5 + Math.sin(timeMs / 400) * 0.25;
	drawBlob(context, view, cx, cy, 1.55, 0.07 + glow * 0.04, '#9fe3ff', 0.02);
}

function drawDartHutArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	for (const [dx, dy] of [
		[-0.28, -0.28],
		[0.28, -0.28],
		[-0.28, 0.28],
		[0.28, 0.28]
	] as const) {
		drawBar(
			context,
			view,
			{ x: cx + dx, y: cy + dy, z: 0 },
			{ x: cx + dx, y: cy + dy, z: 0.42 },
			'#6b4526',
			0.08
		);
	}
	drawBox(context, view, b.x + 0.12, b.y + 0.12, 0.76, 0.76, 0.4, 0.5, paletteOf('#8a5a2b'));
	drawBox(context, view, b.x + 0.25, b.y + 0.25, 0.5, 0.5, 0.5, 0.78, paletteOf('#a8793c'));
	drawRoof(context, view, b.x + 0.08, b.y + 0.08, 0.84, 0.84, 0.78, 0.5, paletteOf(THATCH));
	drawBar(
		context,
		view,
		{ x: cx, y: cy + 0.1, z: 0.64 },
		{ x: cx, y: cy + 0.62, z: 0.7 },
		INK,
		0.05
	);
}

function drawTotemArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.2, 0, 0.45, paletteOf('#7a4e26'));
	drawCylinder(context, view, cx, cy, 0.17, 0.45, 0.85, paletteOf('#c0392b'));
	drawCylinder(context, view, cx, cy, 0.15, 0.85, 1.2, paletteOf('#3f9a4a'));
	const eye = view.project(cx, cy + 0.15, 1.02);
	context.fillStyle = PAPER;
	context.beginPath();
	context.arc(eye.x - 0.05, eye.y, 0.04, 0, Math.PI * 2);
	context.arc(eye.x + 0.07, eye.y, 0.04, 0, Math.PI * 2);
	context.fill();
	const glow = 0.5 + Math.sin(timeMs / 300) * 0.5;
	drawBlob(context, view, cx, cy, 1.32, 0.1 + glow * 0.03, EXPLOSION_YELLOW);
}

function drawSandMortarArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.3, 0, 0.12, paletteOf('#c9a35a'));
	drawBar(
		context,
		view,
		{ x: cx, y: cy - 0.04, z: 0.1 },
		{ x: cx, y: cy + 0.14, z: 0.82 },
		'#8a6a2b',
		0.17
	);
	drawBlob(context, view, cx, cy + 0.14, 0.84, 0.09, INK);
	sandbags(context, view, cx, cy - 0.12, 0.4, 7);
}

function drawScorpionArt(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawRoof(context, view, b.x + 0.1, b.y + 0.1, 0.8, 0.8, 0, 0.32, paletteOf('#c9a35a'));
	drawBlob(context, view, cx, cy, 0.38, 0.17, '#4a2a1e');
	for (const side of [-0.18, 0.18]) {
		drawBar(
			context,
			view,
			{ x: cx + side, y: cy + 0.05, z: 0.38 },
			{ x: cx + side * 1.8, y: cy + 0.3, z: 0.42 },
			'#4a2a1e',
			0.06
		);
		drawBlob(context, view, cx + side * 1.9, cy + 0.32, 0.43, 0.06, '#6b3a28', 0.025);
	}
	// A tail that arches over its back and twitches
	const sway = Math.sin(timeMs / 350) * 0.06;
	drawBar(
		context,
		view,
		{ x: cx, y: cy - 0.12, z: 0.4 },
		{ x: cx + sway, y: cy - 0.32, z: 0.78 },
		'#4a2a1e',
		0.07
	);
	drawBar(
		context,
		view,
		{ x: cx + sway, y: cy - 0.32, z: 0.78 },
		{ x: cx + sway, y: cy - 0.08, z: 0.98 },
		'#4a2a1e',
		0.06
	);
	drawBlob(context, view, cx + sway, cy - 0.06, 1.0, 0.05, TIE_RED, 0.02);
}

function drawIceHq(context: CanvasRenderingContext2D, view: IsoView, b: Placement, timeMs: number) {
	const { x, y, width: w, height: h } = b;
	drawBox(context, view, x + 0.06, y + 0.06, w - 0.12, h - 0.12, 0, 0.8, paletteOf(ICE));
	wallLeft(context, view, x + w * 0.4, x + w * 0.4 + 0.3, y + h - 0.06, 0, 0.4, INK);
	drawBox(context, view, x + 0.4, y + 0.4, w - 0.8, h - 0.8, 0.8, 1.2, paletteOf('#e6f4fb'));
	drawRoof(context, view, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 1.2, 0.8, paletteOf(ICE_DARK));
	drawRoof(context, view, x + 0.02, y + 0.02, 0.4, 0.4, 0.8, 0.9, paletteOf('#e6f4fb'), 0.03);
	drawRoof(
		context,
		view,
		x + w - 0.42,
		y + h - 0.42,
		0.4,
		0.4,
		0.8,
		0.9,
		paletteOf('#e6f4fb'),
		0.03
	);
	drawFlag(context, view, x + w / 2, y + h / 2, 2.0, 0.7, '#4fa8d8', timeMs);
}

function drawJungleHq(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const { x, y, width: w, height: h } = b;
	for (const [dx, dy] of [
		[0.2, 0.2],
		[w - 0.2, 0.2],
		[0.2, h - 0.2],
		[w - 0.2, h - 0.2]
	] as const) {
		drawBar(
			context,
			view,
			{ x: x + dx, y: y + dy, z: 0 },
			{ x: x + dx, y: y + dy, z: 0.5 },
			'#6b4526',
			0.1
		);
	}
	drawBox(context, view, x + 0.05, y + 0.05, w - 0.1, h - 0.1, 0.45, 0.6, paletteOf('#8a5a2b'));
	drawBox(context, view, x + 0.3, y + 0.3, w - 0.6, h - 0.6, 0.6, 1.2, paletteOf('#a8793c'));
	wallLeft(context, view, x + w * 0.38, x + w * 0.38 + 0.3, y + h - 0.3, 0.6, 1.0, INK);
	drawRoof(context, view, x + 0.1, y + 0.1, w - 0.2, h - 0.2, 1.2, 0.8, paletteOf(THATCH));
	drawFlag(context, view, x + w / 2, y + h / 2, 1.9, 0.7, '#3f9a4a', timeMs);
}

function drawDesertHq(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	timeMs: number
) {
	const { x, y, width: w, height: h } = b;
	drawBox(context, view, x + 0.06, y + 0.06, w - 0.12, h - 0.12, 0, 0.85, paletteOf(SANDSTONE));
	wallLeft(context, view, x + w * 0.4, x + w * 0.4 + 0.3, y + h - 0.06, 0, 0.45, INK);
	for (const t of [0.2, 0.6]) {
		wallLeft(context, view, x + w * t, x + w * t + 0.22, y + h - 0.06, 0.52, 0.72, '#7a5a2b');
	}
	drawBox(context, view, x + 0.45, y + 0.45, w - 0.9, h - 0.9, 0.85, 1.2, paletteOf('#e8cf95'));
	drawCylinder(context, view, x + w / 2, y + h / 2, 0.38, 1.2, 1.5, paletteOf('#e8cf95'));
	drawBlob(context, view, x + w / 2, y + h / 2, 1.66, 0.3, '#d9a441', 0.04);
	drawFlag(context, view, x + w / 2, y + h / 2, 1.9, 0.6, '#e08a1e', timeMs);
}

export function drawEnemyBuilding(
	context: CanvasRenderingContext2D,
	view: IsoView,
	building: Building,
	timeMs: number,
	theme?: IslandTheme
) {
	drawShadow(context, view, building.x, building.y, building.width, building.height);
	switch (building.kind) {
		case 'hq':
			if (theme === 'orc') drawOrcHq(context, view, building, timeMs);
			else if (theme === 'ice') drawIceHq(context, view, building, timeMs);
			else if (theme === 'jungle') drawJungleHq(context, view, building, timeMs);
			else if (theme === 'desert') drawDesertHq(context, view, building, timeMs);
			else drawEnemyHq(context, view, building, timeMs);
			break;
		case 'ice-cannon':
			drawIceCannonArt(context, view, building);
			break;
		case 'ice-spire':
			drawIceSpireArt(context, view, building, timeMs);
			break;
		case 'dart-hut':
			drawDartHutArt(context, view, building);
			break;
		case 'totem':
			drawTotemArt(context, view, building, timeMs);
			break;
		case 'sand-mortar':
			drawSandMortarArt(context, view, building);
			break;
		case 'scorpion-nest':
			drawScorpionArt(context, view, building, timeMs);
			break;
		case 'catapult':
			drawCatapultArt(context, view, building);
			break;
		case 'ballista':
			drawBallistaArt(context, view, building);
			break;
		case 'field-cannon':
			drawCannonArt(context, view, building);
			break;
		case 'mortar':
			drawMortarArt(context, view, building);
			break;
		case 'fpv-nest':
			drawFpvArt(context, view, building, timeMs);
			break;
		case 'air-defence':
			drawAirArt(context, view, building);
			break;
		case 'sniper':
			drawSniperArt(context, view, building);
			break;
		case 'mg':
			drawMgArt(context, view, building);
			break;
		case 'flame':
			drawFlameArt(context, view, building, timeMs);
			break;
		case 'depot':
			drawDepotArt(context, view, building);
			break;
		default:
			break;
	}
}

/** A white wash over a building's footprint and walls for the frame after it is hit */
export function drawHitFlash(
	context: CanvasRenderingContext2D,
	view: IsoView,
	b: Placement,
	alpha: number,
	height = 0.7
) {
	context.save();
	context.globalAlpha = alpha;
	drawBox(context, view, b.x, b.y, b.width, b.height, 0, height, {
		top: PAPER,
		left: PAPER,
		right: PAPER
	});
	context.restore();
}

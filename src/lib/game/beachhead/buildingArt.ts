/*
 * Isometric drawings of the enemy base: the headquarters, the guns, the depots and the mines. Every
 * building is a few solid blocks, bars and blobs from iso.ts, so it keeps its outline whatever the
 * zoom. A building is described by its footprint in grid cells; the picture rises above it.
 */
import type { Building } from './battle.js';
import type { BuildingKind } from './config.js';
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
		{ x: cx - 0.62, y: cy - 0.05, z: 0.5 },
		STEEL,
		0.12
	);
}

function drawSniperArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawBox(context, view, b.x + 0.3, b.y + 0.3, 0.4, 0.4, 0, 0.95, paletteOf(BANNER_SLATE));
	drawBox(context, view, b.x + 0.18, b.y + 0.18, 0.64, 0.64, 0.95, 1.08, paletteOf(STEEL));
	drawBar(context, view, { x: cx, y: cy, z: 1.2 }, { x: cx - 0.5, y: cy, z: 1.28 }, INK, 0.06);
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
	// A horseshoe of bags that opens towards the beach (the -x side), drawn back to front
	const bags: { x: number; y: number }[] = [];
	for (let bag = 0; bag < count; bag++) {
		const angle = -Math.PI / 2 + (bag / (count - 1)) * Math.PI;
		bags.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
	}
	bags
		.sort((a, c) => a.x + a.y - (c.x + c.y))
		.forEach((bag) => drawBlob(context, view, bag.x, bag.y, 0.1, 0.17, KHAKI, 0.04));
}

function drawMgArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.14, 0, 0.3, paletteOf(STEEL));
	drawBar(context, view, { x: cx, y: cy, z: 0.34 }, { x: cx - 0.5, y: cy, z: 0.36 }, STEEL, 0.08);
	sandbags(context, view, cx + 0.1, cy, 0.34, 6);
}

function drawMortarArt(context: CanvasRenderingContext2D, view: IsoView, b: Placement) {
	const cx = b.x + 0.5;
	const cy = b.y + 0.5;
	drawCylinder(context, view, cx, cy, 0.26, 0, 0.12, paletteOf(STEEL));
	drawBar(
		context,
		view,
		{ x: cx + 0.04, y: cy + 0.04, z: 0.1 },
		{ x: cx - 0.12, y: cy - 0.1, z: 0.8 },
		STEEL,
		0.16
	);
	drawBlob(context, view, cx - 0.12, cy - 0.1, 0.82, 0.09, INK);
	sandbags(context, view, cx + 0.12, cy, 0.38, 7);
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
			{ x: cx - offset * 0.5, y: cy + offset, z: 0.4 },
			{ x: cx - 0.24 - offset * 0.5, y: cy + offset, z: 0.98 },
			STEEL,
			0.09
		);
		drawBlob(context, view, cx - 0.24 - offset * 0.5, cy + offset, 1.0, 0.07, TIE_RED);
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
	drawCylinder(context, view, cx + 0.12, cy - 0.2, 0.17, 0, 0.5, paletteOf(TIE_RED));
	drawCylinder(context, view, cx + 0.12, cy + 0.2, 0.17, 0, 0.5, paletteOf(MUSTARD));
	drawBar(context, view, { x: cx, y: cy, z: 0.4 }, { x: cx - 0.48, y: cy, z: 0.34 }, INK, 0.1);
	const tip = view.project(cx - 0.52, cy, 0.34);
	const flicker = 0.07 + Math.sin(timeMs / 90) * 0.025;
	context.beginPath();
	context.moveTo(tip.x - 0.02, tip.y + 0.05);
	context.lineTo(tip.x - 0.1 - flicker, tip.y - 0.1 - flicker * 2);
	context.lineTo(tip.x + 0.08, tip.y - 0.02);
	context.closePath();
	context.fillStyle = FLARE_ORANGE;
	context.fill();
	drawBlob(context, view, cx - 0.52, cy, 0.38, flicker, EXPLOSION_YELLOW, 0);
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
export function drawEnemyBuilding(
	context: CanvasRenderingContext2D,
	view: IsoView,
	building: Building,
	timeMs: number
) {
	drawShadow(context, view, building.x, building.y, building.width, building.height);
	switch (building.kind) {
		case 'hq':
			drawEnemyHq(context, view, building, timeMs);
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

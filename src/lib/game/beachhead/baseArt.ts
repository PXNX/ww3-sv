/*
 * The shore base in isometric view: the island slab with its grid, the headquarters, training ground,
 * dojo, radar tower and eight warehouses, the mines and the landing craft moored at the pier. Every
 * building changes its look with its level in four steps, so a base that has grown is easy to tell
 * from a new one at a glance.
 */
import { wallLeft, wallRight, drawEnemyBuilding, drawFlag, drawMineArt } from './buildingArt.js';
import { isMine, type BuildingKind } from './config.js';
import { CRYSTAL_COLORS, type CrystalType } from './crystals.js';
import { drawResourceGlyph } from './resourceIcons.js';
import {
	BASE_COLS,
	BASE_ROWS,
	FOREST,
	HOUSES,
	MOUNTAIN,
	QUARRY,
	SAWMILL,
	boatDock,
	defaultLayout,
	footprintOf,
	positionOf,
	type BaseLayout,
	type Cell,
	type LayoutKey
} from './baseLayout.js';
import {
	createIsoView,
	depthOf,
	drawBar,
	drawBlob,
	drawBox,
	drawCylinder,
	drawRoof,
	drawShadow,
	footprintPath,
	onGround,
	paletteOf,
	shade,
	type IsoView
} from './iso.js';
import {
	BANNER_SLATE,
	DIRT,
	DISPLAY_FONT,
	EXPLOSION_YELLOW,
	GOLD,
	INK,
	IRON,
	KHAKI,
	MUSTARD,
	PAPER,
	SAND,
	SAND_DARK,
	SEA,
	SEA_DARK,
	STEEL,
	STONE,
	TIE_RED,
	WOOD
} from './palette.js';

export type HomeResource = 'wood' | 'stone' | 'iron' | 'gold';

/** The home island seen from the south, with water on every side and the pier on the right */
export const HOME_VIEW: IsoView = createIsoView(BASE_COLS, BASE_ROWS, {
	pad: 1.6,
	headroom: 2.4,
	depth: 1.1
});

/** The picture changes in four steps over a building's levels */
export function stageOf(level: number, max: number): 0 | 1 | 2 | 3 {
	const stage = Math.floor(((Math.max(1, level) - 1) / Math.max(1, max)) * 4);
	return Math.min(3, Math.max(0, stage)) as 0 | 1 | 2 | 3;
}

/** How tall each building stands, for badges and bars above it */
export function heightOf(key: LayoutKey, stage: number): number {
	if (key === 'bunker') return 0.8 + stage * 0.2;
	if (key === 'hq') return 2.1 + stage * 0.35;
	if (key === 'dojo') return 0.9 + stage * 0.6;
	if (key === 'radar') return 1.4 + stage * 0.5;
	if (key === 'training') return 1.0 + stage * 0.1;
	return 0.9 + stage * 0.2;
}

/** Every level makes a building a little bigger, so a base that has grown also looks it */
export function growthOf(level: number, perLevel = 0.04): number {
	return 1 + Math.min(12, Math.max(0, level - 1)) * perLevel;
}

/** Draws something scaled about a point on the ground, keeping its feet where they were */
function scaledAbout(
	context: CanvasRenderingContext2D,
	pivot: { x: number; y: number },
	factor: number,
	draw: () => void
) {
	context.save();
	context.translate(pivot.x, pivot.y);
	context.scale(factor, factor);
	context.translate(-pivot.x, -pivot.y);
	draw();
	context.restore();
}

export interface HomeScene {
	layout: BaseLayout;
	levelOf: (key: string) => number;
	maxOf: (key: string) => number;
	/** Fill of the warehouse stock of a resource, 0 to 1 */
	fillOf: (resource: HomeResource) => number;
	/** Progress 0 to 1 of a building that is being upgraded, or null */
	buildProgress: (key: string) => number | null;
	/** Progress 0 to 1 of a placed mine, gun or obstacle that a builder is raising a level, or null */
	defenseProgress?: (id: number) => number | null;
	/** The overcharge crystal socketed into a building (`hq`, `bunker`...) or a defence (`defense:<id>`), if any */
	crystalAt?: (target: string) => CrystalType | undefined;
	boatCount: number;
	/** The troops sitting in the boat with this number, as troop kinds */
	boatUnits: (index: number) => readonly string[];
	timeMs: number;
	/** Whether the grid and the move hints show */
	arranging: boolean;
	selected: { kind: 'building'; key: string } | { kind: 'mine'; id: number } | null;
	/** A building or mine being dragged, and the cell it would land on */
	drag: {
		item: { kind: 'building'; key: LayoutKey } | { kind: 'mine'; id: number };
		cell: Cell;
		valid: boolean;
	} | null;
}

const RESOURCE_COLOR: Record<HomeResource, string> = {
	wood: WOOD,
	stone: STONE,
	iron: IRON,
	gold: GOLD
};
const ROOF_COLOR: Record<HomeResource, string> = {
	wood: '#6b4526',
	stone: '#5b6572',
	iron: '#3b4048',
	gold: '#b8891a'
};

function resourceOf(key: LayoutKey): HomeResource {
	return (key.split('-')[1] as HomeResource) ?? 'wood';
}

/** Rows of small windows across one wall, evenly spaced */
function windowsLeft(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	width: number,
	yPlane: number,
	z0: number,
	z1: number,
	count: number,
	fill = '#cfe6f5'
) {
	const pitch = width / count;
	for (let index = 0; index < count; index++) {
		const x0 = x + pitch * index + pitch * 0.25;
		wallLeft(context, view, x0, x0 + pitch * 0.5, yPlane, z0, z1, fill);
	}
}

function windowsRight(
	context: CanvasRenderingContext2D,
	view: IsoView,
	xPlane: number,
	y: number,
	depth: number,
	z0: number,
	z1: number,
	count: number,
	fill = '#cfe6f5'
) {
	const pitch = depth / count;
	for (let index = 0; index < count; index++) {
		const y0 = y + pitch * index + pitch * 0.25;
		wallRight(context, view, xPlane, y0, y0 + pitch * 0.5, z0, z1, fill);
	}
}

function tower(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	size: number,
	height: number,
	wall: string,
	roof: string
) {
	drawBox(context, view, x, y, size, size, 0, height, paletteOf(wall));
	drawRoof(
		context,
		view,
		x - 0.08,
		y - 0.08,
		size + 0.16,
		size + 0.16,
		height,
		0.5,
		paletteOf(roof)
	);
}

function drawHq(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	stage: number,
	timeMs: number
) {
	const { x, y } = at;
	const wall = [WOOD, STONE, '#b7b2a6', '#f1ead8'][stage];
	const roof = ['#6b4526', TIE_RED, '#b0383d', GOLD][stage];
	const floors = [1, 2, 2, 3][stage];
	const body = [3.2, 3.4, 3.4, 3.4][stage];
	const inset = (5 - body) / 2;
	const floorHeight = 0.78;
	const top = floors * floorHeight;

	if (stage >= 2) tower(context, view, x + 0.15, y + 0.15, 0.85, top + 0.7, wall, roof);
	drawBox(context, view, x + inset, y + inset, body, body, 0.06, top, paletteOf(wall));
	for (let floor = 0; floor < floors; floor++) {
		const z0 = 0.2 + floor * floorHeight;
		windowsLeft(context, view, x + inset + 0.2, body - 0.4, y + inset + body, z0, z0 + 0.4, 3);
		windowsRight(context, view, x + inset + body, y + inset + 0.2, body - 0.4, z0, z0 + 0.4, 3);
	}
	// The door, centred on the south-west wall
	wallLeft(
		context,
		view,
		x + inset + body / 2 - 0.25,
		x + inset + body / 2 + 0.25,
		y + inset + body,
		0.06,
		0.62,
		stage === 3 ? GOLD : INK
	);
	drawRoof(
		context,
		view,
		x + inset - 0.12,
		y + inset - 0.12,
		body + 0.24,
		body + 0.24,
		top,
		0.55 + stage * 0.1,
		paletteOf(roof)
	);
	if (stage >= 2) {
		tower(context, view, x + 4.0, y + 0.15, 0.85, top + 0.7, wall, roof);
		tower(context, view, x + 0.15, y + 4.0, 0.85, top + 0.7, wall, roof);
		tower(context, view, x + 4.0, y + 4.0, 0.85, top + 0.7, wall, roof);
	}
	// A spire and one banner per stage, so the top of a grown headquarters is busy
	const centre = { x: x + 2.5, y: y + 2.5 };
	const apex = top + 0.55 + stage * 0.1;
	drawFlag(
		context,
		view,
		centre.x,
		centre.y,
		apex,
		0.9 + stage * 0.15,
		TIE_RED,
		timeMs,
		1 + stage * 0.15
	);
	if (stage >= 1)
		drawFlag(context, view, x + 0.45, y + 4.55, 0.06, 1.1, BANNER_SLATE, timeMs + 400);
	if (stage >= 3) {
		drawBlob(context, view, centre.x, centre.y, apex + 0.05, 0.16, GOLD);
		drawFlag(context, view, x + 4.55, y + 4.55, 0.06, 1.1, EXPLOSION_YELLOW, timeMs + 900);
	}
}

function drawTraining(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	stage: number,
	timeMs: number
) {
	const { x, y } = at;
	const length = [1.5, 1.8, 2.2, 2.4][stage];
	const height = [0.5, 0.6, 0.78, 0.92][stage];
	drawBox(context, view, x + 0.15, y + 0.15, length, 1.1, 0.05, height, paletteOf(KHAKI));
	windowsLeft(
		context,
		view,
		x + 0.25,
		length - 0.2,
		y + 1.25,
		0.2,
		height - 0.12,
		Math.max(2, Math.round(length))
	);
	drawRoof(context, view, x + 0.1, y + 0.1, length + 0.1, 1.2, height, 0.3, paletteOf(STEEL));
	if (stage >= 2) {
		drawBox(
			context,
			view,
			x + 0.15 + length + 0.1,
			y + 0.15,
			0.55,
			0.9,
			0.05,
			height - 0.15,
			paletteOf(BANNER_SLATE)
		);
	}
	// Target posts out on the yard, one more with every step
	for (let post = 0; post < 2 + stage; post++) {
		const px = x + 0.5 + post * 0.6;
		const py = y + 2.35;
		drawBar(context, view, { x: px, y: py, z: 0.05 }, { x: px, y: py, z: 0.6 }, WOOD, 0.06);
		drawBlob(context, view, px, py, 0.62, 0.15, post % 2 === 0 ? TIE_RED : PAPER, 0.03);
		drawBlob(context, view, px, py, 0.62, 0.06, TIE_RED, 0);
	}
	if (stage >= 1) {
		for (let bag = 0; bag < 3 + stage; bag++) {
			drawBlob(
				context,
				view,
				x + 2.4 + (bag % 2) * 0.2,
				y + 0.5 + bag * 0.3,
				0.12,
				0.17,
				KHAKI,
				0.03
			);
		}
	}
	if (stage >= 3) drawFlag(context, view, x + 2.7, y + 0.35, 0.05, 1.3, TIE_RED, timeMs);
}

function drawDojo(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	stage: number,
	timeMs: number
) {
	const { x, y } = at;
	const tiers = stage + 1;
	let z = 0;
	for (let tier = 0; tier < tiers; tier++) {
		const size = 2.2 - tier * 0.4;
		const inset = (3 - size) / 2;
		const height = 0.5;
		drawBox(context, view, x + inset, y + inset, size, size, z, z + height, paletteOf('#f1ead8'));
		windowsLeft(
			context,
			view,
			x + inset + 0.15,
			size - 0.3,
			y + inset + size,
			z + 0.14,
			z + 0.38,
			2,
			INK
		);
		drawRoof(
			context,
			view,
			x + inset - 0.22,
			y + inset - 0.22,
			size + 0.44,
			size + 0.44,
			z + height,
			0.3,
			paletteOf(stage >= 3 ? GOLD : TIE_RED)
		);
		z += height + 0.18;
	}
	drawBlob(context, view, x + 1.5, y + 1.5, z + 0.1, 0.12, EXPLOSION_YELLOW);
	// Paper lanterns by the steps
	for (const lantern of [0.25, 2.55]) {
		drawBar(
			context,
			view,
			{ x: x + lantern, y: y + 2.75, z: 0.14 },
			{ x: x + lantern, y: y + 2.75, z: 0.55 },
			WOOD,
			0.05
		);
		drawBlob(
			context,
			view,
			x + lantern,
			y + 2.75,
			0.6,
			0.11,
			stage >= 1 ? EXPLOSION_YELLOW : PAPER,
			0.03
		);
	}
	if (stage >= 2) drawFlag(context, view, x + 2.7, y + 0.3, 0.14, 1.2, TIE_RED, timeMs);
}

function drawRadar(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	stage: number,
	timeMs: number
) {
	const { x, y } = at;
	drawBox(context, view, x + 0.3, y + 0.5, 1.0, 1.0, 0.06, 0.45, paletteOf(KHAKI));
	const mastHeight = 1.3 + stage * 0.5;
	// A lattice mast of four legs that tighten towards the top
	const cx = x + 1.45;
	const cy = y + 0.8;
	for (const [dx, dy] of [
		[-0.2, -0.2],
		[0.2, -0.2],
		[-0.2, 0.2],
		[0.2, 0.2]
	] as const) {
		drawBar(
			context,
			view,
			{ x: cx + dx, y: cy + dy, z: 0.06 },
			{ x: cx + dx * 0.4, y: cy + dy * 0.4, z: mastHeight },
			STEEL,
			0.05
		);
	}
	const top = view.project(cx, cy, mastHeight);
	// The dish turns slowly; bigger at each step, with a second small one from the third
	const turn = timeMs / 900;
	const dishes = stage >= 2 ? 2 : 1;
	for (let dish = 0; dish < dishes; dish++) {
		const size = (dish === 0 ? 0.42 : 0.28) + stage * 0.05;
		const dx = dish === 0 ? 0 : -0.35;
		const dy = dish === 0 ? 0 : 0.4;
		context.save();
		context.translate(top.x + dx, top.y + dy);
		context.rotate(Math.sin(turn + dish) * 0.5 - 0.5);
		context.beginPath();
		context.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
		context.fillStyle = '#e9eef2';
		context.fill();
		context.lineWidth = 0.05;
		context.strokeStyle = INK;
		context.stroke();
		context.beginPath();
		context.arc(0, 0, size * 0.18, 0, Math.PI * 2);
		context.fillStyle = TIE_RED;
		context.fill();
		context.restore();
	}
	if (stage >= 3) {
		const blink = Math.sin(timeMs / 300) > 0 ? TIE_RED : '#7a1a1a';
		drawBlob(context, view, cx, cy, mastHeight + 0.1, 0.09, blink, 0.03);
	}
}

/** A little heap of whatever the warehouse holds, growing with the stock */
function drawPile(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	resource: HomeResource,
	size: number
) {
	const count = 1 + Math.round(size * 3);
	for (let item = 0; item < count; item++) {
		const px = x + (item % 2) * 0.3;
		const py = y - Math.floor(item / 2) * 0.28 + (item % 2) * 0.1;
		const lift = Math.floor(item / 2) * 0.06;
		if (resource === 'wood') {
			drawCylinder(context, view, px, py, 0.14, lift, lift + 0.32, paletteOf(WOOD), 0.035);
		} else if (resource === 'stone') {
			drawBox(
				context,
				view,
				px - 0.14,
				py - 0.14,
				0.28,
				0.28,
				lift,
				lift + 0.22,
				paletteOf(STONE),
				0.035
			);
		} else if (resource === 'iron') {
			drawBox(
				context,
				view,
				px - 0.17,
				py - 0.1,
				0.34,
				0.2,
				lift,
				lift + 0.16,
				paletteOf(IRON),
				0.035
			);
		} else {
			drawCylinder(context, view, px, py, 0.14, lift, lift + 0.08, paletteOf(GOLD), 0.03);
		}
	}
}

function drawWarehouse(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	key: LayoutKey,
	stage: number,
	fill: number
) {
	const { x, y } = at;
	const resource = resourceOf(key);
	const colour = RESOURCE_COLOR[resource];
	const size = [1.3, 1.45, 1.45, 1.55][stage];
	const height = [0.55, 0.65, 0.72, 0.8][stage];
	const inset = 0.15;
	drawBox(context, view, x + inset, y + inset, size, size, 0.05, height, paletteOf(colour));
	// Planks across the front, a door and a roof in the colour of the stock
	wallLeft(
		context,
		view,
		x + inset + size * 0.32,
		x + inset + size * 0.68,
		y + inset + size,
		0.05,
		height * 0.7,
		INK
	);
	if (stage >= 1) {
		wallLeft(
			context,
			view,
			x + inset + 0.08,
			x + inset + size - 0.08,
			y + inset + size,
			height - 0.1,
			height - 0.05,
			shade(colour, -0.3)
		);
	}
	drawRoof(
		context,
		view,
		x + inset - 0.06,
		y + inset - 0.06,
		size + 0.12,
		size + 0.12,
		height,
		0.25 + stage * 0.07,
		paletteOf(ROOF_COLOR[resource])
	);
	if (stage >= 2) {
		// A second storey bay on top
		drawBox(
			context,
			view,
			x + 0.45,
			y + 0.45,
			0.7,
			0.7,
			height + 0.2,
			height + 0.55,
			paletteOf(shade(colour, 0.1))
		);
	}
	if (stage >= 3) {
		drawCylinder(
			context,
			view,
			x + 0.35,
			y + 0.35,
			0.22,
			0.05,
			height + 0.9,
			paletteOf(shade(colour, 0.15))
		);
	}
	drawPile(context, view, x + 1.75, y + 1.75, resource, fill);
}

const UNIT_COLOR: Record<string, string> = {
	assault: KHAKI,
	tank: '#4d5b3a',
	mortar: '#6b705a',
	drone: BANNER_SLATE,
	medic: PAPER,
	artillery: STEEL,
	apc: '#55603f',
	demo: TIE_RED,
	heavy: '#7a7f66',
	hero: '#2f3338',
	azov: '#1d1d1d'
};
const VEHICLES = new Set(['tank', 'apc', 'artillery']);

/** One soldier or vehicle standing on a boat's deck, small enough that a full load is readable */
function drawDeckUnit(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	z: number,
	kind: string
) {
	const color = UNIT_COLOR[kind] ?? KHAKI;
	if (VEHICLES.has(kind)) {
		drawBox(context, view, x - 0.13, y - 0.17, 0.26, 0.34, z, z + 0.1, paletteOf(color), 0.03);
		drawBlob(context, view, x, y, z + 0.14, 0.07, color, 0.03);
		return;
	}
	drawBlob(context, view, x, y, z + 0.07, 0.075, color, 0.03);
	drawBlob(context, view, x, y, z + 0.18, 0.05, '#f6c9a0', 0.025);
	if (kind === 'medic') drawBlob(context, view, x, y, z + 0.07, 0.025, TIE_RED, 0);
}

function drawBoat(
	context: CanvasRenderingContext2D,
	view: IsoView,
	index: number,
	level: number,
	max: number,
	timeMs: number,
	units: readonly string[] = []
) {
	const dock = boatDock(index);
	const stage = stageOf(level, max);
	const bob = Math.sin(timeMs / 650 + index * 1.7) * 0.04;
	const length = 1.2 + stage * 0.12;
	const x = dock.x + 0.1;
	const y = dock.y;
	const at = view.project(x + 0.3, y + length / 2, bob);
	context.strokeStyle = 'rgba(255,255,255,0.55)';
	context.lineWidth = 0.05;
	context.beginPath();
	context.ellipse(at.x, at.y + 0.12, 0.8, 0.3, 0, 0, Math.PI * 2);
	context.stroke();
	drawBox(context, view, x, y, 0.65, length, bob, 0.22 + bob, paletteOf(STEEL));
	drawBox(
		context,
		view,
		x + 0.08,
		y + 0.15,
		0.49,
		length - 0.3,
		0.22 + bob,
		0.28 + bob,
		paletteOf(KHAKI)
	);
	if (stage >= 1) {
		drawBox(
			context,
			view,
			x + 0.14,
			y + 0.1,
			0.37,
			0.32,
			0.28 + bob,
			0.55 + bob,
			paletteOf(BANNER_SLATE)
		);
		drawBar(
			context,
			view,
			{ x: x + 0.32, y: y + 0.26, z: 0.55 + bob },
			{ x: x + 0.32, y: y + 0.26, z: 1.0 + bob },
			STEEL,
			0.05
		);
	}
	// The troops waiting for the attack, two abreast from the stern forwards
	const shown = units.slice(0, 16);
	for (let slot = shown.length - 1; slot >= 0; slot--) {
		const row = Math.floor(slot / 2);
		const col = slot % 2;
		drawDeckUnit(
			context,
			view,
			x + 0.22 + col * 0.21,
			y + length - 0.16 - row * 0.15,
			0.28 + bob,
			shown[slot]
		);
	}
	if (stage >= 3) {
		drawCylinder(
			context,
			view,
			x + 0.32,
			y + length - 0.15,
			0.12,
			0.28 + bob,
			0.4 + bob,
			paletteOf(STEEL)
		);
		drawBlob(context, view, x + 0.32, y + 0.26, 1.02 + bob, 0.07, GOLD, 0.03);
	}
	const flag = view.project(x + 0.32, y + 0.26, (stage >= 1 ? 1.0 : 0.5) + bob);
	context.beginPath();
	context.moveTo(flag.x, flag.y);
	context.lineTo(flag.x + 0.3, flag.y + 0.05);
	context.lineTo(flag.x, flag.y + 0.14);
	context.closePath();
	context.fillStyle = TIE_RED;
	context.fill();
}

/** An empty mooring where a landing craft will join at a later headquarters level */
function drawEmptyBerth(context: CanvasRenderingContext2D, view: IsoView, index: number) {
	const dock = boatDock(index);
	context.save();
	context.globalAlpha = 0.5;
	context.setLineDash([0.12, 0.1]);
	context.strokeStyle = PAPER;
	context.lineWidth = 0.05;
	footprintPath(context, view, dock.x + 0.1, dock.y, 0.65, 1.2);
	context.stroke();
	context.restore();
}

const LEAF = '#3f7a3a';

/** One fir: a trunk and three stacked cones that shrink towards the top */
function drawTree(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	size: number,
	timeMs: number
) {
	const sway = Math.sin(timeMs / 1300 + x * 2 + y) * 0.015;
	drawBar(context, view, { x, y, z: 0 }, { x, y, z: 0.3 * size }, '#6b4526', 0.1);
	for (let tier = 0; tier < 3; tier++) {
		const width = (0.78 - tier * 0.2) * size;
		drawRoof(
			context,
			view,
			x - width / 2 + sway * tier,
			y - width / 2,
			width,
			width,
			(0.2 + tier * 0.34) * size,
			0.5 * size,
			paletteOf(tier % 2 === 0 ? LEAF : '#2f6a35'),
			0.04
		);
	}
}

/** Fir trees spread over the forest's ground, some close, some far, never in a line */
function forestTrees(): { x: number; y: number; size: number }[] {
	const trees: { x: number; y: number; size: number }[] = [];
	for (let column = 0; column < 7; column++) {
		for (let row = 0; row < 3; row++) {
			const jitterX = Math.sin(column * 12.9 + row * 78.2) * 0.5;
			const jitterY = Math.sin(column * 39.3 + row * 11.1) * 0.5;
			trees.push({
				x: FOREST.x + 0.45 + column * (FOREST.width / 7) + jitterX * 0.25,
				y: FOREST.y + 0.4 + row * (FOREST.height / 2.6) + jitterY * 0.2,
				size: 0.85 + (Math.sin(column * 5.7 + row * 3.3) + 1) * 0.2
			});
		}
	}
	return trees;
}

/** The little mountain: grey rock with a snow cap, a timbered mine mouth and a cart of iron ore */
function drawMountain(context: CanvasRenderingContext2D, view: IsoView) {
	const { x, y, width: w, height: h } = MOUNTAIN;
	drawShadow(context, view, x, y, w, h);
	drawRoof(context, view, x - 0.25, y - 0.2, w + 0.5, h + 0.4, 0, 1.7, paletteOf('#8d8f93'));
	drawRoof(context, view, x - 0.9, y + 0.5, 1.3, 1.5, 0, 0.9, paletteOf('#a0a2a7'));
	drawRoof(
		context,
		view,
		x + w / 2 - 0.3,
		y + h / 2 - 0.3,
		0.6,
		0.6,
		1.1,
		0.6,
		paletteOf('#f4f6f8'),
		0.04
	);
	// The tunnel mouth in the south-west face, framed by two posts and a beam
	wallLeft(context, view, x + 0.55, x + 1.15, y + h + 0.2, 0, 0.42, INK);
	drawBar(
		context,
		view,
		{ x: x + 0.5, y: y + h + 0.2, z: 0 },
		{ x: x + 0.5, y: y + h + 0.2, z: 0.5 },
		WOOD,
		0.07
	);
	drawBar(
		context,
		view,
		{ x: x + 1.2, y: y + h + 0.2, z: 0 },
		{ x: x + 1.2, y: y + h + 0.2, z: 0.5 },
		WOOD,
		0.07
	);
	drawBar(
		context,
		view,
		{ x: x + 0.45, y: y + h + 0.2, z: 0.5 },
		{ x: x + 1.25, y: y + h + 0.2, z: 0.5 },
		WOOD,
		0.08
	);
	// A cart of ore on a short rail
	drawBar(
		context,
		view,
		{ x: x + 0.85, y: y + h + 0.3, z: 0.02 },
		{ x: x + 0.85, y: y + h + 1.1, z: 0.02 },
		'#5d6470',
		0.04
	);
	drawBox(
		context,
		view,
		x + 0.62,
		y + h + 0.75,
		0.46,
		0.34,
		0.06,
		0.26,
		paletteOf('#6f7b88'),
		0.035
	);
	for (const [dx, dy] of [
		[0.7, 0.85],
		[0.85, 0.92],
		[0.95, 0.82]
	] as const) {
		drawBlob(context, view, x + dx, y + h + dy, 0.32, 0.06, '#c4ccd6', 0.025);
	}
}

/** A cottage with a chimney that smokes; a coin floats up now and then as the family pays its tax */
function drawHouse(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	timeMs: number,
	seed: number
) {
	drawShadow(context, view, x + 0.1, y + 0.1, 0.8, 0.8);
	drawBox(
		context,
		view,
		x + 0.12,
		y + 0.14,
		0.76,
		0.72,
		0,
		0.5,
		paletteOf(seed % 2 === 0 ? '#e8cf95' : '#d9c3a0')
	);
	wallLeft(context, view, x + 0.4, x + 0.62, y + 0.86, 0, 0.32, '#6b4526');
	wallLeft(context, view, x + 0.2, x + 0.34, y + 0.86, 0.22, 0.4, '#cfe6f5');
	drawRoof(
		context,
		view,
		x + 0.04,
		y + 0.06,
		0.92,
		0.88,
		0.5,
		0.45,
		paletteOf(seed % 2 === 0 ? '#b0383d' : '#8a5a2b')
	);
	drawBox(context, view, x + 0.68, y + 0.22, 0.12, 0.12, 0.5, 0.9, paletteOf('#8d8f93'), 0.03);
	// Chimney smoke
	for (let puff = 0; puff < 2; puff++) {
		const rise = ((timeMs / 2200 + puff / 2 + seed * 0.3) % 1) * 0.6;
		const at = view.project(x + 0.74 + rise * 0.2, y + 0.28, 0.95 + rise);
		context.globalAlpha = 0.4 * (1 - rise / 0.6);
		context.fillStyle = '#d9dde2';
		context.beginPath();
		context.arc(at.x, at.y, 0.07 + rise * 0.1, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
	// The tax: a coin pops out of the door, floats up and fades
	const cycle = (timeMs / 4200 + seed * 0.37) % 1;
	if (cycle < 0.45) {
		const t = cycle / 0.45;
		const coin = view.project(x + 0.5, y + 0.9, 0.5 + t * 0.9);
		context.globalAlpha = Math.sin(Math.min(1, t) * Math.PI);
		drawResourceGlyph(context, 'gold', coin.x, coin.y, 0.42);
		context.globalAlpha = 1;
	}
}

/** A small sawmill: an open shed with a spinning blade and a stack of planks beside the logs */
function drawSawmill(
	context: CanvasRenderingContext2D,
	view: IsoView,
	level: number,
	timeMs: number
) {
	const { x, y } = SAWMILL;
	drawShadow(context, view, x, y, 1, 2);
	drawBox(context, view, x + 0.08, y + 0.15, 0.84, 1.1, 0, 0.12, paletteOf('#8a5a2b'));
	for (const [dx, dy] of [
		[0.14, 0.2],
		[0.86, 0.2],
		[0.14, 1.2],
		[0.86, 1.2]
	] as const) {
		drawBar(
			context,
			view,
			{ x: x + dx, y: y + dy, z: 0.1 },
			{ x: x + dx, y: y + dy, z: 0.75 },
			'#6b4526',
			0.07
		);
	}
	drawRoof(
		context,
		view,
		x + 0.02,
		y + 0.1,
		0.96,
		1.2,
		0.75,
		0.3 + level * 0.03,
		paletteOf('#b0383d')
	);
	// A log on the bench and a blade that spins in front of it
	drawCylinder(context, view, x + 0.5, y + 0.65, 0.13, 0.12, 0.3, paletteOf('#9b6a3c'), 0.03);
	const blade = view.project(x + 0.5, y + 1.05, 0.38);
	context.save();
	context.translate(blade.x, blade.y);
	context.rotate(timeMs / 120);
	context.beginPath();
	for (let tooth = 0; tooth < 10; tooth++) {
		const angle = (tooth / 10) * Math.PI * 2;
		context.lineTo(Math.cos(angle) * 0.2, Math.sin(angle) * 0.2);
		context.lineTo(Math.cos(angle + 0.15) * 0.14, Math.sin(angle + 0.15) * 0.14);
	}
	context.closePath();
	context.fillStyle = '#c4ccd6';
	context.fill();
	context.lineWidth = 0.03;
	context.strokeStyle = INK;
	context.stroke();
	context.restore();
	// Planks stacked beside it, a few more with every level
	for (let plank = 0; plank < 1 + level; plank++) {
		drawBox(
			context,
			view,
			x + 0.15,
			y + 1.45 + (plank % 2) * 0.02,
			0.7,
			0.14,
			plank * 0.07,
			plank * 0.07 + 0.07,
			paletteOf('#e2b277'),
			0.025
		);
	}
}

/** The quarry ditch: a stepped pit in the grass with a pile of cut stone and a rope windlass */
function drawQuarry(context: CanvasRenderingContext2D, view: IsoView, timeMs: number) {
	const { x, y, width: w, height: h } = QUARRY;
	onGround(context, view, () => {
		context.fillStyle = '#a78f63';
		context.fillRect(x + 0.05, y + 0.05, w - 0.1, h - 0.1);
		context.fillStyle = '#7a6746';
		context.fillRect(x + 0.25, y + 0.25, w - 0.5, h - 0.5);
		context.fillStyle = '#4d4030';
		context.fillRect(x + 0.5, y + 0.5, w - 1, h - 1);
		context.lineWidth = 0.05;
		context.strokeStyle = INK;
		context.strokeRect(x + 0.05, y + 0.05, w - 0.1, h - 0.1);
		context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	});
	// Cut blocks stacked beside the pit
	for (const [dx, dy, lift] of [
		[w + 0.05, 0.2, 0],
		[w + 0.05, 0.62, 0],
		[w + 0.1, 0.4, 0.22]
	] as const) {
		drawBox(
			context,
			view,
			x + dx,
			y + dy,
			0.4,
			0.34,
			lift,
			lift + 0.22,
			paletteOf('#b7b9bd'),
			0.035
		);
	}
	// A windlass over the pit hauling a bucket of rubble
	drawBar(
		context,
		view,
		{ x: x + 0.2, y: y + 0.1, z: 0 },
		{ x: x + 0.2, y: y + 0.1, z: 0.8 },
		'#6b4526',
		0.07
	);
	drawBar(
		context,
		view,
		{ x: x + 1.8, y: y + 0.1, z: 0 },
		{ x: x + 1.8, y: y + 0.1, z: 0.8 },
		'#6b4526',
		0.07
	);
	drawBar(
		context,
		view,
		{ x: x + 0.2, y: y + 0.1, z: 0.8 },
		{ x: x + 1.8, y: y + 0.1, z: 0.8 },
		'#6b4526',
		0.06
	);
	const bucket = 0.2 + (Math.sin(timeMs / 900) * 0.5 + 0.5) * 0.45;
	drawBar(
		context,
		view,
		{ x: x + 1.0, y: y + 0.1, z: 0.8 },
		{ x: x + 1.0, y: y + 0.1, z: bucket },
		'#d9c3a0',
		0.025
	);
	drawBox(context, view, x + 0.9, y, 0.2, 0.2, bucket - 0.2, bucket, paletteOf('#8d8f93'), 0.03);
}

/** Bushes and flowers on the lawn, so the island is not bare grass */
const GREENERY: { x: number; y: number; flower?: string }[] = [
	{ x: 0.7, y: 0.5 },
	{ x: 3.1, y: 0.7, flower: '#e5484d' },
	{ x: 9.6, y: 0.4 },
	{ x: 13.3, y: 0.8, flower: '#f5c83a' },
	{ x: 0.5, y: 3.6, flower: '#fff' },
	{ x: 4.2, y: 8.7 },
	{ x: 9.8, y: 8.9, flower: '#e5484d' },
	{ x: 13.4, y: 4.2 },
	{ x: 2.6, y: 12.9, flower: '#f5c83a' },
	{ x: 8.8, y: 13.3 },
	{ x: 10.6, y: 12.6 },
	{ x: 0.5, y: 9.9 }
];

function drawBush(
	context: CanvasRenderingContext2D,
	view: IsoView,
	spot: { x: number; y: number; flower?: string }
) {
	drawBlob(context, view, spot.x - 0.12, spot.y + 0.04, 0.12, 0.2, '#4c8a3f', 0.04);
	drawBlob(context, view, spot.x + 0.12, spot.y - 0.02, 0.16, 0.22, '#5b9a49', 0.04);
	if (spot.flower) {
		drawBlob(context, view, spot.x + 0.04, spot.y + 0.1, 0.3, 0.06, spot.flower, 0.02);
		drawBlob(context, view, spot.x + 0.2, spot.y - 0.04, 0.34, 0.05, spot.flower, 0.02);
	}
}

/** The bunker: a squat concrete block with a steel door; it grows slits, sandbags, a turret and an aerial */
function drawBunker(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	stage: number,
	timeMs: number
) {
	const { x, y } = at;
	drawBox(context, view, x + 0.1, y + 0.1, 1.8, 1.8, 0, 0.55 + stage * 0.08, paletteOf('#9a9ea4'));
	drawRoof(
		context,
		view,
		x + 0.04,
		y + 0.04,
		1.92,
		1.92,
		0.55 + stage * 0.08,
		0.2,
		paletteOf('#7d8187')
	);
	wallLeft(context, view, x + 0.7, x + 1.3, y + 1.9, 0, 0.4, '#3b4048');
	wallLeft(context, view, x + 0.76, x + 1.24, y + 1.9, 0.3, 0.34, '#d6d8dd');
	if (stage >= 1) {
		wallLeft(context, view, x + 0.2, x + 0.55, y + 1.9, 0.3, 0.42, INK);
		wallLeft(context, view, x + 1.45, x + 1.8, y + 1.9, 0.3, 0.42, INK);
		for (let bag = 0; bag < 5; bag++) {
			drawBlob(context, view, x + 0.25 + bag * 0.38, y + 2.1, 0.1, 0.15, KHAKI, 0.035);
		}
	}
	if (stage >= 2) {
		drawCylinder(context, view, x + 1.0, y + 0.9, 0.38, 0.75, 0.95, paletteOf('#7d8187'));
		drawBar(
			context,
			view,
			{ x: x + 1.0, y: y + 0.9, z: 0.9 },
			{ x: x + 1.0, y: y + 1.55, z: 0.95 },
			STEEL,
			0.1
		);
	}
	if (stage >= 3) {
		drawBar(
			context,
			view,
			{ x: x + 1.7, y: y + 0.3, z: 0.7 },
			{ x: x + 1.7, y: y + 0.3, z: 1.6 },
			STEEL,
			0.05
		);
		drawBlob(
			context,
			view,
			x + 1.7,
			y + 0.3,
			1.62,
			0.06,
			Math.sin(timeMs / 350) > 0 ? TIE_RED : '#7a1a1a',
			0.025
		);
	}
}

/** A defence from the other modes on a single cell of the home grid */
function drawGuard(
	context: CanvasRenderingContext2D,
	view: IsoView,
	kind: BuildingKind,
	x: number,
	y: number,
	timeMs: number
) {
	drawEnemyBuilding(
		context,
		view,
		{ kind, x, y, width: 1, height: 1 } as Parameters<typeof drawEnemyBuilding>[2],
		timeMs
	);
}

function drawHomeBuilding(
	context: CanvasRenderingContext2D,
	view: IsoView,
	scene: HomeScene,
	key: LayoutKey,
	ghostAt?: Cell
) {
	const at = ghostAt ?? positionOf(scene.layout, key);
	const stage = stageOf(scene.levelOf(key), scene.maxOf(key));
	const size = footprintOf(key);
	drawShadow(context, view, at.x, at.y, size.width, size.height);
	if (key === 'hq') drawHq(context, view, at, stage, scene.timeMs);
	else if (key === 'training') drawTraining(context, view, at, stage, scene.timeMs);
	else if (key === 'dojo') drawDojo(context, view, at, stage, scene.timeMs);
	else if (key === 'radar') drawRadar(context, view, at, stage, scene.timeMs);
	else if (key === 'bunker') drawBunker(context, view, at, stage, scene.timeMs);
	else drawWarehouse(context, view, at, key, stage, scene.fillOf(resourceOf(key)));
}

function drawBadge(
	context: CanvasRenderingContext2D,
	view: IsoView,
	x: number,
	y: number,
	z: number,
	text: string,
	fill: string,
	selected: boolean
) {
	const at = view.project(x, y, z);
	context.font = `bold 0.4px ${DISPLAY_FONT}`;
	const width = Math.max(0.62, context.measureText(text).width + 0.3);
	const height = 0.52;
	context.beginPath();
	context.roundRect(at.x - width / 2, at.y - height / 2, width, height, 0.14);
	context.fillStyle = fill;
	context.fill();
	context.lineWidth = selected ? 0.1 : 0.06;
	context.strokeStyle = selected ? EXPLOSION_YELLOW : INK;
	context.stroke();
	context.fillStyle = INK;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, at.x, at.y + 0.02);
}

/**
 * A little builder hammering at the wall of the building under construction. The hammer is a body
 * under gravity: it is hauled back, hangs for a breath, falls with a constant angular acceleration
 * until it meets the wall, and then rings back like a damped spring. The impact squashes the builder,
 * kicks a few chips out that fall under gravity and bounce twice on the ground before they fade.
 */
const SWING = {
	/** Milliseconds to haul the hammer back, to hold it and the full length of one blow */
	raiseMs: 520,
	holdMs: 90,
	cycleMs: 1320,
	/** Hammer angle in radians from straight up: cocked back, and where it meets the wall */
	back: -0.95,
	hit: 1.2,
	/** Angular acceleration of the fall, in radians per second squared */
	gravity: 24
};

function hammerAngle(phaseMs: number): { angle: number; sinceHit: number } {
	const fall = Math.sqrt((2 * (SWING.hit - SWING.back)) / SWING.gravity) * 1000;
	const hitAt = SWING.raiseMs + SWING.holdMs + fall;
	if (phaseMs < SWING.raiseMs) {
		const t = phaseMs / SWING.raiseMs;
		const ease = 1 - Math.pow(1 - t, 3);
		return { angle: SWING.hit + (SWING.back - SWING.hit) * ease, sinceHit: -1 };
	}
	if (phaseMs < SWING.raiseMs + SWING.holdMs) {
		// A tremble while the arm is cocked
		return { angle: SWING.back + Math.sin(phaseMs / 9) * 0.015, sinceHit: -1 };
	}
	if (phaseMs < hitAt) {
		const tau = (phaseMs - SWING.raiseMs - SWING.holdMs) / 1000;
		return { angle: SWING.back + 0.5 * SWING.gravity * tau * tau, sinceHit: -1 };
	}
	const tau = (phaseMs - hitAt) / 1000;
	// Rings back off the wall and settles, the way a stiff spring does
	const recoil = 0.42 * Math.exp(-7 * tau) * Math.abs(Math.sin(16 * tau));
	return { angle: SWING.hit - recoil, sinceHit: tau };
}

function drawBuilder(
	context: CanvasRenderingContext2D,
	base: { x: number; y: number },
	timeMs: number,
	seed: number
) {
	const phase = (((timeMs + seed * 417) % SWING.cycleMs) + SWING.cycleMs) % SWING.cycleMs;
	const { angle, sinceHit } = hammerAngle(phase);
	const impact = sinceHit >= 0 ? Math.exp(-11 * sinceHit) : 0;
	const squash = 1 - 0.1 * impact * Math.cos(34 * Math.max(0, sinceHit));
	const lean = 0.05 + angle * 0.05;

	context.save();
	context.translate(base.x, base.y);
	context.lineJoin = 'round';
	context.lineCap = 'round';

	// Shadow
	context.fillStyle = 'rgba(17,17,17,0.25)';
	context.beginPath();
	context.ellipse(0, 0.02, 0.3, 0.1, 0, 0, Math.PI * 2);
	context.fill();

	// Legs and boots, planted
	context.strokeStyle = INK;
	context.lineWidth = 0.1;
	for (const side of [-0.08, 0.1]) {
		context.beginPath();
		context.moveTo(side, -0.3);
		context.lineTo(side + (side > 0 ? 0.03 : -0.03), -0.02);
		context.stroke();
	}
	context.strokeStyle = '#3b4048';
	context.lineWidth = 0.065;
	for (const side of [-0.08, 0.1]) {
		context.beginPath();
		context.moveTo(side, -0.3);
		context.lineTo(side + (side > 0 ? 0.03 : -0.03), -0.02);
		context.stroke();
	}

	// Torso and head squash and lean as one body hanging off the hips
	context.save();
	context.translate(0, -0.3);
	context.rotate(lean);
	context.scale(1 / squash, squash);
	context.beginPath();
	context.roundRect(-0.17, -0.38, 0.34, 0.4, 0.07);
	context.fillStyle = '#f28c28';
	context.fill();
	context.lineWidth = 0.05;
	context.strokeStyle = INK;
	context.stroke();
	// A reflective stripe on the vest
	context.fillStyle = '#fff3a8';
	context.fillRect(-0.15, -0.2, 0.3, 0.05);
	// Head and hard hat
	context.beginPath();
	context.arc(0.02, -0.52, 0.13, 0, Math.PI * 2);
	context.fillStyle = '#f6c9a0';
	context.fill();
	context.stroke();
	context.beginPath();
	context.arc(0.02, -0.55, 0.14, Math.PI, Math.PI * 2);
	context.fillStyle = '#f5c83a';
	context.fill();
	context.stroke();
	context.fillStyle = '#e0a91c';
	context.fillRect(-0.15, -0.56, 0.34, 0.045);
	context.fillStyle = INK;
	context.beginPath();
	context.arc(0.09, -0.5, 0.017, 0, Math.PI * 2);
	context.fill();

	// The arm and the hammer swing from the shoulder
	context.translate(0.1, -0.3);
	context.rotate(angle);
	context.strokeStyle = INK;
	context.lineWidth = 0.13;
	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(0, -0.3);
	context.stroke();
	context.strokeStyle = '#f28c28';
	context.lineWidth = 0.075;
	context.stroke();
	context.strokeStyle = INK;
	context.lineWidth = 0.1;
	context.beginPath();
	context.moveTo(0, -0.28);
	context.lineTo(0, -0.62);
	context.stroke();
	context.strokeStyle = '#9b6a3c';
	context.lineWidth = 0.05;
	context.stroke();
	context.beginPath();
	context.roundRect(-0.12, -0.74, 0.24, 0.16, 0.03);
	context.fillStyle = '#8b97a6';
	context.fill();
	context.lineWidth = 0.045;
	context.strokeStyle = INK;
	context.stroke();
	context.restore();

	// Chips fly off the wall in front of the builder and bounce on the ground
	if (sinceHit >= 0 && sinceHit < 0.95) {
		const wallX = 0.62;
		const wallY = -0.5;
		for (let chip = 0; chip < 7; chip++) {
			const spread = (chip - 3) / 3;
			let vx = 1.4 + (chip % 3) * 0.55;
			let vy = -2.6 - Math.abs(spread) * 0.9 - (chip % 2) * 0.8;
			let x = wallX;
			let y = wallY;
			let t = sinceHit;
			let bounces = 0;
			// Step the flight under gravity, reflecting off the ground a couple of times
			const g = 9.5;
			const dt = 1 / 60;
			for (let step = 0; step < t / dt && bounces < 3; step++) {
				vy += g * dt;
				x += vx * dt * (0.4 + Math.abs(spread) * 0.3);
				y += vy * dt;
				if (y > 0) {
					y = 0;
					vy = -vy * 0.42;
					vx *= 0.7;
					bounces += 1;
				}
			}
			context.globalAlpha = Math.max(0, 1 - sinceHit / 0.95);
			context.save();
			context.translate(x + spread * 0.05, y);
			context.rotate(chip + sinceHit * 9 * (chip % 2 ? 1 : -1));
			context.fillStyle = chip % 3 === 0 ? '#f5c83a' : chip % 3 === 1 ? '#e8e2c8' : '#9b6a3c';
			context.fillRect(-0.035, -0.025, 0.07, 0.05);
			context.restore();
		}
		context.globalAlpha = 1;
		// A flash where the hammer met the wall
		if (sinceHit < 0.09) {
			context.globalAlpha = 1 - sinceHit / 0.09;
			context.fillStyle = '#fff3a8';
			context.beginPath();
			context.arc(wallX, wallY, 0.17, 0, Math.PI * 2);
			context.fill();
			context.globalAlpha = 1;
		}
	}
	context.restore();
}

function drawConstruction(
	context: CanvasRenderingContext2D,
	view: IsoView,
	at: Cell,
	size: { width: number; height: number },
	progress: number,
	top: number,
	timeMs: number
) {
	// Scaffold poles on the corners and a progress bar floating above
	const corners = [
		[at.x, at.y + size.height],
		[at.x + size.width, at.y + size.height],
		[at.x + size.width, at.y]
	] as const;
	for (const [cx, cy] of corners) {
		drawBar(context, view, { x: cx, y: cy, z: 0 }, { x: cx, y: cy, z: top }, MUSTARD, 0.07);
	}
	const a = view.project(at.x, at.y + size.height, top);
	const b = view.project(at.x + size.width, at.y + size.height, top);
	const c = view.project(at.x + size.width, at.y, top);
	context.strokeStyle = MUSTARD;
	context.lineWidth = 0.07;
	context.beginPath();
	context.moveTo(a.x, a.y);
	context.lineTo(b.x, b.y);
	context.lineTo(c.x, c.y);
	context.stroke();
	const centre = view.project(at.x + size.width / 2, at.y + size.height / 2, top + 0.9);
	const width = 1.5;
	context.fillStyle = INK;
	context.fillRect(centre.x - width / 2 - 0.04, centre.y - 0.12, width + 0.08, 0.24);
	context.fillStyle = EXPLOSION_YELLOW;
	context.fillRect(
		centre.x - width / 2,
		centre.y - 0.08,
		width * Math.min(1, Math.max(0, progress)),
		0.16
	);
	// The builder stands at the south-west wall, hammering it
	const standing = view.project(at.x + Math.min(0.9, size.width * 0.3), at.y + size.height + 0.55);
	drawBuilder(context, standing, timeMs, at.x * 3 + at.y);
}

function drawGround(context: CanvasRenderingContext2D, view: IsoView, scene: HomeScene) {
	context.fillStyle = SEA;
	context.fillRect(0, 0, view.width, view.height);
	onGround(context, view, () => {
		context.strokeStyle = SEA_DARK;
		context.lineWidth = 0.06;
		for (let row = -8; row < BASE_ROWS + 8; row += 2) {
			context.beginPath();
			const y = row + 0.7;
			for (let x = -8; x <= BASE_COLS + 8; x += 0.3) {
				const wave = Math.sin(x * 2 + scene.timeMs / 700 + row) * 0.09;
				if (x === -8) context.moveTo(x, y + wave);
				else context.lineTo(x, y + wave);
			}
			context.stroke();
		}
	});

	const edge = 0.7;
	const lo = -edge;
	const hi = BASE_COLS + edge;
	const p = view.project;
	const thickness = 0.8;
	const wall = (from: [number, number], to: [number, number], fill: string) => {
		context.beginPath();
		context.moveTo(p(from[0], from[1]).x, p(from[0], from[1]).y);
		context.lineTo(p(to[0], to[1]).x, p(to[0], to[1]).y);
		context.lineTo(p(to[0], to[1], -thickness).x, p(to[0], to[1], -thickness).y);
		context.lineTo(p(from[0], from[1], -thickness).x, p(from[0], from[1], -thickness).y);
		context.closePath();
		context.fillStyle = fill;
		context.fill();
		context.lineWidth = 0.08;
		context.lineJoin = 'round';
		context.strokeStyle = INK;
		context.stroke();
	};
	// The side facing the beach where attackers land slopes gently into the water instead of ending in a cliff
	const slope = 1.6;
	context.beginPath();
	context.moveTo(p(lo, hi).x, p(lo, hi).y);
	context.lineTo(p(hi, hi).x, p(hi, hi).y);
	context.lineTo(p(hi, hi + slope, -thickness).x, p(hi, hi + slope, -thickness).y);
	context.lineTo(p(lo, hi + slope, -thickness).x, p(lo, hi + slope, -thickness).y);
	context.closePath();
	context.fillStyle = shade(SAND, -0.06);
	context.fill();
	context.lineWidth = 0.08;
	context.lineJoin = 'round';
	context.strokeStyle = INK;
	context.stroke();
	// Wet sand near the waterline and a line of foam where the waves wash up it
	context.beginPath();
	context.moveTo(
		p(lo, hi + slope * 0.7, -thickness * 0.7).x,
		p(lo, hi + slope * 0.7, -thickness * 0.7).y
	);
	context.lineTo(
		p(hi, hi + slope * 0.7, -thickness * 0.7).x,
		p(hi, hi + slope * 0.7, -thickness * 0.7).y
	);
	context.strokeStyle = 'rgba(255,255,255,0.8)';
	context.lineWidth = 0.1;
	context.stroke();
	wall([hi, lo], [hi, hi], shade(DIRT, -0.2));

	onGround(context, view, () => {
		context.fillStyle = SAND;
		context.fillRect(lo, lo, hi - lo, hi - lo);
		context.lineWidth = 0.06;
		context.strokeStyle = INK;
		context.strokeRect(lo, lo, hi - lo, hi - lo);
		// The grass inside the beach
		context.fillStyle = shade(KHAKI, 0.5);
		context.fillRect(0, 0, BASE_COLS, BASE_ROWS);
		// Foam along the two near shores
		context.strokeStyle = PAPER;
		context.lineWidth = 0.12;
		context.beginPath();
		context.moveTo(lo, hi + 0.12);
		context.lineTo(hi + 0.12, hi + 0.12);
		context.lineTo(hi + 0.12, lo);
		context.stroke();
		// A path from the headquarters to the pier and the grid, faint unless the player is arranging
		context.globalAlpha = scene.arranging ? 0.55 : 0.12;
		context.strokeStyle = INK;
		context.lineWidth = 0.03;
		for (let line = 0; line <= BASE_COLS; line++) {
			context.beginPath();
			context.moveTo(line, 0);
			context.lineTo(line, BASE_ROWS);
			context.moveTo(0, line);
			context.lineTo(BASE_COLS, line);
			context.stroke();
		}
		context.globalAlpha = 1;
	});

	// The pier the landing craft are moored at
	drawBox(context, view, hi, lo, 0.8, hi - lo, 0, 0.12, paletteOf(WOOD), 0.05);
	for (let post = 0; post < 8; post++) {
		const y = lo + 0.4 + post * ((hi - lo) / 8);
		drawBlob(context, view, hi + 0.7, y, 0.14, 0.08, STEEL, 0.03);
	}
}

/** Draws the whole island; the context is already scaled so a unit is one view unit */
function drawGem(
	context: CanvasRenderingContext2D,
	at: { x: number; y: number },
	color: string,
	timeMs: number
) {
	const spin = Math.abs(Math.cos(timeMs / 900));
	context.save();
	context.translate(at.x, at.y);
	context.lineJoin = 'round';
	context.lineWidth = 0.05;
	context.strokeStyle = INK;
	context.fillStyle = color;
	context.beginPath();
	context.moveTo(0, -0.26);
	context.lineTo(0.17 * (0.4 + spin * 0.6), 0);
	context.lineTo(0, 0.26);
	context.lineTo(-0.17 * (0.4 + spin * 0.6), 0);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = 'rgba(255,255,255,0.55)';
	context.beginPath();
	context.moveTo(0, -0.2);
	context.lineTo(0.07, -0.02);
	context.lineTo(0, -0.02);
	context.closePath();
	context.fill();
	context.restore();
}

export function drawHome(context: CanvasRenderingContext2D, input: HomeScene, view = HOME_VIEW) {
	// A building that is not built yet is not drawn, except while its first level is going up
	const shown = (key: string) => input.levelOf(key) >= 1 || input.buildProgress(key) !== null;
	const scene: HomeScene = { ...input, levelOf: (key) => Math.max(1, input.levelOf(key)) };
	drawGround(context, view, scene);

	const dragging = scene.drag;

	// Mines are flat, so they go under the standing buildings
	for (const mine of scene.layout.mines) {
		if (dragging?.item.kind === 'mine' && dragging.item.id === mine.id) continue;
		if (isMine(mine.kind)) drawMineArt(context, view, mine.kind, mine.x, mine.y, scene.timeMs, 1);
		if (scene.selected?.kind === 'mine' && scene.selected.id === mine.id) {
			context.save();
			footprintPath(context, view, mine.x, mine.y, 1, 1);
			context.lineWidth = 0.09;
			context.strokeStyle = EXPLOSION_YELLOW;
			context.stroke();
			context.restore();
		}
	}

	const standing: { depth: number; draw: () => void }[] = [];
	// Guns stand like buildings; their barrels point at the beach on the lower left
	for (const gun of scene.layout.mines) {
		if (isMine(gun.kind)) continue;
		if (dragging?.item.kind === 'mine' && dragging.item.id === gun.id) continue;
		standing.push({
			depth: depthOf(gun.x + 0.5, gun.y + 0.5),
			draw: () => drawGuard(context, view, gun.kind as BuildingKind, gun.x, gun.y, scene.timeMs)
		});
	}
	// A builder works beside every defence that is being raised a level, with a bar over it
	for (const defense of scene.layout.mines) {
		const progress = scene.defenseProgress?.(defense.id) ?? null;
		if (progress === null) continue;
		standing.push({
			depth: depthOf(defense.x + 0.5, defense.y + 1.3),
			draw: () => {
				const bar = view.project(defense.x + 0.5, defense.y + 0.5, 1.2);
				context.fillStyle = INK;
				context.fillRect(bar.x - 0.4, bar.y - 0.09, 0.8, 0.18);
				context.fillStyle = EXPLOSION_YELLOW;
				context.fillRect(bar.x - 0.37, bar.y - 0.06, 0.74 * progress, 0.12);
				drawBuilder(
					context,
					view.project(defense.x + 0.15, defense.y + 1.25),
					scene.timeMs,
					defense.id * 7
				);
			}
		});
	}
	const keys = (Object.keys(scene.layout.positions) as LayoutKey[]).filter(
		(key) => shown(key) && !(dragging?.item.kind === 'building' && dragging.item.key === key)
	);
	// The ring of the selected building lies on the ground, under everything that stands on it
	for (const key of keys) {
		const at = positionOf(scene.layout, key);
		const size = footprintOf(key);
		if (scene.selected?.kind === 'building' && scene.selected.key === key) {
			context.save();
			footprintPath(context, view, at.x - 0.05, at.y - 0.05, size.width + 0.1, size.height + 0.1);
			context.lineWidth = 0.1;
			context.strokeStyle = EXPLOSION_YELLOW;
			context.setLineDash([0.22, 0.14]);
			context.stroke();
			context.restore();
		}
	}

	for (const key of keys) {
		const at = positionOf(scene.layout, key);
		const size = footprintOf(key);
		const stage = stageOf(scene.levelOf(key), scene.maxOf(key));
		standing.push({
			depth: depthOf(at.x + size.width / 2, at.y + size.height / 2),
			draw: () => {
				scaledAbout(
					context,
					view.project(at.x + size.width / 2, at.y + size.height / 2),
					growthOf(scene.levelOf(key)),
					() => drawHomeBuilding(context, view, scene, key)
				);
				const progress = scene.buildProgress(key);
				if (progress !== null) {
					drawConstruction(
						context,
						view,
						at,
						size,
						progress,
						heightOf(key, stage) + 0.3,
						scene.timeMs
					);
				}
			}
		});
	}
	for (let index = 0; index < 8; index++) {
		const dock = boatDock(index);
		standing.push({
			depth: depthOf(dock.x + 0.4, dock.y + 0.6),
			draw: () => {
				if (index < scene.boatCount) {
					const level = scene.levelOf(`boat-${index}`);
					scaledAbout(
						context,
						view.project(dock.x + 0.4, dock.y + 0.7),
						growthOf(level, 0.05),
						() =>
							drawBoat(
								context,
								view,
								index,
								level,
								scene.maxOf(`boat-${index}`),
								scene.timeMs,
								scene.boatUnits(index)
							)
					);
					const progress = scene.buildProgress(`boat-${index}`);
					if (progress !== null) {
						const spot = view.project(dock.x + 0.4, dock.y + 0.6, 1.5);
						context.fillStyle = INK;
						context.fillRect(spot.x - 0.5, spot.y - 0.1, 1, 0.2);
						context.fillStyle = EXPLOSION_YELLOW;
						context.fillRect(spot.x - 0.46, spot.y - 0.06, 0.92 * progress, 0.12);
						drawBuilder(
							context,
							view.project(dock.x - 0.35, dock.y + 1.0),
							scene.timeMs,
							index * 5
						);
					}
				} else {
					drawEmptyBerth(context, view, index);
				}
			}
		});
	}
	for (const tree of forestTrees()) {
		standing.push({
			depth: depthOf(tree.x, tree.y),
			draw: () => drawTree(context, view, tree.x, tree.y, tree.size, scene.timeMs)
		});
	}
	for (let house = 0; house < HOUSES.width; house++) {
		if (!shown(`house-${house}`)) continue;
		standing.push({
			depth: depthOf(HOUSES.x + house + 0.5, HOUSES.y + 0.5),
			draw: () =>
				scaledAbout(
					context,
					view.project(HOUSES.x + house + 0.5, HOUSES.y + 0.9),
					growthOf(scene.levelOf(`house-${house}`), 0.05),
					() => drawHouse(context, view, HOUSES.x + house, HOUSES.y, scene.timeMs, house)
				)
		});
	}
	standing.push({
		depth: depthOf(SAWMILL.x + 0.5, SAWMILL.y + 1),
		draw: () =>
			scaledAbout(
				context,
				view.project(SAWMILL.x + 0.5, SAWMILL.y + 1.5),
				growthOf(scene.levelOf('sawmill'), 0.05),
				() => drawSawmill(context, view, scene.levelOf('sawmill'), scene.timeMs)
			)
	});
	standing.push({
		depth: depthOf(QUARRY.x + QUARRY.width / 2, QUARRY.y + QUARRY.height / 2) - 0.6,
		draw: () => drawQuarry(context, view, scene.timeMs)
	});
	standing.push({
		depth: depthOf(MOUNTAIN.x + MOUNTAIN.width / 2, MOUNTAIN.y + MOUNTAIN.height / 2),
		draw: () => drawMountain(context, view)
	});
	for (const spot of GREENERY) {
		standing.push({ depth: depthOf(spot.x, spot.y), draw: () => drawBush(context, view, spot) });
	}
	standing.sort((a, b) => a.depth - b.depth);
	for (const item of standing) item.draw();

	// A socketed overcharge crystal floats above its building or defence and turns slowly
	const gem = (target: string, x: number, y: number, z: number) => {
		const type = scene.crystalAt?.(target);
		if (!type) return;
		const point = view.project(x, y, z + Math.sin(scene.timeMs / 500 + x) * 0.06);
		drawGem(context, point, CRYSTAL_COLORS[type], scene.timeMs);
	};
	for (const key of keys) {
		const at = positionOf(scene.layout, key);
		const size = footprintOf(key);
		gem(
			key,
			at.x + size.width / 2,
			at.y + size.height / 2,
			heightOf(key, stageOf(scene.levelOf(key), scene.maxOf(key))) + 0.35
		);
	}
	for (const defense of scene.layout.mines) {
		gem(
			`defense:${defense.id}`,
			defense.x + 0.5,
			defense.y + 0.5,
			isMine(defense.kind) ? 0.55 : 1.5
		);
	}
	// Level badges float above the buildings; the selected one is ringed
	for (const key of keys) {
		const at = positionOf(scene.layout, key);
		const size = footprintOf(key);
		const stage = stageOf(scene.levelOf(key), scene.maxOf(key));
		const selected = scene.selected?.kind === 'building' && scene.selected.key === key;
		drawBadge(
			context,
			view,
			at.x + size.width / 2,
			at.y + size.height / 2,
			heightOf(key, stage) * growthOf(scene.levelOf(key)) + 0.55,
			`${scene.levelOf(key)}`,
			selected ? EXPLOSION_YELLOW : PAPER,
			selected
		);
	}
	// The producers carry a level badge too, and a ring on the ground when they are selected
	const producerSpots: { key: string; x: number; y: number; z: number }[] = [
		...[0, 1, 2].map((house) => ({
			key: `house-${house}`,
			x: HOUSES.x + house + 0.5,
			y: HOUSES.y + 0.5,
			z: 1.5
		})),
		{ key: 'sawmill', x: SAWMILL.x + 0.5, y: SAWMILL.y + 1, z: 1.5 },
		{ key: 'quarry', x: QUARRY.x + 1, y: QUARRY.y + 1, z: 1.4 },
		{ key: 'mine', x: MOUNTAIN.x + 1, y: MOUNTAIN.y + 1, z: 2.3 }
	];
	for (const spot of producerSpots.filter((candidate) => shown(candidate.key))) {
		const selected = scene.selected?.kind === 'building' && scene.selected.key === spot.key;
		drawBadge(
			context,
			view,
			spot.x,
			spot.y,
			spot.z,
			`${scene.levelOf(spot.key)}`,
			selected ? EXPLOSION_YELLOW : PAPER,
			selected
		);
	}
	for (let index = 0; index < scene.boatCount; index++) {
		const dock = boatDock(index);
		const selected = scene.selected?.kind === 'building' && scene.selected.key === `boat-${index}`;
		drawBadge(
			context,
			view,
			dock.x + 0.4,
			dock.y + 0.6,
			1.4,
			`${scene.levelOf(`boat-${index}`)}`,
			selected ? EXPLOSION_YELLOW : PAPER,
			selected
		);
	}

	// The thing being dragged: a green or red footprint on the grid and the building over it
	if (dragging) {
		const item = dragging.item;
		const size = item.kind === 'building' ? footprintOf(item.key) : { width: 1, height: 1 };
		context.save();
		footprintPath(context, view, dragging.cell.x, dragging.cell.y, size.width, size.height);
		context.fillStyle = dragging.valid ? 'rgba(63,166,90,0.55)' : 'rgba(229,72,77,0.55)';
		context.fill();
		context.lineWidth = 0.09;
		context.strokeStyle = dragging.valid ? '#3fa65a' : TIE_RED;
		context.stroke();
		context.restore();
		context.save();
		context.globalAlpha = 0.85;
		if (item.kind === 'building') {
			drawHomeBuilding(context, view, scene, item.key, dragging.cell);
		} else {
			const mine = scene.layout.mines.find((candidate) => candidate.id === item.id);
			if (mine && isMine(mine.kind)) {
				drawMineArt(context, view, mine.kind, dragging.cell.x, dragging.cell.y, scene.timeMs, 1);
			} else if (mine) {
				drawGuard(
					context,
					view,
					mine.kind as BuildingKind,
					dragging.cell.x,
					dragging.cell.y,
					scene.timeMs
				);
			}
		}
		context.restore();
	}
}

/** Which building or mine stands under a point on the screen, for taps and drags */
export function pickHome(
	view: IsoView,
	layout: BaseLayout,
	boatCount: number,
	sx: number,
	sy: number,
	built: (key: string) => boolean = () => true
): { kind: 'building'; key: string } | { kind: 'mine'; id: number } | null {
	// Walls rise above their footprint, so look at the ground under the tap and a little behind it
	for (const lift of [0, 0.5, 1.0, 1.6, 2.2]) {
		const ground = view.unproject(sx, sy + lift);
		const x = Math.floor(ground.x);
		const y = Math.floor(ground.y);
		for (const mine of layout.mines) {
			if (lift === 0 && mine.x === x && mine.y === y) return { kind: 'mine', id: mine.id };
		}
		for (const key of Object.keys(layout.positions) as LayoutKey[]) {
			const at = positionOf(layout, key);
			const size = footprintOf(key);
			if (!built(key)) continue;
			if (x >= at.x && x < at.x + size.width && y >= at.y && y < at.y + size.height) {
				return { kind: 'building', key };
			}
		}
		const rects: [string, { x: number; y: number; width: number; height: number }][] = [
			['sawmill', SAWMILL],
			['quarry', QUARRY],
			['mine', MOUNTAIN]
		];
		for (const [key, rect] of rects) {
			if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
				return { kind: 'building', key };
			}
		}
		if (
			y === HOUSES.y &&
			x >= HOUSES.x &&
			x < HOUSES.x + HOUSES.width &&
			built(`house-${x - HOUSES.x}`)
		) {
			return { kind: 'building', key: `house-${x - HOUSES.x}` };
		}
		for (let index = 0; index < boatCount; index++) {
			const dock = boatDock(index);
			if (
				ground.x >= dock.x - 0.1 &&
				ground.x <= dock.x + 1 &&
				ground.y >= dock.y - 0.1 &&
				ground.y <= dock.y + 1.6
			) {
				return { kind: 'building', key: `boat-${index}` };
			}
		}
	}
	return null;
}

/** One home building at a given level on its own, for the upgrade window; returns the picture's size in view units */
export function previewSize(key: LayoutKey): { width: number; height: number } {
	const size = footprintOf(key);
	const view = createIsoView(size.width, size.height, { pad: 0.3, headroom: 2.6, depth: 0.3 });
	return { width: view.width, height: view.height };
}

export function drawBuildingPreview(
	context: CanvasRenderingContext2D,
	key: LayoutKey,
	level: number,
	max: number,
	pixelsWide: number
) {
	const size = footprintOf(key);
	const view = createIsoView(size.width, size.height, { pad: 0.3, headroom: 2.6, depth: 0.3 });
	const scale = pixelsWide / view.width;
	const scene: HomeScene = {
		layout: defaultLayout(),
		levelOf: () => level,
		maxOf: () => max,
		fillOf: () => 0.6,
		buildProgress: () => null,
		boatCount: 0,
		boatUnits: () => [],
		timeMs: 0,
		arranging: false,
		selected: null,
		drag: null
	};
	context.save();
	context.scale(scale, scale);
	const pivot = view.project(size.width / 2, size.height / 2);
	scaledAbout(context, pivot, growthOf(level), () =>
		drawHomeBuilding(context, view, scene, key, { x: 0, y: 0 })
	);
	context.restore();
}

/**
 * Where something on the home island sits in the picture, in view units: the point just above its
 * top for a name tag, and the point at its front corner for the buttons under it.
 */
export function homeAnchor(
	layout: BaseLayout,
	selection: { kind: 'building'; key: string } | { kind: 'mine'; id: number },
	levelOf: (key: string) => number,
	maxOf: (key: string) => number,
	view: IsoView = HOME_VIEW
): { top: { x: number; y: number }; foot: { x: number; y: number } } | null {
	let rect: { x: number; y: number; width: number; height: number } | null = null;
	let tall = 0.9;
	if (selection.kind === 'mine') {
		const mine = layout.mines.find((candidate) => candidate.id === selection.id);
		if (!mine) return null;
		rect = { x: mine.x, y: mine.y, width: 1, height: 1 };
		tall = 0.8;
	} else {
		const key = selection.key;
		if (key in layout.positions) {
			const at = positionOf(layout, key as LayoutKey);
			rect = { ...at, ...footprintOf(key as LayoutKey) };
			tall = heightOf(key as LayoutKey, stageOf(levelOf(key), maxOf(key)));
		} else if (key === 'sawmill') rect = SAWMILL;
		else if (key === 'quarry') rect = QUARRY;
		else if (key === 'mine') {
			rect = MOUNTAIN;
			tall = 1.6;
		} else if (key.startsWith('house-')) {
			rect = { x: HOUSES.x + Number(key.slice('house-'.length)), y: HOUSES.y, width: 1, height: 1 };
		} else if (key.startsWith('boat-')) {
			const dock = boatDock(Number(key.slice('boat-'.length)));
			rect = { x: dock.x, y: dock.y, width: 1, height: 1.6 };
			tall = 0.6;
		}
	}
	if (!rect) return null;
	const middle = view.project(rect.x + rect.width / 2, rect.y + rect.height / 2);
	const front = view.project(rect.x + rect.width, rect.y + rect.height);
	return {
		top: { x: middle.x, y: middle.y - tall - view.halfH * 0.6 },
		foot: { x: middle.x, y: front.y + view.halfH * 0.3 }
	};
}

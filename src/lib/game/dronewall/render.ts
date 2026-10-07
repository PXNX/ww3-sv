/*
 * Canvas drawing for Drone Wall, all in world units (see config.ts) and scaled by the caller.
 * Everything is original: chunky blob soldiers with thick ink outlines, flat fills, no blood.
 * Fallen soldiers tumble away and breaches or blasts end in a white poof.
 */
import {
	FLYERS,
	HELMET_FLY_MS,
	HELMET_POP_MS,
	HELMET_TARGET,
	LINE_Y,
	MAX_LEVEL,
	SOLDIERS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	defenseStats,
	isFlyerKind,
	type EnemyKind,
	type FlyerKind,
	type MapTheme,
	type Point,
	type SoldierKind
} from './config';
import type { Decor, DroneWallMap } from './maps';
import { pointAt, type Path } from './path';
import type {
	Defense,
	DroneWallState,
	Flyer,
	Helmet,
	Projectile,
	Shell,
	Soldier,
	Unit
} from './state';

// Design tokens (src/lib/styles/tokens.css); a canvas cannot read Tailwind utilities
const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const FLAG_BLUE = '#4fa8d8';
const TIE_RED = '#e5484d';
const YELLOW = '#f5c83a';
const SANDBAG = '#cdbb7e';
const SOVIET_GREEN = '#6f7d3c';
const SOVIET_GREEN_DARK = '#55612e';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'tumble';
			x: number;
			y: number;
			vx: number;
			vy: number;
			spin: number;
			soldier: EnemyKind;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'poof'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'blast'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'popup'; x: number; y: number; text: string; ageMs: number; durationMs: number }
	| {
			kind: 'tracer';
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	/** Where collected helmets fly to, in world units */
	helmetTarget: Point;
	effects: readonly Effect[];
	/** Slot whose range ring is shown, or null */
	selectedSlot: number | null;
	/** Slot hint for the empty slots: draw a "+" when true */
	showEmptySlots: boolean;
}

const NO_EXTRAS: SceneExtras = {
	helmetTarget: HELMET_TARGET,
	effects: [],
	selectedSlot: null,
	showEmptySlots: false
};

function inkEllipse(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	rx: number,
	ry: number,
	fill: string,
	lineWidth = 2
) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

function polyline(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
	ctx.beginPath();
	points.forEach((point, index) => {
		if (index === 0) ctx.moveTo(point.x, point.y);
		else ctx.lineTo(point.x, point.y);
	});
}

function drawField(ctx: CanvasRenderingContext2D, map: DroneWallMap) {
	const { theme, points } = map;
	ctx.fillStyle = theme.field;
	ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	// Soft mown stripes
	ctx.fillStyle = theme.stripe;
	for (let y = 0; y < WORLD_HEIGHT; y += 56) ctx.fillRect(0, y, WORLD_WIDTH, 28);

	// The road: ink edge, then the surface
	ctx.lineJoin = 'round';
	ctx.lineCap = 'butt';
	polyline(ctx, points);
	ctx.lineWidth = 38;
	ctx.strokeStyle = INK;
	ctx.stroke();
	polyline(ctx, points);
	ctx.lineWidth = 32;
	ctx.strokeStyle = theme.road;
	ctx.stroke();
	polyline(ctx, points);
	ctx.lineWidth = 2;
	ctx.setLineDash([10, 12]);
	ctx.strokeStyle = 'rgba(17,17,17,0.18)';
	ctx.stroke();
	ctx.setLineDash([]);

	for (const prop of map.decor) drawDecor(ctx, prop, theme);
}

/** One scenery prop: a tree, pine, rock, bush or cactus, standing at its position */
function drawDecor(ctx: CanvasRenderingContext2D, prop: Decor, theme: MapTheme) {
	const leaf = theme.leaves[prop.tint % theme.leaves.length];
	ctx.save();
	ctx.translate(prop.x, prop.y);
	ctx.scale(prop.size, prop.size);
	// A shadow under everything
	ctx.beginPath();
	ctx.ellipse(1, 3, 12, 4.5, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.18)';
	ctx.fill();
	switch (prop.kind) {
		case 'tree':
			ctx.fillStyle = '#7a5a3a';
			ctx.fillRect(-2.5, -8, 5, 11);
			ctx.lineWidth = 1.8;
			ctx.strokeStyle = INK;
			ctx.strokeRect(-2.5, -8, 5, 11);
			inkEllipse(ctx, 0, -16, 12, 11, leaf, 2);
			inkEllipse(ctx, -4, -19, 4, 3, 'rgba(255,255,255,0.3)', 0.1);
			break;
		case 'pine':
			ctx.fillStyle = '#6b4f36';
			ctx.fillRect(-2, -3, 4, 6);
			for (const [y, half] of [
				[-4, 11],
				[-13, 9],
				[-21, 6.5]
			]) {
				ctx.beginPath();
				ctx.moveTo(-half, y);
				ctx.lineTo(0, y - 12);
				ctx.lineTo(half, y);
				ctx.closePath();
				ctx.fillStyle = leaf;
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = INK;
				ctx.stroke();
				// Snow on the branches
				ctx.beginPath();
				ctx.moveTo(-half * 0.45, y - 6.5);
				ctx.lineTo(0, y - 12);
				ctx.lineTo(half * 0.45, y - 6.5);
				ctx.closePath();
				ctx.fillStyle = PAPER;
				ctx.fill();
			}
			break;
		case 'rock':
			ctx.beginPath();
			ctx.moveTo(-11, 3);
			ctx.lineTo(-8, -7);
			ctx.lineTo(1, -10);
			ctx.lineTo(10, -4);
			ctx.lineTo(11, 3);
			ctx.closePath();
			ctx.fillStyle = '#9a9a96';
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-6, -4);
			ctx.lineTo(0, -7);
			ctx.lineWidth = 2;
			ctx.strokeStyle = 'rgba(255,255,255,0.6)';
			ctx.stroke();
			break;
		case 'bush':
			inkEllipse(ctx, -6, -3, 7, 6, leaf, 2);
			inkEllipse(ctx, 6, -3, 7, 6, leaf, 2);
			inkEllipse(ctx, 0, -7, 8, 7, leaf, 2);
			break;
		case 'cactus':
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.fillStyle = leaf;
			for (const rect of [
				[-3.5, -22, 7, 26],
				[-12, -15, 5, 9],
				[7, -12, 5, 9]
			]) {
				ctx.beginPath();
				ctx.roundRect(rect[0], rect[1], rect[2], rect[3], 3);
				ctx.fill();
				ctx.stroke();
			}
			break;
	}
	ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, map: DroneWallMap) {
	// The Ukrainian line: a sandbag wall with the flag colours
	const top = LINE_Y + 4;
	const exit = map.points[map.points.length - 1].x;
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(0, top, WORLD_WIDTH, (WORLD_HEIGHT - top) / 2);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(0, top + (WORLD_HEIGHT - top) / 2, WORLD_WIDTH, (WORLD_HEIGHT - top) / 2);
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.strokeRect(-2, top, WORLD_WIDTH + 4, WORLD_HEIGHT - top + 2);
	// Sandbags along the top edge, with a gap where the road comes in
	for (let x = 8; x < WORLD_WIDTH; x += 30) {
		if (Math.abs(x - exit) < 24) continue;
		inkEllipse(ctx, x, top, 14, 7, SANDBAG);
	}
}

function drawSlot(
	ctx: CanvasRenderingContext2D,
	slots: readonly Point[],
	slot: number,
	selected: boolean,
	showEmpty: boolean,
	occupied: boolean
) {
	const { x, y } = slots[slot];
	if (!occupied) {
		ctx.beginPath();
		ctx.arc(x, y, 21, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.4)';
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.setLineDash([6, 5]);
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.setLineDash([]);
		if (showEmpty) {
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x - 7, y);
			ctx.lineTo(x + 7, y);
			ctx.moveTo(x, y - 7);
			ctx.lineTo(x, y + 7);
			ctx.stroke();
		}
	}
	if (selected) {
		ctx.beginPath();
		ctx.arc(x, y, 26, 0, Math.PI * 2);
		ctx.lineWidth = 4;
		ctx.strokeStyle = YELLOW;
		ctx.stroke();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
}

function drawRangeRing(
	ctx: CanvasRenderingContext2D,
	slots: readonly Point[],
	slot: number,
	defense: Defense | null
) {
	if (!defense) return;
	const { x, y } = slots[slot];
	const stats = defenseStats(defense.kind, defense.level);
	ctx.beginPath();
	ctx.arc(x, y, stats.range, 0, Math.PI * 2);
	ctx.fillStyle = defense.kind === 'trench' ? 'rgba(120,80,40,0.14)' : 'rgba(255,255,255,0.14)';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.setLineDash([8, 6]);
	ctx.strokeStyle = 'rgba(17,17,17,0.55)';
	ctx.stroke();
	ctx.setLineDash([]);
}

function drawPips(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
	for (let i = 0; i < MAX_LEVEL; i++) {
		ctx.beginPath();
		ctx.arc(x + (i - 1) * 8, y, 3, 0, Math.PI * 2);
		ctx.fillStyle = i < level ? YELLOW : 'rgba(255,255,255,0.6)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
}

/** A friendly blob with a generic round patch on the chest (no real insignia) */
function drawSquad(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	defense: Defense,
	t: number
) {
	inkEllipse(ctx, x, y + 9, 21, 9, SANDBAG);
	const recoil = defense.firedMs > 0 ? Math.sin(t / 25) * 1.2 : 0;
	const bob = Math.sin(t / 300) * 0.8;
	// Rifle toward the target
	ctx.save();
	ctx.translate(x, y - 2 + bob);
	ctx.rotate(defense.aim);
	ctx.fillStyle = '#3b4048';
	ctx.fillRect(6 + recoil, -2, 17, 4);
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = INK;
	ctx.strokeRect(6 + recoil, -2, 17, 4);
	if (defense.firedMs > 90) {
		ctx.beginPath();
		ctx.arc(26, 0, 4.5, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
	}
	ctx.restore();
	inkEllipse(ctx, x, y + bob, 12, 13, FLAG_BLUE);
	// Helmet
	ctx.beginPath();
	ctx.ellipse(x, y - 9 + bob, 12, 8, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = '#4d5a38';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// Eyes
	for (const dx of [-4, 4]) {
		ctx.beginPath();
		ctx.arc(x + dx, y - 3 + bob, 2.2, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(
			x + dx + Math.cos(defense.aim),
			y - 3 + bob + Math.sin(defense.aim),
			1.1,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	// The patch: a round badge with a chevron
	ctx.beginPath();
	ctx.arc(x, y + 6 + bob, 5.5, 0, Math.PI * 2);
	ctx.fillStyle = PAPER;
	ctx.fill();
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x - 3, y + 7.5 + bob);
	ctx.lineTo(x, y + 4 + bob);
	ctx.lineTo(x + 3, y + 7.5 + bob);
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = TIE_RED;
	ctx.stroke();
	ctx.strokeStyle = INK;
}

function drawMortar(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	defense: Defense,
	t: number
) {
	inkEllipse(ctx, x, y + 8, 21, 10, SANDBAG);
	inkEllipse(ctx, x, y + 6, 12, 5, '#4a4f57');
	// Tube, tilted toward the target; it kicks back when it fires
	const kick = defense.firedMs > 0 ? -3 : 0;
	ctx.save();
	ctx.translate(x, y + 2);
	ctx.rotate(defense.aim);
	ctx.fillStyle = '#2f343b';
	ctx.fillRect(-4 + kick, -5, 24, 10);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.strokeRect(-4 + kick, -5, 24, 10);
	ctx.fillStyle = '#555c66';
	ctx.fillRect(18 + kick, -6.5, 5, 13);
	ctx.strokeRect(18 + kick, -6.5, 5, 13);
	ctx.restore();
	if (defense.firedMs > 90) {
		const flash = defense.firedMs / 160;
		ctx.beginPath();
		ctx.arc(
			x + Math.cos(defense.aim) * 24,
			y + 2 + Math.sin(defense.aim) * 24,
			8 * flash,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = YELLOW;
		ctx.fill();
	}
	// A crew blob peeking out behind the sandbags
	const peek = Math.sin(t / 420) * 0.8;
	inkEllipse(ctx, x - 12, y - 6 + peek, 7, 7.5, FLAG_BLUE);
	ctx.beginPath();
	ctx.ellipse(x - 12, y - 11 + peek, 7, 5, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = '#4d5a38';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
}

function drawNest(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	defense: Defense,
	t: number
) {
	inkEllipse(ctx, x, y + 9, 21, 9, SANDBAG);
	// A little crate with an H on it
	ctx.fillStyle = '#9a7b4f';
	ctx.fillRect(x - 11, y - 2, 22, 14);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.strokeRect(x - 11, y - 2, 22, 14);
	ctx.font = `700 11px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = INK;
	ctx.fillText('FPV', x, y + 5.5);
	// The drone hovers above, rotors a blur
	const hover = Math.sin(t / 240) * 2;
	const dy = y - 13 + hover;
	const spin = Math.sin(t / 28) > 0 ? 7 : 5;
	for (const dx of [-11, 11]) {
		ctx.beginPath();
		ctx.ellipse(x + dx, dy - 4, spin, 2, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x, dy);
		ctx.lineTo(x + dx, dy - 3);
		ctx.stroke();
	}
	inkEllipse(ctx, x, dy, 7, 4.5, '#3b4048');
	ctx.beginPath();
	ctx.arc(x, dy, 1.8, 0, Math.PI * 2);
	ctx.fillStyle = defense.cooldownMs > 0 ? TIE_RED : '#6ef07a';
	ctx.fill();
}

/** A Patriot launcher: a truck bed with four canisters that swing toward the aircraft */
function drawPatriot(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	defense: Defense,
	t: number
) {
	inkEllipse(ctx, x, y + 10, 23, 9, SANDBAG);
	// The truck bed and a radar dish on a post
	ctx.beginPath();
	ctx.roundRect(x - 18, y + 1, 36, 10, 3);
	ctx.fillStyle = SOVIET_GREEN_DARK;
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	for (const dx of [-11, 11]) inkEllipse(ctx, x + dx, y + 12, 3.6, 3.6, '#2f343b', 1.5);
	const dish = Math.sin(t / 500) * 0.4;
	ctx.save();
	ctx.translate(x + 15, y - 1);
	ctx.rotate(dish);
	ctx.fillStyle = '#d9d6c3';
	ctx.beginPath();
	ctx.ellipse(0, -5, 2.6, 6.5, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
	// Four canisters, tilted toward the target (never pointing at the ground)
	const angle = Math.min(-0.35, Math.max(-Math.PI + 0.35, defense.aim));
	const kick = defense.firedMs > 0 ? -2 : 0;
	ctx.save();
	ctx.translate(x - 2, y - 2);
	ctx.rotate(angle);
	for (const dy of [-6.5, -2.2, 2.2, 6.5]) {
		ctx.fillStyle = '#e8e4d0';
		ctx.fillRect(-4 + kick, dy - 1.8, 22, 3.6);
		ctx.lineWidth = 1.5;
		ctx.strokeRect(-4 + kick, dy - 1.8, 22, 3.6);
		ctx.fillStyle = TIE_RED;
		ctx.fillRect(15 + kick, dy - 1.8, 3, 3.6);
	}
	ctx.restore();
	if (defense.firedMs > 90) {
		const flash = defense.firedMs / 160;
		ctx.beginPath();
		ctx.arc(x - 2 + Math.cos(angle) * 22, y - 2 + Math.sin(angle) * 22, 9 * flash, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	// The crew, peeking over the bed
	const peek = Math.sin(t / 380) * 0.8;
	inkEllipse(ctx, x - 14, y + 2 + peek, 6.5, 6.5, FLAG_BLUE);
	ctx.beginPath();
	ctx.ellipse(x - 14, y - 2 + peek, 6.5, 4.6, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = '#4d5a38';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
}

function drawTrench(ctx: CanvasRenderingContext2D, x: number, y: number, defense: Defense) {
	// A dug-in strip with sandbags along its lip
	ctx.beginPath();
	ctx.roundRect(x - 20, y - 8, 40, 18, 7);
	ctx.fillStyle = '#6f5b3d';
	ctx.fill();
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.strokeStyle = 'rgba(17,17,17,0.35)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - 14, y + 1);
	ctx.lineTo(x - 7, y - 3);
	ctx.lineTo(x, y + 1);
	ctx.lineTo(x + 7, y - 3);
	ctx.lineTo(x + 14, y + 1);
	ctx.stroke();
	for (const dx of [-14, 0, 14]) inkEllipse(ctx, x + dx, y - 9, 8, 4.5, SANDBAG, 1.8);
	// Mines from level 2: little round buttons with spikes
	if (defense.level >= 2) {
		for (const [dx, dy] of defense.level >= 3
			? [
					[-26, 12],
					[0, 18],
					[26, 12]
				]
			: [
					[-26, 12],
					[26, 12]
				]) {
			ctx.save();
			ctx.translate(x + dx, y + dy);
			ctx.strokeStyle = INK;
			ctx.lineWidth = 1.8;
			for (let i = 0; i < 6; i++) {
				const a = (i / 6) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
				ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
				ctx.stroke();
			}
			inkEllipse(ctx, 0, 0, 4.5, 4.5, TIE_RED, 1.8);
			ctx.restore();
		}
	}
}

/** A sandbag post with a tent (Azov) or a vehicle shed (Leopard) and a flag */
function drawGarrisonPost(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	kind: 'azov' | 'leopard',
	t: number
) {
	inkEllipse(ctx, x, y + 10, 24, 10, SANDBAG);
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	if (kind === 'azov') {
		// A tent
		ctx.beginPath();
		ctx.moveTo(x - 17, y + 8);
		ctx.lineTo(x - 2, y - 14);
		ctx.lineTo(x + 13, y + 8);
		ctx.closePath();
		ctx.fillStyle = '#5d6b45';
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 2, y - 14);
		ctx.lineTo(x - 2, y + 8);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 6, y + 8);
		ctx.lineTo(x - 2, y - 1);
		ctx.lineTo(x + 2, y + 8);
		ctx.fillStyle = '#2b3022';
		ctx.fill();
	} else {
		// A shed with an arched door for the tank
		ctx.beginPath();
		ctx.roundRect(x - 19, y - 9, 34, 19, 3);
		ctx.fillStyle = '#6b705f';
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 12, y + 10);
		ctx.lineTo(x - 12, y);
		ctx.quadraticCurveTo(x - 2, y - 9, x + 8, y);
		ctx.lineTo(x + 8, y + 10);
		ctx.closePath();
		ctx.fillStyle = '#2b3022';
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#59604d';
		ctx.fillRect(x - 19, y - 12, 34, 4);
		ctx.strokeRect(x - 19, y - 12, 34, 4);
	}
	// The flag on its pole, waving a little
	const wave = Math.sin(t / 220) * 1.2;
	ctx.beginPath();
	ctx.moveTo(x + 17, y + 8);
	ctx.lineTo(x + 17, y - 22);
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(x + 17, y - 22, 12, 4 + wave * 0.3);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(x + 17, y - 18 + wave * 0.3, 12, 4 + wave * 0.3);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(x + 17, y - 22, 12, 8 + wave * 0.6);
}

function drawDefense(
	ctx: CanvasRenderingContext2D,
	slots: readonly Point[],
	slot: number,
	defense: Defense,
	timeMs: number
) {
	const { x, y } = slots[slot];
	switch (defense.kind) {
		case 'squad':
			drawSquad(ctx, x, y, defense, timeMs);
			break;
		case 'mortar':
			drawMortar(ctx, x, y, defense, timeMs);
			break;
		case 'nest':
			drawNest(ctx, x, y, defense, timeMs);
			break;
		case 'patriot':
			drawPatriot(ctx, x, y, defense, timeMs);
			break;
		case 'azov':
		case 'leopard':
			drawGarrisonPost(ctx, x, y, defense.kind, timeMs);
			break;
		case 'trench':
			drawTrench(ctx, x, y, defense);
			break;
	}
	drawPips(ctx, x, y + 25, defense.level);
}

const BODY: Record<SoldierKind, string> = {
	scout: '#c9aa82',
	grunt: '#a58e75',
	brute: '#7a655a',
	runner: '#d6b985',
	shield: '#8f8a7a',
	btr: '#6c7358'
};
const HAT: Record<SoldierKind, string> = {
	scout: '#5e6168',
	grunt: '#4b4f55',
	brute: '#35383d',
	runner: '#8a3b36',
	shield: '#2f4a6b',
	btr: '#59604d'
};

/** A chunky blob soldier standing at (0, 0) of the current transform */
/** An armored car with angry eyes behind the windscreen, standing at (0, 0) */
function drawBtr(ctx: CanvasRenderingContext2D, t: number, phase: number, flash: boolean) {
	const r = SOLDIERS.btr.radius;
	const rumble = Math.sin(t / 55 + phase) * 0.6;
	// Wheels
	for (const dx of [-0.95, -0.32, 0.32, 0.95]) {
		inkEllipse(ctx, dx * r, r * 0.78 + rumble * 0.4, r * 0.24, r * 0.26, INK, 1.2);
	}
	ctx.beginPath();
	ctx.roundRect(-r * 1.25, -r * 0.7 + rumble, r * 2.5, r * 1.5, 7);
	ctx.fillStyle = flash ? PAPER : BODY.btr;
	ctx.fill();
	ctx.lineWidth = 2.6;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// A turret with a stubby gun
	ctx.fillStyle = flash ? PAPER : HAT.btr;
	ctx.fillRect(-2, -r * 1.35 + rumble, 4, r * 0.55);
	ctx.strokeRect(-2, -r * 1.35 + rumble, 4, r * 0.55);
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.7 + rumble, r * 0.62, r * 0.38, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	// The windscreen with the eyes
	ctx.beginPath();
	ctx.roundRect(-r * 0.85, -r * 0.2 + rumble, r * 1.7, r * 0.6, 4);
	ctx.fillStyle = flash ? PAPER : '#9fc4d6';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	for (const dx of [-0.38, 0.38]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.1 + rumble, r * 0.17, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.16 + rumble, r * 0.08, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-r * 0.62, -r * 0.02 + rumble);
	ctx.lineTo(-r * 0.15, r * 0.06 + rumble);
	ctx.moveTo(r * 0.62, -r * 0.02 + rumble);
	ctx.lineTo(r * 0.15, r * 0.06 + rumble);
	ctx.lineWidth = 1.6;
	ctx.stroke();
}

function drawBlob(
	ctx: CanvasRenderingContext2D,
	kind: SoldierKind,
	t: number,
	phase: number,
	flash: boolean,
	grumpy = true
) {
	if (kind === 'btr') {
		drawBtr(ctx, t, phase, flash);
		return;
	}
	const r = SOLDIERS[kind].radius;
	const stride = Math.sin(t / 95 + phase) * (kind === 'runner' ? 3 : 2);
	// Stubby feet
	inkEllipse(ctx, -r * 0.45, r * 0.95 + stride * 0.5, r * 0.35, r * 0.24, INK, 1);
	inkEllipse(ctx, r * 0.45, r * 0.95 - stride * 0.5, r * 0.35, r * 0.24, INK, 1);
	// Body
	inkEllipse(ctx, 0, 0, r, r * 1.05, flash ? PAPER : BODY[kind], 2.2);
	// Helmet
	ctx.beginPath();
	ctx.ellipse(0, -r * 0.35, r * 1.02, r * 0.78, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = flash ? PAPER : HAT[kind];
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// Face
	for (const dx of [-0.38, 0.38]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.08, r * 0.2, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.14, r * 0.09, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	if (grumpy) {
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(-r * 0.62, -r * 0.1);
		ctx.lineTo(-r * 0.15, r * 0.02);
		ctx.moveTo(r * 0.62, -r * 0.1);
		ctx.lineTo(r * 0.15, r * 0.02);
		ctx.stroke();
	}
	if (kind === 'brute') {
		// A big belt, because chunky
		ctx.fillStyle = '#4a3b30';
		ctx.fillRect(-r * 0.95, r * 0.45, r * 1.9, r * 0.22);
	}
	if (kind === 'shield') {
		// A riot shield held in front
		ctx.beginPath();
		ctx.roundRect(-r * 1.3, -r * 0.5, r * 1.05, r * 1.75, 4);
		ctx.fillStyle = flash ? PAPER : '#9aa6b4';
		ctx.fill();
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(-r * 1.05, -r * 0.2);
		ctx.lineTo(-r * 1.05, r * 0.95);
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}
	if (kind === 'runner') {
		// Speed lines trailing up the road
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = 'rgba(17,17,17,0.45)';
		for (const dx of [-0.5, 0.5]) {
			ctx.beginPath();
			ctx.moveTo(dx * r, -r * 1.35);
			ctx.lineTo(dx * r, -r * 2.1);
			ctx.stroke();
		}
	}
}

function drawSoldier(ctx: CanvasRenderingContext2D, soldier: Soldier, timeMs: number, road: Path) {
	const r = SOLDIERS[soldier.kind].radius;
	const sample = pointAt(road, soldier.progress);
	// Spread the crowd across the width of the road
	const side = soldier.lane * 8;
	// A soldier in a melee shakes on the spot instead of hopping along
	const shake = soldier.engaged ? Math.sin(timeMs / 38 + soldier.id) * 1.4 : 0;
	const x = soldier.x - Math.sin(sample.angle) * side + shake;
	const y = soldier.y + Math.cos(sample.angle) * side;
	const hop = soldier.engaged
		? 0
		: Math.abs(Math.sin(timeMs / 130 + soldier.id)) * 2 * soldier.slow;
	ctx.save();
	ctx.translate(x, y - hop);
	ctx.beginPath();
	ctx.ellipse(0, r * 1.1 + hop, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.25)';
	ctx.fill();
	drawBlob(ctx, soldier.kind, timeMs, soldier.id, soldier.hitMs > 0);
	if (soldier.hp < soldier.maxHp) {
		const w = r * 2;
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, -r * 1.7, w, 4);
		ctx.fillStyle = soldier.hp / soldier.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, -r * 1.7, w * Math.max(0, soldier.hp / soldier.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, -r * 1.7, w, 4);
	}
	ctx.restore();
}

/** A five-pointed star centred on (x, y) as the current path */
/** A friendly unit of a garrison post: an Azov fighter with a club, or a Leopard 2 tank */
function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, timeMs: number) {
	const flash = unit.hitMs > 0;
	const tank = unit.kind === 'leopard';
	const size = tank ? 20 : 10;
	ctx.save();
	ctx.translate(unit.x, unit.y);
	// Its shadow
	ctx.beginPath();
	ctx.ellipse(0, size * 0.95, size * (tank ? 1.5 : 1), size * 0.32, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.25)';
	ctx.fill();

	if (tank) {
		ctx.rotate(unit.facing);
		const recoil = unit.swingMs > 0 ? -4 * Math.sin((unit.swingMs / 220) * Math.PI) : 0;
		// Tracks with wheels, then the hull
		for (const dy of [-14, 7]) {
			ctx.beginPath();
			ctx.roundRect(-20, dy, 40, 7, 3.5);
			ctx.fillStyle = '#2f343b';
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = INK;
			ctx.stroke();
			for (let i = -3; i <= 3; i++) {
				ctx.beginPath();
				ctx.arc(i * 5.5, dy + 3.5, 2, 0, Math.PI * 2);
				ctx.fillStyle = '#6b727c';
				ctx.fill();
			}
		}
		ctx.beginPath();
		ctx.roundRect(-18, -9, 36, 18, 5);
		ctx.fillStyle = flash ? PAPER : '#5f6a4a';
		ctx.fill();
		ctx.lineWidth = 2.4;
		ctx.stroke();
		// The gun first, so the turret sits on top of it
		ctx.fillStyle = flash ? PAPER : '#3b4048';
		ctx.fillRect(4 + recoil, -2.2, 26, 4.4);
		ctx.strokeRect(4 + recoil, -2.2, 26, 4.4);
		ctx.fillRect(28 + recoil, -3.4, 5, 6.8);
		ctx.strokeRect(28 + recoil, -3.4, 5, 6.8);
		if (unit.swingMs > 110) {
			ctx.beginPath();
			ctx.arc(36 + recoil, 0, 6, 0, Math.PI * 2);
			ctx.fillStyle = YELLOW;
			ctx.fill();
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.ellipse(-2, 0, 12, 9.5, 0, 0, Math.PI * 2);
		ctx.fillStyle = flash ? PAPER : '#6c7858';
		ctx.fill();
		ctx.lineWidth = 2.4;
		ctx.stroke();
		// The commander, popping out of the hatch
		inkEllipse(ctx, -5, 0, 4.6, 4.6, FLAG_BLUE, 1.6);
		ctx.beginPath();
		ctx.ellipse(-5, -2, 4.8, 3.2, 0, Math.PI, 0);
		ctx.closePath();
		ctx.fillStyle = '#4d5a38';
		ctx.fill();
		ctx.stroke();
		ctx.rotate(-unit.facing);
	} else {
		const stride = Math.sin(timeMs / 80 + unit.id) * 1.5;
		// Boots, body, helmet and a patch, like the assault squad
		inkEllipse(ctx, -4, 9 + stride * 0.4, 3.3, 2.4, INK, 1);
		inkEllipse(ctx, 4, 9 - stride * 0.4, 3.3, 2.4, INK, 1);
		inkEllipse(ctx, 0, 0, 9.5, 10, flash ? PAPER : FLAG_BLUE, 2.2);
		ctx.beginPath();
		ctx.ellipse(0, -3.5, 9.8, 7.5, 0, Math.PI, 0);
		ctx.closePath();
		ctx.fillStyle = flash ? PAPER : '#4d5a38';
		ctx.fill();
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		for (const dx of [-3.5, 3.5]) {
			ctx.beginPath();
			ctx.arc(dx, -0.5, 2, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(dx + Math.cos(unit.facing), -0.5 + Math.sin(unit.facing), 1, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
		}
		ctx.fillStyle = YELLOW;
		ctx.fillRect(-9, 4, 18, 3);
		// The club swings toward the enemy
		const swing =
			unit.swingMs > 0
				? -1.1 + (1 - unit.swingMs / 220) * 2.2
				: Math.sin(timeMs / 300 + unit.id) * 0.15;
		ctx.save();
		ctx.rotate(unit.facing + swing);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(6, 0);
		ctx.lineTo(17, 0);
		ctx.lineWidth = 5;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.lineWidth = 2.6;
		ctx.strokeStyle = '#9a7b4f';
		ctx.stroke();
		ctx.lineCap = 'butt';
		ctx.restore();
	}

	if (unit.hp < unit.maxHp) {
		const w = size * 2;
		const top = -size * (tank ? 1.1 : 1.6);
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, top, w, 4);
		ctx.fillStyle = unit.hp / unit.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, top, w * Math.max(0, unit.hp / unit.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, top, w, 4);
	}
	ctx.restore();
}

function starPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	outer: number,
	inner: number
) {
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const radius = i % 2 === 0 ? outer : inner;
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;
		const px = x + Math.cos(angle) * radius;
		const py = y + Math.sin(angle) * radius;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}

/** A Soviet steel helmet (olive dome, narrow brim, rivet, red star) about (0, 0), 28 units wide */
function drawSovietHelmet(ctx: CanvasRenderingContext2D) {
	// The dome
	ctx.beginPath();
	ctx.ellipse(0, 3, 11, 10, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = SOVIET_GREEN;
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// The narrow brim
	ctx.beginPath();
	ctx.roundRect(-14, 2, 28, 4.5, 2.2);
	ctx.fillStyle = SOVIET_GREEN_DARK;
	ctx.fill();
	ctx.stroke();
	// The red star on the front, and the top rivet
	starPath(ctx, 0, -2.6, 4.6, 1.9);
	ctx.fillStyle = TIE_RED;
	ctx.fill();
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, -8.6, 1.3, 0, Math.PI * 2);
	ctx.fillStyle = SOVIET_GREEN_DARK;
	ctx.fill();
	ctx.stroke();
	// A shine
	ctx.beginPath();
	ctx.arc(-6.2, -0.5, 3.4, Math.PI * 1.05, Math.PI * 1.45);
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = 'rgba(255,255,255,0.8)';
	ctx.stroke();
}

const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * A dropped helmet pops up where the soldier fell, then arcs to the helmet counter, trailing
 * sparkles and shrinking a little as it goes in (the game adds it to the pocket when it lands).
 */
function drawHelmetPickup(
	ctx: CanvasRenderingContext2D,
	helmet: Helmet,
	timeMs: number,
	target: Point
) {
	const size = helmet.value > 1 ? 1.3 : 1;
	let x = helmet.x;
	let y = helmet.y - 6;
	let scale: number;
	let spin = 0;

	if (helmet.ageMs < HELMET_POP_MS) {
		// A little hop with a bounce
		const p = helmet.ageMs / HELMET_POP_MS;
		scale = Math.max(0.05, easeOutBack(p));
		y -= Math.sin(p * Math.PI) * 14;
	} else {
		const q = Math.min(1, (helmet.ageMs - HELMET_POP_MS) / HELMET_FLY_MS);
		const e = smoothstep(q);
		const at = (amount: number) => ({
			x: helmet.x + (target.x - helmet.x) * amount,
			// The arc lifts the helmet up before it drops into the counter
			y: helmet.y - 6 + (target.y - (helmet.y - 6)) * amount - Math.sin(Math.PI * amount) * 36
		});
		// Sparkles trail behind the helmet
		for (let i = 3; i >= 1; i--) {
			const trail = at(Math.max(0, e - i * 0.07));
			ctx.beginPath();
			ctx.arc(trail.x, trail.y + 2, 5 - i, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(245,200,58,${0.55 - i * 0.14})`;
			ctx.fill();
		}
		({ x, y } = at(e));
		scale = 1 - 0.3 * e;
		spin = Math.sin(q * Math.PI) * 0.45;
	}

	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.scale(scale * size, scale * size);
	// A soft glow so the helmet reads against the field
	ctx.beginPath();
	ctx.arc(0, 2, 15 + Math.sin(timeMs / 150) * 1.2, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.fill();
	drawSovietHelmet(ctx);
	ctx.restore();

	if (helmet.value > 1 && helmet.ageMs < HELMET_POP_MS + 120) {
		ctx.font = `700 12px ${DISPLAY_FONT}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineWidth = 3;
		ctx.strokeStyle = INK;
		ctx.fillStyle = PAPER;
		const text = `×${helmet.value}`;
		ctx.strokeText(text, helmet.x, helmet.y + 14);
		ctx.fillText(text, helmet.x, helmet.y + 14);
	}
}

/** The body of an aerial enemy about (0, 0), flying toward the bottom of the field */
function drawFlyerBody(ctx: CanvasRenderingContext2D, kind: FlyerKind, t: number, flash: boolean) {
	const r = FLYERS[kind].radius;
	if (kind === 'shahed') {
		// A delta-wing kamikaze drone with a buzzing propeller and a grumpy face
		const buzz = Math.sin(t / 22) > 0 ? 1 : 0.6;
		ctx.beginPath();
		ctx.ellipse(0, -r * 1.05, r * 0.7 * buzz, r * 0.2, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.7)';
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, r * 1.15);
		ctx.lineTo(r * 1.25, -r * 0.85);
		ctx.lineTo(0, -r * 0.45);
		ctx.lineTo(-r * 1.25, -r * 0.85);
		ctx.closePath();
		ctx.fillStyle = flash ? PAPER : '#b9b4a0';
		ctx.fill();
		ctx.lineWidth = 2.2;
		ctx.stroke();
		for (const dx of [-0.26, 0.26]) {
			ctx.beginPath();
			ctx.arc(dx * r, r * 0.12, r * 0.17, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(dx * r, r * 0.2, r * 0.08, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
		}
		ctx.beginPath();
		ctx.moveTo(-r * 0.48, -r * 0.05);
		ctx.lineTo(-r * 0.1, r * 0.06);
		ctx.moveTo(r * 0.48, -r * 0.05);
		ctx.lineTo(r * 0.1, r * 0.06);
		ctx.lineWidth = 1.5;
		ctx.stroke();
		// A red band on each wing
		ctx.beginPath();
		ctx.moveTo(-r * 0.8, -r * 0.55);
		ctx.lineTo(-r * 1.1, -r * 0.75);
		ctx.moveTo(r * 0.8, -r * 0.55);
		ctx.lineTo(r * 1.1, -r * 0.75);
		ctx.lineWidth = 3;
		ctx.strokeStyle = TIE_RED;
		ctx.stroke();
		return;
	}
	// A helicopter: tail boom up, canopy with eyes down, spinning rotor on top
	ctx.beginPath();
	ctx.roundRect(-r * 0.12, -r * 1.9, r * 0.24, r * 1.2, 2);
	ctx.fillStyle = flash ? PAPER : '#59604d';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(0, -r * 1.85, r * 0.45, r * 0.12, t / 35, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.7)';
	ctx.fill();
	ctx.stroke();
	inkEllipse(ctx, 0, 0, r * 0.95, r * 0.85, flash ? PAPER : '#6b705f', 2.4);
	// The canopy glass with angry eyes
	ctx.beginPath();
	ctx.ellipse(0, r * 0.28, r * 0.68, r * 0.5, 0, 0, Math.PI * 2);
	ctx.fillStyle = flash ? PAPER : '#9fc4d6';
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.stroke();
	for (const dx of [-0.3, 0.3]) {
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.3, r * 0.15, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(dx * r, r * 0.36, r * 0.07, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(-r * 0.5, r * 0.1);
	ctx.lineTo(-r * 0.12, r * 0.2);
	ctx.moveTo(r * 0.5, r * 0.1);
	ctx.lineTo(r * 0.12, r * 0.2);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	// The main rotor: two blades and a faint disc
	ctx.beginPath();
	ctx.arc(0, -r * 0.1, r * 1.9, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.18)';
	ctx.fill();
	ctx.save();
	ctx.translate(0, -r * 0.1);
	ctx.rotate(t / 45);
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.strokeStyle = INK;
	ctx.beginPath();
	ctx.moveTo(-r * 1.9, 0);
	ctx.lineTo(r * 1.9, 0);
	ctx.stroke();
	ctx.restore();
	ctx.lineCap = 'butt';
	inkEllipse(ctx, 0, -r * 0.1, 2.6, 2.6, '#2f343b', 1.4);
}

function drawFlyer(ctx: CanvasRenderingContext2D, flyer: Flyer, timeMs: number) {
	const r = FLYERS[flyer.kind].radius;
	// Its shadow slides over the ground below
	ctx.beginPath();
	ctx.ellipse(flyer.x + 8, flyer.y + r * 2.1, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.22)';
	ctx.fill();
	ctx.save();
	ctx.translate(flyer.x, flyer.y + Math.sin(timeMs / 170 + flyer.id) * 1.5);
	drawFlyerBody(ctx, flyer.kind, timeMs + flyer.id * 37, flyer.hitMs > 0);
	if (flyer.hp < flyer.maxHp) {
		const w = r * 2;
		ctx.fillStyle = PAPER;
		ctx.fillRect(-w / 2, -r * 2.3, w, 4);
		ctx.fillStyle = flyer.hp / flyer.maxHp > 0.4 ? '#6ac05c' : TIE_RED;
		ctx.fillRect(-w / 2, -r * 2.3, w * Math.max(0, flyer.hp / flyer.maxHp), 4);
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = INK;
		ctx.strokeRect(-w / 2, -r * 2.3, w, 4);
	}
	ctx.restore();
}

/** An FPV drone (a small quadcopter) or a Patriot missile, pointing the way it flies */
function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, timeMs: number) {
	const dx = Math.cos(p.angle);
	const dy = Math.sin(p.angle);
	// A short trail behind it
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(p.x, p.y);
	ctx.lineTo(
		p.x - dx * (p.kind === 'missile' ? 20 : 12),
		p.y - dy * (p.kind === 'missile' ? 20 : 12)
	);
	ctx.lineWidth = p.kind === 'missile' ? 5 : 3;
	ctx.strokeStyle = p.kind === 'missile' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)';
	ctx.stroke();
	ctx.lineCap = 'butt';

	ctx.save();
	ctx.translate(p.x, p.y);
	if (p.kind === 'missile') {
		ctx.rotate(p.angle);
		// The flame flickers behind the body
		ctx.beginPath();
		ctx.ellipse(-9 - Math.sin(timeMs / 30) * 1.5, 0, 4.5, 2.6, 0, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
		ctx.beginPath();
		ctx.roundRect(-8, -2.6, 15, 5.2, 2.2);
		ctx.fillStyle = '#e8e4d0';
		ctx.fill();
		ctx.lineWidth = 1.8;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(7, -2.6);
		ctx.lineTo(11.5, 0);
		ctx.lineTo(7, 2.6);
		ctx.closePath();
		ctx.fillStyle = TIE_RED;
		ctx.fill();
		ctx.stroke();
	} else {
		// Four rotor blurs around a dark body; it tilts into the dive
		ctx.rotate(p.angle * 0.15);
		const spin = Math.sin(timeMs / 24 + p.id) > 0 ? 3.2 : 2.4;
		for (const [rx, ry] of [
			[-5, -4],
			[5, -4],
			[-5, 4],
			[5, 4]
		]) {
			ctx.beginPath();
			ctx.ellipse(rx, ry, spin, 1.6, 0, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.8)';
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = INK;
			ctx.stroke();
		}
		inkEllipse(ctx, 0, 0, 4.2, 3, '#3b4048', 1.5);
		ctx.beginPath();
		ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
		ctx.fillStyle = TIE_RED;
		ctx.fill();
	}
	ctx.restore();
}

function drawShell(ctx: CanvasRenderingContext2D, shell: Shell) {
	const t = Math.min(1, shell.ageMs / shell.flightMs);
	const x = shell.fromX + (shell.toX - shell.fromX) * t;
	const ground = shell.fromY + (shell.toY - shell.fromY) * t;
	const y = ground - Math.sin(Math.PI * t) * 70;
	// Where it will land
	ctx.beginPath();
	ctx.arc(shell.toX, shell.toY, shell.radius, 0, Math.PI * 2);
	ctx.fillStyle = `rgba(229,72,77,${0.08 + 0.12 * t})`;
	ctx.fill();
	ctx.setLineDash([5, 5]);
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(229,72,77,0.8)';
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.beginPath();
	ctx.ellipse(x, ground, 4, 2, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(17,17,17,0.3)';
	ctx.fill();
	inkEllipse(ctx, x, y, 4.5, 4.5, '#2f343b', 1.8);
}

function progressOf(effect: { ageMs: number; durationMs: number }) {
	return Math.min(1, effect.ageMs / effect.durationMs);
}

function drawPoof(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, p: number) {
	const grow = 0.5 + 0.5 * Math.min(1, p * 2.4);
	ctx.globalAlpha = 1 - p * p;
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + 0.4;
		const d = size * 0.5 * grow * (0.6 + (0.4 * ((i * 7) % 3)) / 2);
		inkEllipse(
			ctx,
			x + Math.cos(a) * d,
			y + Math.sin(a) * d * 0.8,
			size * 0.28 * grow,
			size * 0.28 * grow,
			PAPER,
			1.8
		);
	}
	inkEllipse(ctx, x, y, size * 0.34 * grow, size * 0.34 * grow, SAND, 1.8);
	ctx.globalAlpha = 1;
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: Effect) {
	const p = progressOf(effect);
	switch (effect.kind) {
		case 'tumble': {
			// Launched into the air, spinning, then gone: no blood, just a goofy tumble
			const seconds = effect.ageMs / 1000;
			const x = effect.x + effect.vx * seconds;
			const y = effect.y + effect.vy * seconds + 260 * seconds * seconds;
			ctx.save();
			ctx.globalAlpha = 1 - p * p;
			ctx.translate(x, y);
			ctx.rotate(effect.spin * seconds);
			if (isFlyerKind(effect.soldier)) drawFlyerBody(ctx, effect.soldier, effect.ageMs, false);
			else drawBlob(ctx, effect.soldier, effect.ageMs, 0, false, false);
			ctx.restore();
			break;
		}
		case 'poof':
			drawPoof(ctx, effect.x, effect.y, effect.size, p);
			break;
		case 'blast': {
			const grow = Math.min(1, p * 2.2);
			ctx.globalAlpha = 1 - p;
			inkEllipse(ctx, effect.x, effect.y, effect.size * grow, effect.size * grow * 0.85, YELLOW, 3);
			inkEllipse(
				ctx,
				effect.x,
				effect.y,
				effect.size * grow * 0.6,
				effect.size * grow * 0.5,
				PAPER,
				2
			);
			ctx.globalAlpha = 1;
			if (p > 0.15) drawPoof(ctx, effect.x, effect.y, effect.size * 1.1, (p - 0.15) / 0.85);
			break;
		}
		case 'popup': {
			ctx.globalAlpha = 1 - p * p;
			ctx.font = `700 15px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 4;
			ctx.strokeStyle = INK;
			ctx.fillStyle = YELLOW;
			const y = effect.y - 12 - p * 22;
			ctx.strokeText(effect.text, effect.x, y);
			ctx.fillText(effect.text, effect.x, y);
			ctx.globalAlpha = 1;
			break;
		}
		case 'tracer':
			ctx.globalAlpha = 1 - p;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(effect.x1, effect.y1);
			ctx.lineTo(effect.x2, effect.y2);
			ctx.lineWidth = 2.5;
			ctx.strokeStyle = YELLOW;
			ctx.stroke();
			ctx.lineCap = 'butt';
			ctx.globalAlpha = 1;
			break;
	}
}

export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: DroneWallState,
	extras: SceneExtras = NO_EXTRAS
) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	ctx.clip();
	const { map } = state;
	drawField(ctx, map);
	drawLine(ctx, map);

	if (extras.selectedSlot !== null) {
		drawRangeRing(ctx, map.slots, extras.selectedSlot, state.defenses[extras.selectedSlot] ?? null);
	}
	// Trenches lie flat on the ground, below the crowd
	state.defenses.forEach((defense, slot) => {
		drawSlot(
			ctx,
			map.slots,
			slot,
			slot === extras.selectedSlot,
			extras.showEmptySlots,
			defense !== null
		);
		if (defense?.kind === 'trench') drawDefense(ctx, map.slots, slot, defense, state.timeMs);
	});

	const standing = [...state.soldiers].sort((a, b) => a.y - b.y);
	for (const soldier of standing) drawSoldier(ctx, soldier, state.timeMs, map.road);

	state.defenses.forEach((defense, slot) => {
		if (defense && defense.kind !== 'trench') {
			drawDefense(ctx, map.slots, slot, defense, state.timeMs);
		}
	});
	// Defender units walk about their posts, in front of them
	for (const unit of [...state.units].sort((a, b) => a.y - b.y)) drawUnit(ctx, unit, state.timeMs);
	for (const shell of state.shells) drawShell(ctx, shell);
	// Aircraft fly above everything on the ground, and the projectiles above them
	for (const flyer of state.flyers) drawFlyer(ctx, flyer, state.timeMs);
	for (const projectile of state.projectiles) drawProjectile(ctx, projectile, state.timeMs);
	for (const effect of extras.effects) drawEffect(ctx, effect);
	for (const helmet of state.helmets) {
		drawHelmetPickup(ctx, helmet, state.timeMs, extras.helmetTarget);
	}
	ctx.restore();
}

/** Draws the final field onto the shared score card */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: DroneWallState,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_HEIGHT;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, size, size);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(x, y, size, size);
	ctx.translate(x + (size - WORLD_WIDTH * scale) / 2, y);
	ctx.scale(scale, scale);
	drawScene(ctx, state, { ...NO_EXTRAS, showEmptySlots: false });
	ctx.restore();
}

/*
 * Canvas drawing for Drone Wall, all in world units (see config.ts) and scaled by the caller.
 * Everything is original: chunky blob soldiers with thick ink outlines, flat fills, no blood.
 * Fallen soldiers tumble away and breaches or blasts end in a white poof.
 */
import {
	HELMET_BLINK_MS,
	HELMET_TTL_MS,
	LINE_Y,
	MAX_LEVEL,
	PATH_POINTS,
	SLOTS,
	SOLDIERS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	defenseStats,
	type SoldierKind
} from './config';
import { ROAD, pointAt } from './path';
import type { Defense, DroneWallState, Helmet, Shell, Soldier } from './state';

// Design tokens (src/lib/styles/tokens.css); a canvas cannot read Tailwind utilities
const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const FLAG_BLUE = '#4fa8d8';
const TIE_RED = '#e5484d';
const MUSTARD = '#ddb93c';
const YELLOW = '#f5c83a';
const SANDBAG = '#cdbb7e';
const FIELD = '#8c9d69';
const FIELD_DARK = '#7c8c5c';
const ROAD_FILL = '#e8dca8';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'tumble';
			x: number;
			y: number;
			vx: number;
			vy: number;
			spin: number;
			soldier: SoldierKind;
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
			drone: boolean;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Slot whose range ring is shown, or null */
	selectedSlot: number | null;
	/** Slot hint for the empty slots: draw a "+" when true */
	showEmptySlots: boolean;
}

const NO_EXTRAS: SceneExtras = { effects: [], selectedSlot: null, showEmptySlots: false };

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

function polyline(ctx: CanvasRenderingContext2D) {
	ctx.beginPath();
	PATH_POINTS.forEach((point, index) => {
		if (index === 0) ctx.moveTo(point.x, point.y);
		else ctx.lineTo(point.x, point.y);
	});
}

function drawField(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = FIELD;
	ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	// Soft mown stripes
	ctx.fillStyle = FIELD_DARK;
	for (let y = 0; y < WORLD_HEIGHT; y += 56) ctx.fillRect(0, y, WORLD_WIDTH, 28);

	// The road: ink edge, then the sand surface
	ctx.lineJoin = 'round';
	ctx.lineCap = 'butt';
	polyline(ctx);
	ctx.lineWidth = 38;
	ctx.strokeStyle = INK;
	ctx.stroke();
	polyline(ctx);
	ctx.lineWidth = 32;
	ctx.strokeStyle = ROAD_FILL;
	ctx.stroke();
	polyline(ctx);
	ctx.lineWidth = 2;
	ctx.setLineDash([10, 12]);
	ctx.strokeStyle = 'rgba(17,17,17,0.18)';
	ctx.stroke();
	ctx.setLineDash([]);
}

function drawLine(ctx: CanvasRenderingContext2D) {
	// The Ukrainian line: a sandbag wall with the flag colours
	const top = LINE_Y + 4;
	ctx.fillStyle = FLAG_BLUE;
	ctx.fillRect(0, top, WORLD_WIDTH, (WORLD_HEIGHT - top) / 2);
	ctx.fillStyle = YELLOW;
	ctx.fillRect(0, top + (WORLD_HEIGHT - top) / 2, WORLD_WIDTH, (WORLD_HEIGHT - top) / 2);
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.strokeRect(-2, top, WORLD_WIDTH + 4, WORLD_HEIGHT - top + 2);
	// Sandbags along the top edge
	for (let x = 8; x < WORLD_WIDTH; x += 30) {
		if (Math.abs(x - 310) < 24) continue;
		inkEllipse(ctx, x, top, 14, 7, SANDBAG);
	}
}

function drawSlot(
	ctx: CanvasRenderingContext2D,
	slot: number,
	selected: boolean,
	showEmpty: boolean,
	occupied: boolean
) {
	const { x, y } = SLOTS[slot];
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

function drawRangeRing(ctx: CanvasRenderingContext2D, slot: number, defense: Defense | null) {
	if (!defense) return;
	const { x, y } = SLOTS[slot];
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

function drawDefense(
	ctx: CanvasRenderingContext2D,
	slot: number,
	defense: Defense,
	timeMs: number
) {
	const { x, y } = SLOTS[slot];
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
		case 'trench':
			drawTrench(ctx, x, y, defense);
			break;
	}
	drawPips(ctx, x, y + 25, defense.level);
}

const BODY: Record<SoldierKind, string> = { scout: '#c9aa82', grunt: '#a58e75', brute: '#7a655a' };
const HAT: Record<SoldierKind, string> = { scout: '#5e6168', grunt: '#4b4f55', brute: '#35383d' };

/** A chunky blob soldier standing at (0, 0) of the current transform */
function drawBlob(
	ctx: CanvasRenderingContext2D,
	kind: SoldierKind,
	t: number,
	phase: number,
	flash: boolean,
	grumpy = true
) {
	const r = SOLDIERS[kind].radius;
	const stride = Math.sin(t / 95 + phase) * 2;
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
}

function drawSoldier(ctx: CanvasRenderingContext2D, soldier: Soldier, timeMs: number) {
	const r = SOLDIERS[soldier.kind].radius;
	const sample = pointAt(ROAD, soldier.progress);
	// Spread the crowd across the width of the road
	const side = soldier.lane * 8;
	const x = soldier.x - Math.sin(sample.angle) * side;
	const y = soldier.y + Math.cos(sample.angle) * side;
	const hop = Math.abs(Math.sin(timeMs / 130 + soldier.id)) * 2 * soldier.slow;
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

function drawHelmetPickup(ctx: CanvasRenderingContext2D, helmet: Helmet, timeMs: number) {
	const left = HELMET_TTL_MS - helmet.ageMs;
	const blinking = left < HELMET_BLINK_MS;
	if (blinking && Math.floor(left / 110) % 2 === 0) return;
	const pop = Math.min(1, helmet.ageMs / 160);
	const scale = (helmet.value > 1 ? 1.35 : 1) * (0.5 + 0.5 * pop);
	const bob = Math.sin(timeMs / 190 + helmet.id) * 2.2;
	ctx.save();
	ctx.translate(helmet.x, helmet.y - 6 + bob);
	ctx.scale(scale, scale);
	// Glow ring that invites a tap
	ctx.beginPath();
	ctx.arc(0, 2, 15 + Math.sin(timeMs / 150) * 1.5, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.45)';
	ctx.fill();
	// The dome, brim and a shine
	ctx.beginPath();
	ctx.ellipse(0, 3, 11, 10, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fillStyle = MUSTARD;
	ctx.fill();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.beginPath();
	ctx.roundRect(-14, 2, 28, 5, 2.5);
	ctx.fillStyle = YELLOW;
	ctx.fill();
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(-4, -2, 3, Math.PI, Math.PI * 1.6);
	ctx.lineWidth = 2;
	ctx.strokeStyle = PAPER;
	ctx.stroke();
	ctx.restore();
	if (helmet.value > 1) {
		ctx.font = `700 12px ${DISPLAY_FONT}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineWidth = 3;
		ctx.strokeStyle = INK;
		ctx.fillStyle = PAPER;
		const text = `×${helmet.value}`;
		ctx.strokeText(text, helmet.x, helmet.y + 14 + bob);
		ctx.fillText(text, helmet.x, helmet.y + 14 + bob);
	}
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
			drawBlob(ctx, effect.soldier, effect.ageMs, 0, false, false);
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
			ctx.lineWidth = effect.drone ? 4 : 2.5;
			ctx.strokeStyle = effect.drone ? 'rgba(255,255,255,0.9)' : YELLOW;
			if (effect.drone) ctx.setLineDash([3, 6]);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.lineCap = 'butt';
			ctx.globalAlpha = 1;
			if (effect.drone) drawPoof(ctx, effect.x2, effect.y2, 22, p);
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
	drawField(ctx);
	drawLine(ctx);

	if (extras.selectedSlot !== null) {
		drawRangeRing(ctx, extras.selectedSlot, state.defenses[extras.selectedSlot] ?? null);
	}
	// Trenches lie flat on the ground, below the crowd
	state.defenses.forEach((defense, slot) => {
		drawSlot(ctx, slot, slot === extras.selectedSlot, extras.showEmptySlots, defense !== null);
		if (defense?.kind === 'trench') drawDefense(ctx, slot, defense, state.timeMs);
	});

	const standing = [...state.soldiers].sort((a, b) => a.y - b.y);
	for (const soldier of standing) drawSoldier(ctx, soldier, state.timeMs);

	state.defenses.forEach((defense, slot) => {
		if (defense && defense.kind !== 'trench') drawDefense(ctx, slot, defense, state.timeMs);
	});
	for (const shell of state.shells) drawShell(ctx, shell);
	for (const effect of extras.effects) drawEffect(ctx, effect);
	for (const helmet of state.helmets) drawHelmetPickup(ctx, helmet, state.timeMs);
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

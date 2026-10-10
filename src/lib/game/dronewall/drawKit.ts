/*
 * Shared bits of the Drone Wall canvas drawing: the colours, the ink-outlined shapes every sprite
 * is built from, a tiny deterministic hash for particles, and the "skin" of a defense level (the
 * elite levels get a darker, gold-trimmed look).
 */
import { eliteTier, type Point } from './config';

export type Ctx = CanvasRenderingContext2D;

// Design tokens (src/lib/styles/tokens.css); a canvas cannot read Tailwind utilities
export const INK = '#111111';
export const PAPER = '#ffffff';
export const SAND = '#e8e1bc';
export const FLAG_BLUE = '#4fa8d8';
export const TIE_RED = '#e5484d';
export const YELLOW = '#f5c83a';
export const SANDBAG = '#cdbb7e';
export const SOVIET_GREEN = '#6f7d3c';
export const SOVIET_GREEN_DARK = '#55612e';
export const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

// The elite look: black armour, gold trim, red glow
export const BLACK = '#1c1e23';
export const BLACK_LIGHT = '#2e313a';
export const BLACK_DEEP = '#0f1013';
export const GOLD = '#f0b82a';
export const GOLD_DARK = '#a87b10';
export const ELITE_RED = '#d8262c';
export const GLOWS: readonly string[] = ['#f5c83a', '#ff9a2e', '#ff4a3a'];

export function inkEllipse(
	ctx: Ctx,
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

/** A filled, ink-outlined rectangle (rounded when `radius` is given) */
export function inkRect(
	ctx: Ctx,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string,
	lineWidth = 2,
	radius = 0
) {
	ctx.beginPath();
	if (radius > 0) ctx.roundRect(x, y, w, h, radius);
	else ctx.rect(x, y, w, h);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

/** A filled, ink-outlined polygon from a flat list [x0, y0, x1, y1, ...] */
export function inkPoly(ctx: Ctx, coords: readonly number[], fill: string, lineWidth = 2) {
	ctx.beginPath();
	ctx.moveTo(coords[0], coords[1]);
	for (let i = 2; i < coords.length; i += 2) ctx.lineTo(coords[i], coords[i + 1]);
	ctx.closePath();
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

export function stroke(
	ctx: Ctx,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	width: number,
	color: string | CanvasGradient
) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.lineWidth = width;
	ctx.strokeStyle = color;
	ctx.stroke();
}

export function polyline(ctx: Ctx, points: readonly Point[]) {
	ctx.beginPath();
	points.forEach((point, index) => {
		if (index === 0) ctx.moveTo(point.x, point.y);
		else ctx.lineTo(point.x, point.y);
	});
}

/** A five-pointed star centred on (x, y) as the current path */
export function starPath(ctx: Ctx, x: number, y: number, outer: number, inner: number) {
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

/** Angry white eyes with a pupil and a frowning brow each, `r` is the blob's radius */
export function angryEyes(ctx: Ctx, cx: number, cy: number, spread: number, size: number) {
	for (const dx of [-spread, spread]) {
		ctx.beginPath();
		ctx.arc(cx + dx, cy, size, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(cx + dx, cy + size * 0.5, size * 0.5, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(cx - spread - size * 1.4, cy - size * 1.1);
	ctx.lineTo(cx - spread * 0.35, cy - size * 0.4);
	ctx.moveTo(cx + spread + size * 1.4, cy - size * 1.1);
	ctx.lineTo(cx + spread * 0.35, cy - size * 0.4);
	ctx.lineWidth = Math.max(1.2, size * 0.8);
	ctx.strokeStyle = INK;
	ctx.stroke();
}

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export function progressOf(effect: { ageMs: number; durationMs: number }) {
	return Math.min(1, Math.max(0, effect.ageMs / effect.durationMs));
}

export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** A deterministic hash of an integer to [0, 1): particles never call Math.random in a frame */
export function hash01(n: number): number {
	let x = Math.imul(n | 0, 374761393) + 668265263;
	x = Math.imul(x ^ (x >>> 13), 1274126177);
	return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Looks of a defense by level: the normal levels 1 to 3, the elite ones 4 to 6 (tier 1 to 3) */
export interface Skin {
	/** 0 for a normal level, 1 to 3 for the elite ones */
	tier: number;
	elite: boolean;
	/** The aura colour of the elite tier */
	glow: string;
	/** How much bigger the whole post is drawn */
	scale: number;
}

const SKINS: Skin[] = [0, 1, 2, 3].map((tier) => ({
	tier,
	elite: tier > 0,
	glow: tier > 0 ? GLOWS[tier - 1] : YELLOW,
	scale: 1 + tier * 0.05
}));

export function skin(level: number): Skin {
	const tier = eliteTier(level);
	return SKINS[tier];
}

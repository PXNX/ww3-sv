/*
 * Canvas drawing for GPS Liar. The scene is drawn in scene pixels (50 per sea unit) and scaled by
 * the caller so that at least the 700 by 500 view of config.ts fits; a screen of another shape just
 * shows more sea (or fog) around the boat. Two pictures share the canvas:
 * the real view around the boat, which stops at the fog, and the chart in the corner, which shows
 * the whole sea but puts the boat where the GPS lies (and, during a cross-check, where it truly
 * is). Everything is original cartoon art: the boat, the tanker and the lighthouses are made-up.
 */
import {
	BOAT_RADIUS,
	COAST_DEPTH,
	GULL_COUNT,
	LIGHT_RANGE,
	PATROL_CONE,
	PATROL_RANGE,
	TANKER_RADIUS,
	VIEW_H,
	VIEW_W
} from './config.js';
import type { Particle } from './fx.js';
import { gullFlock } from './gulls.js';
import { LIGHTHOUSE_RADIUS, seaBounds, type Level } from './level.js';
import type { Vec } from './lie.js';
import { lightOffset, lightOn } from './lights.js';
import { patrolPose } from './patrol.js';
import { claimedPosition, heading, nextStop, type GameState } from './state.js';
import { tankerPose } from './tanker.js';
import { currentAt, fogFactor, lightning } from './weather.js';

/** Pixels per sea unit in the scene */
export const UNIT = 50;
export const SCENE_W = VIEW_W * UNIT;
export const SCENE_H = VIEW_H * UNIT;

export const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const WATER = '#5bb4db';
const WATER_DARK = '#4a9cc4';
const DEEP = '#2f6f94';
const FOG = '#c9d3dc';
const LAND = '#7fb85a';
const LAND_DARK = '#5e9a41';
const SHALLOW = '#a9dcd6';
const ROCK = '#8d939b';
const ROCK_DARK = '#6c727a';
const RED = '#e5484d';
const GREEN = '#2e9e5b';
const YELLOW = '#f5c83a';
const BROWN = '#8a5a2b';
const HERRING = '#b9c7d6';
const STONE = '#9a9a9a';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'popup';
			/** Position in sea units */
			x: number;
			y: number;
			text: string;
			big: boolean;
			ageMs: number;
			durationMs: number;
	  }
	| {
			/** An expanding ring: a splash where the boat hit something */
			kind: 'ring';
			x: number;
			y: number;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
	/** How far the view is shaken right now, in scene pixels */
	shake?: number;
	/** Foam, sparks and confetti, in sea units */
	particles?: readonly Particle[];
}

export const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true };

/** Size of the chart in the corner and how far it sits from the edge, in scene pixels */
const CHART_W = 220;
const CHART_H = 160;
const CHART_MARGIN = 10;

/**
 * The canvas in scene pixels: its size, and how much of each edge the page covers (the HUD on top,
 * the safe area), so the chart, the compass and the lights stay clear of it
 */
export interface Frame {
	width: number;
	height: number;
	top: number;
	right: number;
	bottom: number;
	left: number;
	/** Where the cross-check button starts at the bottom right; the compass sits above it */
	buttonTop: number;
}

/** The bare view of config.ts, as the tests draw it */
export const FULL_FRAME: Frame = {
	width: SCENE_W,
	height: SCENE_H,
	top: 0,
	right: 0,
	bottom: 0,
	left: 0,
	buttonTop: SCENE_H
};

/** CSS pixels per scene pixel for a canvas this size: the whole view of config.ts always fits */
export function sceneScale(cssWidth: number, cssHeight: number): number {
	return Math.max(Math.min(cssWidth / SCENE_W, cssHeight / SCENE_H), 0.01);
}

/** A small deterministic scatter so the waves sit in the same places every frame */
function hash(a: number, b: number): number {
	let h = (a * 374761393 + b * 668265263) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function outline(ctx: CanvasRenderingContext2D, width = 2.5) {
	ctx.lineWidth = width;
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.stroke();
}

/** The middle of the view: the boat, kept off the edge of a small sea */
function camera(level: Level, pos: Vec, frame: Frame): Vec {
	const clamp = (value: number, size: number, view: number) =>
		size <= view ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, value));
	return {
		x: clamp(pos.x, level.width, frame.width / UNIT),
		y: clamp(pos.y, level.height, frame.height / UNIT)
	};
}

interface View {
	cam: Vec;
	frame: Frame;
	/** Radius of the fog around the boat, in sea units */
	fog: number;
	/** The point the fog is centred on: the boat itself */
	boat: Vec;
	/** Storm strength 0 to 1 */
	storm: number;
	/** Seconds on the animation clock: 0 when motion is reduced */
	clock: number;
}

const sx = (view: View, x: number) => (x - view.cam.x) * UNIT + view.frame.width / 2;
const sy = (view: View, y: number) => (y - view.cam.y) * UNIT + view.frame.height / 2;
const away = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function drawWater(ctx: CanvasRenderingContext2D, state: GameState, view: View, still: boolean) {
	const { level } = state;
	const { width, height } = view.frame;
	ctx.fillStyle = DEEP;
	ctx.fillRect(0, 0, width, height);
	const left = sx(view, 0);
	const top = sy(view, 0);
	ctx.fillStyle = WATER;
	ctx.fillRect(left, top, level.width * UNIT, level.height * UNIT);

	// Wave dashes on a loose grid, bobbing a little
	const time = still ? 0 : state.time;
	// A slow far layer of swell bands that scrolls at half the speed of the camera (parallax)
	ctx.fillStyle = 'rgba(255,255,255,0.09)';
	const bandGap = 86;
	for (let band = -1; band * bandGap < height + bandGap; band++) {
		const y =
			band * bandGap -
			((view.cam.y * UNIT * 0.5) % bandGap) +
			Math.sin(time * 0.5 + band * 1.7) * (4 + view.storm * 8);
		ctx.beginPath();
		ctx.moveTo(0, y);
		for (let x = 0; x <= width; x += 40) {
			ctx.lineTo(x, y + Math.sin(x * 0.02 + time * 0.8 + view.cam.x * 0.4 + band) * 6);
		}
		ctx.lineTo(width, y + 18);
		ctx.lineTo(0, y + 18);
		ctx.closePath();
		ctx.fill();
	}
	const current = currentAt(level, time);
	const driftX = current.x * time * 0.6;
	const driftY = current.y * time * 0.6;
	ctx.strokeStyle = WATER_DARK;
	ctx.lineWidth = 2.5;
	ctx.lineCap = 'round';
	const firstX = Math.floor(view.cam.x - width / UNIT / 2);
	const firstY = Math.floor(view.cam.y - height / UNIT / 2);
	for (let gx = firstX; gx <= firstX + width / UNIT + 1; gx++) {
		for (let gy = firstY; gy <= firstY + height / UNIT + 1; gy++) {
			if (gx < 0 || gy < 0 || gx >= level.width || gy >= level.height) continue;
			if (hash(gx, gy) < 0.45) continue;
			const x = sx(view, gx + hash(gy, gx) + driftX);
			const y =
				sy(view, gy + hash(gx + 7, gy) + driftY) +
				Math.sin(time * (1.6 + view.storm * 1.4) + gx + gy) * (2 + view.storm * 3);
			ctx.beginPath();
			ctx.moveTo(x - 8, y);
			ctx.quadraticCurveTo(x - 4, y - 5, x, y);
			ctx.quadraticCurveTo(x + 4, y + 5, x + 8, y);
			ctx.stroke();
		}
	}

	// The coast: a strip of land along the chosen edge
	const landBox = {
		north: { x: 0, y: 0, w: level.width, h: COAST_DEPTH },
		south: { x: 0, y: level.height - COAST_DEPTH, w: level.width, h: COAST_DEPTH },
		west: { x: 0, y: 0, w: COAST_DEPTH, h: level.height },
		east: { x: level.width - COAST_DEPTH, y: 0, w: COAST_DEPTH, h: level.height }
	}[level.land];
	ctx.fillStyle = LAND;
	ctx.fillRect(sx(view, landBox.x), sy(view, landBox.y), landBox.w * UNIT, landBox.h * UNIT);
	ctx.fillStyle = LAND_DARK;
	ctx.beginPath();
	const edge = {
		north: [landBox.x, landBox.y + landBox.h, landBox.w, 0.12],
		south: [landBox.x, landBox.y - 0.12, landBox.w, 0.12],
		west: [landBox.x + landBox.w, landBox.y, 0.12, landBox.h],
		east: [landBox.x - 0.12, landBox.y, 0.12, landBox.h]
	}[level.land];
	ctx.rect(sx(view, edge[0]), sy(view, edge[1]), edge[2] * UNIT, edge[3] * UNIT);
	ctx.fill();
	// The sea ends at the map border, a thick line
	ctx.strokeStyle = INK;
	ctx.lineWidth = 3;
	ctx.strokeRect(left, top, level.width * UNIT, level.height * UNIT);
}

function drawShallows(ctx: CanvasRenderingContext2D, level: Level, view: View) {
	for (const shallow of level.shallows) {
		if (away(shallow, view.boat) > view.fog + shallow.r) continue;
		ctx.fillStyle = SHALLOW;
		ctx.beginPath();
		ctx.arc(sx(view, shallow.x), sy(view, shallow.y), shallow.r * UNIT, 0, Math.PI * 2);
		ctx.fill();
		ctx.setLineDash([6, 6]);
		ctx.strokeStyle = SAND;
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
	ctx.fillStyle = ROCK;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const bump = i % 2 === 0 ? 1 : 0.82;
		ctx.lineTo(x + Math.cos(angle) * r * bump, y + Math.sin(angle) * r * bump);
	}
	ctx.closePath();
	ctx.fill();
	outline(ctx, 2.5);
	ctx.fillStyle = ROCK_DARK;
	ctx.beginPath();
	ctx.arc(x + r * 0.2, y + r * 0.15, r * 0.35, 0, Math.PI * 2);
	ctx.fill();
}

function drawBuoy(ctx: CanvasRenderingContext2D, x: number, y: number, number: number) {
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.roundRect(x - 9, y - 12, 18, 22, 6);
	ctx.fill();
	outline(ctx, 2.5);
	ctx.fillStyle = PAPER;
	ctx.fillRect(x - 8, y - 4, 16, 6);
	ctx.fillStyle = INK;
	ctx.font = `bold 11px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(String(number), x, y - 1);
	ctx.beginPath();
	ctx.arc(x, y - 15, 3, 0, Math.PI * 2);
	ctx.fillStyle = YELLOW;
	ctx.fill();
	outline(ctx, 1.5);
}

function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean) {
	ctx.fillStyle = ROCK;
	ctx.beginPath();
	ctx.ellipse(
		x,
		y + 8,
		LIGHTHOUSE_RADIUS * UNIT,
		LIGHTHOUSE_RADIUS * UNIT * 0.8,
		0,
		0,
		Math.PI * 2
	);
	ctx.fill();
	outline(ctx, 2.5);
	ctx.fillStyle = PAPER;
	ctx.beginPath();
	ctx.moveTo(x - 9, y + 8);
	ctx.lineTo(x - 6, y - 16);
	ctx.lineTo(x + 6, y - 16);
	ctx.lineTo(x + 9, y + 8);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 2.5);
	ctx.fillStyle = RED;
	ctx.fillRect(x - 7.5, y - 6, 15, 6);
	ctx.fillStyle = lit ? YELLOW : ROCK_DARK;
	ctx.fillRect(x - 6, y - 24, 12, 8);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2;
	ctx.strokeRect(x - 6, y - 24, 12, 8);
}

function drawHarbour(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	cargo: 'herring' | 'stones',
	target: boolean,
	still: boolean,
	time: number
) {
	// A little jetty with a crate of the cargo on it
	ctx.fillStyle = BROWN;
	ctx.fillRect(x - 28, y - 10, 56, 20);
	outline(ctx, 2.5);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2;
	for (const dx of [-14, 0, 14]) {
		ctx.beginPath();
		ctx.moveTo(x + dx, y - 10);
		ctx.lineTo(x + dx, y + 10);
		ctx.stroke();
	}
	drawCargo(ctx, x, y - 4, cargo, 1);
	if (target) {
		const pulse = still ? 0 : (Math.sin(time * 5) + 1) * 3;
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 4;
		ctx.setLineDash([8, 6]);
		ctx.beginPath();
		ctx.arc(x, y, 0.95 * UNIT + pulse, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

/** The cargo: a herring for a fish harbour, a pile of sauna stones for a sauna harbour */
function drawCargo(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	cargo: 'herring' | 'stones',
	scale: number
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	if (cargo === 'herring') {
		ctx.fillStyle = HERRING;
		ctx.beginPath();
		ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.moveTo(9, 0);
		ctx.lineTo(16, -5);
		ctx.lineTo(16, 5);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 2);
		ctx.fillStyle = INK;
		ctx.beginPath();
		ctx.arc(-6, -1, 1.4, 0, Math.PI * 2);
		ctx.fill();
	} else {
		for (const [dx, dy, r] of [
			[-6, 2, 6],
			[5, 2, 6],
			[-1, -5, 5.5]
		]) {
			ctx.fillStyle = STONE;
			ctx.beginPath();
			ctx.arc(dx, dy, r, 0, Math.PI * 2);
			ctx.fill();
			outline(ctx, 2);
		}
		// Steam: it is a sauna
		ctx.strokeStyle = PAPER;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-1, -12);
		ctx.quadraticCurveTo(3, -16, -1, -20);
		ctx.stroke();
	}
	ctx.restore();
}

function drawTanker(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
	const { tanker } = state.level;
	if (!tanker) return;
	const pose = tankerPose(tanker, state.time);
	const x = sx(view, pose.hull.x);
	const y = sy(view, pose.hull.y);
	const ax = sx(view, pose.anchor.x);
	const ay = sy(view, pose.anchor.y);
	// The chain and the dragging anchor
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2.5;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(ax, ay);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = ROCK_DARK;
	ctx.beginPath();
	ctx.arc(ax, ay, 8, 0, Math.PI * 2);
	ctx.fill();
	outline(ctx, 2.5);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(ax, ay - 5);
	ctx.lineTo(ax, ay + 5);
	ctx.moveTo(ax - 5, ay + 1);
	ctx.quadraticCurveTo(ax, ay + 8, ax + 5, ay + 1);
	ctx.stroke();

	// The hull: a long dark ship with a stack, no flag and no name
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.atan2(pose.heading.y, pose.heading.x));
	const half = TANKER_RADIUS * UNIT;
	ctx.fillStyle = '#2b2f36';
	ctx.beginPath();
	ctx.moveTo(-half * 1.1, -half * 0.55);
	ctx.lineTo(half * 0.7, -half * 0.55);
	ctx.lineTo(half * 1.35, 0);
	ctx.lineTo(half * 0.7, half * 0.55);
	ctx.lineTo(-half * 1.1, half * 0.55);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 3);
	ctx.fillStyle = RED;
	ctx.fillRect(-half * 0.95, -half * 0.3, half * 0.5, half * 0.6);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2;
	ctx.strokeRect(-half * 0.95, -half * 0.3, half * 0.5, half * 0.6);
	ctx.fillStyle = '#4a505a';
	ctx.fillRect(-half * 0.2, -half * 0.25, half * 0.9, half * 0.5);
	ctx.restore();
}

function drawBoat(
	ctx: CanvasRenderingContext2D,
	state: GameState,
	view: View,
	still: boolean,
	at: Vec = state.pos,
	ghost = false
) {
	if (!ghost && !still && state.invulnerable > 0 && Math.floor(state.time * 10) % 2 === 0) return;
	// Bobbing on the swell: a small lift and a roll that both grow in a storm
	const swell = still ? 0 : Math.sin(state.time * 2.3) * (1.2 + view.storm * 3.2);
	const roll = still ? 0 : Math.sin(state.time * 1.7 + 1) * (0.03 + view.storm * 0.08);
	const x = sx(view, at.x);
	const y = sy(view, at.y) + swell;
	const half = BOAT_RADIUS * UNIT;
	ctx.save();
	if (ghost) ctx.globalAlpha = 0.4 + Math.sin(state.time * 30) * 0.1;
	if (!ghost) {
		// A soft shadow on the water
		ctx.fillStyle = 'rgba(20,60,90,0.25)';
		ctx.beginPath();
		ctx.ellipse(x + 3, y + 6, half * 1.3, half * 0.7, state.facing, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.translate(x, y);
	ctx.rotate(state.facing + roll);
	// A wake behind a moving boat
	if (!ghost && !still && Math.hypot(state.vel.x, state.vel.y) > 0.4) {
		ctx.strokeStyle = 'rgba(255,255,255,0.8)';
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(-half * 1.2, -half * 0.5);
		ctx.lineTo(-half * 2.6, -half * 0.9);
		ctx.moveTo(-half * 1.2, half * 0.5);
		ctx.lineTo(-half * 2.6, half * 0.9);
		ctx.stroke();
	}
	// Hull, cabin and a pile of cargo
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.moveTo(-half * 1.2, -half * 0.8);
	ctx.lineTo(half * 0.5, -half * 0.8);
	ctx.lineTo(half * 1.3, 0);
	ctx.lineTo(half * 0.5, half * 0.8);
	ctx.lineTo(-half * 1.2, half * 0.8);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 3);
	ctx.fillStyle = PAPER;
	ctx.fillRect(-half * 0.3, -half * 0.5, half * 0.8, half);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2.5;
	ctx.strokeRect(-half * 0.3, -half * 0.5, half * 0.8, half);
	ctx.fillStyle = BROWN;
	ctx.fillRect(-half * 1.0, -half * 0.45, half * 0.55, half * 0.9);
	ctx.strokeRect(-half * 1.0, -half * 0.45, half * 0.55, half * 0.9);
	if (ghost) {
		ctx.strokeStyle = '#19e3ff';
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 4]);
		ctx.strokeRect(-half * 1.2, -half * 0.8, half * 2.5, half * 1.6);
		ctx.setLineDash([]);
	}
	ctx.restore();
}

/** The lock-on ring around the boat: it fills as a radar beam holds on, and blinks near full */
function drawAlertRing(
	ctx: CanvasRenderingContext2D,
	state: GameState,
	view: View,
	still: boolean
) {
	if (state.alert <= 0.02) return;
	const x = sx(view, state.pos.x);
	const y = sy(view, state.pos.y);
	const radius = BOAT_RADIUS * UNIT + 16;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineWidth = 5;
	ctx.strokeStyle = 'rgba(0,0,0,0.35)';
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.stroke();
	const blink = !still && state.alert > 0.7 && Math.floor(state.time * 8) % 2 === 0;
	ctx.strokeStyle = blink ? RED : YELLOW;
	ctx.beginPath();
	ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.alert);
	ctx.stroke();
	ctx.restore();
}

/** Coast guard boats with their sweeping radar beam, drawn under the fog */
function drawPatrols(ctx: CanvasRenderingContext2D, state: GameState, view: View, still: boolean) {
	const routes = state.level.patrols ?? [];
	routes.forEach((route, index) => {
		const pose = patrolPose(route, state.time);
		if (away(pose.pos, state.pos) > view.fog + PATROL_RANGE) return;
		const x = sx(view, pose.pos.x);
		const y = sy(view, pose.pos.y);
		// The radar beam: a wedge that turns round, bright when it holds the boat
		const locked = state.beamOn[index];
		const beam = still ? 0 : pose.beam;
		ctx.save();
		ctx.fillStyle = locked ? 'rgba(229,72,77,0.38)' : 'rgba(80,255,150,0.2)';
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.arc(x, y, PATROL_RANGE * UNIT, beam - PATROL_CONE / 2, beam + PATROL_CONE / 2);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = locked ? 'rgba(229,72,77,0.8)' : 'rgba(80,255,150,0.5)';
		ctx.lineWidth = 2;
		ctx.stroke();
		// A faint trail of the sweep
		for (let i = 1; i <= 3; i++) {
			ctx.fillStyle = `rgba(80,255,150,${0.07 / i})`;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.arc(
				x,
				y,
				PATROL_RANGE * UNIT,
				beam - PATROL_CONE / 2 - i * 0.18,
				beam - PATROL_CONE / 2 - (i - 1) * 0.18
			);
			ctx.closePath();
			ctx.fill();
		}
		ctx.restore();

		// The hull: a white boat with a blue stripe and a flashing light
		const bob = still ? 0 : Math.sin(state.time * 2 + index) * 1.5;
		ctx.save();
		ctx.translate(x, y + bob);
		ctx.rotate(pose.heading);
		const half = 0.42 * UNIT;
		ctx.fillStyle = PAPER;
		ctx.beginPath();
		ctx.moveTo(-half * 1.2, -half * 0.7);
		ctx.lineTo(half * 0.6, -half * 0.7);
		ctx.lineTo(half * 1.4, 0);
		ctx.lineTo(half * 0.6, half * 0.7);
		ctx.lineTo(-half * 1.2, half * 0.7);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 3);
		ctx.fillStyle = '#2f6fd0';
		ctx.fillRect(-half * 1.1, -half * 0.18, half * 2, half * 0.36);
		const flash = still || Math.floor(state.time * 5 + index) % 2 === 0;
		ctx.fillStyle = flash ? '#3a7bff' : RED;
		ctx.beginPath();
		ctx.arc(-half * 0.1, 0, 5, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 1.5);
		ctx.restore();
	});
}

/** Foam, sparks, confetti and glitch bits, in sea units */
function drawParticles(ctx: CanvasRenderingContext2D, view: View, particles: readonly Particle[]) {
	for (const particle of particles) {
		const t = particle.ageMs / particle.durationMs;
		const x = sx(view, particle.x);
		const y = sy(view, particle.y);
		const size = particle.size * UNIT;
		ctx.save();
		ctx.globalAlpha = Math.max(0, 1 - t);
		if (particle.kind === 'foam') {
			ctx.fillStyle = PAPER;
			ctx.beginPath();
			ctx.arc(x, y, size * (1 + t * 1.5), 0, Math.PI * 2);
			ctx.fill();
		} else if (particle.kind === 'spark') {
			ctx.fillStyle = particle.tint % 2 === 0 ? YELLOW : PAPER;
			ctx.fillRect(x - size / 2, y - size / 2, size, size);
		} else if (particle.kind === 'confetti') {
			ctx.fillStyle = [RED, YELLOW, GREEN, '#3a7bff'][particle.tint % 4];
			ctx.translate(x, y);
			ctx.rotate(t * 8 + particle.tint);
			ctx.fillRect(-size, -size / 2, size * 2, size);
		} else {
			ctx.fillStyle = particle.tint % 2 === 0 ? '#19e3ff' : '#ff3bd4';
			ctx.fillRect(x - size * 2, y - size / 3, size * 4, size / 1.5);
		}
		ctx.restore();
	}
}

/** Storm weather over the sea: gloom, slanting rain and lightning flashes */
function drawStorm(ctx: CanvasRenderingContext2D, state: GameState, view: View, still: boolean) {
	if (view.storm <= 0.01) return;
	const { width, height } = view.frame;
	ctx.fillStyle = `rgba(20,35,60,${0.32 * view.storm})`;
	ctx.fillRect(0, 0, width, height);
	if (!still) {
		ctx.strokeStyle = `rgba(220,235,255,${0.5 * view.storm})`;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		const drops = Math.round(70 * view.storm);
		for (let i = 0; i < drops; i++) {
			const fall = (state.time * 520 + hash(i, 3) * height) % height;
			const x = (hash(i, 9) * (width + 100) - fall * 0.25 + width) % (width + 100);
			ctx.moveTo(x, fall);
			ctx.lineTo(x - 5, fall + 16);
		}
		ctx.stroke();
		const flash = lightning(view.storm, state.time);
		if (flash > 0) {
			ctx.fillStyle = `rgba(255,255,255,${0.55 * flash})`;
			ctx.fillRect(0, 0, width, height);
		}
	}
}

/** Signal glitch over the scene while the spoofer runs: scanlines and colour tears at the edges */
function drawGlitch(ctx: CanvasRenderingContext2D, state: GameState, view: View, still: boolean) {
	const strength = state.spoofBlend;
	if (strength <= 0.02) return;
	const { width, height } = view.frame;
	ctx.save();
	ctx.fillStyle = `rgba(25,227,255,${0.07 * strength})`;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = `rgba(0,0,0,${0.12 * strength})`;
	for (let y = 0; y < height; y += 6) ctx.fillRect(0, y, width, 2);
	if (!still) {
		const tick = Math.floor(state.time * 14);
		for (let i = 0; i < 4; i++) {
			if (hash(tick, i) > 0.45 * strength + 0.1) continue;
			const y = hash(tick, i + 20) * height;
			const h = 3 + hash(tick, i + 40) * 14;
			const shift = (hash(tick, i + 60) - 0.5) * 60;
			ctx.fillStyle = i % 2 === 0 ? 'rgba(25,227,255,0.3)' : 'rgba(255,59,212,0.28)';
			ctx.fillRect(shift, y, width, h);
		}
	}
	ctx.restore();
}

/** A gull seen from above: a flat V heading somewhere */
function drawGull(ctx: CanvasRenderingContext2D, x: number, y: number, heading: Vec, time: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.atan2(heading.y, heading.x));
	const flap = Math.sin(time * 9 + x * 0.1) * 3;
	ctx.strokeStyle = PAPER;
	ctx.lineWidth = 3.5;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(-6, -8 - flap);
	ctx.lineTo(2, 0);
	ctx.lineTo(-6, 8 + flap);
	ctx.stroke();
	ctx.restore();
}

/** Fog: opaque beyond the radius, clear close to the boat; the real view stops here */
function drawFog(ctx: CanvasRenderingContext2D, view: View) {
	const x = sx(view, view.boat.x);
	const y = sy(view, view.boat.y);
	const radius = view.fog * UNIT;
	const gradient = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius);
	gradient.addColorStop(0, 'rgba(201,211,220,0)');
	gradient.addColorStop(0.85, 'rgba(201,211,220,0.82)');
	gradient.addColorStop(1, FOG);
	const { width, height } = view.frame;
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = FOG;
	// Beyond the radius nothing but fog (the gradient only covers the circle's own area)
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	ctx.arc(x, y, radius, 0, Math.PI * 2, true);
	ctx.fill('evenodd');
}

/** Lighthouse lights shine through the fog: a blinking dot, pinned to the view edge (below the HUD) when off screen */
function drawLights(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
	const { frame } = view;
	state.level.lighthouses.forEach((lighthouse, index) => {
		if (away(lighthouse, state.pos) > LIGHT_RANGE) return;
		if (!lightOn(lighthouse.flashes, state.time, lightOffset(index))) return;
		const margin = 16;
		const x = Math.min(
			frame.width - frame.right - margin,
			Math.max(frame.left + margin, sx(view, lighthouse.x))
		);
		const y = Math.min(
			frame.height - frame.bottom - margin,
			Math.max(frame.top + margin, sy(view, lighthouse.y))
		);
		const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
		glow.addColorStop(0, 'rgba(255,240,150,0.95)');
		glow.addColorStop(1, 'rgba(255,240,150,0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(x, y, 26, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = YELLOW;
		ctx.beginPath();
		ctx.arc(x, y, 6, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 2);
	});
}

/** A blinking patrol light pinned to the edge, so a boat beyond the fog still shows */
function drawPatrolLights(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
	const { frame } = view;
	(state.level.patrols ?? []).forEach((route, index) => {
		const pose = patrolPose(route, state.time);
		const distance = away(pose.pos, state.pos);
		if (distance > LIGHT_RANGE || distance <= view.fog) return;
		if (Math.floor(state.time * 4 + index) % 2 !== 0) return;
		const margin = 16;
		const x = Math.min(
			frame.width - frame.right - margin,
			Math.max(frame.left + margin, sx(view, pose.pos.x))
		);
		const y = Math.min(
			frame.height - frame.bottom - margin,
			Math.max(frame.top + margin, sy(view, pose.pos.y))
		);
		ctx.fillStyle = Math.floor(state.time * 2 + index) % 2 === 0 ? '#3a7bff' : RED;
		ctx.beginPath();
		ctx.arc(x, y, 5, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 2);
	});
}

function drawCompass(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number) {
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.beginPath();
	ctx.arc(x, y, 34, 0, Math.PI * 2);
	ctx.fill();
	outline(ctx, 3);
	// North is always up; the arrow is where the bow points
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.moveTo(x, y - 33);
	ctx.lineTo(x - 5, y - 24);
	ctx.lineTo(x + 5, y - 24);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = INK;
	ctx.font = `bold 12px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('N', x, y - 14);
	ctx.save();
	ctx.translate(x, y + 4);
	ctx.rotate(state.facing);
	ctx.fillStyle = BROWN;
	ctx.beginPath();
	ctx.moveTo(14, 0);
	ctx.lineTo(-6, -7);
	ctx.lineTo(-6, 7);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 2);
	ctx.restore();
	const bearing = heading(state);
	if (bearing !== null) {
		ctx.fillStyle = INK;
		ctx.font = `bold 13px ${DISPLAY_FONT}`;
		ctx.fillText(`${String(bearing).padStart(3, '0')}°`, x, y + 50);
	}
}

/** The chart: the whole sea, known hazards and marks, and the GPS dot (the truth, too, if asked) */
function drawChart(
	ctx: CanvasRenderingContext2D,
	state: GameState,
	box: { x: number; y: number; w: number; h: number },
	showTruth: boolean,
	still: boolean
) {
	const { level } = state;
	const pad = 8;
	const scale = Math.min((box.w - pad * 2) / level.width, (box.h - pad * 2) / level.height);
	const originX = box.x + (box.w - level.width * scale) / 2;
	const originY = box.y + (box.h - level.height * scale) / 2;
	const cx = (x: number) => originX + x * scale;
	const cy = (y: number) => originY + y * scale;
	const mark = scale / (UNIT / 28);

	ctx.save();
	ctx.fillStyle = PAPER;
	ctx.beginPath();
	ctx.roundRect(box.x, box.y, box.w, box.h, 12);
	ctx.fill();
	ctx.clip();
	ctx.fillStyle = '#cfeaf5';
	ctx.fillRect(originX, originY, level.width * scale, level.height * scale);

	// Land, shallows and rocks
	const bounds = seaBounds(level);
	ctx.fillStyle = LAND;
	ctx.fillRect(originX, originY, level.width * scale, level.height * scale);
	ctx.fillStyle = '#cfeaf5';
	ctx.fillRect(
		cx(bounds.minX),
		cy(bounds.minY),
		(bounds.maxX - bounds.minX) * scale,
		(bounds.maxY - bounds.minY) * scale
	);
	for (const shallow of level.shallows) {
		ctx.fillStyle = SHALLOW;
		ctx.beginPath();
		ctx.arc(cx(shallow.x), cy(shallow.y), shallow.r * scale, 0, Math.PI * 2);
		ctx.fill();
	}
	for (const rock of level.rocks) {
		ctx.fillStyle = ROCK;
		ctx.beginPath();
		ctx.arc(cx(rock.x), cy(rock.y), Math.max(2.5, rock.r * scale), 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 1.2);
	}

	// Buoys (numbered), lighthouses (a star, then one dot per flash) and the harbours
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const buoy of level.buoys) {
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.arc(cx(buoy.x), cy(buoy.y), mark * 0.55, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 1.2);
		ctx.fillStyle = INK;
		ctx.font = `bold ${Math.max(8, mark)}px ${DISPLAY_FONT}`;
		ctx.fillText(String(buoy.number), cx(buoy.x) + mark * 1.1, cy(buoy.y) - mark * 0.7);
	}
	for (const lighthouse of level.lighthouses) {
		const x = cx(lighthouse.x);
		const y = cy(lighthouse.y);
		ctx.fillStyle = YELLOW;
		ctx.beginPath();
		ctx.moveTo(x, y - mark * 0.9);
		ctx.lineTo(x + mark * 0.8, y + mark * 0.6);
		ctx.lineTo(x - mark * 0.8, y + mark * 0.6);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 1.2);
		ctx.fillStyle = INK;
		for (let i = 0; i < lighthouse.flashes; i++) {
			const dx = (i - (lighthouse.flashes - 1) / 2) * mark * 0.7;
			ctx.beginPath();
			ctx.arc(x + dx, y + mark * 1.4, mark * 0.22, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	const target = nextStop(state);
	level.stops.forEach((stop, index) => {
		const done = index < state.delivered;
		const x = cx(stop.x);
		const y = cy(stop.y);
		ctx.fillStyle = done ? LAND_DARK : stop.cargo === 'herring' ? HERRING : STONE;
		ctx.fillRect(x - mark, y - mark * 0.7, mark * 2, mark * 1.4);
		outline(ctx, 1.4);
		if (stop === target) {
			const pulse = still ? 0 : (Math.sin(state.time * 5) + 1) * 0.8;
			ctx.strokeStyle = RED;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(x, y, mark * 1.7 + pulse, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.fillStyle = INK;
		ctx.font = `bold ${Math.max(8, mark)}px ${DISPLAY_FONT}`;
		ctx.fillText(done ? '✓' : String(index + 1), x, y + 0.5);
	});

	// The GPS dot lies; the truth shows only during a cross-check
	const claimed = claimedPosition(state);
	const gx = Math.min(box.x + box.w - 3, Math.max(box.x + 3, cx(claimed.x)));
	const gy = Math.min(box.y + box.h - 3, Math.max(box.y + 3, cy(claimed.y)));
	if (showTruth) {
		const tx = cx(state.pos.x);
		const ty = cy(state.pos.y);
		ctx.strokeStyle = INK;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([3, 3]);
		ctx.beginPath();
		ctx.moveTo(gx, gy);
		ctx.lineTo(tx, ty);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = GREEN;
		ctx.beginPath();
		ctx.arc(tx, ty, mark * 0.95, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 2);
	}
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(gx, gy, mark * 0.85, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = PAPER;
	ctx.lineWidth = 2;
	ctx.stroke();
	if (state.spoofBlend > 0.02) {
		// The spoofed chart: scanlines, colour tears and a label
		ctx.fillStyle = `rgba(25,227,255,${0.1 * state.spoofBlend})`;
		ctx.fillRect(box.x, box.y, box.w, box.h);
		ctx.fillStyle = `rgba(0,0,0,${0.14 * state.spoofBlend})`;
		for (let y = box.y; y < box.y + box.h; y += 5) ctx.fillRect(box.x, y, box.w, 1.5);
		if (!still) {
			const tick = Math.floor(state.time * 12);
			for (let i = 0; i < 3; i++) {
				if (hash(tick, i + 5) > 0.55) continue;
				ctx.fillStyle = i % 2 === 0 ? 'rgba(25,227,255,0.35)' : 'rgba(255,59,212,0.3)';
				ctx.fillRect(
					box.x + (hash(tick, i) - 0.5) * 24,
					box.y + hash(tick, i + 9) * box.h,
					box.w,
					2 + hash(tick, i + 3) * 7
				);
			}
		}
	}
	ctx.restore();

	ctx.beginPath();
	ctx.roundRect(box.x, box.y, box.w, box.h, 12);
	ctx.strokeStyle = showTruth ? GREEN : state.spoofBlend > 0.5 ? '#19e3ff' : INK;
	ctx.lineWidth = showTruth ? 5 : 3;
	ctx.stroke();
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[], view: View) {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const effect of effects) {
		const t = effect.ageMs / effect.durationMs;
		const x = sx(view, effect.x);
		const y = sy(view, effect.y);
		ctx.save();
		ctx.globalAlpha = t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) * 4);
		if (effect.kind === 'popup') {
			ctx.font = `bold ${effect.big ? 22 : 16}px ${DISPLAY_FONT}`;
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = INK;
			ctx.strokeText(effect.text, x, y - t * 26);
			ctx.fillStyle = PAPER;
			ctx.fillText(effect.text, x, y - t * 26);
		} else {
			ctx.strokeStyle = PAPER;
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(x, y, 10 + t * 34, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.restore();
	}
}

/** Draws the whole scene; the context must already be scaled so that one unit is one scene pixel */
export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: GameState,
	extras: SceneExtras = NO_EXTRAS,
	frame: Frame = FULL_FRAME
) {
	const still = extras.reducedMotion;
	const { level } = state;
	const view: View = {
		cam: camera(level, state.pos, frame),
		frame,
		boat: state.pos,
		fog: level.fogRadius * fogFactor(state.storm),
		storm: state.storm,
		clock: still ? 0 : state.time
	};
	ctx.save();
	if (extras.shake)
		ctx.translate(
			Math.sin(state.time * 97) * extras.shake,
			Math.cos(state.time * 83) * extras.shake
		);
	drawWater(ctx, state, view, still);
	drawShallows(ctx, level, view);
	for (const rock of level.rocks) {
		if (away(rock, state.pos) > view.fog + rock.r) continue;
		drawRock(ctx, sx(view, rock.x), sy(view, rock.y), rock.r * UNIT);
	}
	for (const buoy of level.buoys) {
		if (away(buoy, state.pos) <= view.fog)
			drawBuoy(ctx, sx(view, buoy.x), sy(view, buoy.y), buoy.number);
	}
	const target = nextStop(state);
	for (const stop of level.stops) {
		if (away(stop, state.pos) > view.fog + 1) continue;
		drawHarbour(
			ctx,
			sx(view, stop.x),
			sy(view, stop.y),
			stop.cargo,
			stop === target,
			still,
			state.time
		);
	}
	level.lighthouses.forEach((lighthouse, index) => {
		if (away(lighthouse, state.pos) > view.fog + 1) return;
		const lit = lightOn(lighthouse.flashes, state.time, lightOffset(index));
		drawLighthouse(ctx, sx(view, lighthouse.x), sy(view, lighthouse.y), lit);
	});
	if (level.tanker) {
		const pose = tankerPose(level.tanker, state.time);
		if (
			away(pose.hull, state.pos) <= view.fog + TANKER_RADIUS * 2 ||
			away(pose.anchor, state.pos) <= view.fog + 1
		) {
			drawTanker(ctx, state, view);
		}
	}
	drawPatrols(ctx, state, view, still);
	if (state.spoofBlend > 0.05) {
		drawBoat(ctx, state, view, still, claimedPosition(state), true);
	}
	drawBoat(ctx, state, view, still);
	drawAlertRing(ctx, state, view, still);
	if (extras.particles) drawParticles(ctx, view, extras.particles);
	drawFog(ctx, view);
	drawLights(ctx, state, view);
	drawPatrolLights(ctx, state, view);
	drawStorm(ctx, state, view, still);
	drawGlitch(ctx, state, view, still);
	for (const gull of gullFlock(state.pos, level.land, still ? 0 : state.time).slice(
		0,
		GULL_COUNT
	)) {
		drawGull(ctx, sx(view, gull.x), sy(view, gull.y), gull.heading, still ? 0 : state.time);
	}
	drawEffects(ctx, extras.effects, view);
	ctx.restore();
	// The compass sits above the cross-check button at the bottom right, the chart in the other corner
	drawCompass(
		ctx,
		state,
		frame.width - frame.right - CHART_MARGIN - 36,
		Math.min(frame.height - frame.bottom, frame.buttonTop) - CHART_MARGIN - 58
	);
	drawChart(
		ctx,
		state,
		{
			x: frame.left + CHART_MARGIN,
			y: frame.height - frame.bottom - CHART_H - CHART_MARGIN,
			w: CHART_W,
			h: CHART_H
		},
		state.reveal > 0,
		still
	);
}

/** Draws the final chart onto the shared score card: the whole sea, the lying dot and the truth */
export function drawChartPreview(
	ctx: CanvasRenderingContext2D,
	state: GameState,
	x: number,
	y: number,
	size: number
) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, size, size);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(x, y, size, size);
	drawChart(ctx, state, { x: x + 6, y: y + 6, w: size - 12, h: size - 12 }, true, true);
	ctx.restore();
}

/** Where the boat is on the scene, in scene pixels (the view follows it, except near the edge of a small sea) */
export function boatOnScreen(state: GameState, frame: Frame = FULL_FRAME): Vec {
	const cam = camera(state.level, state.pos, frame);
	return {
		x: (state.pos.x - cam.x) * UNIT + frame.width / 2,
		y: (state.pos.y - cam.y) * UNIT + frame.height / 2
	};
}

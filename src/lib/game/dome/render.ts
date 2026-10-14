/*
 * Canvas drawing for Iron Dome Juggler, all in world units (see config.ts) and scaled by the
 * caller: sky, sea, the small cartoon city with the value tag of every building, the battery,
 * incoming rockets with their faint dotted trajectory and landing marker, interceptors, and short
 * effects. Everything is original cartoon art: the rockets, the interceptors and the battery are
 * made-up designs without any real markings, and nothing is hurt: impacts are smoke and dust.
 */
import {
	BATTERY_X,
	FIELD_START,
	GROUND_Y,
	SEA_END,
	TARGETS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type TargetKind
} from './config.js';
import type { Interceptor } from './intercept.js';
import { rocketPosition, type DomeState, type Rocket } from './state.js';
import { flightHeading, pointAt, remainingPath } from './trajectory.js';

export const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const SKY = '#9ec3e6';
const SKY_LOW = '#cfe6f4';
const GRASS = '#7fb85a';
const GRASS_DARK = '#5e9a41';
const WATER = '#5bb4db';
const WATER_DARK = '#3f95bf';
const BEACH = '#e3c98a';
const RED = '#e5484d';
const YELLOW = '#f5c83a';
const ORANGE = '#f08a3c';
const TEAL = '#2f9e8f';
const BROWN = '#8a5a2b';
const GREY = '#a7adb8';
const GREY_DARK = '#6d7482';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			big: boolean;
			/** Fill colour of the text */
			color: string;
			ageMs: number;
			durationMs: number;
	  }
	| {
			/** A starburst: a cartoon pop where an interceptor met a rocket, or smoke where one landed */
			kind: 'burst';
			x: number;
			y: number;
			radius: number;
			color: string;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
	/** Running time in ms, for drifting clouds and waves (ignored with reduced motion) */
	timeMs: number;
}

export const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true, timeMs: 0 };

function outline(ctx: CanvasRenderingContext2D, width = 2.5) {
	ctx.lineWidth = width;
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.stroke();
}

function fillOutlined(ctx: CanvasRenderingContext2D, fill: string, width = 2.5) {
	ctx.fillStyle = fill;
	ctx.fill();
	outline(ctx, width);
}

function rect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string,
	width = 2.5
) {
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	fillOutlined(ctx, fill, width);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
	// Outlined blobs first, then the same blobs filled again to hide the lines inside the cloud
	const blobs = [
		[x, y, 14],
		[x + 20 * scale, y - 6 * scale, 18],
		[x + 42 * scale, y, 13]
	] as const;
	for (const [bx, by, radius] of blobs) {
		ctx.beginPath();
		ctx.arc(bx, by, radius * scale, 0, Math.PI * 2);
		fillOutlined(ctx, PAPER, 2);
	}
	ctx.fillStyle = PAPER;
	for (const [bx, by, radius] of blobs) {
		ctx.beginPath();
		ctx.arc(bx, by, radius * scale - 1, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawSky(ctx: CanvasRenderingContext2D, extras: SceneExtras) {
	ctx.fillStyle = SKY;
	ctx.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);
	ctx.fillStyle = SKY_LOW;
	ctx.fillRect(0, GROUND_Y - 70, WORLD_WIDTH, 70);
	// A cartoon sun
	ctx.beginPath();
	ctx.arc(560, 62, 24, 0, Math.PI * 2);
	fillOutlined(ctx, YELLOW, 3);
	const drift = extras.reducedMotion ? 0 : (extras.timeMs / 1000) * 4;
	const wrap = WORLD_WIDTH + 120;
	for (const [x, y, s] of [
		[60, 140, 1],
		[300, 96, 0.8],
		[470, 170, 0.9]
	] as const) {
		cloud(ctx, ((x + drift) % wrap) - 60, y, s);
	}
}

function drawSea(ctx: CanvasRenderingContext2D, extras: SceneExtras) {
	ctx.fillStyle = WATER;
	ctx.fillRect(0, GROUND_Y - 6, SEA_END, WORLD_HEIGHT - GROUND_Y + 6);
	ctx.strokeStyle = WATER_DARK;
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	const sway = extras.reducedMotion ? 0 : Math.sin(extras.timeMs / 600) * 4;
	for (let row = 0; row < 3; row++) {
		const y = GROUND_Y + 8 + row * 18;
		ctx.beginPath();
		for (let x = 8 + (row % 2) * 14; x < SEA_END - 16; x += 36) {
			ctx.moveTo(x + sway, y);
			ctx.quadraticCurveTo(x + 9 + sway, y - 7, x + 18 + sway, y);
		}
		ctx.stroke();
	}
	// The shoreline
	ctx.beginPath();
	ctx.moveTo(SEA_END, GROUND_Y - 6);
	ctx.lineTo(SEA_END + 12, GROUND_Y - 6);
	ctx.lineTo(SEA_END + 12, WORLD_HEIGHT);
	ctx.lineTo(SEA_END, WORLD_HEIGHT);
	ctx.closePath();
	ctx.fillStyle = BEACH;
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(0, GROUND_Y - 6);
	ctx.lineTo(SEA_END, GROUND_Y - 6);
	outline(ctx, 3);
}

function tree(ctx: CanvasRenderingContext2D, x: number) {
	rect(ctx, x - 3, GROUND_Y - 20, 6, 20, BROWN, 2);
	ctx.beginPath();
	ctx.arc(x, GROUND_Y - 28, 13, 0, Math.PI * 2);
	fillOutlined(ctx, GRASS_DARK, 2.5);
}

function drawGround(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = GRASS;
	ctx.fillRect(SEA_END, GROUND_Y - 6, WORLD_WIDTH - SEA_END, WORLD_HEIGHT - GROUND_Y + 6);
	// A road through the city
	ctx.fillStyle = GREY;
	ctx.fillRect(SEA_END + 12, GROUND_Y + 2, FIELD_START - SEA_END - 12, 16);
	ctx.strokeStyle = PAPER;
	ctx.lineWidth = 2;
	ctx.setLineDash([10, 10]);
	ctx.beginPath();
	ctx.moveTo(SEA_END + 12, GROUND_Y + 10);
	ctx.lineTo(FIELD_START, GROUND_Y + 10);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.beginPath();
	ctx.moveTo(SEA_END + 12, GROUND_Y - 6);
	ctx.lineTo(WORLD_WIDTH, GROUND_Y - 6);
	outline(ctx, 3);
	// Empty fields on the right: trees and a hay bale, nothing worth a rocket
	tree(ctx, FIELD_START + 40);
	tree(ctx, FIELD_START + 112);
	ctx.beginPath();
	ctx.arc(FIELD_START + 76, GROUND_Y - 8, 11, 0, Math.PI * 2);
	fillOutlined(ctx, YELLOW, 2.5);
	ctx.beginPath();
	ctx.moveTo(SEA_END + 12, GROUND_Y + 22);
	ctx.lineTo(WORLD_WIDTH, GROUND_Y + 22);
	ctx.strokeStyle = GRASS_DARK;
	ctx.lineWidth = 3;
	ctx.stroke();
}

function smoke(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	extras: SceneExtras,
	count = 3
) {
	const wobble = extras.reducedMotion ? 0 : Math.sin(extras.timeMs / 400 + x) * 3;
	for (let i = 0; i < count; i++) {
		ctx.beginPath();
		ctx.arc(x + wobble * (i + 1) * 0.4, y - i * 13, 6 + i * 2.5, 0, Math.PI * 2);
		fillOutlined(ctx, i === 0 ? GREY_DARK : GREY, 2);
	}
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, ruined: boolean) {
	const left = x - 17;
	if (ruined) {
		rect(ctx, left, GROUND_Y - 12, 34, 12, GREY_DARK, 2.5);
		ctx.beginPath();
		ctx.moveTo(left + 2, GROUND_Y - 12);
		ctx.lineTo(left + 10, GROUND_Y - 26);
		ctx.lineTo(left + 17, GROUND_Y - 14);
		ctx.lineTo(left + 25, GROUND_Y - 22);
		ctx.lineTo(left + 32, GROUND_Y - 12);
		ctx.closePath();
		fillOutlined(ctx, GREY, 2.5);
		return;
	}
	rect(ctx, left, GROUND_Y - 26, 34, 26, SAND, 2.5);
	ctx.beginPath();
	ctx.moveTo(left - 5, GROUND_Y - 26);
	ctx.lineTo(x, GROUND_Y - 42);
	ctx.lineTo(left + 39, GROUND_Y - 26);
	ctx.closePath();
	fillOutlined(ctx, RED, 2.5);
	rect(ctx, x - 4, GROUND_Y - 15, 8, 15, BROWN, 2);
	rect(ctx, left + 4, GROUND_Y - 21, 8, 8, SKY, 2);
	rect(ctx, left + 22, GROUND_Y - 21, 8, 8, SKY, 2);
}

function drawHospital(ctx: CanvasRenderingContext2D, x: number, ruined: boolean) {
	const left = x - 28;
	if (ruined) {
		rect(ctx, left, GROUND_Y - 14, 56, 14, GREY_DARK, 2.5);
		ctx.beginPath();
		ctx.moveTo(left + 3, GROUND_Y - 14);
		ctx.lineTo(left + 12, GROUND_Y - 34);
		ctx.lineTo(left + 22, GROUND_Y - 18);
		ctx.lineTo(left + 32, GROUND_Y - 30);
		ctx.lineTo(left + 43, GROUND_Y - 16);
		ctx.lineTo(left + 53, GROUND_Y - 14);
		ctx.closePath();
		fillOutlined(ctx, GREY, 2.5);
		return;
	}
	rect(ctx, left, GROUND_Y - 42, 56, 42, PAPER, 3);
	rect(ctx, left + 18, GROUND_Y - 50, 20, 8, GREY, 2.5);
	// A teal plus: the hospital's own made-up sign
	ctx.beginPath();
	ctx.rect(x - 3.5, GROUND_Y - 40, 7, 18);
	ctx.rect(x - 9, GROUND_Y - 34.5, 18, 7);
	ctx.fillStyle = TEAL;
	ctx.fill();
	rect(ctx, x - 6, GROUND_Y - 14, 12, 14, SKY, 2);
	rect(ctx, left + 5, GROUND_Y - 16, 9, 9, SKY, 2);
	rect(ctx, left + 42, GROUND_Y - 16, 9, 9, SKY, 2);
}

function drawPlant(
	ctx: CanvasRenderingContext2D,
	x: number,
	ruined: boolean,
	blackout: boolean,
	extras: SceneExtras
) {
	const left = x - 30;
	rect(ctx, left, GROUND_Y - 16, 60, 16, GREY, 3);
	if (ruined) {
		ctx.beginPath();
		ctx.moveTo(x - 24, GROUND_Y - 16);
		ctx.lineTo(x - 14, GROUND_Y - 30);
		ctx.lineTo(x - 6, GROUND_Y - 20);
		ctx.lineTo(x + 6, GROUND_Y - 28);
		ctx.lineTo(x + 24, GROUND_Y - 16);
		ctx.closePath();
		fillOutlined(ctx, GREY_DARK, 2.5);
		return;
	}
	// A cooling tower and a chimney with a cloud of steam
	ctx.beginPath();
	ctx.moveTo(x - 24, GROUND_Y - 16);
	ctx.quadraticCurveTo(x - 14, GROUND_Y - 32, x - 18, GROUND_Y - 46);
	ctx.lineTo(x + 2, GROUND_Y - 46);
	ctx.quadraticCurveTo(x + 6, GROUND_Y - 32, x + 2, GROUND_Y - 16);
	ctx.closePath();
	fillOutlined(ctx, PAPER, 2.5);
	rect(ctx, x + 12, GROUND_Y - 44, 10, 28, RED, 2.5);
	if (!blackout) {
		smoke(ctx, x - 8, GROUND_Y - 52, extras, 2);
		// A yellow bolt on the wall: the lights are on
		ctx.beginPath();
		ctx.moveTo(x + 2, GROUND_Y - 14);
		ctx.lineTo(x - 4, GROUND_Y - 7);
		ctx.lineTo(x, GROUND_Y - 7);
		ctx.lineTo(x - 2, GROUND_Y - 1);
		ctx.lineTo(x + 5, GROUND_Y - 9);
		ctx.lineTo(x + 1, GROUND_Y - 9);
		ctx.closePath();
		fillOutlined(ctx, YELLOW, 1.5);
	} else {
		// Lights out: a dark wash over the plant
		ctx.fillStyle = 'rgba(17,17,17,0.35)';
		ctx.fillRect(left, GROUND_Y - 50, 60, 50);
	}
}

function drawTag(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	value: number,
	kind: TargetKind,
	ruined: boolean
) {
	const text = String(value);
	ctx.font = `bold 15px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const width = Math.max(30, ctx.measureText(text).width + 14);
	ctx.beginPath();
	ctx.roundRect(x - width / 2, y - 11, width, 22, 8);
	fillOutlined(ctx, ruined ? GREY : kind === 'hospital' ? YELLOW : PAPER, 2.5);
	ctx.fillStyle = INK;
	ctx.fillText(text, x, y + 1);
}

function drawBattery(ctx: CanvasRenderingContext2D, state: DomeState) {
	// A little hill, a dome-shaped shelter and three launch tubes
	ctx.beginPath();
	ctx.ellipse(BATTERY_X, GROUND_Y, 26, 12, 0, Math.PI, 0);
	fillOutlined(ctx, GRASS_DARK, 2.5);
	ctx.beginPath();
	ctx.arc(BATTERY_X, GROUND_Y - 6, 14, Math.PI, 0);
	ctx.closePath();
	fillOutlined(ctx, GREY, 2.5);
	for (let i = 0; i < 3; i++) {
		const loaded = i < state.ammo.loaded;
		ctx.save();
		ctx.translate(BATTERY_X + (i - 1) * 9, GROUND_Y - 18);
		ctx.rotate(-0.4 + i * 0.4);
		ctx.beginPath();
		ctx.roundRect(-3.5, -14, 7, 16, 2);
		fillOutlined(ctx, loaded ? PAPER : GREY_DARK, 2);
		ctx.restore();
	}
}

function drawCity(ctx: CanvasRenderingContext2D, state: DomeState, extras: SceneExtras) {
	TARGETS.forEach((target, index) => {
		const ruined = state.ruined[index];
		if (target.kind === 'house') drawHouse(ctx, target.x, ruined);
		else if (target.kind === 'hospital') drawHospital(ctx, target.x, ruined);
		else drawPlant(ctx, target.x, ruined, state.blackoutMs > 0, extras);
		if (ruined) smoke(ctx, target.x, GROUND_Y - 28, extras, 2);
		const top = target.kind === 'house' ? 46 : target.kind === 'hospital' ? 52 : 84;
		drawTag(ctx, target.x, GROUND_Y - top - 12, ruined ? 0 : target.value, target.kind, ruined);
	});
}

function drawTrajectory(ctx: CanvasRenderingContext2D, rocket: Rocket) {
	const path = remainingPath(rocket.flight, rocket.elapsedMs, 26);
	ctx.save();
	ctx.beginPath();
	path.forEach((point, index) => {
		if (index === 0) ctx.moveTo(point.x, point.y);
		else ctx.lineTo(point.x, point.y);
	});
	ctx.setLineDash([2, 8]);
	ctx.lineCap = 'round';
	ctx.lineWidth = 3;
	ctx.strokeStyle = rocket.interceptorId === null ? 'rgba(17,17,17,0.38)' : 'rgba(17,17,17,0.16)';
	ctx.stroke();
	ctx.setLineDash([]);
	// The predicted landing: a flat ring on the ground
	const end = path[path.length - 1];
	ctx.beginPath();
	ctx.ellipse(end.x, GROUND_Y + 2, 11, 4.5, 0, 0, Math.PI * 2);
	ctx.strokeStyle = rocket.interceptorId === null ? 'rgba(229,72,77,0.85)' : 'rgba(17,17,17,0.3)';
	ctx.lineWidth = 2.5;
	ctx.stroke();
	ctx.restore();
}

function drawRocket(ctx: CanvasRenderingContext2D, rocket: Rocket, extras: SceneExtras) {
	const at = rocketPosition(rocket);
	const heading = flightHeading(rocket.flight, rocket.elapsedMs);
	const fast = rocket.kind === 'fast';
	// A puffy trail along the path it has already flown
	const progress = rocket.elapsedMs / rocket.flight.flightMs;
	for (let i = 1; i <= 4; i++) {
		const back = pointAt(rocket.flight, progress - i * 0.012);
		if (back.x === at.x && back.y === at.y) continue;
		ctx.beginPath();
		ctx.arc(back.x, back.y, 5 - i * 0.8, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255,255,255,${0.9 - i * 0.18})`;
		ctx.fill();
	}
	ctx.save();
	ctx.translate(at.x, at.y);
	ctx.rotate(heading);
	const flicker = extras.reducedMotion ? 1 : 0.8 + 0.4 * Math.abs(Math.sin(extras.timeMs / 70));
	// Flame
	ctx.beginPath();
	ctx.moveTo(-10, 0);
	ctx.lineTo(-18 * flicker - (fast ? 4 : 0), -3.5);
	ctx.lineTo(-18 * flicker - (fast ? 4 : 0), 3.5);
	ctx.closePath();
	fillOutlined(ctx, ORANGE, 1.5);
	// Fins
	ctx.beginPath();
	ctx.moveTo(-9, 0);
	ctx.lineTo(-13, -8);
	ctx.lineTo(-3, -4);
	ctx.moveTo(-9, 0);
	ctx.lineTo(-13, 8);
	ctx.lineTo(-3, 4);
	fillOutlined(ctx, GREY_DARK, 2);
	// Body and nose cone
	ctx.beginPath();
	ctx.roundRect(-11, -4.5, 20, 9, 3);
	fillOutlined(ctx, fast ? YELLOW : RED, 2.5);
	ctx.beginPath();
	ctx.moveTo(8, -4.5);
	ctx.quadraticCurveTo(15, -3.5, 17, 0);
	ctx.quadraticCurveTo(15, 3.5, 8, 4.5);
	ctx.closePath();
	fillOutlined(ctx, PAPER, 2.5);
	ctx.restore();
	if (rocket.interceptorId !== null) {
		// A locked-on bracket
		ctx.beginPath();
		ctx.arc(at.x, at.y, 17, 0, Math.PI * 2);
		ctx.setLineDash([4, 5]);
		ctx.strokeStyle = 'rgba(17,17,17,0.55)';
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function drawInterceptor(ctx: CanvasRenderingContext2D, interceptor: Interceptor) {
	const { x, y, heading } = interceptor;
	ctx.beginPath();
	ctx.moveTo(x - Math.cos(heading) * 30, y - Math.sin(heading) * 30);
	ctx.lineTo(x, y);
	ctx.strokeStyle = 'rgba(255,255,255,0.8)';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.stroke();
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(heading);
	ctx.beginPath();
	ctx.moveTo(-8, 0);
	ctx.lineTo(-14, -3);
	ctx.lineTo(-14, 3);
	ctx.closePath();
	fillOutlined(ctx, YELLOW, 1.5);
	ctx.beginPath();
	ctx.roundRect(-8, -3, 14, 6, 2);
	fillOutlined(ctx, PAPER, 2);
	ctx.beginPath();
	ctx.moveTo(6, -3);
	ctx.lineTo(11, 0);
	ctx.lineTo(6, 3);
	ctx.closePath();
	fillOutlined(ctx, TEAL, 2);
	ctx.restore();
}

function starburst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
	const points = 9;
	ctx.beginPath();
	for (let i = 0; i < points * 2; i++) {
		const angle = (i / (points * 2)) * Math.PI * 2;
		const r = i % 2 === 0 ? radius : radius * 0.55;
		const px = x + Math.cos(angle) * r;
		const py = y + Math.sin(angle) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[]) {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const effect of effects) {
		const t = Math.min(1, effect.ageMs / effect.durationMs);
		ctx.save();
		ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
		if (effect.kind === 'burst') {
			starburst(ctx, effect.x, effect.y, effect.radius * (0.4 + 0.6 * Math.min(1, t * 3)));
			fillOutlined(ctx, effect.color, 2.5);
		} else {
			const rise = t * 28;
			ctx.font = `bold ${effect.big ? 22 : 16}px ${DISPLAY_FONT}`;
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = INK;
			ctx.strokeText(effect.text, effect.x, effect.y - rise);
			ctx.fillStyle = effect.color;
			ctx.fillText(effect.text, effect.x, effect.y - rise);
		}
		ctx.restore();
	}
}

/** Draws the whole scene; the context must already be scaled so that one unit is one world unit */
export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: DomeState,
	extras: SceneExtras = NO_EXTRAS
) {
	drawSky(ctx, extras);
	drawSea(ctx, extras);
	drawGround(ctx);
	drawBattery(ctx, state);
	drawCity(ctx, state, extras);
	for (const rocket of state.rockets) drawTrajectory(ctx, rocket);
	for (const rocket of state.rockets) drawRocket(ctx, rocket, extras);
	for (const interceptor of state.interceptors) drawInterceptor(ctx, interceptor);
	drawEffects(ctx, extras.effects);
}

/** Draws the final scene onto the shared score card, centred on the city */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: DomeState,
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
	ctx.translate(x + size / 2 - 300 * scale, y);
	ctx.scale(scale, scale);
	drawScene(ctx, state, NO_EXTRAS);
	ctx.restore();
}

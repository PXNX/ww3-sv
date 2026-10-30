/*
 * Canvas drawing for Starlink Kill Switch, in world units (see state.ts) scaled by the caller.
 * A night sky with satellites that beam to every linked target, a road and a lake along the
 * bottom, SpaceX-ish rocket on the left and the refinery on the right. Machines get thick ink
 * outlines like the other modes; the sky and the lake are outline-free.
 */
import { createRandom } from '#lib/game/random.js';
import {
	LAKE_Y,
	REFINERY_X,
	ROAD_Y,
	STARTING_LIVES,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type CivilianKind,
	type KillState,
	type Target
} from './state';

const INK = '#111111';
const PAPER = '#ffffff';
const TIE_RED = '#e5484d';
const EXPLOSION_YELLOW = '#f5c83a';
const LINK = '#37d4ff';
const DRONE_GREY = '#3b4048';
const FLAME = '#f0772f';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| { kind: 'burst'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'splash'; x: number; ageMs: number; durationMs: number }
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			color: string;
			ageMs: number;
			durationMs: number;
	  }
	| { kind: 'ping'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	timeMs: number;
	shakeX: number;
	shakeY: number;
	/** The geofence line being dragged, if any */
	preview: { x1: number; y1: number; x2: number; y2: number } | null;
}

const STARS = (() => {
	const random = createRandom(5);
	return Array.from({ length: 46 }, () => ({
		x: random() * WORLD_WIDTH,
		y: random() * 250,
		size: 0.8 + random() * 1.4,
		phase: random() * Math.PI * 2
	}));
})();

/** Three satellites crawling along the top; each target beams to the nearest one */
function satellites(timeMs: number) {
	return [0, 1, 2].map((i) => ({
		x: (((timeMs / 1000) * (6 + i * 2) + i * 230) % (WORLD_WIDTH + 80)) - 40,
		y: 22 + i * 9
	}));
}

function outline(context: CanvasRenderingContext2D, width = 3) {
	context.lineWidth = width;
	context.lineJoin = 'round';
	context.lineCap = 'round';
	context.strokeStyle = INK;
}

function roundRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	context.beginPath();
	context.roundRect(x, y, w, h, r);
}

function drawBackground(context: CanvasRenderingContext2D, timeMs: number) {
	const sky = context.createLinearGradient(0, 0, 0, 320);
	sky.addColorStop(0, '#080c26');
	sky.addColorStop(0.65, '#1d2a63');
	sky.addColorStop(1, '#3d4b8f');
	context.fillStyle = sky;
	context.fillRect(-20, -20, WORLD_WIDTH + 40, 350);

	context.fillStyle = PAPER;
	for (const star of STARS) {
		context.globalAlpha = 0.45 + 0.45 * Math.sin(timeMs / 700 + star.phase);
		context.fillRect(star.x, star.y, star.size, star.size);
	}
	context.globalAlpha = 1;

	// Moon
	context.fillStyle = '#f4efd6';
	context.beginPath();
	context.arc(96, 78, 22, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = '#d9d3b4';
	for (const [dx, dy, r] of [
		[-6, -5, 5],
		[7, 6, 4],
		[3, -9, 2.5]
	]) {
		context.beginPath();
		context.arc(96 + dx, 78 + dy, r, 0, Math.PI * 2);
		context.fill();
	}

	// Hills and ground
	context.fillStyle = '#16233a';
	context.beginPath();
	context.moveTo(-20, 304);
	context.quadraticCurveTo(120, 262, 260, 300);
	context.quadraticCurveTo(400, 266, 540, 296);
	context.lineTo(WORLD_WIDTH + 20, 300);
	context.lineTo(WORLD_WIDTH + 20, LAKE_Y);
	context.lineTo(-20, LAKE_Y);
	context.closePath();
	context.fill();

	// Road
	context.fillStyle = '#2a2f3d';
	context.fillRect(-20, ROAD_Y - 18, WORLD_WIDTH + 40, 50);
	context.strokeStyle = '#d8cf7a';
	context.lineWidth = 2;
	context.setLineDash([14, 12]);
	context.beginPath();
	context.moveTo(-20, ROAD_Y + 9);
	context.lineTo(WORLD_WIDTH + 20, ROAD_Y + 9);
	context.stroke();
	context.setLineDash([]);

	// Lake
	const lake = context.createLinearGradient(0, LAKE_Y, 0, WORLD_HEIGHT);
	lake.addColorStop(0, '#1b5a8c');
	lake.addColorStop(1, '#0d2a4d');
	context.fillStyle = lake;
	context.fillRect(-20, LAKE_Y, WORLD_WIDTH + 40, WORLD_HEIGHT - LAKE_Y + 20);
	context.strokeStyle = 'rgba(255,255,255,0.18)';
	context.lineWidth = 1.5;
	for (let row = 0; row < 3; row++) {
		context.beginPath();
		for (let x = -20; x <= WORLD_WIDTH + 20; x += 8) {
			const y = LAKE_Y + 14 + row * 18 + Math.sin(x / 26 + timeMs / 600 + row * 2) * 2.2;
			if (x === -20) context.moveTo(x, y);
			else context.lineTo(x, y);
		}
		context.stroke();
	}
}

function drawSatellite(context: CanvasRenderingContext2D, x: number, y: number) {
	context.save();
	context.translate(x, y);
	context.fillStyle = '#b8c4e8';
	context.fillRect(-4, -3, 8, 6);
	context.fillStyle = '#4a6fd8';
	context.fillRect(-17, -2, 11, 4);
	context.fillRect(6, -2, 11, 4);
	context.restore();
}

function drawRocket(context: CanvasRenderingContext2D, timeMs: number) {
	context.save();
	context.translate(20, LAKE_Y - 4);
	// Launch tower
	outline(context, 2);
	context.fillStyle = '#4b5568';
	context.fillRect(18, -118, 8, 118);
	context.strokeRect(18, -118, 8, 118);
	// Starship-ish stack
	context.fillStyle = '#d9dee8';
	roundRect(context, -8, -96, 22, 86, 4);
	context.fill();
	context.stroke();
	context.beginPath();
	context.moveTo(-8, -96);
	context.quadraticCurveTo(3, -122, 14, -96);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = INK;
	context.fillRect(-8, -62, 22, 3);
	context.fillRect(-8, -40, 22, 3);
	// Idle engine glow
	context.fillStyle = FLAME;
	context.globalAlpha = 0.6 + 0.3 * Math.sin(timeMs / 140);
	context.beginPath();
	context.moveTo(-2, -10);
	context.lineTo(3, 6);
	context.lineTo(8, -10);
	context.closePath();
	context.fill();
	context.restore();
}

function drawRefinery(context: CanvasRenderingContext2D, timeMs: number, lives: number) {
	const lost = Math.max(0, STARTING_LIVES - lives);
	context.save();
	outline(context, 2.5);
	// Tanks
	const tanks = [
		{ x: 566, y: 270, w: 34, h: 82 },
		{ x: 604, y: 288, w: 34, h: 64 }
	];
	tanks.forEach((tank, i) => {
		context.fillStyle = lost > i + 1 ? '#3b3232' : '#9aa3b2';
		roundRect(context, tank.x, tank.y, tank.w, tank.h, 6);
		context.fill();
		context.stroke();
		context.beginPath();
		context.moveTo(tank.x + 2, tank.y + tank.h * 0.35);
		context.lineTo(tank.x + tank.w - 2, tank.y + tank.h * 0.35);
		context.stroke();
	});
	// Tower and flare stack
	context.fillStyle = '#6a7384';
	context.fillRect(552, 232, 7, 120);
	context.strokeRect(552, 232, 7, 120);
	context.fillStyle = FLAME;
	const flicker = 1 + 0.15 * Math.sin(timeMs / 90);
	context.beginPath();
	context.ellipse(555.5, 222, 6 * flicker, 12 * flicker, 0, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = EXPLOSION_YELLOW;
	context.beginPath();
	context.ellipse(555.5, 224, 3, 7 * flicker, 0, 0, Math.PI * 2);
	context.fill();
	// One fire per lost heart
	for (let i = 0; i < lost; i++) {
		const fx = [583, 621, 556][i];
		const fy = [262, 280, 296][i];
		const wobble = 1 + 0.2 * Math.sin(timeMs / 80 + i);
		context.fillStyle = TIE_RED;
		context.beginPath();
		context.ellipse(fx, fy, 11 * wobble, 20 * wobble, 0, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = EXPLOSION_YELLOW;
		context.beginPath();
		context.ellipse(fx, fy + 4, 6, 11 * wobble, 0, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawLinkBadge(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	const y = target.civilian ? -44 : -30;
	context.save();
	context.translate(0, y);
	if (target.state === 'falling') {
		context.restore();
		return;
	}
	const dead = target.state === 'stalled';
	const offline = target.state === 'offline';
	const blink = offline && Math.floor(timeMs / 160) % 2 === 0;
	context.fillStyle = dead || offline ? TIE_RED : LINK;
	if (blink) context.fillStyle = EXPLOSION_YELLOW;
	outline(context, 2);
	context.beginPath();
	context.arc(0, 0, 10, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.strokeStyle = PAPER;
	context.lineWidth = 2;
	if (dead || offline) {
		context.beginPath();
		context.moveTo(-4, -4);
		context.lineTo(4, 4);
		context.moveTo(4, -4);
		context.lineTo(-4, 4);
		context.stroke();
	} else {
		context.beginPath();
		context.arc(0, 3, 3, Math.PI * 1.15, Math.PI * 1.85);
		context.stroke();
		context.beginPath();
		context.arc(0, 3, 7, Math.PI * 1.2, Math.PI * 1.8);
		context.stroke();
		context.fillStyle = PAPER;
		context.beginPath();
		context.arc(0, 3, 1.5, 0, Math.PI * 2);
		context.fill();
	}
	if (offline) {
		// A pulsing ring tells the player this one needs a tap to come back
		context.strokeStyle = EXPLOSION_YELLOW;
		context.lineWidth = 2;
		context.beginPath();
		context.arc(0, 0, 13 + 3 * Math.sin(timeMs / 120), 0, Math.PI * 2);
		context.stroke();
	}
	context.restore();
}

function drawDrone(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	const flying = target.state === 'flying';
	const angle = flying ? Math.atan2(target.vy, target.vx) : target.spin;
	const scale = target.kind === 'fast' ? 0.85 : 1;
	context.save();
	context.rotate(angle);
	context.scale(scale, scale);
	outline(context, 2.5);
	context.fillStyle = target.kind === 'fast' ? '#5c2f33' : DRONE_GREY;
	// Delta wing with the nose to the right
	context.beginPath();
	context.moveTo(20, 0);
	context.lineTo(-16, -17);
	context.lineTo(-10, 0);
	context.lineTo(-16, 17);
	context.closePath();
	context.fill();
	context.stroke();
	context.fillStyle = TIE_RED;
	context.fillRect(8, -2, 8, 4);
	// Little propeller blur at the back
	context.strokeStyle = INK;
	context.lineWidth = 2;
	context.beginPath();
	const prop = Math.sin(timeMs / 30) * 7;
	context.moveTo(-13, -prop);
	context.lineTo(-13, prop);
	context.stroke();
	if (!flying) {
		context.fillStyle = FLAME;
		context.beginPath();
		context.arc(-12, 0, 5 + Math.sin(timeMs / 40) * 1.5, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
}

function drawWheel(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	timeMs: number
) {
	context.fillStyle = '#23262f';
	context.beginPath();
	context.arc(x, y, r, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.fillStyle = '#c9ced9';
	context.beginPath();
	context.arc(x, y, r * 0.4, 0, Math.PI * 2);
	context.fill();
	context.strokeStyle = INK;
	context.lineWidth = 1.5;
	const spin = timeMs / 120;
	context.beginPath();
	context.moveTo(x + Math.cos(spin) * r * 0.4, y + Math.sin(spin) * r * 0.4);
	context.lineTo(x - Math.cos(spin) * r * 0.4, y - Math.sin(spin) * r * 0.4);
	context.stroke();
}

function drawCivilian(context: CanvasRenderingContext2D, kind: CivilianKind, timeMs: number) {
	outline(context, 2.5);
	switch (kind) {
		case 'van':
			context.fillStyle = '#f2f2ee';
			roundRect(context, -26, -18, 52, 26, 5);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			context.fillRect(10, -14, 12, 10);
			context.strokeRect(10, -14, 12, 10);
			context.fillStyle = TIE_RED;
			context.fillRect(-22, -8, 26, 5);
			drawWheel(context, -14, 9, 6, timeMs);
			drawWheel(context, 14, 9, 6, timeMs);
			break;
		case 'tractor':
			context.fillStyle = '#4c9a4a';
			roundRect(context, -8, -10, 30, 14, 4);
			context.fill();
			context.stroke();
			context.fillStyle = '#3c7c3a';
			roundRect(context, -22, -26, 22, 22, 4);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			context.fillRect(-18, -22, 14, 11);
			drawWheel(context, -14, 6, 11, timeMs);
			drawWheel(context, 16, 9, 6, timeMs);
			break;
		case 'bus':
			context.fillStyle = '#f2c230';
			roundRect(context, -34, -22, 68, 30, 5);
			context.fill();
			context.stroke();
			context.fillStyle = '#8fd0e8';
			for (let i = 0; i < 5; i++) context.fillRect(-29 + i * 12, -17, 9, 9);
			context.fillStyle = INK;
			context.fillRect(-34, -2, 68, 3);
			drawWheel(context, -20, 9, 6, timeMs);
			drawWheel(context, 20, 9, 6, timeMs);
			break;
		case 'boat': {
			const bob = Math.sin(timeMs / 420) * 2;
			context.translate(0, bob);
			context.fillStyle = '#e5ede8';
			context.beginPath();
			context.moveTo(-26, -4);
			context.lineTo(26, -4);
			context.lineTo(18, 10);
			context.lineTo(-18, 10);
			context.closePath();
			context.fill();
			context.stroke();
			context.fillStyle = TIE_RED;
			roundRect(context, -8, -18, 16, 14, 3);
			context.fill();
			context.stroke();
			context.beginPath();
			context.moveTo(12, -4);
			context.lineTo(12, -26);
			context.stroke();
			context.fillStyle = EXPLOSION_YELLOW;
			context.beginPath();
			context.moveTo(12, -26);
			context.lineTo(24, -16);
			context.lineTo(12, -8);
			context.closePath();
			context.fill();
			context.stroke();
			break;
		}
	}
}

function drawTarget(context: CanvasRenderingContext2D, target: Target, timeMs: number) {
	context.save();
	context.translate(target.x, target.y);
	if (target.civilian) {
		context.save();
		// Vehicles driving left face left
		if (target.vx < 0) context.scale(-1, 1);
		drawCivilian(context, target.kind as CivilianKind, timeMs);
		context.restore();
	} else {
		drawDrone(context, target, timeMs);
	}
	drawLinkBadge(context, target, timeMs);
	context.restore();
}

function drawBeams(
	context: CanvasRenderingContext2D,
	state: KillState,
	sats: { x: number; y: number }[]
) {
	context.lineWidth = 1.5;
	context.setLineDash([3, 5]);
	for (const target of state.targets) {
		if (target.state !== 'flying') continue;
		let nearest = sats[0];
		for (const sat of sats) {
			if (Math.abs(sat.x - target.x) < Math.abs(nearest.x - target.x)) nearest = sat;
		}
		context.strokeStyle = target.civilian ? 'rgba(55,212,255,0.25)' : 'rgba(55,212,255,0.5)';
		context.beginPath();
		context.moveTo(nearest.x, nearest.y + 4);
		context.lineTo(target.x, target.y - (target.civilian ? 44 : 30));
		context.stroke();
	}
	context.setLineDash([]);
}

function drawFence(context: CanvasRenderingContext2D, state: KillState, timeMs: number) {
	const fence = state.fence;
	if (!fence) return;
	const fade = Math.min(1, fence.leftMs / 800);
	context.save();
	context.globalAlpha = fade;
	context.strokeStyle = LINK;
	context.lineWidth = 4;
	context.shadowColor = LINK;
	context.shadowBlur = 12;
	context.setLineDash([10, 8]);
	context.lineDashOffset = -timeMs / 40;
	context.beginPath();
	context.moveTo(fence.x1, fence.y1);
	context.lineTo(fence.x2, fence.y2);
	context.stroke();
	context.restore();
}

function drawEffect(context: CanvasRenderingContext2D, effect: Effect) {
	const progress = Math.min(1, effect.ageMs / effect.durationMs);
	context.save();
	switch (effect.kind) {
		case 'burst': {
			const r = effect.size * (0.35 + 0.65 * progress);
			context.globalAlpha = 1 - progress;
			context.fillStyle = FLAME;
			context.beginPath();
			context.arc(effect.x, effect.y, r, 0, Math.PI * 2);
			context.fill();
			context.fillStyle = EXPLOSION_YELLOW;
			context.beginPath();
			context.arc(effect.x, effect.y, r * 0.55, 0, Math.PI * 2);
			context.fill();
			break;
		}
		case 'splash': {
			context.globalAlpha = 1 - progress;
			context.strokeStyle = PAPER;
			context.lineWidth = 2.5;
			context.beginPath();
			context.ellipse(effect.x, LAKE_Y + 3, 8 + progress * 34, 3 + progress * 7, 0, 0, Math.PI * 2);
			context.stroke();
			context.fillStyle = PAPER;
			for (let i = -2; i <= 2; i++) {
				const lift = Math.sin(progress * Math.PI) * (24 - Math.abs(i) * 6);
				context.beginPath();
				context.arc(effect.x + i * 7 * (0.5 + progress), LAKE_Y - lift, 2.4, 0, Math.PI * 2);
				context.fill();
			}
			break;
		}
		case 'popup': {
			context.globalAlpha = 1 - progress * progress;
			context.font = `800 20px ${DISPLAY_FONT}`;
			context.textAlign = 'center';
			context.lineWidth = 4;
			context.strokeStyle = INK;
			context.fillStyle = effect.color;
			const y = effect.y - 26 - progress * 30;
			context.strokeText(effect.text, effect.x, y);
			context.fillText(effect.text, effect.x, y);
			break;
		}
		case 'ping':
			context.globalAlpha = 0.5 * (1 - progress);
			context.strokeStyle = PAPER;
			context.lineWidth = 2;
			context.beginPath();
			context.arc(effect.x, effect.y, 6 + progress * 16, 0, Math.PI * 2);
			context.stroke();
			break;
	}
	context.restore();
}

export function drawScene(
	context: CanvasRenderingContext2D,
	state: KillState,
	extras: SceneExtras
) {
	context.save();
	context.translate(extras.shakeX, extras.shakeY);
	drawBackground(context, extras.timeMs);
	const sats = satellites(extras.timeMs);
	drawBeams(context, state, sats);
	for (const sat of sats) drawSatellite(context, sat.x, sat.y);
	drawRocket(context, extras.timeMs);
	drawRefinery(context, extras.timeMs, state.lives);
	// Warning line where the refinery starts
	context.strokeStyle = 'rgba(229,72,77,0.35)';
	context.lineWidth = 2;
	context.setLineDash([6, 8]);
	context.beginPath();
	context.moveTo(REFINERY_X, 40);
	context.lineTo(REFINERY_X, 300);
	context.stroke();
	context.setLineDash([]);

	// Vehicles under drones, so a low drone never hides the link of a van
	for (const target of state.targets)
		if (target.civilian) drawTarget(context, target, extras.timeMs);
	for (const target of state.targets)
		if (!target.civilian) drawTarget(context, target, extras.timeMs);
	drawFence(context, state, extras.timeMs);
	if (extras.preview) {
		context.strokeStyle = 'rgba(55,212,255,0.8)';
		context.lineWidth = 3;
		context.setLineDash([6, 6]);
		context.beginPath();
		context.moveTo(extras.preview.x1, extras.preview.y1);
		context.lineTo(extras.preview.x2, extras.preview.y2);
		context.stroke();
		context.setLineDash([]);
	}
	for (const effect of extras.effects) drawEffect(context, effect);
	context.restore();
}

/** Draws the final scene onto the shared score card: the whole world, fitted into a square */
export function drawScenePreview(
	context: CanvasRenderingContext2D,
	state: KillState,
	extras: SceneExtras,
	x: number,
	y: number,
	size: number
) {
	const scale = size / WORLD_WIDTH;
	const height = WORLD_HEIGHT * scale;
	context.save();
	context.beginPath();
	context.rect(x, y, size, size);
	context.clip();
	context.translate(x, y + (size - height) / 2);
	context.scale(scale, scale);
	drawScene(context, state, extras);
	context.restore();
}

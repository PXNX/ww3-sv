/*
 * Canvas drawing for Wandering Balloon, all in world units (see config.ts) and scaled by the
 * caller: the stacked wind layers with their streaks and arrows, the scrolling ground with its
 * points of interest and the east coast, the hazards, the hot-air puffs, the patrol jets, the
 * balloon with its burner flame, and short popups. Everything is original cartoon art: the
 * balloon, the missile and the jets are made-up designs without any real markings.
 */
import {
	BALLOON_RADIUS,
	BALLOON_X,
	CHUNK_LENGTH,
	GROUND_Y,
	JET_HALF_LENGTH,
	JET_WARN_MS,
	LAYER_COUNT,
	LAYER_HEIGHT,
	PHOTO_DWELL_MS,
	PHOTO_RANGE,
	PUFF_RADIUS,
	TRACK_LENGTH,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from './config.js';
import type { Hazard, Poi, Puff } from './course.js';
import { isBurning, missilePosition, screenX, type BalloonState, type Jet } from './state.js';
import { chunkOf, layerCentre, windPattern } from './wind.js';

export const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const LAYER_TINTS = ['#9ec3e6', '#aacdea', '#b7d6ee', '#c4dff2', '#d1e8f5'] as const;
const STREAK = 'rgba(255,255,255,0.85)';
const BACK_STREAK = 'rgba(229,72,77,0.8)';
const GRASS = '#7fb85a';
const GRASS_DARK = '#5e9a41';
const WATER = '#5bb4db';
const BEACH = '#e3c98a';
const RED = '#e5484d';
const YELLOW = '#f5c83a';
const BROWN = '#8a5a2b';
const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";

export type Effect =
	| {
			kind: 'popup';
			x: number;
			y: number;
			text: string;
			big: boolean;
			ageMs: number;
			durationMs: number;
	  }
	| {
			/** A speech bubble: the weather balloon's standard answer to everything */
			kind: 'bubble';
			x: number;
			y: number;
			text: string;
			ageMs: number;
			durationMs: number;
	  };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
}

export const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true };

/** A small deterministic scatter so the streaks sit in the same places every frame */
function hash(a: number, b: number, c: number): number {
	let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
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

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, speed: number, colour: string) {
	const length = Math.max(8, Math.abs(speed) * 0.32);
	const dir = speed < 0 ? -1 : 1;
	ctx.strokeStyle = colour;
	ctx.fillStyle = colour;
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + dir * length, y);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + dir * (length + 7), y);
	ctx.lineTo(x + dir * (length - 1), y - 5);
	ctx.lineTo(x + dir * (length - 1), y + 5);
	ctx.closePath();
	ctx.fill();
}

function drawSky(ctx: CanvasRenderingContext2D, state: BalloonState, still: boolean) {
	for (let layer = 0; layer < LAYER_COUNT; layer++) {
		ctx.fillStyle = LAYER_TINTS[layer];
		ctx.fillRect(0, layer * LAYER_HEIGHT, WORLD_WIDTH, LAYER_HEIGHT + 1);
	}
	// Dashed lines between the layers
	ctx.strokeStyle = 'rgba(255,255,255,0.7)';
	ctx.lineWidth = 2;
	ctx.setLineDash([10, 8]);
	ctx.beginPath();
	for (let layer = 1; layer < LAYER_COUNT; layer++) {
		ctx.moveTo(0, layer * LAYER_HEIGHT);
		ctx.lineTo(WORLD_WIDTH, layer * LAYER_HEIGHT);
	}
	ctx.stroke();
	ctx.setLineDash([]);

	const first = chunkOf(state.progress - BALLOON_X);
	const last = chunkOf(state.progress + WORLD_WIDTH);
	const time = still ? 0 : state.timeMs / 1000;
	for (let chunk = first; chunk <= last; chunk++) {
		const pattern = windPattern(state.seed, chunk);
		const start = chunk * CHUNK_LENGTH;
		for (let layer = 0; layer < LAYER_COUNT; layer++) {
			const wind = pattern[layer];
			ctx.strokeStyle = wind < 0 ? BACK_STREAK : STREAK;
			ctx.lineWidth = 3;
			ctx.lineCap = 'round';
			for (let k = 0; k < 5; k++) {
				const along = (hash(chunk, layer, k) * CHUNK_LENGTH + wind * time) % CHUNK_LENGTH;
				const x = screenX(state, start + (along < 0 ? along + CHUNK_LENGTH : along));
				const y = layer * LAYER_HEIGHT + 14 + hash(layer, k, chunk) * (LAYER_HEIGHT - 28);
				if (x < -60 || x > WORLD_WIDTH + 60) continue;
				const length = 14 + Math.abs(wind) * 0.35;
				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x + length, y);
				ctx.stroke();
			}
		}
		// A chunk boundary: a dotted line, and the new winds as arrows right behind it
		if (chunk > 0) {
			const x = screenX(state, start);
			if (x > -30 && x < WORLD_WIDTH + 30) {
				ctx.strokeStyle = 'rgba(17,17,17,0.35)';
				ctx.lineWidth = 2;
				ctx.setLineDash([3, 7]);
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, GROUND_Y);
				ctx.stroke();
				ctx.setLineDash([]);
				for (let layer = 0; layer < LAYER_COUNT; layer++) {
					arrow(ctx, x + 10, layerCentre(layer), pattern[layer], arrowColour(pattern[layer]));
				}
			}
		}
	}
	// The winds of the current stretch, always visible at the left edge
	const current = windPattern(state.seed, chunkOf(state.progress));
	for (let layer = 0; layer < LAYER_COUNT; layer++) {
		arrow(ctx, 10, layerCentre(layer), current[layer], arrowColour(current[layer]));
	}
}

/** Arrow colour: red for a headwind, ink for a tailwind */
function arrowColour(speed: number): string {
	return speed < 0 ? RED : INK;
}

function drawGround(ctx: CanvasRenderingContext2D, state: BalloonState) {
	ctx.fillStyle = GRASS;
	ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
	// Rolling hills along the horizon
	ctx.fillStyle = GRASS_DARK;
	ctx.beginPath();
	ctx.moveTo(0, WORLD_HEIGHT);
	for (let x = 0; x <= WORLD_WIDTH; x += 20) {
		const track = x + state.progress - BALLOON_X;
		ctx.lineTo(x, GROUND_Y + 8 + Math.sin(track / 47) * 4 + Math.sin(track / 19) * 2);
	}
	ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = INK;
	ctx.fillRect(0, GROUND_Y - 1.5, WORLD_WIDTH, 3);

	// The east coast: sand, then the sea
	const coast = screenX(state, TRACK_LENGTH);
	if (coast < WORLD_WIDTH) {
		ctx.fillStyle = BEACH;
		ctx.fillRect(Math.max(0, coast - 24), GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
		ctx.fillStyle = WATER;
		ctx.fillRect(Math.max(0, coast), GROUND_Y - 1, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y + 1);
		ctx.strokeStyle = PAPER;
		ctx.lineWidth = 3;
		ctx.beginPath();
		for (let y = GROUND_Y + 12; y < WORLD_HEIGHT; y += 14) {
			ctx.moveTo(Math.max(0, coast) + 8, y);
			ctx.quadraticCurveTo(Math.max(0, coast) + 20, y - 5, Math.max(0, coast) + 32, y);
		}
		ctx.stroke();
		ctx.fillStyle = INK;
		ctx.fillRect(Math.max(0, coast) - 1.5, GROUND_Y, 3, WORLD_HEIGHT - GROUND_Y);
	}
	// The west coast: the start of the track
	const west = screenX(state, 0);
	if (west > -40) {
		ctx.fillStyle = WATER;
		ctx.fillRect(Math.min(west, WORLD_WIDTH) - 200, GROUND_Y, 200, WORLD_HEIGHT - GROUND_Y);
	}
}

function drawPoi(ctx: CanvasRenderingContext2D, state: BalloonState, poi: Poi, still: boolean) {
	const x = screenX(state, poi.x);
	if (x < -60 || x > WORLD_WIDTH + 60) return;
	const y = GROUND_Y + 2;
	ctx.save();
	ctx.translate(x, y);
	if (poi.kind === 'farm') {
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.rect(-22, 6, 44, 28);
		ctx.fill();
		outline(ctx);
		ctx.fillStyle = BROWN;
		ctx.beginPath();
		ctx.moveTo(-26, 8);
		ctx.lineTo(0, -10);
		ctx.lineTo(26, 8);
		ctx.closePath();
		ctx.fill();
		outline(ctx);
		ctx.fillStyle = PAPER;
		ctx.fillRect(-7, 18, 14, 16);
		ctx.strokeRect(-7, 18, 14, 16);
	} else if (poi.kind === 'silo') {
		for (const [dx, h] of [
			[-14, 40],
			[14, 32]
		] as const) {
			ctx.fillStyle = '#c9ced6';
			ctx.beginPath();
			ctx.rect(dx - 11, 34 - h, 22, h);
			ctx.fill();
			outline(ctx);
			ctx.fillStyle = '#9aa3b0';
			ctx.beginPath();
			ctx.ellipse(dx, 34 - h, 11, 6, 0, Math.PI, 0);
			ctx.fill();
			outline(ctx);
		}
	} else if (poi.kind === 'lake') {
		ctx.fillStyle = WATER;
		ctx.beginPath();
		ctx.ellipse(0, 22, 40, 14, 0, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx);
		// The lake is very interesting: it has a suspiciously square shoreline marker
		ctx.fillStyle = PAPER;
		ctx.fillRect(-8, 8, 16, 11);
		ctx.strokeRect(-8, 8, 16, 11);
		ctx.fillStyle = INK;
		ctx.font = `bold 11px ${DISPLAY_FONT}`;
		ctx.textAlign = 'center';
		ctx.fillText('?', 0, 17.5);
	} else {
		ctx.fillStyle = '#d9d3b8';
		ctx.beginPath();
		ctx.ellipse(0, 22, 44, 16, 0, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx);
		ctx.fillStyle = GRASS;
		ctx.beginPath();
		ctx.ellipse(0, 22, 28, 8, 0, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 2);
		ctx.fillStyle = YELLOW;
		for (const dx of [-36, 36]) {
			ctx.fillRect(dx - 2, -6, 4, 28);
		}
	}
	ctx.restore();

	// The viewfinder: it fills while the balloon hovers over the spot, and ticks once the photo is taken
	if (poi.photographed) {
		ctx.fillStyle = PAPER;
		ctx.beginPath();
		ctx.arc(x, y - 16, 9, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx, 2);
		ctx.strokeStyle = '#2f9e5f';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x - 4, y - 16);
		ctx.lineTo(x - 1, y - 12);
		ctx.lineTo(x + 5, y - 20);
		ctx.stroke();
	} else if (Math.abs(poi.x - state.progress) <= PHOTO_RANGE + 30) {
		const fill = Math.min(1, poi.dwellMs / PHOTO_DWELL_MS);
		const pulse = still ? 0 : Math.sin(state.timeMs / 140) * 1.5;
		ctx.strokeStyle = fill > 0 ? RED : INK;
		ctx.lineWidth = 3;
		ctx.strokeRect(x - PHOTO_RANGE, y - 24 - pulse, PHOTO_RANGE * 2, 58 + pulse * 2);
		ctx.fillStyle = 'rgba(229,72,77,0.28)';
		ctx.fillRect(x - PHOTO_RANGE, y + 34 - 58 * fill, PHOTO_RANGE * 2, 58 * fill);
	}
}

function drawHazard(ctx: CanvasRenderingContext2D, state: BalloonState, hazard: Hazard) {
	const x = screenX(state, hazard.x);
	if (x < -60 || x > WORLD_WIDTH + 60) return;
	ctx.save();
	ctx.globalAlpha = hazard.spent ? 0.3 : 1;
	ctx.translate(x, hazard.y);
	if (hazard.kind === 'crow') {
		const flap = Math.sin(state.timeMs / 90 + hazard.phase) * 9;
		ctx.fillStyle = '#2a2a33';
		ctx.beginPath();
		ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
		ctx.fill();
		outline(ctx);
		ctx.beginPath();
		ctx.moveTo(-4, -2);
		ctx.lineTo(-12, -10 - flap);
		ctx.lineTo(4, -4);
		ctx.closePath();
		ctx.fill();
		outline(ctx);
		ctx.fillStyle = YELLOW;
		ctx.beginPath();
		ctx.moveTo(-12, -1);
		ctx.lineTo(-21, 2);
		ctx.lineTo(-12, 4);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 2);
		ctx.fillStyle = PAPER;
		ctx.beginPath();
		ctx.arc(-7, -3, 2.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = INK;
		ctx.fillRect(-8, -4, 2, 2);
	} else if (hazard.kind === 'cloud') {
		ctx.fillStyle = '#6b7280';
		ctx.beginPath();
		ctx.arc(-18, 6, 16, 0, Math.PI * 2);
		ctx.arc(2, -6, 22, 0, Math.PI * 2);
		ctx.arc(22, 6, 16, 0, Math.PI * 2);
		ctx.rect(-18, 6, 40, 16);
		ctx.fill();
		outline(ctx);
		ctx.fillStyle = YELLOW;
		ctx.beginPath();
		ctx.moveTo(2, 10);
		ctx.lineTo(-6, 26);
		ctx.lineTo(2, 24);
		ctx.lineTo(-2, 38);
		ctx.lineTo(12, 20);
		ctx.lineTo(4, 22);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 2);
	} else {
		ctx.rotate(-0.2);
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.moveTo(0, -16);
		ctx.lineTo(12, 0);
		ctx.lineTo(0, 16);
		ctx.lineTo(-12, 0);
		ctx.closePath();
		ctx.fill();
		outline(ctx);
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, -16);
		ctx.lineTo(0, 16);
		ctx.moveTo(-12, 0);
		ctx.lineTo(12, 0);
		ctx.stroke();
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, 16);
		ctx.bezierCurveTo(8, 24, -8, 30, 4, 40);
		ctx.stroke();
		ctx.fillStyle = YELLOW;
		for (const [dx, dy] of [
			[4, 26],
			[0, 34]
		] as const) {
			ctx.fillRect(dx - 4, dy - 2, 8, 4);
		}
	}
	ctx.restore();
}

function drawPuff(ctx: CanvasRenderingContext2D, state: BalloonState, puff: Puff, still: boolean) {
	if (puff.taken) return;
	const x = screenX(state, puff.x);
	if (x < -40 || x > WORLD_WIDTH + 40) return;
	const bob = still ? 0 : Math.sin(state.timeMs / 300 + puff.x) * 3;
	ctx.fillStyle = '#ffb347';
	ctx.beginPath();
	ctx.arc(x, puff.y + bob, PUFF_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	outline(ctx);
	ctx.fillStyle = YELLOW;
	ctx.beginPath();
	ctx.arc(x, puff.y + bob + 2, PUFF_RADIUS * 0.55, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = INK;
	ctx.font = `bold 11px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('+', x, puff.y + bob + 1);
}

function drawJet(ctx: CanvasRenderingContext2D, state: BalloonState, jet: Jet, still: boolean) {
	const y = layerCentre(jet.layer);
	if (jet.ageMs < JET_WARN_MS) {
		// The warning: the whole layer blinks red and an arrow points in from the right
		const blink = still || Math.floor(jet.ageMs / 160) % 2 === 0;
		if (blink) {
			ctx.fillStyle = 'rgba(229,72,77,0.22)';
			ctx.fillRect(0, jet.layer * LAYER_HEIGHT, WORLD_WIDTH, LAYER_HEIGHT);
		}
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.moveTo(WORLD_WIDTH - 40, y);
		ctx.lineTo(WORLD_WIDTH - 12, y - 14);
		ctx.lineTo(WORLD_WIDTH - 12, y + 14);
		ctx.closePath();
		ctx.fill();
		outline(ctx);
		return;
	}
	const tail = jet.x;
	const nose = tail - JET_HALF_LENGTH * 2;
	ctx.fillStyle = '#9aa3b0';
	ctx.beginPath();
	ctx.moveTo(nose, y);
	ctx.quadraticCurveTo(nose + 18, y - 11, tail - 14, y - 9);
	ctx.lineTo(tail, y - 18);
	ctx.lineTo(tail, y + 4);
	ctx.lineTo(tail - 14, y + 9);
	ctx.quadraticCurveTo(nose + 18, y + 11, nose, y);
	ctx.closePath();
	ctx.fill();
	outline(ctx);
	ctx.fillStyle = '#6a7c9b';
	ctx.beginPath();
	ctx.moveTo(tail - 36, y);
	ctx.lineTo(tail - 22, y + 20);
	ctx.lineTo(tail - 14, y + 20);
	ctx.lineTo(tail - 20, y);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 2);
	ctx.fillStyle = YELLOW;
	ctx.beginPath();
	ctx.ellipse(nose + 20, y - 3, 7, 4, 0, 0, Math.PI * 2);
	ctx.fill();
	outline(ctx, 2);
	// A stripe of speed lines behind it
	ctx.strokeStyle = PAPER;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(tail + 8, y - 4);
	ctx.lineTo(tail + 40, y - 4);
	ctx.moveTo(tail + 14, y + 4);
	ctx.lineTo(tail + 50, y + 4);
	ctx.stroke();
}

function drawBalloon(ctx: CanvasRenderingContext2D, state: BalloonState, still: boolean) {
	const blink =
		state.invulnerableMs > 0 && !still && Math.floor(state.invulnerableMs / 100) % 2 === 0;
	const x = BALLOON_X;
	const y = state.y;
	ctx.save();
	ctx.globalAlpha = blink ? 0.35 : 1;
	// Burner flame under the envelope
	if (isBurning(state)) {
		const flicker = still ? 0 : Math.sin(state.timeMs / 45) * 3;
		ctx.fillStyle = YELLOW;
		ctx.beginPath();
		ctx.moveTo(x - 6, y + BALLOON_RADIUS + 3);
		ctx.quadraticCurveTo(x, y + BALLOON_RADIUS + 26 + flicker, x + 6, y + BALLOON_RADIUS + 3);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 2);
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.moveTo(x - 3, y + BALLOON_RADIUS + 3);
		ctx.quadraticCurveTo(x, y + BALLOON_RADIUS + 15 + flicker, x + 3, y + BALLOON_RADIUS + 3);
		ctx.closePath();
		ctx.fill();
	}
	// Basket and ropes
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - 12, y + BALLOON_RADIUS - 4);
	ctx.lineTo(x - 7, y + BALLOON_RADIUS + 12);
	ctx.moveTo(x + 12, y + BALLOON_RADIUS - 4);
	ctx.lineTo(x + 7, y + BALLOON_RADIUS + 12);
	ctx.stroke();
	ctx.fillStyle = BROWN;
	ctx.beginPath();
	ctx.rect(x - 9, y + BALLOON_RADIUS + 12, 18, 11);
	ctx.fill();
	outline(ctx, 2);
	// Envelope with white stripes
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.ellipse(x, y, BALLOON_RADIUS * 0.92, BALLOON_RADIUS, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.save();
	ctx.clip();
	ctx.fillStyle = PAPER;
	ctx.fillRect(x - 5, y - BALLOON_RADIUS, 10, BALLOON_RADIUS * 2);
	ctx.restore();
	ctx.beginPath();
	ctx.ellipse(x, y, BALLOON_RADIUS * 0.92, BALLOON_RADIUS, 0, 0, Math.PI * 2);
	outline(ctx, 3);
	// Sunglasses, because it is just a weather balloon
	ctx.fillStyle = INK;
	ctx.fillRect(x - 12, y - 6, 10, 6);
	ctx.fillRect(x + 2, y - 6, 10, 6);
	ctx.fillRect(x - 3, y - 5, 6, 2);
	ctx.restore();
}

function drawMissile(ctx: CanvasRenderingContext2D, state: BalloonState, still: boolean) {
	const { x, y } = missilePosition(state);
	const angle = Math.atan2(state.y - (GROUND_Y + 6), BALLOON_X - (WORLD_WIDTH + 30));
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	const flame = still ? 0 : Math.sin(state.timeMs / 40) * 2;
	ctx.fillStyle = YELLOW;
	ctx.beginPath();
	ctx.moveTo(8, 0);
	ctx.lineTo(18 + flame, -3);
	ctx.lineTo(18 + flame, 3);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = PAPER;
	ctx.beginPath();
	ctx.moveTo(-10, 0);
	ctx.lineTo(-5, -4);
	ctx.lineTo(8, -4);
	ctx.lineTo(8, 4);
	ctx.lineTo(-5, 4);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 2);
	ctx.fillStyle = RED;
	ctx.fillRect(2, -6, 5, 3);
	ctx.fillRect(2, 3, 5, 3);
	ctx.restore();
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.fillStyle = YELLOW;
	ctx.beginPath();
	for (let i = 0; i < 16; i++) {
		const radius = i % 2 === 0 ? 40 : 20;
		const angle = (i / 16) * Math.PI * 2;
		ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
	}
	ctx.closePath();
	ctx.fill();
	outline(ctx, 3);
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(x, y, 12, 0, Math.PI * 2);
	ctx.fill();
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[]) {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const effect of effects) {
		const t = effect.ageMs / effect.durationMs;
		ctx.save();
		ctx.globalAlpha = t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) * 4);
		if (effect.kind === 'popup') {
			const rise = t * 26;
			ctx.font = `bold ${effect.big ? 22 : 16}px ${DISPLAY_FONT}`;
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = INK;
			ctx.strokeText(effect.text, effect.x, effect.y - rise);
			ctx.fillStyle = PAPER;
			ctx.fillText(effect.text, effect.x, effect.y - rise);
		} else {
			ctx.font = `bold 14px ${DISPLAY_FONT}`;
			const width = ctx.measureText(effect.text).width + 20;
			const x = Math.min(WORLD_WIDTH - width / 2 - 6, Math.max(width / 2 + 6, effect.x));
			ctx.fillStyle = PAPER;
			ctx.beginPath();
			ctx.roundRect(x - width / 2, effect.y - 14, width, 28, 10);
			ctx.fill();
			outline(ctx, 2.5);
			ctx.fillStyle = INK;
			ctx.fillText(effect.text, x, effect.y);
		}
		ctx.restore();
	}
}

/** Draws the whole scene; the context must already be scaled so that one unit is one world unit */
export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: BalloonState,
	extras: SceneExtras = NO_EXTRAS
) {
	const still = extras.reducedMotion;
	drawSky(ctx, state, still);
	drawGround(ctx, state);
	for (const poi of state.course.pois) drawPoi(ctx, state, poi, still);
	for (const puff of state.course.puffs) drawPuff(ctx, state, puff, still);
	for (const hazard of state.course.hazards) {
		if (hazard.active) drawHazard(ctx, state, hazard);
	}
	for (const jet of state.jets) drawJet(ctx, state, jet, still);
	if (state.phase === 'fly') drawBalloon(ctx, state, still);
	else if (state.phase === 'finale') {
		drawBalloon(ctx, state, true);
		drawMissile(ctx, state, still);
	} else drawBurst(ctx, BALLOON_X, state.y);
	drawEffects(ctx, extras.effects);
}

/** Draws the final scene onto the shared score card, centred on the balloon */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: BalloonState,
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
	ctx.translate(x + size / 2 - BALLOON_X * scale, y);
	ctx.scale(scale, scale);
	drawScene(ctx, state, NO_EXTRAS);
	ctx.restore();
}

/*
 * Canvas drawing for Suez Stuck, all in world units (see config.ts) and scaled by the caller: the
 * water and bank tiles, the waiting ships, the excavator, the green-hulled "Ever Stuck" with its
 * grab handles and the tow lines to the fingers holding it, and short effects. Everything is
 * original cartoon art: the ship is a made-up design with no real vessel's livery or branding.
 */
import { ENDS, endPoint, type Body, type End } from './body';
import { isSolidTile, type Canal } from './canal';
import {
	COLS,
	NOSE_LENGTH,
	QUEUE_CAPACITY,
	ROWS,
	SHIP_NAME,
	TILE,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	levelParams
} from './config';
import type { SuezState } from './state';

export const INK = '#111111';
const PAPER = '#ffffff';
const SAND = '#e8e1bc';
const WATER = '#5bb4db';
const WATER_LIGHT = '#8fd0ea';
const BANKS = ['#e3c98a', '#dcbe7c', '#d5b36e'] as const;
const SHORE = '#8a6a33';
const HULL = '#2f9e5f';
const HULL_DARK = '#1f6b40';
const DECK = '#58c488';
const BOX_COLOURS = ['#e5484d', '#f5c83a', '#4fa8d8', '#e8e1bc', '#d9822b', '#7c8c5c'] as const;
const QUEUE_HULLS = ['#4fa8d8', '#e5484d', '#f5c83a', '#d9822b', '#7a6bb3'] as const;
const DIGGER = '#f5c83a';
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
	| { kind: 'dust'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'ring'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	reducedMotion: boolean;
	/** Real time in milliseconds, for the water ripples */
	timeMs: number;
}

export const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true, timeMs: 0 };

/** A small deterministic scatter so the banks look lumpy without any randomness at draw time */
function hash(col: number, row: number): number {
	let h = (col * 374761393 + row * 668265263) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function channelCentre(canal: Canal, row: number): number {
	let lo = canal.cols;
	let hi = -1;
	for (let col = 0; col < canal.cols; col++) {
		if (!isSolidTile(canal, col, row)) {
			lo = Math.min(lo, col);
			hi = Math.max(hi, col);
		}
	}
	return hi < lo ? WORLD_WIDTH / 2 : ((lo + hi + 1) / 2) * TILE;
}

function drawGround(ctx: CanvasRenderingContext2D, canal: Canal, timeMs: number, still: boolean) {
	ctx.fillStyle = WATER;
	ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const x = col * TILE;
			const y = row * TILE;
			if (isSolidTile(canal, col, row)) {
				const shade = hash(col, row);
				ctx.fillStyle = BANKS[Math.floor(shade * BANKS.length)];
				ctx.fillRect(x, y, TILE, TILE);
				if (shade > 0.55) {
					ctx.fillStyle = 'rgba(138,106,51,0.35)';
					ctx.beginPath();
					ctx.arc(x + 4 + shade * 10, y + 6 + hash(row, col) * 8, 1.6, 0, Math.PI * 2);
					ctx.fill();
				}
			} else if ((col + row) % 3 === 0) {
				// A ripple that drifts sideways, or sits still for reduced motion
				const drift = still ? 0 : Math.sin(timeMs / 700 + col + row) * 3;
				ctx.strokeStyle = WATER_LIGHT;
				ctx.lineWidth = 1.5;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(x + 4 + drift, y + 10);
				ctx.quadraticCurveTo(x + 10 + drift, y + 6, x + 16 + drift, y + 10);
				ctx.stroke();
			}
		}
	}
	// A dark shoreline wherever a bank meets the water
	ctx.strokeStyle = SHORE;
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			if (!isSolidTile(canal, col, row)) continue;
			const x = col * TILE;
			const y = row * TILE;
			if (!isSolidTile(canal, col - 1, row)) {
				ctx.moveTo(x, y);
				ctx.lineTo(x, y + TILE);
			}
			if (!isSolidTile(canal, col + 1, row)) {
				ctx.moveTo(x + TILE, y);
				ctx.lineTo(x + TILE, y + TILE);
			}
			if (row > 0 && !isSolidTile(canal, col, row - 1)) {
				ctx.moveTo(x, y);
				ctx.lineTo(x + TILE, y);
			}
			if (row < ROWS - 1 && !isSolidTile(canal, col, row + 1)) {
				ctx.moveTo(x, y + TILE);
				ctx.lineTo(x + TILE, y + TILE);
			}
		}
	}
	ctx.stroke();
}

function outline(ctx: CanvasRenderingContext2D, fill: string, width = 2.5) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = width;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.strokeStyle = INK;
	ctx.stroke();
}

/** One small waiting ship, seen from above, bow up, centred on (x, y) */
function drawQueueShip(ctx: CanvasRenderingContext2D, x: number, y: number, index: number) {
	const length = 44;
	const beam = 17;
	ctx.save();
	ctx.translate(x, y);
	ctx.beginPath();
	ctx.moveTo(-beam / 2, length / 2);
	ctx.lineTo(-beam / 2, -length / 2 + 12);
	ctx.lineTo(0, -length / 2);
	ctx.lineTo(beam / 2, -length / 2 + 12);
	ctx.lineTo(beam / 2, length / 2);
	ctx.closePath();
	outline(ctx, QUEUE_HULLS[index % QUEUE_HULLS.length], 2);
	ctx.fillStyle = PAPER;
	ctx.fillRect(-4, length / 2 - 14, 8, 9);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 1.5;
	ctx.strokeRect(-4, length / 2 - 14, 8, 9);
	ctx.fillStyle = BOX_COLOURS[(index + 2) % BOX_COLOURS.length];
	ctx.fillRect(-5, -8, 10, 8);
	ctx.strokeRect(-5, -8, 10, 8);
	ctx.restore();
}

function drawQueue(ctx: CanvasRenderingContext2D, state: SuezState) {
	const shown = Math.min(state.queue.waiting, QUEUE_CAPACITY - 1);
	const x = channelCentre(state.canal, ROWS - 1);
	for (let i = 0; i < shown; i++) drawQueueShip(ctx, x, WORLD_HEIGHT - 30 - i * 40, i);
}

function drawExcavator(ctx: CanvasRenderingContext2D, state: SuezState) {
	const { x, y, digMs } = state.excavator;
	const dig = digMs > 0 ? 1 - digMs / 700 : 0;
	ctx.save();
	ctx.translate(x, y);
	// A cooldown ring around it while it rests
	if (state.cooldownMs > 0) {
		const full = levelParams(state.level).excavatorCooldownMs;
		const share = Math.min(1, state.cooldownMs / full);
		ctx.strokeStyle = 'rgba(17,17,17,0.55)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
		ctx.stroke();
	}
	// Tracks
	ctx.beginPath();
	ctx.roundRect(-13, 4, 26, 8, 4);
	outline(ctx, '#3b3b3b', 2);
	// Body and cab
	ctx.beginPath();
	ctx.roundRect(-11, -6, 20, 11, 2);
	outline(ctx, DIGGER, 2);
	ctx.beginPath();
	ctx.rect(-3, -14, 11, 9);
	outline(ctx, DIGGER, 2);
	ctx.fillStyle = '#bfe3f2';
	ctx.fillRect(-1, -12, 7, 5);
	// The arm swings down and back while it digs
	const swing = Math.sin(dig * Math.PI);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 3.5;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(-9, -4);
	ctx.lineTo(-18 - swing * 3, -13 + swing * 11);
	ctx.lineTo(-23 + swing * 4, -4 + swing * 9);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-23 + swing * 4, -4 + swing * 9);
	ctx.lineTo(-27 + swing * 4, 1 + swing * 9);
	ctx.lineTo(-20 + swing * 4, 2 + swing * 9);
	ctx.closePath();
	outline(ctx, DIGGER, 2);
	ctx.restore();
}

/** Containers stacked on the deck: fixed pattern, so the ship does not flicker */
function drawContainers(ctx: CanvasRenderingContext2D, body: Body) {
	const half = body.length / 2;
	const start = -half + 48;
	const end = half - NOSE_LENGTH - 6;
	const rowHeight = 10;
	let index = 0;
	for (let x = start; x + 13 <= end; x += 14, index++) {
		for (const side of [-1, 1] as const) {
			const y = side === -1 ? -body.beam / 2 + 4 : 6;
			ctx.fillStyle = BOX_COLOURS[(index * 2 + (side === -1 ? 0 : 3)) % BOX_COLOURS.length];
			ctx.fillRect(x, y, 13, rowHeight - 1);
			ctx.strokeStyle = INK;
			ctx.lineWidth = 1.2;
			ctx.strokeRect(x, y, 13, rowHeight - 1);
		}
	}
}

function drawShip(ctx: CanvasRenderingContext2D, body: Body) {
	const half = body.length / 2;
	const side = body.beam / 2;
	ctx.save();
	ctx.translate(body.x, body.y);
	ctx.rotate(body.angle);
	// Foam around the hull
	ctx.beginPath();
	ctx.moveTo(-half - 3, -side - 3);
	ctx.lineTo(half - NOSE_LENGTH, -side - 3);
	ctx.lineTo(half + 4, 0);
	ctx.lineTo(half - NOSE_LENGTH, side + 3);
	ctx.lineTo(-half - 3, side + 3);
	ctx.closePath();
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.fill();
	// Hull
	ctx.beginPath();
	ctx.moveTo(-half, -side);
	ctx.lineTo(half - NOSE_LENGTH, -side);
	ctx.lineTo(half, 0);
	ctx.lineTo(half - NOSE_LENGTH, side);
	ctx.lineTo(-half, side);
	ctx.closePath();
	outline(ctx, HULL, 3);
	// Deck
	ctx.beginPath();
	ctx.moveTo(-half + 3, -side + 3);
	ctx.lineTo(half - NOSE_LENGTH - 2, -side + 3);
	ctx.lineTo(half - 12, 0);
	ctx.lineTo(half - NOSE_LENGTH - 2, side - 3);
	ctx.lineTo(-half + 3, side - 3);
	ctx.closePath();
	ctx.fillStyle = DECK;
	ctx.fill();
	// The name on a dark stripe down the middle
	ctx.fillStyle = HULL_DARK;
	ctx.fillRect(-half + 46, -5, half - NOSE_LENGTH - 6 - (-half + 46), 10);
	drawContainers(ctx, body);
	ctx.fillStyle = PAPER;
	ctx.font = `700 8px ${DISPLAY_FONT}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(SHIP_NAME, (-half + 46 + half - NOSE_LENGTH - 6) / 2, 0.5);
	// The bridge at the stern: a white block with a row of windows and a funnel
	ctx.beginPath();
	ctx.rect(-half + 6, -side + 4, 30, body.beam - 8);
	outline(ctx, PAPER, 2.5);
	ctx.fillStyle = '#3d7ea6';
	for (let i = 0; i < 3; i++) ctx.fillRect(-half + 29, -side + 8 + i * 7.5, 4, 4);
	ctx.beginPath();
	ctx.arc(-half + 15, 0, 6, 0, Math.PI * 2);
	outline(ctx, '#e5484d', 2);
	// A little anchor mark at the bow
	ctx.strokeStyle = INK;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(half - 20, -4);
	ctx.lineTo(half - 20, 4);
	ctx.moveTo(half - 24, 0);
	ctx.lineTo(half - 16, 0);
	ctx.stroke();
	ctx.restore();
}

function drawHandles(
	ctx: CanvasRenderingContext2D,
	state: SuezState,
	timeMs: number,
	still: boolean
) {
	for (const end of ENDS) drawHandle(ctx, state, end, timeMs, still);
}

function drawHandle(
	ctx: CanvasRenderingContext2D,
	state: SuezState,
	end: End,
	timeMs: number,
	still: boolean
) {
	const at = endPoint(state.body, end);
	const hold = state.holds.find((candidate) => candidate.end === end);
	if (hold) {
		// The tow line from the end to the finger
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 4]);
		ctx.beginPath();
		ctx.moveTo(at.x, at.y);
		ctx.lineTo(hold.pointer.x, hold.pointer.y);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(hold.pointer.x, hold.pointer.y, 10, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(245,200,58,0.35)';
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	const pulse = hold || still ? 0 : Math.sin(timeMs / 350) * 1.2;
	ctx.beginPath();
	ctx.arc(at.x, at.y, (hold ? 9 : 7) + pulse, 0, Math.PI * 2);
	outline(ctx, hold ? '#f5c83a' : PAPER, 2.5);
	// A small arrow cross, so it reads as something to drag
	ctx.strokeStyle = INK;
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(at.x - 3.5, at.y);
	ctx.lineTo(at.x + 3.5, at.y);
	ctx.moveTo(at.x, at.y - 3.5);
	ctx.lineTo(at.x, at.y + 3.5);
	ctx.stroke();
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[]) {
	for (const effect of effects) {
		const progress = Math.min(1, effect.ageMs / effect.durationMs);
		ctx.save();
		ctx.globalAlpha = Math.max(0, 1 - progress * progress);
		if (effect.kind === 'dust') {
			ctx.fillStyle = '#c9a868';
			ctx.beginPath();
			ctx.arc(effect.x, effect.y - progress * 10, effect.size * (0.6 + progress), 0, Math.PI * 2);
			ctx.fill();
		} else if (effect.kind === 'ring') {
			ctx.strokeStyle = '#e5484d';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, 10 + progress * 40, 0, Math.PI * 2);
			ctx.stroke();
		} else {
			const rise = progress * 30;
			ctx.font = `700 ${effect.big ? 26 : 16}px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			ctx.lineWidth = 5;
			ctx.strokeStyle = INK;
			ctx.strokeText(effect.text, effect.x, effect.y - rise);
			ctx.fillStyle = effect.big ? '#f5c83a' : PAPER;
			ctx.fillText(effect.text, effect.x, effect.y - rise);
		}
		ctx.restore();
	}
}

/** Draws the whole field in world units: the caller sets the transform that maps them to pixels */
export function drawScene(ctx: CanvasRenderingContext2D, state: SuezState, extras: SceneExtras) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	ctx.clip();
	ctx.fillStyle = SAND;
	ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	drawGround(ctx, state.canal, extras.timeMs, extras.reducedMotion);
	drawQueue(ctx, state);
	drawExcavator(ctx, state);
	drawShip(ctx, state.body);
	if (state.phase === 'stuck') drawHandles(ctx, state, extras.timeMs, extras.reducedMotion);
	drawEffects(ctx, extras.effects);
	ctx.restore();
}

/** The final field on the shared score card: a square crop around the ship */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: SuezState,
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
	drawScene(ctx, state, NO_EXTRAS);
	ctx.restore();
}

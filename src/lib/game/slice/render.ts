/*
 * Canvas drawing for Radar Slice, all in world units (see config.ts) and scaled by the caller:
 * a pale radar sky with a sweeping beam, the flyers, the two halves of sliced ones, the swipe
 * trail and short effects (score popups, puffs, splashes). Bloodless: pieces just tumble apart.
 */
import { HALF_LIFE_MS, TRAIL_FADE_MS, WORLD_HEIGHT, WORLD_WIDTH, specOf } from './config';
import { INK, PAPER, SAND, YELLOW, drawSilhouette, type Pose } from './art';
import type { Half, SliceState } from './state';

const DISPLAY_FONT = "'Baloo 2', system-ui, sans-serif";
const SKY_TOP = '#9fd3ee';
const SKY_BOTTOM = '#e8f4fa';
const RADAR_LINE = 'rgba(46, 120, 160, 0.35)';
const SEA = '#4a93bd';
const SEA_DARK = '#2f6f99';
/** Height of the sea strip the flyers launch from and fall back into */
const SEA_HEIGHT = 30;

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
	| { kind: 'puff'; x: number; y: number; size: number; ageMs: number; durationMs: number }
	| { kind: 'splash'; x: number; y: number; ageMs: number; durationMs: number };

export interface SceneExtras {
	effects: readonly Effect[];
	/** Skip the radar sweep and flicker */
	reducedMotion: boolean;
}

const NO_EXTRAS: SceneExtras = { effects: [], reducedMotion: true };

function drawBackground(ctx: CanvasRenderingContext2D, timeMs: number, calm: boolean) {
	const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
	sky.addColorStop(0, SKY_TOP);
	sky.addColorStop(1, SKY_BOTTOM);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

	// Radar rings and cross hairs around the launch point at the bottom center
	const cx = WORLD_WIDTH / 2;
	const cy = WORLD_HEIGHT;
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = RADAR_LINE;
	for (const radius of [110, 220, 330, 440, 550]) {
		ctx.beginPath();
		ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(cx, cy);
	ctx.lineTo(cx, 0);
	for (const angle of [Math.PI * 1.25, Math.PI * 1.75]) {
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(angle) * 700, cy + Math.sin(angle) * 700);
	}
	ctx.stroke();

	// The sweep: a fading wedge that crosses the sky from left to right
	const sweep = calm ? 0.5 : (timeMs / 2600) % 1;
	const angle = Math.PI + sweep * Math.PI;
	for (let i = 0; i < 6; i++) {
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.arc(cx, cy, 700, angle - 0.1 * (i + 1), angle - 0.1 * i);
		ctx.closePath();
		ctx.fillStyle = `rgba(255, 255, 255, ${0.2 - i * 0.03})`;
		ctx.fill();
	}
	ctx.beginPath();
	ctx.moveTo(cx, cy);
	ctx.lineTo(cx + Math.cos(angle) * 700, cy + Math.sin(angle) * 700);
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
	ctx.stroke();

	// A few flat clouds
	ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
	for (const [x, y, w] of [
		[60, 90, 54],
		[290, 150, 44],
		[200, 40, 36]
	]) {
		ctx.beginPath();
		ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2);
		ctx.ellipse(x + w * 0.4, y - w * 0.14, w * 0.5, w * 0.28, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawSea(ctx: CanvasRenderingContext2D, timeMs: number, calm: boolean) {
	const top = WORLD_HEIGHT - SEA_HEIGHT;
	ctx.fillStyle = SEA;
	ctx.fillRect(0, top, WORLD_WIDTH, SEA_HEIGHT);
	ctx.beginPath();
	const drift = calm ? 0 : (timeMs / 40) % 30;
	ctx.moveTo(0, top);
	for (let x = -30 + drift; x <= WORLD_WIDTH + 30; x += 30) {
		ctx.quadraticCurveTo(x + 7.5, top - 7, x + 15, top);
		ctx.quadraticCurveTo(x + 22.5, top + 7, x + 30, top);
	}
	ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
	ctx.lineTo(0, WORLD_HEIGHT);
	ctx.closePath();
	ctx.fillStyle = SEA_DARK;
	ctx.fill();
}

function poseAt(timeMs: number, calm: boolean, phase = 0): Pose {
	return { seconds: timeMs / 1000 + phase, calm };
}

function drawHalf(ctx: CanvasRenderingContext2D, half: Half, pose: Pose) {
	const { radius } = specOf(half.kind);
	const fade = Math.min(1, (HALF_LIFE_MS - half.ageMs) / (HALF_LIFE_MS * 0.35));
	ctx.save();
	ctx.globalAlpha = Math.max(0, fade);
	ctx.translate(half.x, half.y);
	ctx.rotate(half.angle);
	// Keep only this side of the cut line
	ctx.rotate(half.cut);
	ctx.beginPath();
	ctx.rect(-200, half.side === 1 ? 0 : -200, 400, 200);
	ctx.clip();
	ctx.rotate(-half.cut);
	ctx.scale(half.facing, 1);
	drawSilhouette(ctx, half.kind, radius, pose);
	ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, state: SliceState) {
	const { points } = state.trail;
	if (points.length === 0) return;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	if (points.length === 1) {
		const point = points[0];
		const alpha = Math.max(0, 1 - (state.timeMs - point.t) / TRAIL_FADE_MS);
		ctx.globalAlpha = alpha;
		ctx.beginPath();
		ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
		ctx.fillStyle = PAPER;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.globalAlpha = 1;
		return;
	}
	for (let layer = 0; layer < 2; layer++) {
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			const alpha = Math.max(0, 1 - (state.timeMs - b.t) / TRAIL_FADE_MS);
			const taper = (i / points.length) * 0.75 + 0.25;
			ctx.globalAlpha = alpha;
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.lineWidth = layer === 0 ? 10 * taper + 4 : 10 * taper;
			ctx.strokeStyle = layer === 0 ? INK : PAPER;
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: Effect) {
	const p = Math.min(1, effect.ageMs / effect.durationMs);
	switch (effect.kind) {
		case 'popup': {
			ctx.globalAlpha = 1 - p * p;
			ctx.font = `700 ${effect.big ? 24 : 17}px ${DISPLAY_FONT}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 5;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = INK;
			ctx.fillStyle = effect.big ? YELLOW : PAPER;
			const y = effect.y - 14 - p * 28;
			ctx.strokeText(effect.text, effect.x, y);
			ctx.fillText(effect.text, effect.x, y);
			ctx.globalAlpha = 1;
			break;
		}
		case 'puff': {
			const size = effect.size * (0.5 + p * 0.9);
			ctx.globalAlpha = 1 - p;
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
			ctx.fillStyle = PAPER;
			ctx.fill();
			ctx.lineWidth = 3;
			ctx.strokeStyle = INK;
			ctx.stroke();
			ctx.globalAlpha = 1;
			break;
		}
		case 'splash': {
			ctx.globalAlpha = 1 - p;
			ctx.lineWidth = 3;
			ctx.strokeStyle = PAPER;
			ctx.lineCap = 'round';
			for (const side of [-1, 0, 1]) {
				ctx.beginPath();
				ctx.moveTo(effect.x + side * 8, effect.y);
				ctx.quadraticCurveTo(
					effect.x + side * (14 + p * 10),
					effect.y - 26 * (1 - Math.abs(side) * 0.3) * Math.sin(p * Math.PI),
					effect.x + side * (22 + p * 14),
					effect.y
				);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			break;
		}
	}
}

export function drawScene(ctx: CanvasRenderingContext2D, state: SliceState, extras: SceneExtras) {
	const calm = extras.reducedMotion;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
	ctx.clip();
	drawBackground(ctx, state.timeMs, calm);

	for (const flyer of state.flyers) {
		const { radius } = specOf(flyer.kind);
		ctx.save();
		ctx.translate(flyer.x, flyer.y);
		ctx.rotate(flyer.angle);
		if (flyer.vx < 0 && !specOf(flyer.kind).pointsForward) ctx.scale(-1, 1);
		drawSilhouette(ctx, flyer.kind, radius, poseAt(state.timeMs, calm, flyer.phase));
		ctx.restore();
	}
	for (const half of state.halves) drawHalf(ctx, half, poseAt(state.timeMs, true));

	drawSea(ctx, state.timeMs, calm);
	for (const effect of extras.effects) drawEffect(ctx, effect);
	drawTrail(ctx, state);
	ctx.restore();
}

/** Draws the final field onto the shared score card */
export function drawScenePreview(
	ctx: CanvasRenderingContext2D,
	state: SliceState,
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

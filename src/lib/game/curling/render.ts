/*
 * Canvas rendering for Iceberg Curling.
 * Ice sheet with house ("For Sale" sign), sliding stone,
 * seals, a lost penguin, and sweep control.
 * Coordinates are world units (0 to 1) scaled by the canvas.
 */
import type { Random } from '#lib/game/random.js';
import { createRandom, seedFromString } from '#lib/game/random.js';
import type { CurlState, CurlState as CurlStateType } from './state';

const HOUSE_CENTER_X = 0.5;
const HOUSE_RADIUS = 0.18;
const HOUSE_COLOR = 'rgba(255,255,255,0.8)';
const HOUSE_OUTLINE = 'rgba(0,0,0,0.4)';
const STONE_COLOR = 'rgba(0,0,0,0.8)';
const SEAL_COLOR = 'rgba(255,255,255,0.9)';
const PENGUIN_COLOR = 'rgba(255,255,255,0.9)';
const TEXT_COLOR = 'rgba(0,0,0,0.7)';

export function drawIceSheet(context: CanvasRenderingContext2D, width: number, height: number) {
	context.fillStyle = '#7fb3d5';
	context.fillRect(0, 0, width, height);
}

export function drawHouse(context: CanvasRenderingContext2D, width: number, height: number) {
	const cx = HOUSE_CENTER_X * width;
	const cy = 0.25 * height;
	const r = HOUSE_RADIUS * Math.min(width, height);

	context.save();
	context.translate(cx, cy);
	context.beginPath();
	context.arc(0, 0, r, 0, Math.PI * 2);
	context.fillStyle = HOUSE_COLOR;
	context.fill();
	context.strokeStyle = HOUSE_OUTLINE;
	context.lineWidth = 2;
	context.stroke();
	context.restore();
}

export function drawStone(context: CanvasRenderingContext2D, state: CurlStateType, width: number, height: number) {
	const x = state.stone.x * width;
	const y = state.stone.y * height;
	const radius = 12;

	context.save();
	context.translate(x, y);
	context.beginPath();
	context.arc(0, 0, radius, 0, Math.PI * 2);
	context.fillStyle = STONE_COLOR;
	context.fill();
	context.strokeStyle = '#111';
	context.lineWidth = 2;
	context.stroke();
	// Draw curling curl effect (slight oval distortion when moving)
	if (Math.abs(state.stone.vx) > 0.001 || Math.abs(state.stone.vy) > 0.001) {
		context.globalAlpha = 0.4;
		context.beginPath();
		context.arc(0, 0, radius + 6, 0, Math.PI * 2);
		context.strokeStyle = 'rgba(255,255,255,0.3)';
		context.lineWidth = 3;
		context.stroke();
		context.globalAlpha = 1;
	}
	context.restore();
}

export function drawSeal(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
	const px = x * width;
	const py = y * height;
	const size = 16;

	context.save();
	context.translate(px, py);
	context.beginPath();
	context.arc(0, 0, size, 0, Math.PI * 2);
	context.fillStyle = SEAL_COLOR;
	context.fill();
	context.strokeStyle = '#111';
	context.lineWidth = 1;
	context.stroke();
	context.restore();
}

export function drawPenguin(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, lost: boolean) {
	const px = x * width;
	const py = y * height;
	const size = 20;

	context.save();
	context.translate(px, py);
	context.fillStyle = lost ? '#ff6b6b' : PENGUIN_COLOR;
	context.beginPath();
	context.arc(0, 0, size, 0, Math.PI * 2);
	context.fill();
	// Eyes
	context.fillStyle = '#222';
	context.beginPath();
	context.arc(-5, -3, 3, 0, Math.PI * 2);
	context.arc(5, -3, 3, 0, Math.PI * 2);
	context.fill();
	// Beak
	context.fillStyle = '#ff6b6b';
	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(0, 5);
	context.stroke();
	context.restore();
}

export function drawScoreCounter(context: CanvasRenderingContext2D, state: CurlStateType, width: number, height: number) {
	context.fillStyle = TEXT_COLOR;
	context.font = 'bold 24px system-ui, sans-serif';
	context.textAlign = 'center';
	context.fillText(`End ${state.ends + 1}/8`, width / 2, height / 2 - 20);
	context.fillText(`${Math.round(state.score)} pts`, width / 2, height / 2 + 20);
}
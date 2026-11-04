/*
 * Canvas drawing for the Falklands sea: ships, the things floating in the zones and the islands.
 * Everything here only paints; positions and motion come from the component's animation loop.
 */
import type { ZoneKind } from './zones.js';

const INK = '#111111';

function outline(ctx: CanvasRenderingContext2D, fill: string, width = 1.6) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = INK;
	ctx.lineWidth = width;
	ctx.stroke();
}

/** A warship heading right; (x, y) is the waterline centre and `scale` 1 is about 30px long */
export function drawShip(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	angle: number,
	scale: number,
	color: string,
	flash: number
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.scale(scale, scale);
	// Hull
	ctx.beginPath();
	ctx.moveTo(-16, -4);
	ctx.lineTo(17, -4);
	ctx.lineTo(12, 5);
	ctx.lineTo(-13, 5);
	ctx.closePath();
	outline(ctx, color);
	// Superstructure, funnel and gun
	ctx.beginPath();
	ctx.rect(-6, -11, 11, 7);
	outline(ctx, '#e8e1bc');
	ctx.beginPath();
	ctx.rect(-2, -16, 4, 5);
	outline(ctx, '#d6d2c0');
	ctx.beginPath();
	ctx.rect(8, -7, 6, 3);
	outline(ctx, '#555555');
	ctx.beginPath();
	ctx.moveTo(-10, -4);
	ctx.lineTo(-10, -13);
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (flash > 0) {
		ctx.globalAlpha = Math.min(1, flash);
		ctx.fillStyle = '#ff5a4d';
		ctx.fillRect(-17, -17, 36, 24);
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

/** The little icon of what lies in a zone, centred on (x, y) at the water; `t` drives the bobbing */
export function drawZoneItem(
	ctx: CanvasRenderingContext2D,
	kind: ZoneKind,
	x: number,
	y: number,
	scale: number,
	t: number
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	if (kind === 'mine') {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(0, 4);
		ctx.lineTo(0, 12);
		ctx.stroke();
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2;
			ctx.beginPath();
			ctx.moveTo(Math.cos(a) * 5, -3 + Math.sin(a) * 5);
			ctx.lineTo(Math.cos(a) * 8, -3 + Math.sin(a) * 8);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.arc(0, -3, 5, 0, Math.PI * 2);
		outline(ctx, '#3b3f44');
		ctx.fillStyle = Math.sin(t * 5) > 0.3 ? '#ff5a4d' : '#7a2a24';
		ctx.fillRect(-1, -9, 2, 2);
	} else if (kind === 'sub') {
		ctx.globalAlpha = 0.45;
		ctx.fillStyle = '#1d3a4a';
		ctx.beginPath();
		ctx.ellipse(0, 6, 14, 4, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, 2);
		ctx.lineTo(0, -9);
		ctx.lineTo(4, -9);
		ctx.stroke();
		ctx.fillStyle = '#d9534f';
		ctx.fillRect(2, -11, 4, 3);
	} else if (kind === 'raid') {
		const fly = Math.sin(t * 2.4) * 3;
		ctx.translate(0, -36 + fly);
		ctx.beginPath();
		ctx.moveTo(-10, 2);
		ctx.lineTo(0, -6);
		ctx.lineTo(10, 2);
		ctx.lineTo(3, 2);
		ctx.lineTo(0, 8);
		ctx.lineTo(-3, 2);
		ctx.closePath();
		outline(ctx, '#a34a3a');
		ctx.setLineDash([2, 3]);
		ctx.strokeStyle = 'rgba(17,17,17,0.45)';
		ctx.beginPath();
		ctx.moveTo(0, 10);
		ctx.lineTo(0, 34);
		ctx.stroke();
		ctx.setLineDash([]);
	} else if (kind === 'tanker') {
		ctx.beginPath();
		ctx.moveTo(-10, -3);
		ctx.lineTo(10, -3);
		ctx.lineTo(7, 4);
		ctx.lineTo(-8, 4);
		ctx.closePath();
		outline(ctx, '#2f5d8a');
		ctx.beginPath();
		ctx.rect(-6, -8, 7, 5);
		outline(ctx, '#f0c040');
		ctx.beginPath();
		ctx.arc(5, -5, 2.6, 0, Math.PI * 2);
		outline(ctx, '#e5484d');
	} else if (kind === 'repair') {
		ctx.beginPath();
		ctx.rect(-6, -8, 12, 11);
		outline(ctx, '#c79a56');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(-1, -7, 2, 9);
		ctx.fillRect(-5, -3, 10, 2);
	} else if (kind === 'chaff') {
		ctx.beginPath();
		ctx.rect(-3.5, -9, 7, 12);
		outline(ctx, '#c9d3d8');
		ctx.fillStyle = '#7f8c93';
		ctx.fillRect(-3.5, -9, 7, 3);
		ctx.fillStyle = '#ffffff';
		const sparkle = (Math.sin(t * 6) + 1) / 2;
		ctx.globalAlpha = 0.4 + 0.6 * sparkle;
		ctx.fillRect(5, -10, 2, 2);
		ctx.fillRect(-7, -4, 2, 2);
		ctx.globalAlpha = 1;
	} else {
		const pulse = (t * 1.2) % 1;
		ctx.globalAlpha = 1 - pulse;
		ctx.strokeStyle = '#2f5d8a';
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.ellipse(0, 3, 4 + pulse * 12, 1.5 + pulse * 4, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.beginPath();
		ctx.arc(0, 0, 4.5, Math.PI, 0);
		ctx.closePath();
		outline(ctx, '#e8e1bc');
		ctx.strokeStyle = INK;
		ctx.beginPath();
		ctx.moveTo(0, -4);
		ctx.lineTo(0, -11);
		ctx.stroke();
		ctx.fillStyle = '#e5484d';
		ctx.fillRect(0, -12, 4, 3);
	}
	ctx.restore();
}

/** A question mark for a zone the fog hides */
export function drawUnknown(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
	ctx.save();
	ctx.font = `800 ${Math.round(14 * scale)}px system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.lineWidth = 3;
	ctx.strokeStyle = 'rgba(17,17,17,0.7)';
	ctx.strokeText('?', x, y - 2);
	ctx.fillStyle = '#f4f1de';
	ctx.fillText('?', x, y - 2);
	ctx.restore();
}

/** The islands: two green humps with a flag, standing on the horizon at the end of the chart */
export function drawIslands(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	scale: number,
	flagColor: string | null
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	ctx.beginPath();
	ctx.moveTo(-34, 4);
	ctx.quadraticCurveTo(-24, -26, -6, -8);
	ctx.quadraticCurveTo(4, -34, 22, -6);
	ctx.quadraticCurveTo(30, -2, 34, 4);
	ctx.closePath();
	outline(ctx, '#7f9a5e', 2);
	ctx.strokeStyle = '#5b7340';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(-18, -4);
	ctx.quadraticCurveTo(-12, -14, -6, -6);
	ctx.moveTo(8, -6);
	ctx.quadraticCurveTo(14, -18, 20, -4);
	ctx.stroke();
	if (flagColor) {
		ctx.strokeStyle = INK;
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(4, -18);
		ctx.lineTo(4, -34);
		ctx.stroke();
		ctx.fillStyle = flagColor;
		ctx.fillRect(4, -34, 12, 8);
		ctx.strokeRect(4, -34, 12, 8);
	}
	ctx.restore();
}

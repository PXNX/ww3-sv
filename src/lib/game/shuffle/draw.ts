/*
 * Canvas drawing for Shadow Fleet Shuffle: the night sea, the ships, their cargo covers and the
 * effects (wakes, confetti, number pops, stamps). Everything is drawn around the origin so the
 * caller can translate, rotate and scale it into place. Colours are fixed (the board is a night
 * scene in every theme).
 */
import { FLAGS, NAMES, type ShipKind } from './fleet.js';

export const BOARD_W = 720;
export const BOARD_H = 380;
export const WATER_Y = 250;
const INK = '#0b1220';

export function slotX(slot: number, ships: number): number {
	const margin = 60;
	return margin + ((BOARD_W - margin * 2) * (slot + 0.5)) / ships;
}

/** Ships shrink a little as the fleet grows so six still fit the row */
export function shipScale(ships: number): number {
	return Math.min(1, (BOARD_W - 120) / ships / 118);
}

export function drawSea(ctx: CanvasRenderingContext2D, time: number, calm: boolean) {
	const sky = ctx.createLinearGradient(0, 0, 0, BOARD_H);
	sky.addColorStop(0, '#0b1226');
	sky.addColorStop(0.45, '#1b2a55');
	sky.addColorStop(0.46, '#12305a');
	sky.addColorStop(1, '#081a33');
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, BOARD_W, BOARD_H);

	// A few stars and a moon
	ctx.fillStyle = 'rgba(255,255,255,0.7)';
	for (let i = 0; i < 26; i++) {
		const x = (i * 97) % BOARD_W;
		const y = 14 + ((i * 53) % 110);
		const twinkle = calm ? 1 : 0.6 + 0.4 * Math.sin(time / 700 + i);
		ctx.globalAlpha = 0.35 * twinkle + 0.2;
		ctx.fillRect(x, y, i % 4 === 0 ? 2.5 : 1.5, i % 4 === 0 ? 2.5 : 1.5);
	}
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#f3ecc8';
	ctx.beginPath();
	ctx.arc(BOARD_W - 96, 62, 20, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#1b2a55';
	ctx.beginPath();
	ctx.arc(BOARD_W - 88, 57, 18, 0, Math.PI * 2);
	ctx.fill();

	// Wave lines drifting sideways, and the moon's glitter on the water
	ctx.lineWidth = 2;
	for (let row = 0; row < 8; row++) {
		const y = 176 + row * 26;
		ctx.strokeStyle = `rgba(147,197,253,${0.07 + row * 0.018})`;
		ctx.beginPath();
		for (let x = -10; x <= BOARD_W + 10; x += 12) {
			const wave = calm ? 0 : Math.sin(x / 38 + time / 900 + row * 1.7) * (1.5 + row * 0.35);
			if (x === -10) ctx.moveTo(x, y + wave);
			else ctx.lineTo(x, y + wave);
		}
		ctx.stroke();
	}
}

type Ctx = CanvasRenderingContext2D;

function poly(ctx: Ctx, points: [number, number][]) {
	ctx.beginPath();
	points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
	ctx.closePath();
}

function outlined(ctx: Ctx, fill: string, width = 2.5) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = width;
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.stroke();
}

/** A ship sitting on the waterline at the origin, bow to the right, about 110 wide */
export function drawShip(ctx: Ctx, kind: ShipKind) {
	if (kind === 'tanker') {
		poly(ctx, [
			[-56, -16],
			[58, -16],
			[44, 10],
			[-48, 10]
		]);
		outlined(ctx, '#991b1b');
		ctx.fillStyle = '#fca5a5';
		ctx.fillRect(-52, -2, 98, 4);
		for (let i = 0; i < 3; i++) {
			ctx.beginPath();
			ctx.ellipse(-8 + i * 24, -20, 9, 6, 0, Math.PI, 0);
			outlined(ctx, '#cbd5e1', 2);
		}
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-26, -16);
		ctx.lineTo(60, -16);
		ctx.stroke();
		ctx.beginPath();
		ctx.rect(-52, -40, 24, 24);
		outlined(ctx, '#e2e8f0');
		ctx.beginPath();
		ctx.rect(-48, -34, 16, 6);
		outlined(ctx, '#0ea5e9', 1.5);
		ctx.beginPath();
		ctx.rect(-44, -52, 8, 12);
		outlined(ctx, '#1e293b', 2);
		ctx.fillStyle = '#ef4444';
		ctx.fillRect(-43, -50, 6, 4);
	} else if (kind === 'container') {
		poly(ctx, [
			[-56, -14],
			[56, -14],
			[44, 10],
			[-48, 10]
		]);
		outlined(ctx, '#1f2937');
		const colors = ['#f97316', '#38bdf8', '#facc15', '#4ade80', '#f472b6', '#a78bfa'];
		for (let row = 0; row < 2; row++) {
			for (let col = 0; col < 4; col++) {
				ctx.beginPath();
				ctx.rect(-26 + col * 20, -14 - (row + 1) * 14, 19, 14);
				outlined(ctx, colors[(row * 3 + col * 2) % colors.length], 1.8);
			}
		}
		ctx.beginPath();
		ctx.rect(-54, -38, 22, 24);
		outlined(ctx, '#e2e8f0');
		ctx.fillStyle = '#0ea5e9';
		ctx.fillRect(-50, -32, 14, 5);
	} else if (kind === 'sailboat') {
		poly(ctx, [
			[-34, -8],
			[40, -8],
			[26, 10],
			[-26, 10]
		]);
		outlined(ctx, '#f8fafc');
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(2, -8);
		ctx.lineTo(2, -62);
		ctx.stroke();
		poly(ctx, [
			[5, -60],
			[5, -14],
			[34, -14]
		]);
		outlined(ctx, '#fde68a', 2);
		poly(ctx, [
			[-1, -54],
			[-1, -14],
			[-24, -14]
		]);
		outlined(ctx, '#f8fafc', 2);
	} else {
		poly(ctx, [
			[-44, -10],
			[48, -10],
			[36, 10],
			[-38, 10]
		]);
		outlined(ctx, '#0f766e');
		ctx.beginPath();
		ctx.rect(-20, -34, 26, 24);
		outlined(ctx, '#f1f5f9');
		ctx.fillStyle = '#0ea5e9';
		ctx.fillRect(-15, -28, 16, 8);
		ctx.strokeStyle = INK;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(22, -10);
		ctx.lineTo(34, -44);
		ctx.lineTo(48, -16);
		ctx.stroke();
	}
}

/** Down arrow and ring marking the sanctioned tanker while the covers are off */
export function drawTankerMark(ctx: Ctx, time: number, calm: boolean) {
	const bob = calm ? 0 : Math.sin(time / 180) * 5;
	ctx.save();
	ctx.translate(0, -78 + bob);
	poly(ctx, [
		[-13, -14],
		[13, -14],
		[0, 8]
	]);
	outlined(ctx, '#ef4444', 3);
	ctx.restore();
	ctx.strokeStyle = '#ef4444';
	ctx.lineWidth = 3;
	ctx.setLineDash([7, 6]);
	ctx.beginPath();
	ctx.ellipse(0, -14, 70, 46, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
}

export interface CoverLook {
	flag: number;
	name: number;
	dark: boolean;
	/** 0..1 flash of white, for a freshly repainted cover */
	flash: number;
	glow: number;
}

/** The cargo cover over a ship: a tarp dome with a painted flag, a name plate and an AIS beacon */
export function drawCover(ctx: Ctx, look: CoverLook, time: number, nameplate: string | null) {
	const body = ctx.createLinearGradient(0, -76, 0, 10);
	body.addColorStop(0, look.dark ? '#475569' : '#94a3b8');
	body.addColorStop(1, look.dark ? '#1e293b' : '#475569');
	ctx.beginPath();
	ctx.moveTo(-58, 10);
	ctx.lineTo(-58, -30);
	ctx.quadraticCurveTo(-58, -78, 0, -78);
	ctx.quadraticCurveTo(58, -78, 58, -30);
	ctx.lineTo(58, 10);
	ctx.closePath();
	ctx.fillStyle = body;
	ctx.fill();
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.stroke();

	// Tarp ribs
	ctx.strokeStyle = 'rgba(11,18,32,0.35)';
	ctx.lineWidth = 2;
	for (const x of [-30, 0, 30]) {
		ctx.beginPath();
		ctx.moveTo(x, -76 + Math.abs(x) * 0.25);
		ctx.lineTo(x, 8);
		ctx.stroke();
	}

	// The flag of convenience
	const stripes = FLAGS[look.flag % FLAGS.length];
	ctx.save();
	ctx.globalAlpha = look.dark ? 0.35 : 1;
	stripes.forEach((color, i) => {
		ctx.fillStyle = look.dark ? '#64748b' : color;
		ctx.fillRect(-26, -52 + i * 9, 52, 9);
	});
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.strokeRect(-26, -52, 52, 27);
	ctx.restore();

	// AIS beacon
	const blink = look.dark ? 0 : 0.5 + 0.5 * Math.sin(time / 260);
	ctx.beginPath();
	ctx.arc(0, -66, 4.5, 0, Math.PI * 2);
	ctx.fillStyle = look.dark ? '#334155' : `rgba(74,222,128,${0.45 + blink * 0.55})`;
	ctx.fill();
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = INK;
	ctx.stroke();

	if (look.glow > 0) {
		ctx.strokeStyle = `rgba(34,211,238,${look.glow})`;
		ctx.lineWidth = 5;
		ctx.stroke();
	}
	if (look.flash > 0) {
		ctx.globalAlpha = look.flash * 0.75;
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.globalAlpha = 1;
	}

	// Name plate on the cover's foot
	ctx.fillStyle = 'rgba(11,18,32,0.78)';
	ctx.fillRect(-46, -20, 92, 17);
	ctx.fillStyle = look.dark ? '#64748b' : '#f1f5f9';
	ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(nameplate ?? NAMES[look.name % NAMES.length], 0, -11);
}

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	color: string;
	rot: number;
	vr: number;
	text?: string;
	/** 'confetti' falls with gravity, 'pop' rises, 'ring' expands, 'wake' fades in place */
	kind: 'confetti' | 'pop' | 'ring' | 'wake';
}

export function stepParticles(list: Particle[], dt: number) {
	for (let i = list.length - 1; i >= 0; i--) {
		const p = list[i];
		p.life -= dt;
		if (p.life <= 0) {
			list.splice(i, 1);
			continue;
		}
		if (p.kind === 'confetti') p.vy += 900 * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.rot += p.vr * dt;
	}
}

export function drawParticles(ctx: Ctx, list: Particle[]) {
	for (const p of list) {
		const t = 1 - p.life / p.max;
		ctx.save();
		ctx.translate(p.x, p.y);
		if (p.kind === 'confetti') {
			ctx.rotate(p.rot);
			ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.4));
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
		} else if (p.kind === 'ring') {
			ctx.globalAlpha = (1 - t) * 0.8;
			ctx.strokeStyle = p.color;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.ellipse(0, 0, p.size * (0.2 + t), p.size * (0.2 + t) * 0.5, 0, 0, Math.PI * 2);
			ctx.stroke();
		} else if (p.kind === 'wake') {
			ctx.globalAlpha = (1 - t) * 0.5;
			ctx.strokeStyle = '#bfdbfe';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(0, 0, p.size * (0.5 + t), p.size * (0.5 + t) * 0.35, 0, 0, Math.PI * 2);
			ctx.stroke();
		} else if (p.text) {
			// Number pop: springs up fast, then drifts and fades
			const pop = t < 0.18 ? 0.6 + (t / 0.18) * 0.7 : 1.3 - Math.min(0.3, (t - 0.18) * 0.5);
			ctx.scale(pop, pop);
			ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.35));
			ctx.font = `800 ${p.size}px ui-sans-serif, system-ui, sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 5;
			ctx.strokeStyle = INK;
			ctx.lineJoin = 'round';
			ctx.strokeText(p.text, 0, 0);
			ctx.fillStyle = p.color;
			ctx.fillText(p.text, 0, 0);
		}
		ctx.restore();
	}
}

/** A rubber stamp slamming down: scales in from large, tilts, then fades out */
export function drawStamp(
	ctx: Ctx,
	text: string,
	color: string,
	age: number,
	total: number,
	calm: boolean
) {
	const slam = calm ? 1 : Math.max(1, 2.1 - age / 90);
	const alpha = Math.min(1, age / 60) * Math.min(1, (total - age) / 350);
	if (alpha <= 0) return;
	ctx.save();
	ctx.rotate(-0.14);
	ctx.scale(slam, slam);
	ctx.globalAlpha = alpha;
	ctx.font = '900 38px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const width = ctx.measureText(text).width + 36;
	ctx.lineWidth = 6;
	ctx.strokeStyle = color;
	ctx.strokeRect(-width / 2, -30, width, 60);
	ctx.lineWidth = 2;
	ctx.strokeRect(-width / 2 + 6, -24, width - 12, 48);
	ctx.fillStyle = color;
	ctx.fillText(text, 0, 2);
	ctx.restore();
}

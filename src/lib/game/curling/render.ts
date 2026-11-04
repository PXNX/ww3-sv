/*
 * Canvas drawing for Iceberg Curling, all in world units (640 by 420) scaled by the caller: the
 * sea and the slab of ice, the house with the "For Sale" sign, wind and drift hints, seals and the
 * lost penguin, stones with trails and squash, the sweepers, particles and floating text.
 */
import {
	DRIFT_Y0,
	DRIFT_Y1,
	HACK,
	HOG_Y,
	HOUSE,
	PENGUIN_R,
	RINGS,
	SEAL_R,
	SHEET_BACK,
	SHEET_BOTTOM,
	SHEET_CX,
	SHEET_L,
	SHEET_R,
	STONE_R,
	WORLD_H,
	WORLD_W
} from './config';
import { sealWobble, type Fx } from './fx';
import { speedOf } from './physics';
import type { CurlState, Stone } from './state';

export interface SceneLabels {
	forSale: string;
	sold: string;
}

export interface SceneOptions {
	labels: SceneLabels;
	/** Hint dots of the unswept path, or null while there is no hint */
	hint: { x: number; y: number }[] | null;
	/** A hint is shown during aiming; the aim arrow shows the throw while the player drags */
	dragging: boolean;
}

const TAU = Math.PI * 2;
const SIGN_Y = HOUSE.y;

function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawSea(ctx: CanvasRenderingContext2D, fx: Fx) {
	const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_H);
	gradient.addColorStop(0, '#1d5f8a');
	gradient.addColorStop(1, '#143f63');
	ctx.fillStyle = gradient;
	ctx.fillRect(-40, -40, WORLD_W + 80, WORLD_H + 80);
	ctx.strokeStyle = 'rgba(190, 230, 255, 0.16)';
	ctx.lineWidth = 1.5;
	const drift = fx.reduced ? 0 : fx.time;
	for (let row = 0; row < 14; row++) {
		const y = 18 + row * 30;
		for (const side of [0, 1]) {
			const x0 = side === 0 ? 0 : SHEET_R + 14;
			const x1 = side === 0 ? SHEET_L - 14 : WORLD_W;
			ctx.beginPath();
			for (let x = x0; x <= x1; x += 8) {
				const wave = Math.sin(x * 0.05 + row * 1.7 + drift * 1.4) * 2.5;
				if (x === x0) ctx.moveTo(x, y + wave);
				else ctx.lineTo(x, y + wave);
			}
			ctx.stroke();
		}
	}
}

function drawSlab(ctx: CanvasRenderingContext2D) {
	const top = 4;
	const height = SHEET_BOTTOM - top;
	const width = SHEET_R - SHEET_L;
	// The side of the iceberg
	roundedRect(ctx, SHEET_L - 8, top + 8, width + 16, height, 20);
	ctx.fillStyle = '#6aa6c7';
	ctx.fill();
	roundedRect(ctx, SHEET_L - 8, top + 4, width + 16, height, 20);
	ctx.fillStyle = '#4f8db3';
	ctx.fill();
	// The playing surface
	roundedRect(ctx, SHEET_L, top, width, height, 16);
	const surface = ctx.createLinearGradient(SHEET_L, 0, SHEET_R, 0);
	surface.addColorStop(0, '#d8eefb');
	surface.addColorStop(0.5, '#eaf7ff');
	surface.addColorStop(1, '#cfe8f7');
	ctx.fillStyle = surface;
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'rgba(70, 120, 160, 0.5)';
	ctx.stroke();
	// Hairline cracks and scratches in the ice
	ctx.save();
	roundedRect(ctx, SHEET_L, top, width, height, 16);
	ctx.clip();
	ctx.strokeStyle = 'rgba(120, 170, 205, 0.35)';
	ctx.lineWidth = 1;
	const cracks = [
		[170, 60, 205, 92, 198, 130],
		[455, 330, 428, 296, 440, 262],
		[190, 340, 226, 325, 240, 300],
		[470, 40, 446, 70, 452, 96]
	];
	for (const [x0, y0, x1, y1, x2, y2] of cracks) {
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}
	ctx.restore();
}

function drawDrift(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx) {
	const drift = state.hazards.drift;
	if (!drift) return;
	const direction = Math.sign(drift.ax) || 1;
	ctx.save();
	ctx.beginPath();
	ctx.rect(SHEET_L + 2, DRIFT_Y0, SHEET_R - SHEET_L - 4, DRIFT_Y1 - DRIFT_Y0);
	ctx.clip();
	ctx.fillStyle = 'rgba(48, 120, 175, 0.18)';
	ctx.fillRect(SHEET_L, DRIFT_Y0, SHEET_R - SHEET_L, DRIFT_Y1 - DRIFT_Y0);
	ctx.strokeStyle = 'rgba(40, 110, 170, 0.5)';
	ctx.lineWidth = 2.5;
	ctx.lineCap = 'round';
	const offset = fx.reduced ? 0 : (((fx.time * 38 * direction) % 44) + 44) % 44;
	for (let x = SHEET_L - 44; x < SHEET_R + 44; x += 44) {
		for (const y of [DRIFT_Y0 + 16, DRIFT_Y0 + 46]) {
			const px = x + offset;
			ctx.beginPath();
			ctx.moveTo(px - 6 * direction, y - 6);
			ctx.lineTo(px + 6 * direction, y);
			ctx.lineTo(px - 6 * direction, y + 6);
			ctx.stroke();
		}
	}
	ctx.restore();
}

function drawHouse(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx, labels: SceneLabels) {
	const colors = ['#ffffff', '#d8453f', '#ffffff', '#3b82c4'];
	for (let i = RINGS.length - 1; i >= 0; i--) {
		ctx.beginPath();
		ctx.arc(HOUSE.x, HOUSE.y, RINGS[i].r, 0, TAU);
		ctx.fillStyle = colors[i];
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = 'rgba(20, 50, 80, 0.55)';
		ctx.stroke();
	}
	// The realtor's sign planted in the button
	const sold = fx.sold >= 0 || state.results.at(-1)?.sold === true;
	ctx.save();
	ctx.translate(HOUSE.x, SIGN_Y);
	ctx.fillStyle = '#7a5230';
	ctx.fillRect(-20, 10, 4, 12);
	ctx.fillRect(16, 10, 4, 12);
	ctx.rotate(sold ? -0.12 : 0);
	roundedRect(ctx, -30, -11, 60, 24, 3);
	ctx.fillStyle = sold ? '#ffd23f' : '#fffbe8';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = '#2b1d12';
	ctx.stroke();
	ctx.fillStyle = sold ? '#9b1c1c' : '#c0262d';
	ctx.font = 'bold 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(sold ? labels.sold : labels.forSale, 0, 1.5);
	ctx.restore();
}

function drawLines(ctx: CanvasRenderingContext2D) {
	ctx.strokeStyle = 'rgba(60, 120, 170, 0.45)';
	ctx.lineWidth = 2;
	ctx.setLineDash([]);
	for (const y of [HOG_Y, HACK.y + 20]) {
		ctx.beginPath();
		ctx.moveTo(SHEET_L + 6, y);
		ctx.lineTo(SHEET_R - 6, y);
		ctx.stroke();
	}
	ctx.setLineDash([6, 8]);
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(SHEET_CX, SHEET_BACK + 6);
	ctx.lineTo(SHEET_CX, HACK.y + 20);
	ctx.stroke();
	ctx.setLineDash([]);
	// The hack
	ctx.fillStyle = 'rgba(40, 90, 140, 0.5)';
	ctx.beginPath();
	ctx.ellipse(HACK.x, HACK.y + 13, 15, 4, 0, 0, TAU);
	ctx.fill();
}

function drawWind(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx) {
	const wind = state.hazards.wind;
	if (wind === 0) return;
	const direction = Math.sign(wind);
	const length = 14 + Math.abs(wind) * 6;
	const cx = direction > 0 ? 60 : 580;
	const cy = 60;
	ctx.save();
	ctx.strokeStyle = 'rgba(235, 248, 255, 0.85)';
	ctx.fillStyle = 'rgba(235, 248, 255, 0.85)';
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	const sway = fx.reduced ? 0 : Math.sin(fx.time * 3) * 3;
	for (let i = 0; i < 3; i++) {
		const y = cy + (i - 1) * 14;
		const x0 = cx - (direction * length) / 2 + (i === 1 ? sway : -sway);
		ctx.globalAlpha = i === 1 ? 1 : 0.6;
		ctx.beginPath();
		ctx.moveTo(x0, y);
		ctx.lineTo(x0 + direction * length, y);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	ctx.beginPath();
	const tip = cx + (direction * length) / 2 + 8 * direction;
	ctx.moveTo(tip, cy);
	ctx.lineTo(tip - 10 * direction, cy - 8);
	ctx.lineTo(tip - 10 * direction, cy + 8);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawSeal(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx, index: number) {
	const seal = state.hazards.seals[index];
	const progress = Math.min(1, state.enter); // 1 at the edge, 0 resting
	const eased = progress * progress;
	const startX = seal.side < 0 ? SHEET_L - 50 : SHEET_R + 50;
	const x = seal.x + (startX - seal.x) * eased;
	// A wet streak where the seal slid in
	if (progress > 0) {
		ctx.strokeStyle = 'rgba(120, 170, 205, 0.4)';
		ctx.lineWidth = 8;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x, seal.y);
		ctx.lineTo(seal.x + (startX - seal.x) * Math.min(1, eased + 0.25), seal.y);
		ctx.stroke();
	}
	const wobble = sealWobble(fx, index);
	const facing = seal.side < 0 ? 1 : -1;
	const bob = fx.reduced ? 0 : Math.sin(fx.time * 2 + index * 1.7) * 0.8;
	ctx.save();
	ctx.translate(x, seal.y + bob);
	ctx.rotate(wobble);
	ctx.scale(facing, 1);
	ctx.fillStyle = 'rgba(0, 30, 60, 0.2)';
	ctx.beginPath();
	ctx.ellipse(1, 4, SEAL_R * 1.25, SEAL_R * 0.8, 0, 0, TAU);
	ctx.fill();
	// Body
	ctx.fillStyle = '#8a98a6';
	ctx.strokeStyle = '#3a4652';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.ellipse(0, 0, SEAL_R * 1.2, SEAL_R * 0.78, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	// Tail flippers
	ctx.beginPath();
	ctx.moveTo(-SEAL_R * 1.1, 0);
	ctx.lineTo(-SEAL_R * 1.55, -5);
	ctx.lineTo(-SEAL_R * 1.55, 5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Belly spot
	ctx.fillStyle = '#c6d0d9';
	ctx.beginPath();
	ctx.ellipse(2, 3, SEAL_R * 0.7, SEAL_R * 0.35, 0, 0, TAU);
	ctx.fill();
	// Head
	const surprised = (fx.sealReact[index] ?? 0) > 0;
	ctx.fillStyle = '#9aa8b6';
	ctx.beginPath();
	ctx.arc(SEAL_R * 0.95, -1, SEAL_R * 0.55, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#101820';
	ctx.beginPath();
	ctx.arc(SEAL_R * 1.1, -4, surprised ? 2.6 : 1.8, 0, TAU);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(SEAL_R * 1.38, 0, 2, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255,255,255,0.8)';
	ctx.lineWidth = 1;
	for (const dy of [-1.5, 1.5]) {
		ctx.beginPath();
		ctx.moveTo(SEAL_R * 1.3, dy);
		ctx.lineTo(SEAL_R * 1.7, dy * 3);
		ctx.stroke();
	}
	if (surprised) {
		ctx.fillStyle = '#101820';
		ctx.beginPath();
		ctx.ellipse(SEAL_R * 1.5, 4, 2.5, 3, 0, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

function drawPenguin(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx) {
	const penguin = state.hazards.penguin;
	if (!penguin) return;
	const hurt = fx.penguinHurt > 0;
	const facing = penguin.vx >= 0 ? 1 : -1;
	const waddle = Math.sin(penguin.phase) * 0.28;
	ctx.save();
	ctx.translate(penguin.x, penguin.y);
	ctx.fillStyle = 'rgba(0, 30, 60, 0.2)';
	ctx.beginPath();
	ctx.ellipse(0, PENGUIN_R * 0.85, PENGUIN_R * 0.9, PENGUIN_R * 0.35, 0, 0, TAU);
	ctx.fill();
	ctx.rotate(hurt ? fx.penguinHurt * 14 : waddle);
	const squash = hurt ? 1 + Math.sin(fx.penguinHurt * 30) * 0.12 : 1;
	ctx.scale(facing * squash, 1 / squash);
	// Feet
	ctx.fillStyle = '#f2992e';
	ctx.beginPath();
	ctx.ellipse(-4, PENGUIN_R * 0.95, 4, 2, 0, 0, TAU);
	ctx.ellipse(4, PENGUIN_R * 0.95, 4, 2, 0, 0, TAU);
	ctx.fill();
	// Body, belly, wings
	ctx.fillStyle = '#26303a';
	ctx.beginPath();
	ctx.ellipse(0, 0, PENGUIN_R * 0.85, PENGUIN_R, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#f4f7fa';
	ctx.beginPath();
	ctx.ellipse(1.5, 2, PENGUIN_R * 0.55, PENGUIN_R * 0.7, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#26303a';
	ctx.beginPath();
	ctx.ellipse(-PENGUIN_R * 0.85, 1, 3, PENGUIN_R * 0.55, waddle, 0, TAU);
	ctx.ellipse(PENGUIN_R * 0.85, 1, 3, PENGUIN_R * 0.55, -waddle, 0, TAU);
	ctx.fill();
	// Eyes and beak
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(1, -PENGUIN_R * 0.45, 2.6, 0, TAU);
	ctx.arc(6, -PENGUIN_R * 0.45, 2.6, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#111';
	ctx.beginPath();
	ctx.arc(hurt ? 1.4 : 2, -PENGUIN_R * 0.45, hurt ? 1.8 : 1.2, 0, TAU);
	ctx.arc(hurt ? 6.4 : 7, -PENGUIN_R * 0.45, hurt ? 1.8 : 1.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#f2992e';
	ctx.beginPath();
	ctx.moveTo(3, -PENGUIN_R * 0.2);
	ctx.lineTo(10, -PENGUIN_R * 0.05);
	ctx.lineTo(3, PENGUIN_R * 0.1);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	// A speech bubble: a question mark now and then, an alarm when hit
	const asking = fx.penguinAlarm > 0 || (fx.time % 5 < 1.1 && !fx.reduced);
	if (asking) {
		ctx.save();
		ctx.translate(penguin.x + 10, penguin.y - PENGUIN_R - 12);
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#26303a';
		ctx.lineWidth = 1.5;
		roundedRect(ctx, -8, -9, 16, 17, 5);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = fx.penguinAlarm > 0 ? '#d8453f' : '#26303a';
		ctx.font = 'bold 12px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(fx.penguinAlarm > 0 ? '!' : '?', 0, 0.5);
		ctx.restore();
	}
}

function drawStone(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx, stone: Stone) {
	let alpha = 1;
	let scale = 1;
	if (stone.status === 'sunk') {
		const age = state.time - stone.sunkAt;
		if (age > 0.7) return;
		alpha = 1 - age / 0.7;
		scale = 1 - age / 1.4;
	}
	const squash = fx.squash[stone.id];
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.translate(stone.x, stone.y);
	ctx.scale(scale, scale);
	// Shadow
	ctx.fillStyle = 'rgba(10, 40, 70, 0.28)';
	ctx.beginPath();
	ctx.ellipse(2, 4, STONE_R * 1.05, STONE_R * 0.95, 0, 0, TAU);
	ctx.fill();
	if (squash) {
		ctx.rotate(Math.atan2(squash.ny, squash.nx));
		ctx.scale(1 - squash.amount * 0.5, 1 + squash.amount * 0.35);
		ctx.rotate(-Math.atan2(squash.ny, squash.nx));
	}
	const body = ctx.createRadialGradient(-3, -4, 1, 0, 0, STONE_R);
	body.addColorStop(0, '#9aa1a8');
	body.addColorStop(1, '#4b5158');
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.arc(0, 0, STONE_R, 0, TAU);
	ctx.fill();
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = '#23272c';
	ctx.stroke();
	// The handle, spinning with the stone
	ctx.rotate(stone.rot);
	ctx.fillStyle = stone.gamble ? '#f3b61f' : stone.spin > 0 ? '#d8453f' : '#3b82c4';
	roundedRect(ctx, -STONE_R * 0.62, -2.6, STONE_R * 1.24, 5.2, 2.6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(0,0,0,0.5)';
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}

function drawTrails(ctx: CanvasRenderingContext2D, fx: Fx) {
	ctx.lineCap = 'round';
	for (const id of Object.keys(fx.trails)) {
		const trail = fx.trails[Number(id)];
		for (let i = 1; i < trail.length; i++) {
			const fade = Math.max(0, 1 - trail[i].age / 1.4);
			ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * fade})`;
			ctx.lineWidth = 2 + 5 * fade;
			ctx.beginPath();
			ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
			ctx.lineTo(trail[i].x, trail[i].y);
			ctx.stroke();
		}
	}
}

function drawSweepers(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx) {
	const stone = state.stones.find((candidate) => candidate.status === 'moving');
	if (!stone || state.phase !== 'sliding') return;
	const scrubbing = state.sweeping && state.sweepEnergy > 0;
	const stride = fx.reduced ? 0 : Math.sin(fx.time * (scrubbing ? 30 : 10));
	const speed = speedOf(stone);
	const lean = Math.min(1, speed / 90);
	const jackets = ['#d8453f', '#2f6fb0'];
	for (let i = 0; i < 2; i++) {
		const side = i === 0 ? -1 : 1;
		const x = stone.x + side * (STONE_R + 15);
		const y = stone.y - STONE_R - 10 - lean * 6;
		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = 'rgba(10, 40, 70, 0.25)';
		ctx.beginPath();
		ctx.ellipse(1, 3, 7, 5, 0, 0, TAU);
		ctx.fill();
		// The broom swings across the ice in front of the sweeper
		const swing = scrubbing ? stride * 8 : stride * 1.5;
		ctx.strokeStyle = '#7a5230';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-side * 6 + swing * 0.4, -12);
		ctx.stroke();
		ctx.fillStyle = scrubbing ? '#f3d36a' : '#c9a74a';
		ctx.beginPath();
		ctx.ellipse(-side * 6 + swing * 0.4, -14, scrubbing ? 8 : 5, 3, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = jackets[i];
		ctx.beginPath();
		ctx.arc(0, 0, 6, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = '#1b2733';
		ctx.lineWidth = 1.2;
		ctx.stroke();
		ctx.fillStyle = '#f4d3b0';
		ctx.beginPath();
		ctx.arc(0, -1, 3.2, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

function drawHint(ctx: CanvasRenderingContext2D, hint: { x: number; y: number }[]) {
	for (let i = 1; i < hint.length; i++) {
		const fade = 1 - (i / hint.length) * 0.7;
		ctx.fillStyle = `rgba(30, 80, 130, ${0.65 * fade})`;
		ctx.beginPath();
		ctx.arc(hint[i].x, hint[i].y, 2.4 * fade + 0.8, 0, TAU);
		ctx.fill();
	}
	const last = hint[hint.length - 1];
	if (hint.length > 1) {
		ctx.strokeStyle = 'rgba(30, 80, 130, 0.7)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(last.x, last.y, STONE_R, 0, TAU);
		ctx.setLineDash([3, 4]);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function drawAim(ctx: CanvasRenderingContext2D, state: CurlState, fx: Fx, dragging: boolean) {
	const rad = (state.angle * Math.PI) / 180;
	const dx = Math.sin(rad);
	const dy = -Math.cos(rad);
	const length = 22 + state.power * 54;
	const pulse = fx.reduced ? 0 : Math.sin(fx.time * 6) * 1.5;
	ctx.save();
	ctx.strokeStyle = state.gamble ? '#f3b61f' : '#d8453f';
	ctx.fillStyle = ctx.strokeStyle;
	ctx.lineWidth = dragging ? 4 : 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(HACK.x + dx * (STONE_R + 4), HACK.y + dy * (STONE_R + 4));
	const tx = HACK.x + dx * (length + pulse);
	const ty = HACK.y + dy * (length + pulse);
	ctx.lineTo(tx, ty);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(tx + dx * 9, ty + dy * 9);
	ctx.lineTo(tx - dy * 7, ty + dx * 7);
	ctx.lineTo(tx + dy * 7, ty - dx * 7);
	ctx.closePath();
	ctx.fill();
	// A curl hint: a little arc on the side the stone will drift to
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.8;
	ctx.beginPath();
	const side = state.spin;
	ctx.arc(
		HACK.x,
		HACK.y,
		STONE_R + 9,
		-Math.PI / 2 - 0.9 * side,
		-Math.PI / 2 + 0.9 * side,
		side < 0
	);
	ctx.stroke();
	ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: Fx) {
	for (const particle of fx.particles) {
		const fade = Math.max(0, particle.life / particle.max);
		if (particle.kind === 'star') {
			ctx.save();
			ctx.translate(particle.x, particle.y);
			ctx.rotate(particle.life * 6);
			ctx.fillStyle = `rgba(255, 210, 63, ${fade})`;
			ctx.beginPath();
			for (let i = 0; i < 5; i++) {
				const a = (i / 5) * TAU - Math.PI / 2;
				const b = a + Math.PI / 5;
				ctx.lineTo(Math.cos(a) * particle.size * 1.6, Math.sin(a) * particle.size * 1.6);
				ctx.lineTo(Math.cos(b) * particle.size * 0.7, Math.sin(b) * particle.size * 0.7);
			}
			ctx.closePath();
			ctx.fill();
			ctx.restore();
			continue;
		}
		const color =
			particle.kind === 'splash'
				? `rgba(170, 220, 255, ${fade})`
				: particle.kind === 'spark'
					? `rgba(255, 255, 255, ${fade})`
					: `rgba(255, 255, 255, ${0.85 * fade})`;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(particle.x, particle.y, particle.size * (0.5 + fade * 0.5), 0, TAU);
		ctx.fill();
	}
}

function drawPopups(ctx: CanvasRenderingContext2D, fx: Fx) {
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const popup of fx.popups) {
		const t = 1 - popup.life / popup.max;
		const pop = fx.reduced ? 1 : Math.min(1, t * 6) * (1 + Math.max(0, 0.25 - t) * 1.2);
		const size = popup.tone === 'big' ? 26 : 18;
		ctx.save();
		ctx.translate(popup.x, popup.y);
		ctx.scale(pop, pop);
		ctx.globalAlpha = Math.min(1, popup.life / 0.4);
		ctx.font = `800 ${size}px system-ui, sans-serif`;
		ctx.lineWidth = 5;
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#10243a';
		ctx.strokeText(popup.text, 0, 0);
		ctx.fillStyle =
			popup.tone === 'bad'
				? '#ff7a70'
				: popup.tone === 'good'
					? '#8cf08f'
					: popup.tone === 'big'
						? '#ffd23f'
						: '#ffffff';
		ctx.fillText(popup.text, 0, 0);
		ctx.restore();
	}
}

/** Draws one whole frame */
export function drawScene(
	ctx: CanvasRenderingContext2D,
	state: CurlState,
	fx: Fx,
	{ labels, hint, dragging }: SceneOptions
) {
	ctx.save();
	const zoom = fx.camera.zoom;
	ctx.translate(WORLD_W / 2 + fx.shakeX + fx.camera.x, WORLD_H / 2 + fx.shakeY + fx.camera.y);
	ctx.scale(zoom, zoom);
	ctx.translate(-WORLD_W / 2, -WORLD_H / 2);

	drawSea(ctx, fx);
	drawSlab(ctx);
	drawDrift(ctx, state, fx);
	drawHouse(ctx, state, fx, labels);
	drawLines(ctx);
	drawWind(ctx, state, fx);
	drawTrails(ctx, fx);
	if (state.phase === 'aiming') {
		if (hint) drawHint(ctx, hint);
		drawAim(ctx, state, fx, dragging);
		// The next stone waits in the hack
		drawStone(ctx, state, fx, {
			id: -1,
			x: HACK.x,
			y: HACK.y,
			vx: 0,
			vy: 0,
			spin: state.spin,
			gamble: state.gamble,
			status: 'rest',
			rot: 0,
			sunkAt: 0
		});
	}
	for (let i = 0; i < state.hazards.seals.length; i++) drawSeal(ctx, state, fx, i);
	for (const stone of state.stones) drawStone(ctx, state, fx, stone);
	drawPenguin(ctx, state, fx);
	drawSweepers(ctx, state, fx);
	drawParticles(ctx, fx);
	drawPopups(ctx, fx);
	ctx.restore();

	if (fx.flash > 0) {
		ctx.fillStyle = `rgba(255, 255, 255, ${fx.flash * 0.5})`;
		ctx.fillRect(0, 0, WORLD_W, WORLD_H);
	}
}

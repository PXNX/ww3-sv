/*
 * Run Comrade sprites, drawn with canvas paths in the game's chunky cartoon style (thick ink outline,
 * flat colors). Every function takes the point where the thing touches the ground (x, y) and a scale
 * s (1 is the size at the runner's feet), so the same drawing serves the perspective course and the
 * small pictures in the how-to-play legend. Everything is original, generic and bloodless.
 */
import { LANE_W } from './projection';

export const INK = '#111111';
export const PAPER = '#ffffff';
export const SAND = '#e8e1bc';
export const KHAKI = '#7c8c5c';
export const OLIVE = '#5f6f3c';
export const OLIVE_DARK = '#46532b';
export const TIE_RED = '#e5484d';
export const YELLOW = '#f5c83a';
export const MUSTARD = '#ddb93c';
export const SKIN = '#f6c9a0';
export const SLATE = '#6a7c9b';
export const DIRT = '#b99a62';
export const GREEN = '#6f9a3a';

type Ctx = CanvasRenderingContext2D;

function outline(ctx: Ctx, s: number, width = 2.2) {
	ctx.lineWidth = Math.max(0.8, width * Math.min(1, Math.max(0.45, s)));
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
}

function fillStroke(ctx: Ctx, fill: string, s: number, width?: number) {
	ctx.fillStyle = fill;
	ctx.fill();
	outline(ctx, s, width);
	ctx.stroke();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

/** A sunflower on a stalk; `height` is the stalk length at scale 1, `sway` an angle in radians */
export function drawSunflower(ctx: Ctx, x: number, y: number, s: number, height = 46, sway = 0) {
	const top = { x: x + Math.sin(sway) * height * 0.18 * s, y: y - height * s };
	// Stalk
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.quadraticCurveTo(x, y - height * 0.55 * s, top.x, top.y);
	ctx.strokeStyle = INK;
	ctx.lineWidth = Math.max(1.5, 5 * s);
	ctx.lineCap = 'round';
	ctx.stroke();
	ctx.strokeStyle = GREEN;
	ctx.lineWidth = Math.max(0.8, 2.8 * s);
	ctx.stroke();
	// Leaves
	for (const side of [-1, 1]) {
		ctx.beginPath();
		const ly = y - height * 0.34 * s;
		ctx.ellipse(x + side * 7 * s, ly, 7 * s, 3.2 * s, side * -0.5, 0, Math.PI * 2);
		fillStroke(ctx, GREEN, s, 1.4);
	}
	// Head: petals around a brown disc
	const r = 11 * s;
	if (s < 0.22) {
		ctx.beginPath();
		ctx.arc(top.x, top.y, r * 1.35, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(top.x, top.y, r * 0.6, 0, Math.PI * 2);
		ctx.fillStyle = '#6b4423';
		ctx.fill();
		return;
	}
	for (let i = 0; i < 9; i++) {
		const angle = (i / 9) * Math.PI * 2;
		ctx.beginPath();
		ctx.ellipse(
			top.x + Math.cos(angle) * r * 1.05,
			top.y + Math.sin(angle) * r * 1.05,
			r * 0.62,
			r * 0.3,
			angle,
			0,
			Math.PI * 2
		);
		fillStroke(ctx, YELLOW, s, 1.2);
	}
	ctx.beginPath();
	ctx.arc(top.x, top.y, r * 0.78, 0, Math.PI * 2);
	fillStroke(ctx, '#6b4423', s, 1.6);
	ctx.fillStyle = '#4a2e18';
	for (const [dx, dy] of [
		[-0.25, -0.2],
		[0.25, 0.1],
		[-0.05, 0.3]
	]) {
		ctx.beginPath();
		ctx.arc(top.x + dx * r, top.y + dy * r, Math.max(0.6, r * 0.12), 0, Math.PI * 2);
		ctx.fill();
	}
}

/** A ditch across a lane: a dark trench with a crumbly lip */
export function drawDitch(ctx: Ctx, x: number, y: number, s: number) {
	const w = LANE_W * 0.9 * s;
	const h = 30 * s;
	// Lip
	ctx.beginPath();
	ctx.ellipse(x, y, w / 2 + 5 * s, h / 2 + 4 * s, 0, 0, Math.PI * 2);
	fillStroke(ctx, '#8a6a3a', s);
	// Hole
	ctx.beginPath();
	ctx.ellipse(x, y + 1 * s, w / 2, h / 2, 0, 0, Math.PI * 2);
	fillStroke(ctx, '#2e1d10', s, 1.6);
	// A plank of sky-blue water glint and two stones
	ctx.beginPath();
	ctx.ellipse(x - w * 0.12, y + h * 0.08, w * 0.22, h * 0.1, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#4b6a8a';
	ctx.fill();
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(x + side * (w / 2 + 2 * s), y - h * 0.3, 6 * s, 4 * s, 0, 0, Math.PI * 2);
		fillStroke(ctx, '#9a9a8a', s, 1.4);
	}
}

/** A tractor with a hazard-striped boom reaching over the lane at head height */
export function drawTractorArm(ctx: Ctx, x: number, y: number, s: number) {
	const half = LANE_W * 0.5 * s;
	const beamY = y - 70 * s;
	// Ground shadow under the beam
	ctx.beginPath();
	ctx.ellipse(x, y, half * 0.95, 7 * s, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0,0,0,0.18)';
	ctx.fill();
	// Tractor body on the left edge
	roundRect(ctx, x - half - 8 * s, y - 46 * s, 38 * s, 30 * s, 6 * s);
	fillStroke(ctx, GREEN, s);
	roundRect(ctx, x - half - 2 * s, y - 70 * s, 24 * s, 26 * s, 5 * s);
	fillStroke(ctx, '#d9e6ee', s, 1.8);
	ctx.beginPath();
	ctx.arc(x - half + 4 * s, y - 14 * s, 15 * s, 0, Math.PI * 2);
	fillStroke(ctx, '#222222', s);
	ctx.beginPath();
	ctx.arc(x - half + 4 * s, y - 14 * s, 6 * s, 0, Math.PI * 2);
	fillStroke(ctx, MUSTARD, s, 1.4);
	// Boom with warning stripes
	const left = x - half + 14 * s;
	const right = x + half + 8 * s;
	roundRect(ctx, left, beamY - 8 * s, right - left, 16 * s, 3 * s);
	fillStroke(ctx, YELLOW, s);
	ctx.save();
	roundRect(ctx, left, beamY - 8 * s, right - left, 16 * s, 3 * s);
	ctx.clip();
	ctx.fillStyle = INK;
	const stripe = 10 * s;
	for (let sx = left - 16 * s; sx < right; sx += stripe * 2) {
		ctx.beginPath();
		ctx.moveTo(sx, beamY + 9 * s);
		ctx.lineTo(sx + stripe, beamY + 9 * s);
		ctx.lineTo(sx + stripe + 12 * s, beamY - 9 * s);
		ctx.lineTo(sx + 12 * s, beamY - 9 * s);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
	roundRect(ctx, left, beamY - 8 * s, right - left, 16 * s, 3 * s);
	outline(ctx, s);
	ctx.stroke();
	// Bucket hanging from the tip
	ctx.beginPath();
	ctx.moveTo(right - 12 * s, beamY + 8 * s);
	ctx.lineTo(right + 6 * s, beamY + 8 * s);
	ctx.lineTo(right + 2 * s, beamY + 22 * s);
	ctx.lineTo(right - 10 * s, beamY + 22 * s);
	ctx.closePath();
	fillStroke(ctx, '#7d7d7d', s, 1.8);
}

/** A cartoon landmine: a round shell, a few spikes and a blinking light */
export function drawMine(ctx: Ctx, x: number, y: number, s: number, blink = false) {
	const rx = 24 * s;
	const ry = 11 * s;
	ctx.beginPath();
	ctx.ellipse(x, y + 3 * s, rx * 1.1, ry * 0.9, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0,0,0,0.2)';
	ctx.fill();
	for (let i = -2; i <= 2; i++) {
		ctx.beginPath();
		ctx.moveTo(x + i * 8 * s - 3 * s, y - ry * 0.4);
		ctx.lineTo(x + i * 8 * s, y - ry * 0.4 - 10 * s);
		ctx.lineTo(x + i * 8 * s + 3 * s, y - ry * 0.4);
		fillStroke(ctx, '#3b3b3b', s, 1.6);
	}
	ctx.beginPath();
	ctx.ellipse(x, y - 4 * s, rx, ry + 5 * s, 0, 0, Math.PI * 2);
	fillStroke(ctx, '#555a52', s);
	ctx.beginPath();
	ctx.ellipse(x - rx * 0.35, y - 8 * s, rx * 0.3, ry * 0.3, -0.3, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.35)';
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x, y - 6 * s, 4.2 * s, 0, Math.PI * 2);
	fillStroke(ctx, blink ? '#ff5a5a' : '#8f2a2a', s, 1.4);
	// A little warning flag on a stick
	ctx.beginPath();
	ctx.moveTo(x + rx * 0.9, y - 2 * s);
	ctx.lineTo(x + rx * 0.9, y - 34 * s);
	outline(ctx, s, 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + rx * 0.9, y - 34 * s);
	ctx.lineTo(x + rx * 0.9 + 14 * s, y - 29 * s);
	ctx.lineTo(x + rx * 0.9, y - 24 * s);
	ctx.closePath();
	fillStroke(ctx, TIE_RED, s, 1.4);
}

/** The helmet pickup: a plain olive helmet with a glowing rim */
export function drawHelmet(ctx: Ctx, x: number, y: number, s: number, glow = 0) {
	const r = 17 * s;
	if (glow > 0) {
		ctx.beginPath();
		ctx.arc(x, y - r * 0.6, r * (1.5 + glow * 0.2), 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(245, 200, 58, 0.35)';
		ctx.fill();
	}
	ctx.beginPath();
	ctx.arc(x, y - r * 0.3, r, Math.PI, 0);
	ctx.closePath();
	fillStroke(ctx, OLIVE, s);
	ctx.beginPath();
	ctx.ellipse(x, y - r * 0.3, r * 1.25, r * 0.3, 0, 0, Math.PI * 2);
	fillStroke(ctx, OLIVE_DARK, s);
	ctx.beginPath();
	ctx.arc(x - r * 0.3, y - r * 0.85, r * 0.2, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.4)';
	ctx.fill();
	// A generic round patch
	ctx.beginPath();
	ctx.arc(x + r * 0.35, y - r * 0.7, r * 0.2, 0, Math.PI * 2);
	fillStroke(ctx, TIE_RED, s, 1.2);
}

/** The rice bowl pickup: a bowl heaped with rice and a wisp of steam */
export function drawRiceBowl(ctx: Ctx, x: number, y: number, s: number, steam = 0) {
	const r = 17 * s;
	// Rice mound
	ctx.beginPath();
	ctx.arc(x, y - r * 0.8, r * 0.95, Math.PI, 0);
	ctx.closePath();
	fillStroke(ctx, PAPER, s, 1.8);
	ctx.fillStyle = '#d8d8c8';
	for (const [dx, dy] of [
		[-0.4, -1.3],
		[0.1, -1.55],
		[0.45, -1.2],
		[-0.1, -1.05]
	]) {
		ctx.beginPath();
		ctx.ellipse(x + dx * r, y + dy * r, r * 0.12, r * 0.06, 0.5, 0, Math.PI * 2);
		ctx.fill();
	}
	// Bowl
	ctx.beginPath();
	ctx.moveTo(x - r * 1.15, y - r * 0.85);
	ctx.quadraticCurveTo(x - r * 1.0, y, x, y);
	ctx.quadraticCurveTo(x + r * 1.0, y, x + r * 1.15, y - r * 0.85);
	ctx.closePath();
	fillStroke(ctx, '#d9e6ee', s);
	ctx.beginPath();
	ctx.moveTo(x - r * 1.05, y - r * 0.55);
	ctx.lineTo(x + r * 1.05, y - r * 0.55);
	outline(ctx, s, 3);
	ctx.strokeStyle = TIE_RED;
	ctx.stroke();
	// Steam
	for (const dx of [-0.4, 0.3]) {
		ctx.beginPath();
		const wobble = Math.sin(steam * 4 + dx * 5) * r * 0.15;
		ctx.moveTo(x + dx * r, y - r * 1.9);
		ctx.quadraticCurveTo(x + dx * r + wobble, y - r * 2.2, x + dx * r, y - r * 2.5);
		ctx.strokeStyle = 'rgba(255,255,255,0.8)';
		ctx.lineWidth = Math.max(1, 2 * s);
		ctx.stroke();
	}
}

export interface RunnerPose {
	/** Leg and arm swing, any angle in radians that advances while running */
	stride: number;
	/** Height above the ground in screen units at scale 1 */
	lift: number;
	/** 0 upright to 1 fully ducked */
	crouch: number;
	/** Lean in radians (a stumble wobble) */
	tilt: number;
	/** Seen in a flat pose for the game-over card */
	shield: boolean;
	boost: boolean;
	/** The runner blinks while it cannot be hurt */
	alpha: number;
	/** 0 to 1: how far the head is turned back over the shoulder with a shocked face */
	glance: number;
	/** Draw the shocked face as a still picture (no moving sweat drops), for reduced motion */
	still: boolean;
	/** Seconds, for the little animations */
	time: number;
}

export const IDLE_POSE: RunnerPose = {
	stride: 0,
	lift: 0,
	crouch: 0,
	tilt: 0,
	shield: false,
	boost: false,
	alpha: 1,
	glance: 0,
	still: true,
	time: 0
};

/** The comic shocked face he shows when he glances back: wide eyes, open mouth, sweat drops */
function drawShockedFace(ctx: Ctx, amount: number, pose: RunnerPose) {
	ctx.save();
	ctx.translate(-2 * amount, -77);
	ctx.scale(amount, 1);
	ctx.beginPath();
	ctx.ellipse(0, 0, 9.5, 10, 0, 0, Math.PI * 2);
	fillStroke(ctx, '#fbd9b8', 1, 1.8);
	// Wide eyes with tiny pupils, looking back
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(side * 3.8, -2, 3.3, 4.3, 0, 0, Math.PI * 2);
		fillStroke(ctx, PAPER, 1, 1.3);
		ctx.beginPath();
		ctx.arc(side * 3.8 - 0.8, -1.5, 1.2, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
		// Raised eyebrow
		ctx.beginPath();
		ctx.moveTo(side * 3.8 - 3, -9);
		ctx.quadraticCurveTo(side * 3.8, -11.5, side * 3.8 + 3, -9);
		ctx.lineWidth = 1.4;
		ctx.strokeStyle = INK;
		ctx.stroke();
	}
	// Open mouth
	ctx.beginPath();
	ctx.ellipse(0, 6, 3.2, 4.2, 0, 0, Math.PI * 2);
	fillStroke(ctx, '#5a1a1a', 1, 1.4);
	ctx.restore();
	// Sweat drops flying off, or hanging still
	ctx.save();
	ctx.globalAlpha *= amount;
	[
		[-18, -86],
		[18, -82],
		[-16, -70]
	].forEach(([dx, dy], index) => {
		const fall = pose.still ? 0 : (pose.time * 26 + index * 7) % 9;
		const x = dx + Math.sign(dx) * fall * 0.4;
		const y = dy + fall;
		ctx.beginPath();
		ctx.moveTo(x, y - 5);
		ctx.quadraticCurveTo(x + 4, y + 1, x, y + 3);
		ctx.quadraticCurveTo(x - 4, y + 1, x, y - 5);
		fillStroke(ctx, '#8fd0ff', 1, 1.2);
	});
	ctx.restore();
}

/** The cartoon soldier seen from behind: helmet, backpack, swinging arms and legs */
export function drawRunner(ctx: Ctx, x: number, y: number, s: number, pose: RunnerPose) {
	ctx.save();
	ctx.globalAlpha = pose.alpha;
	// Ground shadow
	ctx.beginPath();
	const shadow = 1 - Math.min(0.5, pose.lift / 220);
	ctx.ellipse(x, y + 2 * s, 24 * s * shadow, 7 * s * shadow, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0,0,0,0.25)';
	ctx.fill();

	ctx.translate(x, y - pose.lift * s);
	ctx.rotate(pose.tilt);
	ctx.scale(s, s * (1 - pose.crouch * 0.38));

	const swing = Math.sin(pose.stride);
	const tuck = pose.lift > 4 ? 1 : 0;

	// Legs
	for (const side of [-1, 1]) {
		const phase = side * swing;
		const lift = tuck ? 10 : Math.max(0, phase) * 12;
		ctx.beginPath();
		ctx.roundRect(side * 8 - 5, -28 - phase * 3, 10, 26 - lift * 0.4, 4);
		fillStroke(ctx, OLIVE_DARK, 1, 2);
		ctx.beginPath();
		ctx.roundRect(side * 8 - 7, -6 - lift, 14, 9, 4);
		fillStroke(ctx, '#2a2a2a', 1, 2);
	}

	// Arms behind the body
	for (const side of [-1, 1]) {
		const phase = -side * swing;
		ctx.beginPath();
		ctx.roundRect(side * 21 - 4.5, -62 + phase * 4, 9, 26, 4);
		fillStroke(ctx, OLIVE, 1, 2);
		ctx.beginPath();
		ctx.arc(side * 21, -34 + phase * 4, 4.5, 0, Math.PI * 2);
		fillStroke(ctx, SKIN, 1, 1.6);
	}

	// Body and backpack
	ctx.beginPath();
	ctx.roundRect(-17, -66, 34, 42, 8);
	fillStroke(ctx, OLIVE, 1, 2.4);
	ctx.beginPath();
	ctx.roundRect(-12, -62, 24, 30, 6);
	fillStroke(ctx, '#a58b53', 1, 2.2);
	ctx.beginPath();
	ctx.moveTo(-12, -50);
	ctx.lineTo(12, -50);
	ctx.strokeStyle = INK;
	ctx.lineWidth = 1.6;
	ctx.stroke();
	// A bedroll on top of the pack
	ctx.beginPath();
	ctx.roundRect(-14, -68, 28, 8, 4);
	fillStroke(ctx, '#7a6a43', 1, 2);

	// Head and helmet
	ctx.beginPath();
	ctx.arc(0, -78, 11, 0, Math.PI * 2);
	fillStroke(ctx, SKIN, 1, 2.2);
	if (pose.glance > 0.2) drawShockedFace(ctx, Math.min(1, (pose.glance - 0.2) / 0.8), pose);
	ctx.beginPath();
	ctx.arc(0, -81, 13, Math.PI * 0.98, Math.PI * 0.02);
	ctx.closePath();
	fillStroke(ctx, OLIVE, 1, 2.4);
	ctx.beginPath();
	ctx.ellipse(0, -80, 15, 4, 0, 0, Math.PI * 2);
	fillStroke(ctx, OLIVE_DARK, 1, 2);
	ctx.beginPath();
	ctx.arc(7, -87, 3.2, 0, Math.PI * 2);
	fillStroke(ctx, TIE_RED, 1, 1.4);

	ctx.restore();

	if (pose.boost) {
		ctx.save();
		ctx.globalAlpha = 0.5;
		ctx.strokeStyle = YELLOW;
		ctx.lineWidth = Math.max(1, 3 * s);
		ctx.lineCap = 'round';
		for (const dx of [-30, -18, 18, 30]) {
			ctx.beginPath();
			ctx.moveTo(x + dx * s, y - (pose.lift + 70) * s);
			ctx.lineTo(x + dx * s * 1.1, y - (pose.lift + 20) * s);
			ctx.stroke();
		}
		ctx.restore();
	}
	if (pose.shield) {
		ctx.beginPath();
		ctx.ellipse(x, y - (pose.lift + 46) * s, 38 * s, 56 * s, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
		ctx.fill();
		ctx.lineWidth = Math.max(1, 3 * s);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
		ctx.stroke();
	}
}

/** The chasing FPV drone: a little quadcopter with a lens, drawn from behind and above */
export function drawDrone(ctx: Ctx, x: number, y: number, s: number, phase: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	ctx.rotate(Math.sin(phase * 2.2) * 0.08);
	// Shadow below
	ctx.beginPath();
	ctx.ellipse(0, 34, 34, 7, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0,0,0,0.22)';
	ctx.fill();
	// Arms
	ctx.lineCap = 'round';
	ctx.strokeStyle = INK;
	ctx.lineWidth = 7;
	ctx.beginPath();
	ctx.moveTo(-32, -10);
	ctx.lineTo(32, 12);
	ctx.moveTo(32, -10);
	ctx.lineTo(-32, 12);
	ctx.stroke();
	ctx.strokeStyle = '#3a3f4a';
	ctx.lineWidth = 3.4;
	ctx.stroke();
	// Rotors: blurred discs that flicker
	for (const [dx, dy] of [
		[-34, -12],
		[34, -12],
		[-34, 14],
		[34, 14]
	]) {
		ctx.beginPath();
		ctx.ellipse(dx, dy, 19, 6.5, 0, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(230, 236, 245, 0.55)';
		ctx.fill();
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = INK;
		ctx.stroke();
		const spin = phase * 40 + dx;
		ctx.beginPath();
		ctx.moveTo(dx - Math.cos(spin) * 19, dy - Math.sin(spin) * 6.5);
		ctx.lineTo(dx + Math.cos(spin) * 19, dy + Math.sin(spin) * 6.5);
		ctx.stroke();
	}
	// Body and lens
	ctx.beginPath();
	ctx.roundRect(-15, -14, 30, 28, 9);
	fillStroke(ctx, '#4a5160', 1, 2.6);
	ctx.beginPath();
	ctx.arc(0, 4, 8, 0, Math.PI * 2);
	fillStroke(ctx, '#15181e', 1, 2);
	ctx.beginPath();
	ctx.arc(-2.5, 1.5, 2.6, 0, Math.PI * 2);
	ctx.fillStyle = '#8fd0ff';
	ctx.fill();
	// Blinking red light
	ctx.beginPath();
	ctx.arc(0, -8, 3.2, 0, Math.PI * 2);
	ctx.fillStyle = Math.sin(phase * 12) > 0 ? '#ff5a5a' : '#7a2a2a';
	ctx.fill();
	ctx.restore();
}

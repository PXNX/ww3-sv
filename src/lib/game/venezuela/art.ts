/*
 * Sprites for El Presidente, drawn with canvas paths in the game's chunky cartoon style (thick ink
 * outline, flat colors). Everything is in tile units and takes the point where the thing touches
 * the ground (x = horizontal center, y = feet), so the same drawing serves the level and the small
 * legend pictures. All of it is original and generic: the hero is a made-up caricature with a huge
 * mustache and a sash, not anyone's likeness; the goons wear plain hard hats; the helicopters carry
 * a round cartoon patch. The mystery blocks, spring pads, hover barges and boosters follow the same
 * style.
 */
import type { BoosterKind } from './boosters';

type Ctx = CanvasRenderingContext2D;

export const INK = '#111111';
export const PAPER = '#ffffff';
export const SAND = '#e8e1bc';
export const RED = '#e5484d';
export const YELLOW = '#f5c83a';
export const MUSTARD = '#ddb93c';
export const SKIN = '#f6c9a0';
export const KHAKI = '#7c8c5c';
export const SLATE = '#6a7c9b';
export const NAVY = '#34455e';
export const EARTH = '#b88a4a';
export const EARTH_DARK = '#8f6a34';
export const CRATE = '#c98f4e';

const LINE = 0.07;

function stroke(ctx: Ctx, fill: string | null, width = LINE) {
	if (fill) {
		ctx.fillStyle = fill;
		ctx.fill();
	}
	ctx.lineWidth = width;
	ctx.strokeStyle = INK;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.stroke();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | null) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	stroke(ctx, fill);
}

function roundRect(
	ctx: Ctx,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	fill: string | null
) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
	stroke(ctx, fill);
}

export interface HeroPose {
	facing: 1 | -1;
	/** Seconds into the run cycle; the legs swing with it */
	run: number;
	/** 0 standing, 1 running, used to scale the leg swing */
	speed: number;
	airborne: boolean;
	/** Rising (true) or falling (false) while airborne */
	rising: boolean;
	/** Draws a worried face (just hit) */
	hurt: boolean;
	/** 0 to 1 through the mustache twirl of the air jump, 0 when not twirling */
	twirl?: number;
	/** Curled up in the slam's hang, or stretched in its dive */
	slam?: 'none' | 'hang' | 'dive';
	/** Leaning into a sprint */
	sprint?: boolean;
	/** Wearing the spring boots */
	boots?: boolean;
}

/** The mustachioed hero, about 0.95 tiles tall, feet at (x, y) */
export function drawHero(ctx: Ctx, x: number, y: number, pose: HeroPose) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(pose.facing, 1);
	// The twirl spins around the middle of the body, the slam squashes or stretches it
	if (pose.twirl) {
		ctx.translate(0, -0.48);
		ctx.rotate(pose.twirl * Math.PI * 2);
		ctx.translate(0, 0.48);
	}
	if (pose.slam === 'hang') ctx.scale(1.15, 0.85);
	else if (pose.slam === 'dive') ctx.scale(0.82, 1.2);
	else if (pose.sprint) {
		ctx.transform(1, 0, -0.18, 1, 0, 0);
	}

	const swing = pose.airborne ? 0 : Math.sin(pose.run * 16) * 0.12 * pose.speed;
	const bob = pose.airborne ? 0 : Math.abs(Math.sin(pose.run * 16)) * 0.04 * pose.speed;
	ctx.translate(0, -bob);

	// Legs (red boots with a yellow coil band while the spring boots are on)
	const tuck = pose.airborne ? (pose.rising ? 0.1 : -0.04) : 0;
	const shoe = pose.boots ? RED : '#3b2a20';
	const feet = [
		[-0.1 - swing, -0.08 - tuck],
		[0.12 + swing, -0.08 + (pose.airborne ? -0.08 : 0)]
	];
	for (const [fx, fy] of feet) ellipse(ctx, fx, fy, 0.1, 0.075, shoe);
	if (pose.boots) {
		for (const [fx, fy] of feet) {
			ctx.beginPath();
			ctx.moveTo(fx - 0.07, fy);
			ctx.lineTo(fx + 0.07, fy);
			ctx.lineWidth = 0.035;
			ctx.strokeStyle = YELLOW;
			ctx.stroke();
		}
	}

	// Jacket
	roundRect(ctx, -0.22, -0.52, 0.44, 0.4, 0.14, MUSTARD);
	// Sash across the chest, in a flat cartoon red with a stripe
	ctx.beginPath();
	ctx.moveTo(-0.2, -0.5);
	ctx.lineTo(-0.04, -0.5);
	ctx.lineTo(0.22, -0.2);
	ctx.lineTo(0.08, -0.14);
	ctx.closePath();
	stroke(ctx, RED, 0.05);
	// Medal
	ctx.beginPath();
	ctx.arc(-0.1, -0.36, 0.045, 0, Math.PI * 2);
	stroke(ctx, YELLOW, 0.035);

	// Arms: up while jumping, swinging while running
	const armUp = pose.airborne ? (pose.rising ? -0.3 : -0.15) : swing * 0.9;
	ellipse(ctx, 0.25, -0.36 + armUp, 0.065, 0.065, SKIN);
	ellipse(ctx, -0.25, -0.36 + (pose.airborne ? armUp : -swing * 0.9), 0.065, 0.065, SKIN);

	// Head
	ellipse(ctx, 0.02, -0.7, 0.26, 0.25, SKIN);
	// Hair swoop
	ctx.beginPath();
	ctx.moveTo(-0.22, -0.78);
	ctx.quadraticCurveTo(-0.12, -1.02, 0.12, -0.96);
	ctx.quadraticCurveTo(0.26, -0.92, 0.27, -0.76);
	ctx.quadraticCurveTo(0.1, -0.86, -0.22, -0.78);
	stroke(ctx, '#1c1410', 0.05);
	// Eyebrows and eyes
	ctx.beginPath();
	ctx.moveTo(0.02, pose.hurt ? -0.82 : -0.78);
	ctx.lineTo(0.12, pose.hurt ? -0.76 : -0.8);
	ctx.moveTo(0.14, pose.hurt ? -0.77 : -0.79);
	ctx.lineTo(0.24, pose.hurt ? -0.82 : -0.76);
	ctx.lineWidth = 0.06;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.fillStyle = PAPER;
	for (const ex of [0.08, 0.2]) {
		ctx.beginPath();
		ctx.ellipse(ex, -0.7, 0.05, pose.hurt ? 0.07 : 0.055, 0, 0, Math.PI * 2);
		stroke(ctx, PAPER, 0.03);
		ctx.beginPath();
		ctx.arc(ex + 0.015, -0.7, 0.02, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	// Nose
	ellipse(ctx, 0.17, -0.62, 0.05, 0.04, '#eeb88c');
	// The mustache: big, black, curled up at the tips
	ctx.beginPath();
	ctx.moveTo(-0.1, -0.56);
	ctx.quadraticCurveTo(0.0, -0.64, 0.17, -0.58);
	ctx.quadraticCurveTo(0.3, -0.64, 0.36, -0.68);
	ctx.quadraticCurveTo(0.34, -0.5, 0.17, -0.5);
	ctx.quadraticCurveTo(0.02, -0.46, -0.1, -0.56);
	ctx.closePath();
	stroke(ctx, '#1c1410', 0.04);
	// Mouth peeking under it
	if (pose.hurt || pose.airborne) {
		ellipse(ctx, 0.14, -0.44, 0.04, 0.03, '#5a1a1a');
	}
	ctx.restore();
}

export interface GoonPose {
	/** Seconds, for the waddle */
	time: number;
	dir: 1 | -1;
	/** 0 alive, up to 1 fully squashed */
	squash: number;
	/** Hops: stretched while in the air */
	airborne: boolean;
}

/** A rig-guard goon, 0.8 tiles wide, feet at (x, y) */
export function drawGoon(ctx: Ctx, x: number, y: number, pose: GoonPose) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(pose.dir * -1, 1 - pose.squash * 0.7);
	const waddle = pose.squash > 0 ? 0 : Math.sin(pose.time * 12) * 0.05;
	ctx.translate(0, pose.airborne ? -0.05 : 0);
	// Feet
	ellipse(ctx, -0.17 + waddle, -0.05, 0.12, 0.06, '#222');
	ellipse(ctx, 0.17 - waddle, -0.05, 0.12, 0.06, '#222');
	// Body
	ellipse(ctx, 0, -0.34, 0.34, 0.3, NAVY);
	// Reflective vest stripe
	ctx.beginPath();
	ctx.rect(-0.3, -0.32, 0.6, 0.08);
	stroke(ctx, '#c7d94a', 0.04);
	// Hard hat
	ctx.beginPath();
	ctx.arc(0, -0.56, 0.24, Math.PI, 0);
	ctx.closePath();
	stroke(ctx, YELLOW);
	roundRect(ctx, -0.3, -0.58, 0.6, 0.07, 0.03, YELLOW);
	// Sunglasses and a frown
	roundRect(ctx, -0.22, -0.5, 0.44, 0.1, 0.04, INK);
	ctx.beginPath();
	ctx.moveTo(-0.1, -0.28);
	ctx.quadraticCurveTo(0, -0.34, 0.1, -0.28);
	ctx.lineWidth = 0.05;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.restore();
}

/** Stars that pop out of a squashed goon */
export function drawStars(ctx: Ctx, x: number, y: number, age: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = YELLOW;
	for (let i = 0; i < 4; i++) {
		const angle = (i / 4) * Math.PI * 2 + age * 6;
		const radius = 0.15 + age * 0.9;
		ctx.beginPath();
		ctx.arc(
			Math.cos(angle) * radius,
			Math.sin(angle) * radius * 0.6 - age * 0.3,
			0.06,
			0,
			Math.PI * 2
		);
		stroke(ctx, YELLOW, 0.03);
	}
	ctx.restore();
}

/** A helicopter, centered on (x, y) */
export function drawHelicopter(ctx: Ctx, x: number, y: number, time: number, warning: boolean) {
	ctx.save();
	ctx.translate(x, y);
	// Tail boom and rotor
	ctx.beginPath();
	ctx.moveTo(0.3, -0.05);
	ctx.lineTo(0.85, -0.12);
	ctx.lineTo(0.85, 0.02);
	ctx.lineTo(0.3, 0.1);
	ctx.closePath();
	stroke(ctx, '#9a3036');
	const tailSpin = Math.sin(time * 50) * 0.16;
	ctx.beginPath();
	ctx.moveTo(0.85, -0.05 - tailSpin);
	ctx.lineTo(0.85, -0.05 + tailSpin);
	ctx.lineWidth = 0.05;
	ctx.strokeStyle = INK;
	ctx.stroke();
	// Skids
	ctx.beginPath();
	ctx.moveTo(-0.34, 0.34);
	ctx.lineTo(0.34, 0.34);
	ctx.moveTo(-0.18, 0.2);
	ctx.lineTo(-0.2, 0.34);
	ctx.moveTo(0.18, 0.2);
	ctx.lineTo(0.2, 0.34);
	ctx.lineWidth = 0.05;
	ctx.stroke();
	// Cabin
	ellipse(ctx, 0, 0.02, 0.42, 0.3, RED);
	ctx.beginPath();
	ctx.ellipse(-0.14, -0.02, 0.2, 0.15, 0, Math.PI, Math.PI * 2.3);
	ctx.closePath();
	stroke(ctx, '#bfe6ff', 0.04);
	// A round cartoon patch
	ctx.beginPath();
	ctx.arc(0.2, 0.08, 0.08, 0, Math.PI * 2);
	stroke(ctx, PAPER, 0.03);
	// Mast and the spinning main rotor (it flickers between wide and narrow)
	ctx.beginPath();
	ctx.moveTo(0, -0.26);
	ctx.lineTo(0, -0.38);
	ctx.lineWidth = 0.06;
	ctx.stroke();
	const span = 0.78 * (0.55 + 0.45 * Math.abs(Math.sin(time * 30)));
	ctx.beginPath();
	ctx.moveTo(-span, -0.4);
	ctx.lineTo(span, -0.4);
	ctx.lineWidth = 0.07;
	ctx.stroke();
	if (warning) {
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.roundRect(-0.06, -1.0, 0.12, 0.34, 0.05);
		stroke(ctx, RED, 0.04);
		ctx.beginPath();
		ctx.arc(0, -0.55, 0.07, 0, Math.PI * 2);
		stroke(ctx, RED, 0.04);
	}
	ctx.restore();
}

/** An oil barrel, 0.6 tiles tall, standing on (x, y) */
export function drawBarrel(ctx: Ctx, x: number, y: number, shine = 0) {
	ctx.save();
	ctx.translate(x, y);
	roundRect(ctx, -0.22, -0.58, 0.44, 0.58, 0.07, '#2b3a55');
	for (const band of [-0.44, -0.12]) {
		ctx.beginPath();
		ctx.rect(-0.22, band, 0.44, 0.07);
		stroke(ctx, '#4a5f86', 0.035);
	}
	// A yellow drop
	ctx.beginPath();
	ctx.moveTo(0, -0.4);
	ctx.quadraticCurveTo(0.1, -0.26, 0, -0.2);
	ctx.quadraticCurveTo(-0.1, -0.26, 0, -0.4);
	stroke(ctx, YELLOW, 0.03);
	// Glint
	ctx.globalAlpha = 0.45 + 0.4 * shine;
	ctx.beginPath();
	ctx.moveTo(-0.14, -0.5);
	ctx.lineTo(-0.14, -0.3);
	ctx.lineWidth = 0.05;
	ctx.strokeStyle = PAPER;
	ctx.stroke();
	ctx.restore();
}

/** The flag: a pole three and a half tiles tall standing on (x, y) with a waving red banner */
export function drawFlag(ctx: Ctx, x: number, y: number, time: number, reached: boolean) {
	ctx.save();
	ctx.translate(x, y);
	roundRect(ctx, -0.22, -0.18, 0.44, 0.18, 0.04, SLATE);
	ctx.beginPath();
	ctx.moveTo(0, -0.18);
	ctx.lineTo(0, -3);
	ctx.lineWidth = 0.09;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.lineWidth = 0.04;
	ctx.strokeStyle = '#d9d9d9';
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, -3.05, 0.1, 0, Math.PI * 2);
	stroke(ctx, YELLOW, 0.04);
	// The banner, rippling; it rises to the top when the level is won
	const top = reached ? -2.9 : -2.35;
	ctx.beginPath();
	ctx.moveTo(0.04, top);
	for (let i = 0; i <= 6; i++) {
		const t = i / 6;
		ctx.lineTo(0.04 + t * 1.0, top + Math.sin(time * 5 + t * 5) * 0.06 * t);
	}
	for (let i = 6; i >= 0; i--) {
		const t = i / 6;
		ctx.lineTo(0.04 + t * 1.0, top + 0.7 + Math.sin(time * 5 + t * 5) * 0.06 * t);
	}
	ctx.closePath();
	stroke(ctx, RED, 0.05);
	// A yellow oil drop on the banner
	ctx.beginPath();
	ctx.moveTo(0.4, top + 0.16);
	ctx.quadraticCurveTo(0.52, top + 0.34, 0.4, top + 0.5);
	ctx.quadraticCurveTo(0.28, top + 0.34, 0.4, top + 0.16);
	stroke(ctx, YELLOW, 0.035);
	ctx.restore();
}

/** A checkpoint lamp: a post with a lantern that glows once lit */
export function drawLamp(ctx: Ctx, x: number, y: number, lit: boolean) {
	ctx.save();
	ctx.translate(x, y);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(0, -0.85);
	ctx.lineWidth = 0.08;
	ctx.strokeStyle = INK;
	ctx.stroke();
	if (lit) {
		const glow = ctx.createRadialGradient(0, -0.95, 0.05, 0, -0.95, 0.7);
		glow.addColorStop(0, 'rgba(245, 200, 58, 0.7)');
		glow.addColorStop(1, 'rgba(245, 200, 58, 0)');
		ctx.fillStyle = glow;
		ctx.fillRect(-0.7, -1.65, 1.4, 1.4);
	}
	roundRect(ctx, -0.14, -1.1, 0.28, 0.3, 0.06, lit ? YELLOW : '#9a9a9a');
	ctx.restore();
}

/** A barbed-wire barricade filling one tile */
export function drawSpikes(ctx: Ctx, x: number, y: number) {
	ctx.save();
	ctx.translate(x, y);
	for (let i = 0; i < 3; i++) {
		const cx = 0.17 + i * 0.33;
		ctx.beginPath();
		ctx.moveTo(cx - 0.15, 1);
		ctx.lineTo(cx, 0.45);
		ctx.lineTo(cx + 0.15, 1);
		ctx.closePath();
		stroke(ctx, '#8d949c', 0.045);
	}
	ctx.beginPath();
	ctx.moveTo(0.02, 0.78);
	ctx.lineTo(0.98, 0.78);
	ctx.lineWidth = 0.04;
	ctx.strokeStyle = INK;
	ctx.stroke();
	ctx.restore();
}

/** A mystery block filling one tile; `hop` is the seconds since it was bumped */
export function drawBlock(ctx: Ctx, x: number, y: number, used: boolean, hop: number) {
	ctx.save();
	const lift = hop < 0.18 ? Math.sin((hop / 0.18) * Math.PI) * 0.28 : 0;
	ctx.translate(x, y - lift);
	roundRect(ctx, 0.03, 0.03, 0.94, 0.94, 0.1, used ? '#a98b62' : YELLOW);
	ctx.fillStyle = INK;
	for (const [cx, cy] of [
		[0.16, 0.16],
		[0.84, 0.16],
		[0.16, 0.84],
		[0.84, 0.84]
	]) {
		ctx.beginPath();
		ctx.arc(cx, cy, 0.04, 0, Math.PI * 2);
		ctx.fill();
	}
	if (!used) {
		// A question mark, white with an ink outline
		const mark = () => {
			ctx.beginPath();
			ctx.arc(0.5, 0.38, 0.15, Math.PI, Math.PI * 2.35);
			ctx.quadraticCurveTo(0.5, 0.56, 0.5, 0.64);
		};
		ctx.lineCap = 'round';
		mark();
		ctx.lineWidth = 0.19;
		ctx.strokeStyle = INK;
		ctx.stroke();
		mark();
		ctx.lineWidth = 0.09;
		ctx.strokeStyle = PAPER;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(0.5, 0.8, 0.075, 0, Math.PI * 2);
		stroke(ctx, PAPER, 0.04);
	}
	ctx.restore();
}

/** A spring pad on the floor of the tile at (x, y) */
export function drawSpring(ctx: Ctx, x: number, y: number) {
	ctx.save();
	ctx.translate(x, y);
	roundRect(ctx, 0.1, 0.86, 0.8, 0.14, 0.05, SLATE);
	const coil = () => {
		ctx.beginPath();
		ctx.moveTo(0.28, 0.86);
		ctx.lineTo(0.72, 0.79);
		ctx.lineTo(0.28, 0.72);
		ctx.lineTo(0.72, 0.65);
		ctx.lineTo(0.28, 0.58);
		ctx.lineTo(0.5, 0.54);
	};
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	coil();
	ctx.lineWidth = 0.13;
	ctx.strokeStyle = INK;
	ctx.stroke();
	coil();
	ctx.lineWidth = 0.065;
	ctx.strokeStyle = '#d5dbe3';
	ctx.stroke();
	roundRect(ctx, 0.12, 0.4, 0.76, 0.15, 0.06, RED);
	ctx.restore();
}

/** A hover barge, its left edge at x and the top of the plank at y, with jets of flame below */
export function drawBarge(ctx: Ctx, x: number, y: number, width: number, time: number) {
	ctx.save();
	ctx.translate(x, y);
	for (const jet of [0.5, width - 0.5]) {
		const flick = 0.34 + 0.08 * Math.sin(time * 34 + jet * 3);
		ctx.beginPath();
		ctx.moveTo(jet - 0.13, 0.3);
		ctx.quadraticCurveTo(jet - 0.09, 0.3 + flick * 0.6, jet, 0.3 + flick);
		ctx.quadraticCurveTo(jet + 0.09, 0.3 + flick * 0.6, jet + 0.13, 0.3);
		ctx.closePath();
		stroke(ctx, '#ffb347', 0.04);
		ctx.beginPath();
		ctx.ellipse(jet, 0.34, 0.04, 0.09, 0, 0, Math.PI * 2);
		ctx.fillStyle = YELLOW;
		ctx.fill();
		roundRect(ctx, jet - 0.15, 0.24, 0.3, 0.12, 0.04, NAVY);
	}
	roundRect(ctx, 0, 0, width, 0.3, 0.09, SLATE);
	ctx.fillStyle = YELLOW;
	for (let i = 0; i < Math.floor((width - 0.2) / 0.4); i++) {
		ctx.fillRect(0.14 + i * 0.4, 0.07, 0.2, 0.09);
	}
	ctx.restore();
}

/** A booster, centered on (x, y) and about 0.6 tiles across; `time` makes the sparkle twinkle */
export function drawBooster(ctx: Ctx, kind: BoosterKind, x: number, y: number, time = 0) {
	ctx.save();
	ctx.translate(x, y);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	if (kind === 'arepa') {
		ellipse(ctx, 0, 0, 0.3, 0.26, '#e6b866');
		ctx.beginPath();
		ctx.moveTo(0, 0.13);
		ctx.bezierCurveTo(-0.22, -0.02, -0.12, -0.2, 0, -0.08);
		ctx.bezierCurveTo(0.12, -0.2, 0.22, -0.02, 0, 0.13);
		stroke(ctx, RED, 0.04);
	} else if (kind === 'turbo') {
		ctx.beginPath();
		ctx.moveTo(-0.1, -0.2);
		ctx.quadraticCurveTo(-0.16, -0.28, -0.08, -0.34);
		ctx.moveTo(0.04, -0.2);
		ctx.quadraticCurveTo(-0.02, -0.28, 0.06, -0.34);
		ctx.lineWidth = 0.04;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(0.18, 0.04, 0.1, -Math.PI / 2, Math.PI / 2);
		stroke(ctx, null, 0.06);
		roundRect(ctx, -0.22, -0.14, 0.4, 0.38, 0.08, PAPER);
		ellipse(ctx, -0.02, -0.14, 0.2, 0.05, '#6b3b1e');
		ctx.beginPath();
		ctx.moveTo(0.02, -0.04);
		ctx.lineTo(-0.1, 0.1);
		ctx.lineTo(-0.01, 0.1);
		ctx.lineTo(-0.07, 0.2);
		ctx.lineTo(0.08, 0.04);
		ctx.lineTo(-0.01, 0.04);
		ctx.closePath();
		stroke(ctx, YELLOW, 0.03);
	} else if (kind === 'boots') {
		ctx.beginPath();
		ctx.moveTo(-0.18, -0.26);
		ctx.lineTo(0.06, -0.26);
		ctx.lineTo(0.06, -0.04);
		ctx.lineTo(0.28, 0.02);
		ctx.lineTo(0.28, 0.1);
		ctx.lineTo(-0.18, 0.1);
		ctx.closePath();
		stroke(ctx, RED, 0.05);
		ctx.beginPath();
		ctx.moveTo(-0.14, 0.1);
		ctx.lineTo(0.14, 0.15);
		ctx.lineTo(-0.14, 0.2);
		ctx.lineTo(0.14, 0.25);
		ctx.lineTo(-0.14, 0.3);
		ctx.lineWidth = 0.1;
		ctx.strokeStyle = INK;
		ctx.stroke();
		ctx.lineWidth = 0.04;
		ctx.strokeStyle = '#d5dbe3';
		ctx.stroke();
	} else {
		// The golden mustache
		ctx.beginPath();
		ctx.moveTo(-0.32, -0.04);
		ctx.quadraticCurveTo(-0.2, -0.2, 0, -0.08);
		ctx.quadraticCurveTo(0.2, -0.2, 0.32, -0.04);
		ctx.quadraticCurveTo(0.28, 0.16, 0.1, 0.06);
		ctx.quadraticCurveTo(0, 0.02, -0.1, 0.06);
		ctx.quadraticCurveTo(-0.28, 0.16, -0.32, -0.04);
		ctx.closePath();
		stroke(ctx, '#ffd23f', 0.05);
		const glint = 0.05 + 0.04 * Math.abs(Math.sin(time * 6));
		ctx.beginPath();
		ctx.moveTo(0.3, -0.3 - glint);
		ctx.lineTo(0.3 + glint * 0.35, -0.3 - glint * 0.35);
		ctx.lineTo(0.3 + glint, -0.3);
		ctx.lineTo(0.3 + glint * 0.35, -0.3 + glint * 0.35);
		ctx.lineTo(0.3, -0.3 + glint);
		ctx.lineTo(0.3 - glint * 0.35, -0.3 + glint * 0.35);
		ctx.lineTo(0.3 - glint, -0.3);
		ctx.lineTo(0.3 - glint * 0.35, -0.3 - glint * 0.35);
		ctx.closePath();
		stroke(ctx, PAPER, 0.025);
	}
	ctx.restore();
}

export interface AuraPose {
	facing: 1 | -1;
	time: number;
	/** The golden mustache is on: a shifting rainbow glow */
	star: boolean;
	/** Fading out, so the glow blinks */
	ending: boolean;
	/** Turbo is on and the hero is moving: speed lines behind */
	speed: boolean;
}

/** The glow and the speed lines behind the hero, drawn before him */
export function drawAura(ctx: Ctx, x: number, y: number, pose: AuraPose) {
	ctx.save();
	if (pose.star && !(pose.ending && Math.floor(pose.time * 10) % 2 === 0)) {
		const hue = (pose.time * 540) % 360;
		const glow = ctx.createRadialGradient(x, y - 0.5, 0.1, x, y - 0.5, 0.95);
		glow.addColorStop(0, `hsla(${hue}, 100%, 65%, 0.8)`);
		glow.addColorStop(0.6, `hsla(${(hue + 70) % 360}, 100%, 60%, 0.35)`);
		glow.addColorStop(1, `hsla(${(hue + 140) % 360}, 100%, 60%, 0)`);
		ctx.fillStyle = glow;
		ctx.fillRect(x - 1, y - 1.5, 2, 2);
	}
	if (pose.speed) {
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.lineWidth = 0.05;
		ctx.lineCap = 'round';
		for (let i = 0; i < 3; i++) {
			const length = 0.45 + 0.25 * Math.abs(Math.sin(pose.time * 14 + i * 2));
			const ly = y - 0.25 - i * 0.22;
			ctx.beginPath();
			ctx.moveTo(x - pose.facing * 0.4, ly);
			ctx.lineTo(x - pose.facing * (0.4 + length), ly);
			ctx.stroke();
		}
	}
	ctx.restore();
}

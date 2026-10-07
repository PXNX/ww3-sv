/*
 * Original cartoon figures for Spokesperson Whack, drawn with canvas paths. Every figure is a
 * generic archetype (no real person, no real insignia): origin at the feet, centered, standing up
 * to about 78 units high and 64 wide. Flat fills with a thick ink outline.
 */
import type { MoleKind } from './config';

export const INK = '#111111';
export const PAPER = '#ffffff';
export const SAND = '#e8e1bc';
export const TIE_RED = '#e5484d';
export const YELLOW = '#f5c83a';

const SKIN = '#f2c9a0';
const SKIN_DARK = '#d9a77c';

export interface Pose {
	/** Seconds, for the mouth and the dazed stars */
	seconds: number;
	/** Skip the flapping: a half-open mouth and still stars */
	calm: boolean;
	/** Per-figure phase so mouths do not all move in step */
	phase: number;
	/** Whether the figure is making its statement (the mouth moves) */
	talking: boolean;
	/** Bonked: crossed-out eyes, circling stars, tilted head */
	dazed: boolean;
}

export const CALM_POSE: Pose = { seconds: 0, calm: true, phase: 0, talking: true, dazed: false };

type Point = readonly [number, number];

function outline(ctx: CanvasRenderingContext2D, fill: string, width = 2.5) {
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.lineWidth = width;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.strokeStyle = INK;
	ctx.stroke();
}

function polygon(
	ctx: CanvasRenderingContext2D,
	points: readonly Point[],
	fill: string,
	width = 2.5
) {
	ctx.beginPath();
	ctx.moveTo(points[0][0], points[0][1]);
	for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
	ctx.closePath();
	outline(ctx, fill, width);
}

function ellipse(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	rx: number,
	ry: number,
	fill: string,
	width = 2.5
) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	outline(ctx, fill, width);
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
	fill: string,
	lineWidth = 2.5
) {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	outline(ctx, fill, lineWidth);
}

function line(ctx: CanvasRenderingContext2D, a: Point, b: Point, width = 2.5, color = INK) {
	ctx.beginPath();
	ctx.moveTo(a[0], a[1]);
	ctx.lineTo(b[0], b[1]);
	ctx.lineWidth = width;
	ctx.lineCap = 'round';
	ctx.strokeStyle = color;
	ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string) {
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? radius : radius * 0.45;
		const angle = (Math.PI / 5) * i - Math.PI / 2;
		const px = x + Math.cos(angle) * r;
		const py = y + Math.sin(angle) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	outline(ctx, fill, 1.5);
}

/** How wide the mouth is open: 0 shut to 1 wide */
function mouthOpen(pose: Pose): number {
	if (!pose.talking) return 0;
	if (pose.calm) return 0.6;
	return 0.5 + 0.5 * Math.sin(pose.seconds * 15 + pose.phase);
}

type Mood = 'talk' | 'smile';

/** Eyes and mouth on a face centered at (0, y); r is the face radius */
function drawFace(ctx: CanvasRenderingContext2D, y: number, r: number, mood: Mood, pose: Pose) {
	const eyeY = y - r * 0.12;
	const eyeX = r * 0.42;
	if (pose.dazed) {
		for (const side of [-1, 1]) {
			const cx = side * eyeX;
			line(ctx, [cx - 3, eyeY - 3], [cx + 3, eyeY + 3], 2);
			line(ctx, [cx - 3, eyeY + 3], [cx + 3, eyeY - 3], 2);
		}
		ctx.beginPath();
		ctx.moveTo(-5, y + r * 0.5);
		ctx.quadraticCurveTo(-2.5, y + r * 0.3, 0, y + r * 0.5);
		ctx.quadraticCurveTo(2.5, y + r * 0.7, 5, y + r * 0.5);
		ctx.lineWidth = 2;
		ctx.strokeStyle = INK;
		ctx.stroke();
		return;
	}
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.arc(side * eyeX, eyeY, 2.2, 0, Math.PI * 2);
		ctx.fillStyle = INK;
		ctx.fill();
	}
	if (mood === 'smile') {
		ctx.beginPath();
		ctx.arc(0, y + r * 0.2, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
		ctx.lineWidth = 2.2;
		ctx.lineCap = 'round';
		ctx.strokeStyle = INK;
		ctx.stroke();
		return;
	}
	const open = mouthOpen(pose);
	ctx.beginPath();
	ctx.ellipse(0, y + r * 0.5, r * 0.34, 1.5 + open * r * 0.3, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#7a1f2b';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
}

function drawHead(
	ctx: CanvasRenderingContext2D,
	y: number,
	r: number,
	mood: Mood,
	pose: Pose,
	hair?: string
) {
	ctx.save();
	if (pose.dazed) {
		ctx.translate(0, y);
		ctx.rotate(0.22);
		ctx.translate(0, -y);
	}
	ellipse(ctx, 0, y, r, r * 1.05, SKIN);
	for (const side of [-1, 1]) ellipse(ctx, side * r, y + 1, 3, 4, SKIN_DARK, 2);
	if (hair) {
		ctx.beginPath();
		ctx.arc(0, y - 1, r + 0.5, Math.PI * 1.04, Math.PI * 1.96);
		ctx.closePath();
		outline(ctx, hair, 2.5);
	}
	drawFace(ctx, y, r, mood, pose);
	ctx.restore();
}

function drawDazedStars(ctx: CanvasRenderingContext2D, y: number, pose: Pose) {
	for (let i = 0; i < 3; i++) {
		const angle = (pose.calm ? 0 : pose.seconds * 6) + (i * Math.PI * 2) / 3;
		star(ctx, Math.cos(angle) * 22, y + Math.sin(angle) * 6, 5, YELLOW);
	}
}

function drawSpokesperson(ctx: CanvasRenderingContext2D, pose: Pose) {
	// Dark suit, white shirt and a red tie, a microphone held up beside the face
	roundRect(ctx, -27, -42, 54, 46, 11, '#3d4f7a');
	polygon(
		ctx,
		[
			[-9, -42],
			[9, -42],
			[0, -22]
		],
		PAPER,
		2
	);
	polygon(
		ctx,
		[
			[-3, -38],
			[3, -38],
			[4, -26],
			[0, -18],
			[-4, -26]
		],
		TIE_RED,
		1.8
	);
	line(ctx, [20, -18], [16, -38], 3);
	ellipse(ctx, 15, -42, 5, 5, '#9aa3ad', 2);
	drawHead(ctx, -56, 15, 'talk', pose, '#3b2a20');
}

function drawOfficial(ctx: CanvasRenderingContext2D, pose: Pose) {
	// Uniform with epaulettes and a row of round medals, under a big peaked cap
	roundRect(ctx, -28, -42, 56, 46, 10, '#6f7d55');
	roundRect(ctx, -30, -44, 16, 8, 3, YELLOW, 2);
	roundRect(ctx, 14, -44, 16, 8, 3, YELLOW, 2);
	for (const [x, y, color] of [
		[-14, -26, YELLOW],
		[-7, -24, TIE_RED],
		[0, -26, YELLOW],
		[7, -24, '#4fa8d8']
	] as const) {
		ellipse(ctx, x, y, 3.2, 3.2, color, 1.5);
	}
	drawHead(ctx, -54, 15, 'talk', pose);
	// Stern eyebrows
	if (!pose.dazed) {
		line(ctx, [-11, -64], [-3, -60], 2.6);
		line(ctx, [11, -64], [3, -60], 2.6);
	}
	// The cap: flat top, dark band, plain round badge and a shiny visor
	polygon(
		ctx,
		[
			[-15, -62],
			[-20, -77],
			[20, -77],
			[15, -62]
		],
		'#56633f',
		2.5
	);
	ellipse(ctx, 0, -77, 20, 5, '#6f7d55', 2.5);
	roundRect(ctx, -16, -69, 32, 7, 2, '#2c3320', 2);
	ellipse(ctx, 0, -66, 3.2, 3.2, YELLOW, 1.5);
	roundRect(ctx, -15, -63, 30, 4, 2, INK, 1.5);
}

function drawTalkingHead(ctx: CanvasRenderingContext2D, pose: Pose) {
	// A tiny TV set with rabbit ears; the head lives on the screen
	line(ctx, [0, -66], [-16, -80], 2.5);
	line(ctx, [0, -66], [16, -80], 2.5);
	ellipse(ctx, -16, -80, 2.8, 2.8, '#9aa3ad', 1.5);
	ellipse(ctx, 16, -80, 2.8, 2.8, '#9aa3ad', 1.5);
	roundRect(ctx, -32, -68, 64, 66, 10, '#9aa3ad');
	roundRect(ctx, -26, -62, 52, 42, 7, '#bfe3f2', 2);

	ctx.save();
	ctx.beginPath();
	ctx.roundRect(-26, -62, 52, 42, 7);
	ctx.clip();
	roundRect(ctx, -19, -34, 38, 24, 9, '#3d4f7a', 2);
	polygon(
		ctx,
		[
			[-4, -34],
			[4, -34],
			[0, -26]
		],
		TIE_RED,
		1.5
	);
	drawHead(ctx, -44, 12, 'talk', pose, '#d8d2c4');
	ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
	for (let y = -60; y < -20; y += 6) ctx.fillRect(-26, y, 52, 1.6);
	ctx.restore();
	ctx.beginPath();
	ctx.roundRect(-26, -62, 52, 42, 7);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();

	ellipse(ctx, -14, -11, 3.5, 3.5, TIE_RED, 1.5);
	ellipse(ctx, -4, -11, 3.5, 3.5, YELLOW, 1.5);
	line(ctx, [8, -11], [24, -11], 2);
}

function drawJournalist(ctx: CanvasRenderingContext2D, pose: Pose) {
	// Friendly reporter: trench coat, a camera round the neck and a hat with a card in the band
	roundRect(ctx, -27, -42, 54, 46, 11, '#c9a66b');
	polygon(
		ctx,
		[
			[-10, -42],
			[0, -26],
			[-14, -22]
		],
		'#a8864f',
		1.8
	);
	polygon(
		ctx,
		[
			[10, -42],
			[0, -26],
			[14, -22]
		],
		'#a8864f',
		1.8
	);
	roundRect(ctx, -12, -30, 24, 16, 3, '#33363b', 2);
	ellipse(ctx, 0, -22, 5.5, 5.5, '#bfe3f2', 2);
	roundRect(ctx, -9, -33, 8, 4, 1, '#9aa3ad', 1.5);
	drawHead(ctx, -55, 15, 'smile', pose);
	ellipse(ctx, 0, -66, 22, 5, '#8b6b43', 2.5);
	roundRect(ctx, -13, -80, 26, 16, 6, '#a07a4b', 2.5);
	roundRect(ctx, -13, -70, 26, 5, 1, '#33363b', 1.5);
	roundRect(ctx, 3, -78, 8, 9, 1, PAPER, 1.5);
	line(ctx, [5, -75], [9, -75], 1.2);
	line(ctx, [5, -72], [9, -72], 1.2);
}

function drawAidWorker(ctx: CanvasRenderingContext2D, pose: Pose) {
	// Aid worker: hi-vis vest, a cap and a crate of bread
	roundRect(ctx, -27, -42, 54, 46, 11, '#5c8f9a');
	polygon(
		ctx,
		[
			[-23, -42],
			[-9, -42],
			[-6, 4],
			[-27, 4]
		],
		'#d6e84a',
		2
	);
	polygon(
		ctx,
		[
			[23, -42],
			[9, -42],
			[6, 4],
			[27, 4]
		],
		'#d6e84a',
		2
	);
	line(ctx, [-24, -22], [-7, -22], 2, PAPER);
	line(ctx, [24, -22], [7, -22], 2, PAPER);
	drawHead(ctx, -56, 15, 'smile', pose);
	// Cap
	ctx.beginPath();
	ctx.arc(0, -58, 15.5, Math.PI * 1.02, Math.PI * 1.98);
	ctx.closePath();
	outline(ctx, '#4f8a4f', 2.5);
	roundRect(ctx, -1, -64, 20, 4, 2, '#3f6f3f', 2);
	// The crate with loaves
	ellipse(ctx, -5, -24, 8, 4.5, '#d9a35a', 1.8);
	ellipse(ctx, 6, -25, 8, 4.5, '#e6b46a', 1.8);
	roundRect(ctx, -17, -20, 34, 22, 3, '#b98a50', 2.2);
	line(ctx, [-17, -12], [17, -12], 1.6);
	line(ctx, [-17, -5], [17, -5], 1.6);
}

/**
 * Draws one figure standing with its feet at the origin. The caller clips it to the podium, so
 * a figure that has only half risen simply shows its upper half.
 */
export function drawFigure(ctx: CanvasRenderingContext2D, kind: MoleKind, pose: Pose) {
	switch (kind) {
		case 'spokesperson':
			drawSpokesperson(ctx, pose);
			break;
		case 'official':
			drawOfficial(ctx, pose);
			break;
		case 'talkinghead':
			drawTalkingHead(ctx, pose);
			break;
		case 'journalist':
			drawJournalist(ctx, pose);
			break;
		case 'aidworker':
			drawAidWorker(ctx, pose);
			break;
	}
	if (pose.dazed) drawDazedStars(ctx, -84, pose);
}

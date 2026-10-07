/*
 * Original cartoon silhouettes for Radar Slice, drawn with canvas paths. Every shape is centered
 * on (0, 0), faces +x and fits a circle of the given radius (a little more for fins and flames).
 * Flat fills with a thick ink outline, no faces on people, no markings of any real unit.
 */
import type { FlyerKind } from './config';

export const INK = '#111111';
export const PAPER = '#ffffff';
export const SAND = '#e8e1bc';
export const FLAG_BLUE = '#4fa8d8';
export const TIE_RED = '#e5484d';
export const YELLOW = '#f5c83a';
export const MUSTARD = '#ddb93c';
export const OLIVE = '#8c9d69';
export const SLATE = '#6b7a8c';
export const STEEL = '#8fa0b3';

export interface Pose {
	/** Seconds, for flames and wing beats */
	seconds: number;
	/** Skip the flicker and flapping */
	calm: boolean;
}

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

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string) {
	ctx.beginPath();
	ctx.moveTo(points[0][0], points[0][1]);
	for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
	ctx.closePath();
	outline(ctx, fill);
}

function ellipse(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	rx: number,
	ry: number,
	fill: string
) {
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	outline(ctx, fill);
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
	fill: string
) {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	outline(ctx, fill);
}

/** A little exhaust flame behind a missile, pointing to -x from (x, 0) */
function flame(ctx: CanvasRenderingContext2D, x: number, length: number, pose: Pose) {
	const flicker = pose.calm ? 1 : 0.8 + 0.25 * Math.sin(pose.seconds * 38);
	const long = length * flicker;
	ctx.beginPath();
	ctx.moveTo(x, -length * 0.3);
	ctx.quadraticCurveTo(x - long * 0.6, -length * 0.35, x - long, 0);
	ctx.quadraticCurveTo(x - long * 0.6, length * 0.35, x, length * 0.3);
	ctx.closePath();
	outline(ctx, YELLOW, 2);
	ctx.beginPath();
	ctx.moveTo(x, -length * 0.14);
	ctx.lineTo(x - long * 0.5, 0);
	ctx.lineTo(x, length * 0.14);
	ctx.closePath();
	ctx.fillStyle = TIE_RED;
	ctx.fill();
}

/** Zircon: a slim, fast, dark needle with four small fins */
function zircon(ctx: CanvasRenderingContext2D, r: number, pose: Pose) {
	flame(ctx, -r * 0.95, r * 1.1, pose);
	for (const side of [-1, 1]) {
		polygon(
			ctx,
			[
				[-r * 0.95, side * r * 0.25],
				[-r * 1.05, side * r * 0.85],
				[-r * 0.4, side * r * 0.25]
			],
			TIE_RED
		);
	}
	ctx.beginPath();
	ctx.moveTo(-r, -r * 0.27);
	ctx.lineTo(r * 0.3, -r * 0.27);
	ctx.quadraticCurveTo(r * 0.8, -r * 0.2, r * 1.15, 0);
	ctx.quadraticCurveTo(r * 0.8, r * 0.2, r * 0.3, r * 0.27);
	ctx.lineTo(-r, r * 0.27);
	ctx.closePath();
	outline(ctx, SLATE);
	polygon(
		ctx,
		[
			[r * 0.72, -r * 0.14],
			[r * 1.15, 0],
			[r * 0.72, r * 0.14]
		],
		TIE_RED
	);
	roundRect(ctx, -r * 0.35, -r * 0.27, r * 0.22, r * 0.54, 0, PAPER);
}

/** Kinzhal: a chunky body with big swept wings and a yellow band */
function kinzhal(ctx: CanvasRenderingContext2D, r: number, pose: Pose) {
	flame(ctx, -r * 0.95, r * 1, pose);
	for (const side of [-1, 1]) {
		polygon(
			ctx,
			[
				[r * 0.1, side * r * 0.3],
				[-r * 0.75, side * r * 1.05],
				[-r * 0.3, side * r * 0.3]
			],
			OLIVE
		);
	}
	ctx.beginPath();
	ctx.moveTo(-r, -r * 0.34);
	ctx.lineTo(r * 0.35, -r * 0.34);
	ctx.quadraticCurveTo(r * 0.85, -r * 0.3, r * 1.1, 0);
	ctx.quadraticCurveTo(r * 0.85, r * 0.3, r * 0.35, r * 0.34);
	ctx.lineTo(-r, r * 0.34);
	ctx.closePath();
	outline(ctx, '#a8b684');
	roundRect(ctx, r * 0.05, -r * 0.34, r * 0.2, r * 0.68, 0, YELLOW);
	polygon(
		ctx,
		[
			[r * 0.8, -r * 0.2],
			[r * 1.1, 0],
			[r * 0.8, r * 0.2]
		],
		TIE_RED
	);
}

/** Geran: a cartoon delta-wing drone with a pusher propeller */
function geran(ctx: CanvasRenderingContext2D, r: number, pose: Pose) {
	const blade = pose.calm ? 0.9 : Math.abs(Math.sin(pose.seconds * 45)) * 0.9 + 0.1;
	ctx.beginPath();
	ctx.moveTo(-r * 1.0, -r * blade * 0.7);
	ctx.lineTo(-r * 1.0, r * blade * 0.7);
	ctx.lineWidth = 3;
	ctx.strokeStyle = INK;
	ctx.stroke();
	polygon(
		ctx,
		[
			[r * 1.05, 0],
			[-r * 0.8, -r * 0.95],
			[-r * 0.55, 0],
			[-r * 0.8, r * 0.95]
		],
		'#e8dca8'
	);
	for (const side of [-1, 1]) {
		polygon(
			ctx,
			[
				[-r * 0.65, side * r * 0.62],
				[-r * 0.95, side * r * 0.95],
				[-r * 0.8, side * r * 0.5]
			],
			TIE_RED
		);
	}
	ellipse(ctx, r * 0.1, 0, r * 0.55, r * 0.17, '#f4ecc8');
	ctx.beginPath();
	ctx.arc(r * 0.55, 0, r * 0.07, 0, Math.PI * 2);
	ctx.fillStyle = INK;
	ctx.fill();
}

/** Kalibr: a long cylinder with a rounded nose, a white band and stubby wings */
function kalibr(ctx: CanvasRenderingContext2D, r: number, pose: Pose) {
	flame(ctx, -r * 1.0, r * 0.95, pose);
	for (const side of [-1, 1]) {
		polygon(
			ctx,
			[
				[-r * 0.1, side * r * 0.3],
				[-r * 0.5, side * r * 0.8],
				[-r * 0.7, side * r * 0.3]
			],
			STEEL
		);
	}
	ctx.beginPath();
	ctx.moveTo(-r, -r * 0.3);
	ctx.lineTo(r * 0.55, -r * 0.3);
	ctx.quadraticCurveTo(r * 1.15, -r * 0.28, r * 1.15, 0);
	ctx.quadraticCurveTo(r * 1.15, r * 0.28, r * 0.55, r * 0.3);
	ctx.lineTo(-r, r * 0.3);
	ctx.closePath();
	outline(ctx, '#5c86a8');
	roundRect(ctx, r * 0.15, -r * 0.3, r * 0.18, r * 0.6, 0, PAPER);
	roundRect(ctx, -r * 0.55, -r * 0.3, r * 0.1, r * 0.6, 0, PAPER);
}

/** Friendly tanker: a blue hull, two white tanks, a bridge and a yellow funnel */
function tanker(ctx: CanvasRenderingContext2D, r: number) {
	polygon(
		ctx,
		[
			[-r * 1.05, -r * 0.1],
			[r * 1.05, -r * 0.1],
			[r * 0.8, r * 0.5],
			[-r * 0.85, r * 0.5]
		],
		FLAG_BLUE
	);
	roundRect(ctx, -r * 0.8, -r * 0.5, r * 0.45, r * 0.4, r * 0.16, PAPER);
	roundRect(ctx, -r * 0.3, -r * 0.5, r * 0.45, r * 0.4, r * 0.16, PAPER);
	roundRect(ctx, r * 0.3, -r * 0.75, r * 0.5, r * 0.65, r * 0.06, SAND);
	roundRect(ctx, r * 0.4, -r * 0.62, r * 0.3, r * 0.14, 0, FLAG_BLUE);
	roundRect(ctx, r * 0.4, -r * 1.0, r * 0.14, r * 0.28, 0, YELLOW);
	ctx.beginPath();
	ctx.moveTo(-r * 0.95, r * 0.22);
	ctx.lineTo(r * 0.9, r * 0.22);
	ctx.lineWidth = 3;
	ctx.strokeStyle = YELLOW;
	ctx.stroke();
}

/** Party balloon with a shine, a knot and a curly string */
function balloon(ctx: CanvasRenderingContext2D, r: number) {
	ctx.beginPath();
	ctx.moveTo(0, r * 1.0);
	ctx.bezierCurveTo(r * 0.4, r * 1.3, -r * 0.4, r * 1.5, 0, r * 1.9);
	ctx.lineWidth = 2;
	ctx.strokeStyle = INK;
	ctx.stroke();
	polygon(
		ctx,
		[
			[0, r * 0.88],
			[-r * 0.16, r * 1.1],
			[r * 0.16, r * 1.1]
		],
		TIE_RED
	);
	ctx.beginPath();
	ctx.moveTo(0, r * 0.92);
	ctx.bezierCurveTo(r * 1.1, r * 0.5, r * 1.0, -r * 1.0, 0, -r * 1.0);
	ctx.bezierCurveTo(-r * 1.0, -r * 1.0, -r * 1.1, r * 0.5, 0, r * 0.92);
	ctx.closePath();
	outline(ctx, '#ff7b7f');
	ctx.beginPath();
	ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.14, r * 0.3, 0.5, 0, Math.PI * 2);
	ctx.fillStyle = PAPER;
	ctx.fill();
}

/** Gull: a white body with a yellow beak and flapping M-shaped wings */
function gull(ctx: CanvasRenderingContext2D, r: number, pose: Pose) {
	const flap = pose.calm ? 0.5 : 0.5 + 0.5 * Math.sin(pose.seconds * 14);
	const lift = -r * (0.15 + flap * 0.95);
	ctx.beginPath();
	ctx.moveTo(-r * 0.2, -r * 0.1);
	ctx.quadraticCurveTo(-r * 0.5, lift, -r * 1.0, lift * 0.8 + r * 0.1);
	ctx.quadraticCurveTo(-r * 0.4, lift * 0.35, r * 0.2, -r * 0.05);
	ctx.closePath();
	outline(ctx, '#dfe9f0');
	ellipse(ctx, 0, 0, r * 0.7, r * 0.3, PAPER);
	ellipse(ctx, r * 0.6, -r * 0.12, r * 0.24, r * 0.22, PAPER);
	polygon(
		ctx,
		[
			[r * 0.8, -r * 0.18],
			[r * 1.1, -r * 0.08],
			[r * 0.8, -r * 0.02]
		],
		YELLOW
	);
	ctx.beginPath();
	ctx.arc(r * 0.64, -r * 0.16, r * 0.05, 0, Math.PI * 2);
	ctx.fillStyle = INK;
	ctx.fill();
	polygon(
		ctx,
		[
			[-r * 0.6, -r * 0.05],
			[-r * 1.05, -r * 0.2],
			[-r * 1.0, r * 0.12]
		],
		'#dfe9f0'
	);
}

/** Draws one flyer silhouette at the origin, nose along +x */
export function drawSilhouette(
	ctx: CanvasRenderingContext2D,
	kind: FlyerKind,
	r: number,
	pose: Pose
) {
	ctx.save();
	switch (kind) {
		case 'zircon':
			zircon(ctx, r, pose);
			break;
		case 'kinzhal':
			kinzhal(ctx, r, pose);
			break;
		case 'geran':
			geran(ctx, r, pose);
			break;
		case 'kalibr':
			kalibr(ctx, r, pose);
			break;
		case 'tanker':
			tanker(ctx, r);
			break;
		case 'balloon':
			balloon(ctx, r);
			break;
		case 'gull':
			gull(ctx, r, pose);
			break;
	}
	ctx.restore();
}

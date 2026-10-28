/*
 * Builds brand/splash.svg and brand/splash-dark.svg, the Mini App loading-screen icons for light
 * and dark mode: just the bomb as one monochrome
 * outline, a single closed path (one M … Z) with no fill colour, so Telegram can colour it. Like
 * Telegram's sample (https://telegram.org/resources/web-app-icon-sample.svg) it only uses straight
 * lines and cubic curves (M, L, H, V, C, Z): arcs and quadratic curves are turned into cubics. The
 * outline runs up the cap, along the top of the fuse, around the spark's points, back down the
 * fuse and once around the body.
 *
 * Run with: bun scripts/generate-splash.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const round = (value: number) => Math.round(value * 10) / 10;
const point = (x: number, y: number) => `${round(x)} ${round(y)}`;

const BODY = { x: 248, y: 330, r: 160 };
const CAP = { left: 204, right: 292, top: 130, corner: 12 };
const SPARK = { x: 378, y: 70, outer: 46, inner: 19 };

// Where the cap's sides meet the body
const capJoin = BODY.y - Math.sqrt(BODY.r ** 2 - ((CAP.right - CAP.left) / 2) ** 2);

/** A rounded corner as a cubic curve: from the current point via the corner to `to` */
function corner(
	cx: number,
	cy: number,
	toX: number,
	toY: number,
	fromX: number,
	fromY: number
): string {
	const k = 0.5523;
	return `C${point(fromX + (cx - fromX) * k, fromY + (cy - fromY) * k)} ${point(toX + (cx - toX) * k, toY + (cy - toY) * k)} ${point(toX, toY)}`;
}

/** The body from one angle to another (degrees, clockwise on screen) as cubic curves */
function bodyArc(from: number, to: number): string {
	const segments = Math.ceil((to - from) / 90);
	const step = (to - from) / segments;
	const k = (4 / 3) * Math.tan((step * Math.PI) / 720) * BODY.r;
	const at = (angle: number) => {
		const radians = (angle * Math.PI) / 180;
		return {
			x: BODY.x + BODY.r * Math.cos(radians),
			y: BODY.y + BODY.r * Math.sin(radians),
			radians
		};
	};
	const parts: string[] = [];
	for (let i = 0; i < segments; i++) {
		const a = at(from + step * i);
		const b = at(from + step * (i + 1));
		// Tangents point along the direction of travel (clockwise on screen)
		const c1 = point(a.x - k * Math.sin(a.radians), a.y + k * Math.cos(a.radians));
		const c2 = point(b.x + k * Math.sin(b.radians), b.y - k * Math.cos(b.radians));
		parts.push(`C${c1} ${c2} ${point(b.x, b.y)}`);
	}
	return parts.join('');
}

/** The spark's corners from one angle to another (degrees, clockwise on screen, 0° = right) */
function sparkCorners(from: number, to: number): string {
	const corners: string[] = [];
	for (let angle = from; angle <= to; angle += 22.5) {
		const radius = Math.round((angle - from) / 22.5) % 2 ? SPARK.outer : SPARK.inner;
		const radians = (angle * Math.PI) / 180;
		corners.push(
			`L${point(SPARK.x + radius * Math.cos(radians), SPARK.y + radius * Math.sin(radians))}`
		);
	}
	return corners.join('');
}

const startAngle = (Math.atan2(capJoin - BODY.y, CAP.right - BODY.x) * 180) / Math.PI;
const endAngle = (Math.atan2(capJoin - BODY.y, CAP.left - BODY.x) * 180) / Math.PI + 360;

const d =
	// Up the left side of the cap and along its top to the fuse
	`M${point(CAP.left, capJoin)}V${CAP.top + CAP.corner}` +
	corner(CAP.left, CAP.top, CAP.left + CAP.corner, CAP.top, CAP.left, CAP.top + CAP.corner) +
	`H240` +
	// The top edge of the fuse to the spark
	`C238 80 306 58 346 88` +
	// Around the spark, from its upper left over the top to its lower left
	sparkCorners(202.5, 495) +
	// The lower edge of the fuse back to the cap, and the rest of the cap's top
	`L334 104C308 82 260 92 258 132H${CAP.right - CAP.corner}` +
	corner(CAP.right, CAP.top, CAP.right, CAP.top + CAP.corner, CAP.right - CAP.corner, CAP.top) +
	// Down the cap's right side and round the body back to the start
	`V${round(capJoin)}` +
	bodyArc(startAngle, endAngle) +
	'Z';

if (!/^M[^M]*Z$/.test(d) || /[AQSTaqst]/.test(d))
	throw new Error('splash: not one outline of lines and cubics');

// Light mode: no fill, so it is black (or whatever colour Telegram gives it); dark mode: cream
const VARIANTS = [
	{ file: 'splash.svg', fill: '' },
	{ file: 'splash-dark.svg', fill: ' fill="#f5efd6"' }
];

for (const { file, fill } of VARIANTS) {
	const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path${fill} d="${d}"/>
</svg>
`;
	writeFileSync(join(root, 'brand', file), svg);
	console.log(`${file}: one closed path of lines and cubic curves, ${svg.length} bytes`);
}

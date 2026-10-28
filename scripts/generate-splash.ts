/*
 * Builds brand/splash.svg, the Mini App loading-screen icon: just the bomb as one monochrome
 * outline, a single closed path (one M … Z) with no fill colour, so Telegram can colour it. The
 * outline runs up the cap, along the top of the fuse, around the spark's points, back down the
 * fuse and once around the body.
 *
 * Run with: bun scripts/generate-splash.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const round = (value: number) => Math.round(value * 10) / 10;

const BODY = { x: 248, y: 330, r: 160 };
const CAP = { left: 204, right: 292, top: 130, corner: 12 };
const SPARK = { x: 378, y: 70, outer: 46, inner: 19 };

// Where the cap's sides meet the body
const capJoin = round(BODY.y - Math.sqrt(BODY.r ** 2 - ((CAP.right - CAP.left) / 2) ** 2));

/** The spark's corners from one angle to another (degrees, clockwise on screen, 0° = right) */
function sparkCorners(from: number, to: number): string {
	const corners: string[] = [];
	for (let angle = from; angle <= to; angle += 22.5) {
		const radius = Math.round((angle - from) / 22.5) % 2 ? SPARK.outer : SPARK.inner;
		const radians = (angle * Math.PI) / 180;
		corners.push(
			`L${round(SPARK.x + radius * Math.cos(radians))} ${round(SPARK.y + radius * Math.sin(radians))}`
		);
	}
	return corners.join('');
}

const d =
	// Up the left side of the cap and along its top to the fuse
	`M${CAP.left} ${capJoin}V${CAP.top + CAP.corner}Q${CAP.left} ${CAP.top} ${CAP.left + CAP.corner} ${CAP.top}H240` +
	// The top edge of the fuse to the spark
	`C238 80 306 58 346 88` +
	// Around the spark, from its upper left over the top to its lower left
	sparkCorners(202.5, 495) +
	// The lower edge of the fuse back to the cap, and the rest of the cap's top
	`L334 104C308 82 260 92 258 132H${CAP.right - CAP.corner}Q${CAP.right} ${CAP.top} ${CAP.right} ${CAP.top + CAP.corner}` +
	// Down the cap's right side and round the body back to the start
	`V${capJoin}A${BODY.r} ${BODY.r} 0 1 1 ${CAP.left} ${capJoin}Z`;

const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="${d}"/>
</svg>
`;
writeFileSync(join(root, 'brand', 'splash.svg'), svg);
console.log(`splash.svg: one closed path, ${svg.length} bytes`);

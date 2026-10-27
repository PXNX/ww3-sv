/*
 * Builds brand/splash.svg, the Mini App loading-screen icon. Like Telegram's sample
 * (https://telegram.org/resources/web-app-icon-sample.svg) it is a single <path> with no fill
 * colour or fill rule: Telegram colours it, and holes come from the default nonzero rule, so the
 * inner edge of the globe's ring runs the other way round. The continents sit inside the ring;
 * cap, fuse and spark sit beside it. Continents come from brand/app-icon.svg.
 *
 * Run with: bun scripts/generate-splash.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const brand = join(root, 'brand');
const round = (value: number) => Math.round(value * 10) / 10;

// The globe in the app icon: centre (300, 372), radius 186; here it is redrawn smaller
const SOURCE = { x: 300, y: 372, r: 186 };
const GLOBE = { x: 224, y: 326, r: 150, ring: 16 };
// Continents are pulled in a little, so they stay clear of the ring
const SCALE = ((GLOBE.r - GLOBE.ring - 8) / SOURCE.r) * 1.04;

/** A circle as two arcs; `reverse` draws it the other way round, which makes it a hole */
function circle(x: number, y: number, r: number, reverse = false): string {
	const sweep = reverse ? 1 : 0;
	return `M${round(x - r)} ${round(y)}A${r} ${r} 0 1 ${sweep} ${round(x + r)} ${round(y)}A${r} ${r} 0 1 ${sweep} ${round(x - r)} ${round(y)}Z`;
}

/** A continent from the app icon, moved onto the smaller globe and kept inside its ring */
function moveContinent(d: string): string {
	const inner = GLOBE.r - GLOBE.ring - 6;
	return d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, sx: string, sy: string) => {
		let dx = (Number(sx) - SOURCE.x) * SCALE;
		let dy = (Number(sy) - SOURCE.y) * SCALE;
		const distance = Math.hypot(dx, dy);
		if (distance > inner) {
			dx *= inner / distance;
			dy *= inner / distance;
		}
		return `${round(GLOBE.x + dx)} ${round(GLOBE.y + dy)}`;
	});
}

const icon = readFileSync(join(brand, 'app-icon.svg'), 'utf8');
const land = icon.slice(icon.indexOf('clip-path="url(#globe)"'), icon.indexOf('<!-- tanker'));
const continents = [...land.matchAll(/<path d="([^"]+)"/g)].map((match) => moveContinent(match[1]));

function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
	const corners = Array.from({ length: points * 2 }, (_, i) => {
		const radius = i % 2 ? inner : outer;
		const angle = (Math.PI * i) / points - Math.PI / 2 + 0.2;
		return `${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`;
	});
	return `M${corners.join('L')}Z`;
}

const top = GLOBE.y - GLOBE.r;
const parts = [
	// The globe: outer edge, inner edge (the ring), then the land inside it
	circle(GLOBE.x, GLOBE.y, GLOBE.r),
	circle(GLOBE.x, GLOBE.y, GLOBE.r - GLOBE.ring, true),
	...continents,
	// The cap, just above the globe
	`M${GLOBE.x - 40} ${top - 4}L${GLOBE.x - 40} ${top - 32}Q${GLOBE.x - 40} ${top - 40} ${GLOBE.x - 32} ${top - 40}` +
		`L${GLOBE.x + 32} ${top - 40}Q${GLOBE.x + 40} ${top - 40} ${GLOBE.x + 40} ${top - 32}L${GLOBE.x + 40} ${top - 4}Z`,
	// The fuse as a curved band from the cap towards the spark
	`M${GLOBE.x + 4} ${top - 44}C${GLOBE.x + 8} ${top - 108} ${GLOBE.x + 86} ${top - 118} ${GLOBE.x + 112} ${top - 76}` +
		`L${GLOBE.x + 98} ${top - 66}C${GLOBE.x + 80} ${top - 96} ${GLOBE.x + 26} ${top - 92} ${GLOBE.x + 22} ${top - 44}Z`,
	// The spark
	star(GLOBE.x + 158, top - 100, 52, 22, 8)
];

const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="${parts.join('')}"/>
</svg>
`;
writeFileSync(join(brand, 'splash.svg'), svg);
console.log(`splash.svg: one path, ${svg.length} bytes`);

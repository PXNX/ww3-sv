/*
 * Builds brand/splash.svg, the Mini App loading-screen icon. Like Telegram's sample
 * (https://telegram.org/resources/web-app-icon-sample.svg) it is one monochrome <path> with no
 * fill colour or fill rule, so Telegram can colour it: just the bomb, with a round body, cap, fuse
 * and spark. All parts wind the same way, so their overlaps stay filled under the default nonzero
 * rule; only the highlight runs the other way round, which cuts it out of the body.
 *
 * Run with: bun scripts/generate-splash.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

// Moves the drawing to the middle of the 512×512 box
const x = (value: number) => value + 16;
const y = (value: number) => value + 18;

function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
	const corners: string[] = [];
	// Counting down keeps the star's winding the same as the body's
	for (let i = points * 2; i > 0; i--) {
		const radius = i % 2 ? inner : outer;
		const angle = (Math.PI * i) / points - Math.PI / 2;
		corners.push(
			`${Math.round(cx + radius * Math.cos(angle))} ${Math.round(cy + radius * Math.sin(angle))}`
		);
	}
	return `M${corners.join('L')}Z`;
}

const d = [
	// Body
	`M${x(72)} ${y(312)}a160 160 0 1 0 320 0a160 160 0 1 0-320 0Z`,
	// Highlight, drawn the other way round so it becomes a hole
	`M${x(136)} ${y(258)}a30 30 0 1 1 60 0a30 30 0 1 1-60 0Z`,
	// Cap
	`M${x(188)} ${y(164)}h88v-40q0-12-12-12h-64q-12 0-12 12Z`,
	// Fuse, a curved band
	`M${x(242)} ${y(114)}C${x(244)} ${y(74)} ${x(292)} ${y(64)} ${x(318)} ${y(86)}l12-16` +
		`C${x(290)} ${y(40)} ${x(222)} ${y(62)} ${x(224)} ${y(114)}Z`,
	// Spark
	star(x(362), y(52), 46, 19, 8)
].join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>\n`;
writeFileSync(join(root, 'brand', 'splash.svg'), svg);
console.log(`splash.svg: one path, ${svg.length} bytes`);

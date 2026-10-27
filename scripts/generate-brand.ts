/*
 * Renders the brand pictures in brand/ that Telegram needs as raster images: the description
 * picture (640×360 PNG for BotFather). The SVG sources stay next to them; the title uses the
 * game's own Baloo font from static/fonts, so it is rendered by a headless Chromium browser like
 * the link previews: set EDGE_PATH or CHROME_PATH if it is not found.
 *
 * Run with: bun scripts/generate-brand.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const brand = join(root, 'brand');

const BROWSERS = [
	process.env.EDGE_PATH,
	process.env.CHROME_PATH,
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium'
];
const browser = BROWSERS.find((path) => path && existsSync(path));
if (!browser) throw new Error('No Chromium browser found: set EDGE_PATH or CHROME_PATH');

const PICTURES = [{ source: 'telegram-description.svg', output: 'telegram-description.png', width: 640, height: 360 }];

for (const { source, output, width, height } of PICTURES) {
	execFileSync(browser, [
		'--headless',
		'--disable-gpu',
		'--hide-scrollbars',
		'--allow-file-access-from-files',
		`--screenshot=${join(brand, output)}`,
		`--window-size=${width},${height}`,
		pathToFileURL(join(brand, source)).href
	]);
	console.log(output);
}

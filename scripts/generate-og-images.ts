/*
 * Renders one link-preview image per game into static/og/<id>.png: the game's icon on its tile
 * colour next to its name, in the style of the start screen. The registry cannot be imported
 * here (it pulls in bundler-only icon imports), so its ids, icons and tile colours are read as
 * text. Uses a headless Chromium browser: set EDGE_PATH or CHROME_PATH if it is not found.
 *
 * Run with: bun scripts/generate-og-images.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'static', 'og');

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

const registry = readFileSync(join(root, 'src/lib/modes/registry.ts'), 'utf8');
const tokens = readFileSync(join(root, 'src/lib/styles/tokens.css'), 'utf8');
const names: Record<string, string> = JSON.parse(
	readFileSync(join(root, 'messages/en.json'), 'utf8')
);
const lucide = JSON.parse(
	readFileSync(join(root, 'node_modules/@iconify-json/lucide/icons.json'), 'utf8')
) as { icons: Record<string, { body: string }> };

const iconFiles = new Map(
	[...registry.matchAll(/import (\w+) from '~icons\/lucide\/([\w-]+)'/g)].map((match) => [
		match[1],
		match[2]
	])
);
const colours = new Map(
	[...tokens.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{3,8})/gi)].map((match) => [
		match[1],
		match[2]
	])
);
const games = [
	...registry.matchAll(
		/id: '(\w+)',\s*status: 'playable'[\s\S]*?icon: (\w+),\s*tileClass: 'bg-([\w-]+)'/g
	)
].map(([, id, icon, tile]) => ({ id, icon: iconFiles.get(icon), tile: colours.get(tile) }));

const expected = [...registry.matchAll(/^\s+status: 'playable',/gm)].length;
if (games.length !== expected) throw new Error(`Read ${games.length} of ${expected} games`);

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const font = pathToFileURL(join(root, 'static/fonts/baloo-2-latin-700-normal.woff2')).href;

function page(name: string, iconBody: string, tile: string): string {
	const size = name.length > 22 ? 96 : name.length > 14 ? 112 : 128;
	return `<!doctype html><meta charset="utf-8" /><style>
@font-face { font-family: Baloo; font-weight: 700; src: url('${font}'); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { background: #e8e1bc; color: #111; font-family: Baloo, sans-serif; font-weight: 700;
	display: flex; align-items: center; gap: 60px; padding: 0 80px; box-sizing: border-box; }
.text { flex: 1; display: flex; flex-direction: column; gap: 36px; }
h1 { margin: 0; align-self: flex-start; transform: rotate(-1.5deg); background: #6a7c9b; color: #fff;
	border: 6px solid #111; border-radius: 28px 14px 24px 18px; box-shadow: 10px 10px 0 #111;
	padding: 20px 40px 8px; font-size: ${size}px; line-height: 1; }
p { margin: 0; font-size: 52px; }
.tile { width: 380px; height: 380px; box-sizing: border-box; flex: none; background: ${tile};
	border: 8px solid #111; border-radius: 48px 24px 40px 30px; box-shadow: 14px 14px 0 #111;
	transform: rotate(2deg); display: flex; align-items: center; justify-content: center; }
svg { width: 240px; height: 240px; }
</style>
<div class="text"><h1>${escape(name)}</h1><p>World War 3</p></div>
<div class="tile"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.75"
	fill="none" stroke="#111" stroke-linecap="round" stroke-linejoin="round">${iconBody}</svg></div>`;
}

mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'og-'));
try {
	for (const { id, icon, tile } of games) {
		const name = names[`mode_${id}_name`];
		const body = icon && lucide.icons[icon]?.body;
		if (!name || !body || !tile) throw new Error(`Incomplete data for ${id}`);
		// The icon bodies set their own stroke attributes on a group; strip them so ours apply
		const plain = body.replace(/<g [^>]*>/, '<g>');
		const file = join(work, `${id}.html`);
		writeFileSync(file, page(name, plain, tile));
		execFileSync(browser, [
			'--headless',
			'--disable-gpu',
			'--hide-scrollbars',
			`--screenshot=${join(outDir, `${id}.png`)}`,
			'--window-size=1200,630',
			pathToFileURL(file).href
		]);
		console.log(`${id}.png`);
	}
} finally {
	rmSync(work, { recursive: true, force: true });
}

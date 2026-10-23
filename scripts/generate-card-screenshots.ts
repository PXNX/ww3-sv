/*
 * Captures one gameplay screenshot per game into static/cards/<id>.webp, used as the faint
 * background of its card on the start screen. Opens every game in a headless Chromium browser
 * driven over the DevTools protocol, with each tutorial marked as seen so it does not cover the
 * game. Needs the dev server running: pass its URL as the first argument (default
 * http://localhost:5173), optionally followed by the ids of the games to capture (default: all).
 * Set EDGE_PATH or CHROME_PATH if no browser is found.
 *
 * Run with: bun scripts/generate-card-screenshots.ts [url] [id...]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'static', 'cards');
const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const port = 9333;

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

// The registry cannot be imported here (it pulls in bundler-only icon imports), so read it as text
const registry = readFileSync(join(root, 'src/lib/modes/registry.ts'), 'utf8');
const playable = [...registry.matchAll(/id: '(\w+)',\s*status: 'playable'/g)].map(([, id]) => id);
const requested = process.argv.slice(3);
const unknown = requested.filter((id) => !playable.includes(id));
if (unknown.length > 0) throw new Error(`Unknown games: ${unknown.join(', ')}`);
const games = requested.length > 0 ? requested : playable;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const profile = mkdtempSync(join(tmpdir(), 'cards-'));
const child = spawn(browser, [
	'--headless=new',
	'--disable-gpu',
	'--hide-scrollbars',
	'--mute-audio',
	`--remote-debugging-port=${port}`,
	`--user-data-dir=${profile}`,
	'about:blank'
]);

async function pageSocketUrl(): Promise<string> {
	for (let attempt = 0; attempt < 50; attempt++) {
		try {
			const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
				type: string;
				webSocketDebuggerUrl: string;
			}[];
			const page = targets.find((target) => target.type === 'page');
			if (page) return page.webSocketDebuggerUrl;
		} catch {
			// The browser is still starting
		}
		await sleep(200);
	}
	throw new Error('Browser did not open its debugging port');
}

try {
	const socket = new WebSocket(await pageSocketUrl());
	await new Promise((done) => socket.addEventListener('open', done, { once: true }));
	let nextId = 0;
	const pending = new Map<number, (result: Record<string, unknown>) => void>();
	socket.addEventListener('message', (event) => {
		const message = JSON.parse(String(event.data)) as {
			id?: number;
			result?: Record<string, unknown>;
		};
		if (message.id !== undefined) pending.get(message.id)?.(message.result ?? {});
	});
	const send = (method: string, params: Record<string, unknown> = {}) =>
		new Promise<Record<string, unknown>>((done) => {
			const id = ++nextId;
			pending.set(id, done);
			socket.send(JSON.stringify({ id, method, params }));
		});

	await send('Emulation.setDeviceMetricsOverride', {
		width: 400,
		height: 600,
		deviceScaleFactor: 1,
		mobile: true
	});
	// Mark every tutorial as seen before any game reads it
	const seen = playable.map((id) => `localStorage.setItem('ww3:tutorial:${id}', 'true');`).join('');
	await send('Page.navigate', { url: `${baseUrl}/` });
	await sleep(3000);
	await send('Runtime.evaluate', { expression: seen });

	mkdirSync(outDir, { recursive: true });
	for (const id of games) {
		// A blank page or the error page means the game had not loaded yet (a dev server compiles a
		// route on its first visit, and reloads whenever a source file changes): load it again
		let image: Buffer | undefined;
		for (let attempt = 0; attempt < 4 && !image; attempt++) {
			await send('Page.navigate', { url: `${baseUrl}/play/${id}` });
			await sleep(4000 + attempt * 4000);
			const { result } = await send('Runtime.evaluate', {
				expression: `document.body.innerText.trim().length > 0 && !/^Error \\d{3}/.test(document.title)`
			});
			if (!(result as { value?: boolean }).value) continue;
			const { data } = await send('Page.captureScreenshot', { format: 'webp', quality: 60 });
			image = Buffer.from(String(data), 'base64');
		}
		if (!image) throw new Error(`${id} did not load`);
		writeFileSync(join(outDir, `${id}.webp`), image);
		console.log(`${id}.webp`);
	}
	await send('Browser.close');
	socket.close();
} finally {
	child.kill();
	try {
		rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
	} catch {
		// Helper processes of the browser can hold the profile open for a while on Windows
		console.warn(`Could not remove the temporary browser profile ${profile}`);
	}
}

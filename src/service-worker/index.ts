/*
 * Makes the app installable and playable offline: the built app, the static assets (sprites,
 * sounds, fonts) and every prerendered page are cached on install, and pages fall back to the
 * cache when the network is unavailable. A new deployment gets a new cache name, so old files
 * never linger.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';
import { self as sw } from '$app/service-worker';

const CACHE = `ww3-${version}`;
// Manifest paths are relative to the base path; resolve() turns them into root-relative URLs
const toUrls = (entries: readonly { path: string }[]) =>
	entries.map(({ path }) => resolve(path as never));
// The app itself must be cached completely, or the install fails and the browser never offers it
const SHELL = toUrls([...immutable, ...prerendered]);
// Static assets (sprites, sounds, fonts) are cached one by one: a single failed download must not
// abort the install, because without an active service worker the app is not installable
const OPTIONAL = toUrls(assets);
const PRECACHE = [...SHELL, ...OPTIONAL];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then(async (cache) => {
				await cache.addAll(SHELL);
				await Promise.allSettled(OPTIONAL.map((url) => cache.add(url)));
			})
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	event.respondWith(respond(request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// Built and static files never change under the same name: the cache always wins
	if (PRECACHE.includes(url.pathname) && request.mode !== 'navigate') {
		const cached = await cache.match(url.pathname);
		if (cached) return cached;
	}

	try {
		return await fetch(request);
	} catch (error) {
		// Offline: serve the page from the cache, or the start page as a last resort
		const cached =
			(await cache.match(request)) ??
			(request.mode === 'navigate'
				? ((await cache.match(url.pathname)) ??
					(await cache.match(`${url.pathname}.html`)) ??
					(await cache.match('/')))
				: undefined);
		if (cached) return cached;
		throw error;
	}
}

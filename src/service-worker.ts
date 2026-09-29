/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/*
 * Makes the app installable and playable offline: the built app, the static assets (sprites,
 * sounds, fonts) and every prerendered page are cached on install, and pages fall back to the
 * cache when the network is unavailable. A new deployment gets a new cache name, so old files
 * never linger.
 */
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `ww3-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
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

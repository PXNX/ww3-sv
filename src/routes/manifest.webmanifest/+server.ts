import { json } from '@sveltejs/kit';
import { APP_NAME, APP_SHORT_NAME } from '#lib/config.js';
import type { RequestHandler } from './$types';

// Generated here rather than kept as a static file so the app name has a single source
export const prerender = true;

const THEME_COLOR = '#e8e1bc';

export const GET: RequestHandler = () =>
	json(
		{
			name: APP_NAME,
			short_name: APP_SHORT_NAME,
			description:
				'A satirical cartoon puzzle and arcade collection about oil, shipping, and geopolitics.',
			id: '/',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			orientation: 'any',
			background_color: THEME_COLOR,
			theme_color: THEME_COLOR,
			icons: [
				{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
				{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
				{
					src: '/icons/icon-maskable-512.png',
					sizes: '512x512',
					type: 'image/png',
					purpose: 'maskable'
				},
				{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
			]
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);

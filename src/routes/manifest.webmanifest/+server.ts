import { json } from '@sveltejs/kit';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from '#lib/config.js';
import type { RequestHandler } from './$types';

// Generated here rather than kept as a static file so the app name has a single source
export const prerender = true;

const THEME_COLOR = '#e8e1bc';

export const GET: RequestHandler = () =>
	json(
		{
			name: APP_NAME,
			short_name: APP_SHORT_NAME,
			description: APP_DESCRIPTION,
			id: '/',
			start_url: '/',
			scope: '/',
			// Installed, the app opens without any browser bars; standalone where full screen is refused
			display: 'fullscreen',
			display_override: ['fullscreen', 'standalone'],
			orientation: 'any',
			background_color: THEME_COLOR,
			theme_color: THEME_COLOR,
			icons: [
				{ src: '/brand/bomb.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
				{ src: '/brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
			],
			prefer_related_applications: false
		},
		{ headers: { 'content-type': 'application/manifest+json' } }
	);

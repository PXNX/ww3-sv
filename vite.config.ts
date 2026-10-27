import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';
import vercelAdapter from '@sveltejs/adapter-vercel';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),

			// Also checked whenever the app regains focus; drives the update hint on the start screen
			version: { pollInterval: 5 * 60 * 1000 },

			// Absolute asset URLs, so the start page the service worker serves offline for an unknown
			// deep URL still finds its scripts and styles
			paths: { relative: false },

			// Vercel by default; Functions run on Vercel's Bun runtime, its version is set by bunVersion in
			// vercel.json. ADAPTER=static writes a plain folder (build/) for the Telegram Mini App, which
			// Telegram Serverless hosts (see mn/ptb-ww3)
			adapter:
				process.env.ADAPTER === 'static'
					? staticAdapter({ pages: 'build', assets: 'build', strict: true })
					: vercelAdapter({ runtime: 'bun1.x' })
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// A manual choice is remembered in local storage; otherwise the browser language decides
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		}),
		tailwindcss(),
		Icons({ compiler: 'svelte' })
	],
	// The release shown on the About page, from package.json
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		port: 3021
	}
});

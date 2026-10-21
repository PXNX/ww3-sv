import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),

			// Also checked whenever the app regains focus; drives the update hint on the start screen
			version: { pollInterval: 5 * 60 * 1000 },

			// Absolute asset URLs, so the start page the service worker serves offline for an unknown
			// deep URL still finds its scripts and styles
			paths: { relative: false },

			// Functions run on Vercel's Bun runtime; the Bun version is set by bunVersion in vercel.json
			adapter: adapter({ runtime: 'bun1.x' })
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
	server: {
		port: 3021
	}
});

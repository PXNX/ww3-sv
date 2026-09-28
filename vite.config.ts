import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
	plugins: [
		sveltekit(),
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

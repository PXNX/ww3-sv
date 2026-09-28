import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Pinned because Bun reports its own Node.js version, which the adapter cannot map automatically
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};

export default config;

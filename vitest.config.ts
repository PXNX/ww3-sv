import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Unit tests cover pure logic only, colocated next to the code as *.test.ts.
// The SvelteKit plugin provides the $lib alias; run `bun run i18n:compile` first (the test script does).
export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: [
			{
				find: /^~icons\/.+/,
				replacement: fileURLToPath(new URL('./src/lib/testing/iconStub.ts', import.meta.url))
			}
		]
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});

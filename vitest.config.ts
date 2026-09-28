import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Unit tests cover pure logic only, colocated next to the code as *.test.ts.
// The SvelteKit plugin provides the $lib alias; run `bun run i18n:compile` first (the test script does).
export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});

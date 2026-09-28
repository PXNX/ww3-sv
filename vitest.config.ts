import { defineConfig } from 'vitest/config';

// Unit tests cover pure logic only, colocated next to the code as *.test.ts
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});

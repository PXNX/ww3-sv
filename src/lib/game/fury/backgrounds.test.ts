import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, LEVELS_PER_BACKGROUND, backgroundFor } from './backgrounds';

describe('backgrounds', () => {
	it('starts with the meadow and keeps a theme for a few levels in a row', () => {
		expect(backgroundFor(0).id).toBe('meadow');
		for (let index = 1; index < LEVELS_PER_BACKGROUND; index++) {
			expect(backgroundFor(index)).toBe(backgroundFor(0));
		}
		expect(backgroundFor(LEVELS_PER_BACKGROUND)).not.toBe(backgroundFor(0));
	});

	it('cycles through every theme and starts over, however far the levels go', () => {
		const seen = new Set<string>();
		for (let index = 0; index < BACKGROUNDS.length * LEVELS_PER_BACKGROUND; index++) {
			seen.add(backgroundFor(index).id);
		}
		expect(seen.size).toBe(BACKGROUNDS.length);
		const cycle = BACKGROUNDS.length * LEVELS_PER_BACKGROUND;
		expect(backgroundFor(cycle + 4)).toBe(backgroundFor(4));
		expect(backgroundFor(500)).toBeDefined();
	});

	it('gives every theme its own flat colors', () => {
		expect(new Set(BACKGROUNDS.map((theme) => theme.id)).size).toBe(BACKGROUNDS.length);
		expect(new Set(BACKGROUNDS.map((theme) => theme.sky)).size).toBe(BACKGROUNDS.length);
		for (const theme of BACKGROUNDS) {
			for (const color of [theme.sky, theme.cloud, theme.hillFar, theme.hillNear, theme.ground]) {
				expect(color).toMatch(/^#[0-9a-f]{6}$/);
			}
		}
	});

	it('treats a negative level index like the first level', () => {
		expect(backgroundFor(-3)).toBe(backgroundFor(0));
	});
});

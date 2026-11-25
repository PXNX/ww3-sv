import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_SPRITE_FRAMES, heroSprite, isHeroKind } from './beachheadHeroArt.js';

describe('Blender-rendered Beachhead commanders', () => {
	it('names only the two heroes', () => {
		expect(isHeroKind('azov')).toBe(true);
		expect(isHeroKind('hero')).toBe(true);
		expect(isHeroKind('tank')).toBe(false);
	});

	it('ships a twelve-frame sheet for each hero', () => {
		for (const kind of ['azov', 'hero'] as const) {
			expect(heroSprite(kind)).toBe(`/assets/beachhead/heroes/${kind}.png`);
			const file = `static${heroSprite(kind)}`;
			expect(existsSync(file), file).toBe(true);
			// PNG IHDR: width at bytes 16..20, height at 20..24
			const header = readFileSync(file).subarray(0, 24);
			expect(header.readUInt32BE(16)).toBe(192 * HERO_SPRITE_FRAMES);
			expect(header.readUInt32BE(20)).toBe(192);
		}
	});
});

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LOOK,
	HATS,
	LOOK_PARTS,
	LOOK_PRESETS,
	SHIRT_TYPES,
	SKIN_COLORS,
	cyclePart,
	isAvatarLook,
	parseLook,
	randomLook,
	withPart,
	type LookPart
} from './look';

describe('an avatar look', () => {
	it('has a valid default', () => {
		expect(isAvatarLook(DEFAULT_LOOK)).toBe(true);
	});

	it('draws the same random look from the same seed, and always a valid one', () => {
		expect(randomLook(42)).toEqual(randomLook(42));
		for (let seed = 1; seed < 200; seed++) {
			const look = randomLook(seed);
			expect(isAvatarLook(look)).toBe(true);
			expect(look.skin).not.toBe(SKIN_COLORS.at(-1));
		}
	});

	it('gives some random agents a hat and leaves most bareheaded', () => {
		const hats = Array.from({ length: 200 }, (_, seed) => randomLook(seed + 1).hat);
		const bare = hats.filter((hat) => hat === 'none').length;
		expect(bare).toBeGreaterThan(80);
		expect(bare).toBeLessThan(200);
	});

	it('keeps the ogre ears and the green skin out of random looks', () => {
		for (let seed = 1; seed <= 300; seed++) {
			const look = randomLook(seed);
			expect(look.hat).not.toBe('ogre-ears');
			expect(look.skin).not.toBe(SKIN_COLORS.at(-1));
		}
	});

	it('builds the ready-made looks from the same parts as any other agent', () => {
		expect(LOOK_PRESETS.map((preset) => preset.id)).toEqual(['agent-47', 'ogre']);
		for (const preset of LOOK_PRESETS) {
			expect(isAvatarLook(preset.look)).toBe(true);
			expect(preset.name.length).toBeGreaterThan(0);
		}
		// Both are recognisable from a single part that no other preset uses
		expect(LOOK_PRESETS[0].look.shirt).toBe('suit');
		expect(LOOK_PRESETS[1].look.hat).toBe('ogre-ears');
	});

	it('sets a part only to one of its own choices', () => {
		expect(withPart(DEFAULT_LOOK, 'hat', 'crown').hat).toBe('crown');
		expect(withPart(DEFAULT_LOOK, 'hat', 'tiara')).toBe(DEFAULT_LOOK);
		expect(withPart(DEFAULT_LOOK, 'skin', '#123456')).toBe(DEFAULT_LOOK);
	});

	it('cycles through every choice and wraps around both ways', () => {
		let look = DEFAULT_LOOK;
		for (let i = 0; i < SHIRT_TYPES.length; i++) look = cyclePart(look, 'shirt');
		expect(look.shirt).toBe(DEFAULT_LOOK.shirt);
		expect(cyclePart(DEFAULT_LOOK, 'hat', -1).hat).toBe(HATS.at(-1));
	});

	it('rejects broken or foreign data from storage', () => {
		expect(parseLook(null)).toBeNull();
		expect(parseLook({ ...DEFAULT_LOOK, version: 2 })).toBeNull();
		expect(parseLook({ ...DEFAULT_LOOK, eyes: 'laser' })).toBeNull();
		const missing: Record<string, unknown> = { ...DEFAULT_LOOK };
		delete missing.nose;
		expect(parseLook(missing)).toBeNull();
		expect(parseLook({ ...DEFAULT_LOOK })).toEqual(DEFAULT_LOOK);
	});

	it('offers at least two choices for every part', () => {
		for (const part of Object.keys(LOOK_PARTS) as LookPart[]) {
			expect(LOOK_PARTS[part].length).toBeGreaterThan(1);
		}
	});
});

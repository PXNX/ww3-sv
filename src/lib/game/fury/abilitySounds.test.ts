import { describe, expect, it } from 'vitest';
import { SOUNDS } from '#lib/sound/sounds.js';
import { ABILITY_SOUNDS } from './abilitySounds';
import { BIRDS, BIRD_KINDS } from './birds';

describe('ability sounds', () => {
	it('gives every bird with a tap ability a sound, and a bird without one none', () => {
		for (const kind of BIRD_KINDS) {
			if (BIRDS[kind].ability) expect(ABILITY_SOUNDS[kind], kind).toBeDefined();
			else expect(ABILITY_SOUNDS[kind], kind).toBeUndefined();
		}
	});

	it('uses a different sound for each ability, all of them defined in the catalog', () => {
		const sounds = Object.values(ABILITY_SOUNDS);
		expect(new Set(sounds).size).toBe(sounds.length);
		for (const sound of sounds) expect(SOUNDS[sound!]).toBeTypeOf('function');
	});
});

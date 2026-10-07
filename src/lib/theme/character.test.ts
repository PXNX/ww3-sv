import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { GAME_OVER_POSES, MASCOT_PLACEHOLDER, mascotImage, pickGameOverPose } from './character';

describe('mascot game-over poses', () => {
	it('has artwork for every game-over pose', () => {
		for (const pose of GAME_OVER_POSES) {
			expect(mascotImage(pose)).not.toBe(MASCOT_PLACEHOLDER);
			expect(existsSync(`static${mascotImage(pose)}`)).toBe(true);
		}
	});

	it('eventually picks every pose', () => {
		const random = createRandom(7);
		const seen = new Set<string>();
		for (let i = 0; i < 300; i++) seen.add(pickGameOverPose(random));
		expect(seen.size).toBe(GAME_OVER_POSES.length);
	});

	it('never picks the same pose twice in a row', () => {
		const random = createRandom(11);
		let previous = pickGameOverPose(random);
		for (let i = 0; i < 300; i++) {
			const next = pickGameOverPose(random, previous);
			expect(next).not.toBe(previous);
			previous = next;
		}
	});
});

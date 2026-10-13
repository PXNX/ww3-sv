import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MASCOT_PLACEHOLDER, mascotImage, type MascotPose } from './character';

const POSES: readonly MascotPose[] = [
	'idle',
	'smug',
	'sweating',
	'sunk',
	'sulking',
	'crying',
	'rage',
	'shocked',
	'facepalm'
];

describe('mascot poses', () => {
	it('has artwork for every pose', () => {
		for (const pose of POSES) {
			expect(mascotImage(pose)).not.toBe(MASCOT_PLACEHOLDER);
			expect(existsSync(`static${mascotImage(pose)}`)).toBe(true);
		}
	});
});

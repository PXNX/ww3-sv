/*
 * Proof that every job can be beaten: a bot (testBot.ts) searches the real simulation, never
 * sprinting and never using the phone, so a pass means the plain stealth route exists.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels.js';
import { play } from './testBot.js';

describe('every job can be beaten by stealth alone', () => {
	it.each(LEVELS.map((level) => [level.id, level] as const))(
		'%s',
		(_id, level) => {
			const result = play(level);
			expect(result.cleared, `search gave up after ${result.bestSeconds.toFixed(0)} s`).toBe(true);
			expect(result.state!.targets.every((target) => target.done)).toBe(true);
			expect(result.state!.peakSuspicion).toBeLessThan(0.7);
		},
		120_000
	);
});

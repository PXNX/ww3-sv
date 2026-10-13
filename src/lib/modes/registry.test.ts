import { describe, expect, it } from 'vitest';
import { CAMEOS } from '#lib/theme/cameos.js';
import { MODES, modeById, modesFeaturing } from './registry';

describe('mode leaders', () => {
	it('lists each leader at most once per mode', () => {
		for (const mode of MODES) {
			expect(new Set(mode.leaders).size, mode.id).toBe(mode.leaders.length);
		}
	});

	it('features every roster leader in at least one mode, so no filter comes up empty', () => {
		for (const cameo of CAMEOS) {
			expect(modesFeaturing(cameo.id).length, cameo.id).toBeGreaterThan(0);
		}
	});

	it('filters by leader and keeps registry order', () => {
		const ids = modesFeaturing('xi').map((mode) => mode.id);
		expect(ids).toEqual(['blocks', 'merge', 'beltroad']);
	});

	it('looks a mode up by id and rejects an unknown one', () => {
		expect(modeById('chess').leaders[0]).toBe('putin');
		expect(() => modeById('nope' as never)).toThrow('Unknown mode');
	});
});

import { describe, expect, it } from 'vitest';
import { PURR_RAMP_MS } from './config';
import { purrVolume } from './petting';

describe('purrVolume', () => {
	it('is silent for a cat that has not been petted yet', () => {
		expect(purrVolume(0)).toBe(0);
		expect(purrVolume(-50)).toBe(0);
	});

	it('grows with the time spent petting, towards but never past full volume', () => {
		const volumes = [200, 800, 1500, 3000, 8000].map(purrVolume);
		for (let i = 1; i < volumes.length; i++) expect(volumes[i]).toBeGreaterThan(volumes[i - 1]);
		expect(volumes.at(-1)!).toBeLessThanOrEqual(1);
		expect(volumes.at(-1)!).toBeGreaterThan(0.95);
	});

	it('has reached about two thirds of full volume after the ramp time', () => {
		expect(purrVolume(PURR_RAMP_MS)).toBeCloseTo(1 - Math.exp(-1));
	});
});

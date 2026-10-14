import { describe, expect, it } from 'vitest';
import { FLASH_GAP_S, FLASH_S } from './config';
import { cycleLength, lightOffset, lightOn } from './lights';

/** Counts the flashes (dark to lit changes) over one cycle, sampled finely */
function countFlashes(flashes: number, offset = 0) {
	const cycle = cycleLength(flashes);
	let count = 0;
	let previous = lightOn(flashes, cycle - 0.001 + offset, 0);
	for (let t = 0; t < cycle; t += 0.01) {
		const on = lightOn(flashes, t + offset, 0);
		if (on && !previous) count += 1;
		previous = on;
	}
	return count;
}

describe('lighthouse patterns', () => {
	it('flashes as many times as its number', () => {
		for (const flashes of [1, 2, 3, 4]) expect(countFlashes(flashes)).toBe(flashes);
	});

	it('is lit at the start of the cycle and dark in the pause', () => {
		expect(lightOn(2, 0)).toBe(true);
		expect(lightOn(2, FLASH_S + 0.01)).toBe(false);
		expect(lightOn(2, 2 * (FLASH_S + FLASH_GAP_S) + 0.5)).toBe(false);
	});

	it('repeats every cycle', () => {
		const cycle = cycleLength(3);
		for (const t of [0.1, 0.4, 0.9, 2.5]) {
			expect(lightOn(3, t + cycle)).toBe(lightOn(3, t));
		}
	});

	it('shifts the cycle with an offset, also a negative one', () => {
		expect(lightOn(1, 5, 1.7)).toBe(lightOn(1, 6.7));
		expect(lightOn(1, 0, -0.1)).toBe(lightOn(1, cycleLength(1) - 0.1));
	});

	it('gives every lighthouse a different start', () => {
		expect(new Set([0, 1, 2, 3].map(lightOffset)).size).toBe(4);
	});
});

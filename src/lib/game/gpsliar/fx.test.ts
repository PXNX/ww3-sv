import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { MAX_PARTICLES, addParticles, burst, stepParticles, wakeFoam } from './fx';

describe('particles', () => {
	it('leaves a wake only behind a moving boat', () => {
		const random = createRandom(1);
		expect(wakeFoam({ x: 5, y: 5 }, 0, 0.1, random)).toEqual([]);
		const foam = wakeFoam({ x: 5, y: 5 }, 0, 2, random);
		expect(foam).toHaveLength(2);
		// The boat heads east, so the foam sits west of it
		expect(foam.every((bit) => bit.x < 5)).toBe(true);
	});

	it('bursts outward and fades away', () => {
		const bits = burst({ x: 0, y: 0 }, 'spark', 12, 3, createRandom(2));
		expect(bits).toHaveLength(12);
		let alive = stepParticles(bits, 100);
		expect(alive.length).toBe(12);
		expect(Math.hypot(alive[0].x, alive[0].y)).toBeGreaterThan(0);
		alive = stepParticles(alive, 2000);
		expect(alive).toEqual([]);
	});

	it('never keeps more than the cap', () => {
		const list = burst({ x: 0, y: 0 }, 'foam', MAX_PARTICLES, 1, createRandom(3));
		addParticles(list, burst({ x: 1, y: 1 }, 'foam', 50, 1, createRandom(4)));
		expect(list).toHaveLength(MAX_PARTICLES);
		expect(list.at(-1)?.x).toBe(1);
	});
});

import { describe, expect, it } from 'vitest';
import { GULL_COUNT } from './config';
import { gullFlock } from './gulls';

const around = { x: 10, y: 10 };

describe('gull flock', () => {
	it('has the configured number of gulls', () => {
		expect(gullFlock(around, 'north', 0)).toHaveLength(GULL_COUNT);
	});

	it('always heads for land, whichever coast it is', () => {
		expect(gullFlock(around, 'north', 3)[0].heading).toEqual({ x: 0, y: -1 });
		expect(gullFlock(around, 'south', 3)[0].heading).toEqual({ x: 0, y: 1 });
		expect(gullFlock(around, 'west', 3)[0].heading).toEqual({ x: -1, y: 0 });
		expect(gullFlock(around, 'east', 3)[0].heading).toEqual({ x: 1, y: 0 });
	});

	it('moves toward land as time passes', () => {
		const before = gullFlock(around, 'west', 1)[2];
		const after = gullFlock(around, 'west', 1.5)[2];
		expect(after.x).toBeLessThan(before.x);
	});

	it('stays near the boat and wraps around', () => {
		for (const t of [0, 5, 13.7, 100]) {
			for (const gull of gullFlock(around, 'north', t)) {
				expect(Math.hypot(gull.x - around.x, gull.y - around.y)).toBeLessThan(11);
			}
		}
	});

	it('follows the point it flies around', () => {
		const here = gullFlock({ x: 0, y: 0 }, 'north', 2);
		const there = gullFlock({ x: 5, y: 7 }, 'north', 2);
		expect(there[0].x - here[0].x).toBeCloseTo(5);
		expect(there[0].y - here[0].y).toBeCloseTo(7);
	});
});

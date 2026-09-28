import { describe, expect, it } from 'vitest';
import { advanceAccumulator } from './loop';

describe('advanceAccumulator', () => {
	it('runs whole steps and carries the remainder', () => {
		expect(advanceAccumulator(0, 35, 10)).toEqual({ steps: 3, accumulatorMs: 5 });
		expect(advanceAccumulator(5, 7, 10)).toEqual({ steps: 1, accumulatorMs: 2 });
	});

	it('runs no step when less than one step has elapsed', () => {
		expect(advanceAccumulator(0, 4, 10)).toEqual({ steps: 0, accumulatorMs: 4 });
	});

	it('caps the steps after a long stall and drops the backlog', () => {
		expect(advanceAccumulator(0, 10_000, 10, 5)).toEqual({ steps: 5, accumulatorMs: 0 });
	});

	it('ignores negative elapsed time', () => {
		expect(advanceAccumulator(3, -50, 10)).toEqual({ steps: 0, accumulatorMs: 3 });
	});

	it('gives the same total steps whatever the frame rate', () => {
		const run = (frameMs: number, totalMs: number) => {
			let accumulator = 0;
			let steps = 0;
			for (let t = 0; t < totalMs; t += frameMs) {
				const result = advanceAccumulator(accumulator, frameMs, 1000 / 60);
				accumulator = result.accumulatorMs;
				steps += result.steps;
			}
			return steps;
		};
		expect(Math.abs(run(1000 / 30, 1000) - run(1000 / 120, 1000))).toBeLessThanOrEqual(1);
	});
});

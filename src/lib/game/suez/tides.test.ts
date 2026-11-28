import { describe, expect, it } from 'vitest';
import { HIGH_TIDE_QUEUE, tideAt, TIDE_CYCLE_MS } from './tides.js';
import { stepQueue, createQueue } from './queue.js';

describe('suez tides', () => {
	it('cycles from low through high and back', () => {
		expect(tideAt(0).phase).toBe('low');
		expect(tideAt(TIDE_CYCLE_MS * 0.25).phase).toBe('rising');
		expect(tideAt(TIDE_CYCLE_MS * 0.5).phase).toBe('high');
		expect(tideAt(TIDE_CYCLE_MS * 0.75).phase).toBe('falling');
		expect(tideAt(TIDE_CYCLE_MS).level).toBeCloseTo(0);
	});

	it('makes pulls stronger and the queue faster at high water', () => {
		expect(tideAt(TIDE_CYCLE_MS / 2).grabStrength).toBeGreaterThan(1);
		expect(tideAt(TIDE_CYCLE_MS / 2).queueRate).toBeCloseTo(HIGH_TIDE_QUEUE);
	});

	it('fills the queue faster at high tide', () => {
		const low = createQueue();
		const high = createQueue();
		stepQueue(low, 18_000, 1, 6, tideAt(0).queueRate);
		stepQueue(high, 18_000, 1, 6, tideAt(TIDE_CYCLE_MS / 2).queueRate);
		expect(high.waiting).toBeGreaterThanOrEqual(low.waiting);
	});
});

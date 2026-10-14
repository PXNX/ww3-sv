import { describe, expect, it } from 'vitest';
import { QUEUE_CAPACITY, levelParams } from './config';
import { createQueue, queueFill, releaseQueue, remainingAfterOverflow, stepQueue } from './queue';

describe('queue', () => {
	it('adds a ship every interval and not before', () => {
		const queue = createQueue();
		const gap = levelParams(1).queueIntervalMs;
		expect(stepQueue(queue, gap - 1, 1)).toEqual([]);
		expect(queue.waiting).toBe(0);
		expect(stepQueue(queue, 1, 1)).toEqual([{ type: 'arrived', waiting: 1 }]);
		expect(queue.waiting).toBe(1);
	});

	it('keeps leftover time between steps', () => {
		const queue = createQueue();
		const gap = levelParams(1).queueIntervalMs;
		stepQueue(queue, gap * 2.5, 1);
		expect(queue.waiting).toBe(2);
		expect(queue.timerMs).toBeCloseTo(gap / 2);
	});

	it('grows faster on later canals', () => {
		expect(levelParams(6).queueIntervalMs).toBeLessThan(levelParams(1).queueIntervalMs);
		expect(levelParams(99).queueIntervalMs).toBeGreaterThanOrEqual(1500);
	});

	it('costs a heart when the line is too long, then thins out', () => {
		const queue = createQueue();
		queue.waiting = QUEUE_CAPACITY;
		const events = stepQueue(queue, levelParams(1).queueIntervalMs, 1);
		expect(events.map((event) => event.type)).toEqual(['arrived', 'overflow']);
		expect(queue.waiting).toBe(remainingAfterOverflow());
		expect(remainingAfterOverflow(6)).toBe(3);
	});

	it('does not overflow at exactly the capacity', () => {
		const queue = createQueue();
		queue.waiting = QUEUE_CAPACITY - 1;
		const events = stepQueue(queue, levelParams(1).queueIntervalMs, 1);
		expect(events.map((event) => event.type)).toEqual(['arrived']);
		expect(queue.waiting).toBe(QUEUE_CAPACITY);
	});

	it('can overflow more than once in one long step', () => {
		const queue = createQueue();
		const gap = levelParams(1).queueIntervalMs;
		const events = stepQueue(queue, gap * 20, 1);
		expect(events.filter((event) => event.type === 'overflow').length).toBeGreaterThan(1);
	});

	it('lets the whole line through when released', () => {
		const queue = createQueue();
		queue.waiting = 4;
		queue.timerMs = 1200;
		expect(releaseQueue(queue)).toBe(4);
		expect(queue).toEqual({ waiting: 0, timerMs: 0 });
	});

	it('reports how full the line is', () => {
		const queue = createQueue();
		queue.waiting = 3;
		expect(queueFill(queue, 6)).toBe(0.5);
		queue.waiting = 99;
		expect(queueFill(queue, 6)).toBe(1);
	});

	it('ignores negative time', () => {
		const queue = createQueue();
		expect(stepQueue(queue, -5000, 1)).toEqual([]);
		expect(queue.timerMs).toBe(0);
	});
});

/*
 * The line of ships waiting behind the stuck one. A new ship joins at a steady pace; when the line
 * gets longer than the capacity, it costs a heart and the line shortens (some captains give up and
 * take the long way round the Cape). Freeing the ship lets the whole line through. Pure logic.
 */
import { QUEUE_CAPACITY, levelParams } from './config';

export interface QueueState {
	/** Ships waiting right now */
	waiting: number;
	/** Time since the last ship joined */
	timerMs: number;
}

export type QueueEvent = { type: 'arrived'; waiting: number } | { type: 'overflow'; left: number };

export function createQueue(): QueueState {
	return { waiting: 0, timerMs: 0 };
}

/** How many ships stay when the line overflows: the rest turn back */
export function remainingAfterOverflow(capacity: number = QUEUE_CAPACITY): number {
	return Math.floor(capacity / 2);
}

/**
 * Advances the queue by dtMs. Returns what happened, in order: a ship joined, and if that made the
 * line too long, an overflow (one heart lost by the caller).
 */
export function stepQueue(
	queue: QueueState,
	dtMs: number,
	level: number,
	capacity: number = QUEUE_CAPACITY
): QueueEvent[] {
	const events: QueueEvent[] = [];
	const interval = levelParams(level).queueIntervalMs;
	queue.timerMs += Math.max(0, dtMs);
	while (queue.timerMs >= interval) {
		queue.timerMs -= interval;
		queue.waiting += 1;
		events.push({ type: 'arrived', waiting: queue.waiting });
		if (queue.waiting > capacity) {
			queue.waiting = remainingAfterOverflow(capacity);
			events.push({ type: 'overflow', left: queue.waiting });
		}
	}
	return events;
}

/** The line moves on: returns how many ships got through */
export function releaseQueue(queue: QueueState): number {
	const released = queue.waiting;
	queue.waiting = 0;
	queue.timerMs = 0;
	return released;
}

/** Share of the capacity in use, 0 to 1 (for the meter) */
export function queueFill(queue: QueueState, capacity: number = QUEUE_CAPACITY): number {
	return Math.min(1, Math.max(0, queue.waiting / capacity));
}

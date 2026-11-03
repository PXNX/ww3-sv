import { describe, expect, it } from 'vitest';
import { TAKEBACK_INTERVAL_MS } from './campaign';
import { ambientEvents, nextRetakeAt } from './mapLog';

describe('the map log', () => {
	it('tells when the next island falls, and nothing when you hold none', () => {
		expect(nextRetakeAt(1000, 2)).toBe(1000 + TAKEBACK_INTERVAL_MS);
		expect(nextRetakeAt(1000, 0)).toBeNull();
	});

	it('shows the same ambient lines to everyone within the same stretch of time, newest first', () => {
		const now = 1_800_000_000_000;
		const first = ambientEvents(now, 24);
		expect(first).toEqual(ambientEvents(now + 1000, 24));
		expect(first.length).toBeGreaterThan(2);
		for (let index = 1; index < first.length; index++) {
			expect(first[index - 1].atMs).toBeGreaterThanOrEqual(first[index].atMs);
		}
		for (const event of first) {
			expect(event.atMs).toBeLessThanOrEqual(now);
			expect(event.island).toBeGreaterThanOrEqual(0);
			expect(event.island).toBeLessThan(24);
		}
	});

	it('changes as time moves on', () => {
		const now = 1_800_000_000_000;
		expect(ambientEvents(now, 24)).not.toEqual(ambientEvents(now + 5 * 3_600_000, 24));
	});
});

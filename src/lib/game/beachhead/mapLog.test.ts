import { describe, expect, it } from 'vitest';
import { TAKEBACK_INTERVAL_MS } from './campaign';
import { ago, ambientEvents, isPersonal, mergeLog, nextRetakeAt } from './mapLog';

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

describe('the merged log', () => {
	it('never makes up raids on your own base', () => {
		for (let step = 0; step < 50; step++) {
			for (const event of ambientEvents(1_800_000_000_000 + step * 3_600_000, 24)) {
				expect(isPersonal(event)).toBe(false);
				expect(event.island).not.toBe('home');
			}
		}
	});

	it('mixes the real lines in by time, newest first, and caps the list', () => {
		const now = 1_800_000_000_000;
		const real = [
			{ kind: 'raided', player: 'Nadja', island: 'home', atMs: now - 1000, id: 'r1' } as const,
			{
				kind: 'defended',
				player: 'Vasco',
				island: 'home',
				atMs: now - 10 * 3_600_000,
				id: 'r2'
			} as const
		];
		const merged = mergeLog(real, ambientEvents(now, 24), 4);
		expect(merged).toHaveLength(4);
		expect(merged[0].id).toBe('r1');
	});

	it('says how long ago in compact units', () => {
		expect(ago(10 * 60_000, 0)).toBe('10m');
		expect(ago(3 * 3_600_000, 0)).toBe('3h');
		expect(ago(50 * 3_600_000, 0)).toBe('2d');
		expect(ago(1000, 0)).toBe('1m');
	});
});

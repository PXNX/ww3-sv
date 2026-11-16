import { describe, expect, it } from 'vitest';
import { createTelemetry, MAX_EVENTS, TELEMETRY_KEY, sanitizeProps } from './telemetry.js';
import type { KeyValueStorage } from './storage.js';

function memory(): KeyValueStorage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => void values.set(key, value),
		removeItem: (key) => void values.delete(key)
	};
}

function setup(storage = memory()) {
	let time = 1_700_000_000_000;
	let seed = 1;
	const log = createTelemetry(storage, { now: () => time, random: () => (seed++ % 997) / 997 });
	return {
		log,
		storage,
		advance: (ms: number) => (time += ms),
		setTime: (t: number) => (time = t)
	};
}

describe('local telemetry', () => {
	it('records safe events and reads them back newest first', () => {
		const { log } = setup();
		log.track('app_open');
		log.track('page_view', { path: '/play/blocks', tab: 3 });
		const events = log.events();
		expect(events.map((event) => event.name)).toEqual(['page_view', 'app_open']);
		expect(events[0].props).toEqual({ path: '/play/blocks', tab: 3 });
		expect(events[0].at).toBe(1_700_000_000_000);
		expect(events[0].session).toBe(events[1].session);
		expect(events[0].id).not.toBe(events[1].id);
	});

	it('ignores invalid names and keeps the log bounded', () => {
		const { log } = setup();
		log.track('Bad Name');
		log.track('x');
		log.track('no-dashes');
		expect(log.events()).toEqual([]);
		for (let i = 0; i < MAX_EVENTS + 12; i++) log.track('tick', { n: i });
		expect(log.events()).toHaveLength(MAX_EVENTS);
		expect(log.events()[0].props.n).toBe(MAX_EVENTS + 11);
	});

	it('never stores identifying values, free text or too many properties', () => {
		const safe = sanitizeProps({
			path: '/play/wordle',
			telegramToken: 'secret-abc',
			initData: 'query_id=abc',
			userEmail: 'someone@example.com',
			message: 'free text',
			blank: '',
			long: 'x'.repeat(200),
			notANumber: Number.NaN,
			flag: false,
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5,
			f: 6,
			g: 7,
			h: 8,
			i: 9,
			j: 10
		});
		expect(safe).toEqual({
			path: '/play/wordle',
			long: 'x'.repeat(80),
			flag: false,
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5,
			f: 6,
			g: 7
		});
		expect(JSON.stringify(safe)).not.toContain('secret-abc');
		expect(JSON.stringify(safe)).not.toContain('someone@example.com');
	});

	it('rotates the session after a long pause', () => {
		const { log, advance } = setup();
		log.track('app_open');
		const first = log.session();
		advance(60 * 1000);
		log.track('page_view');
		expect(log.session()).toBe(first);
		advance(31 * 60 * 1000);
		log.track('page_view');
		expect(log.session()).not.toBe(first);
	});

	it('counts events, clears them and exports the log', () => {
		const { log } = setup();
		log.track('app_open');
		log.track('page_view', { path: '/play/blocks' });
		log.track('page_view', { path: '/play/veto' });
		expect(log.counts()).toEqual([
			{ name: 'page_view', count: 2 },
			{ name: 'app_open', count: 1 }
		]);
		expect(JSON.parse(log.exportJson()).events).toHaveLength(3);
		const session = log.session();
		log.clear();
		expect(log.events()).toEqual([]);
		expect(log.session()).toBe(session);
	});

	it('survives a reload and tolerates a corrupt or full storage', () => {
		const storage = memory();
		const first = setup(storage);
		first.log.track('app_open');
		const second = setup(storage);
		expect(second.log.events().map((event) => event.name)).toEqual(['app_open']);
		expect(second.log.session()).toBe(first.log.session());

		storage.setItem(TELEMETRY_KEY, '{not json');
		const third = setup(storage);
		expect(third.log.events()).toEqual([]);

		const full: KeyValueStorage = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {}
		};
		const broken = setup(full);
		expect(() => broken.log.track('app_open')).not.toThrow();
		expect(broken.log.events()).toHaveLength(1);
	});
});

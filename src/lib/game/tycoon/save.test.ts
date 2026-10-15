import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { MAX_OWNED } from './config.js';
import {
	SAVE_KEY,
	SAVE_VERSION,
	parseSave,
	readSave,
	serialize,
	writeSave,
	clearSave
} from './save.js';
import { createState } from './state.js';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const random = () => createRandom(3);

function played() {
	const state = createState(random());
	state.barrels = 12_345.5;
	state.runTotal = 99_999;
	state.lifetime = 1_000_000;
	state.taps = 321;
	state.owned.pumpjack = 12;
	state.owned.shadowfleet = 3;
	state.upgrades.push('click_bucket', 'pumpjack_1');
	state.prestigePoints = 7;
	state.prestiges = 2;
	state.achievements.push('first_tap', 'kilo');
	state.eventsHandled = 4;
	state.sanctionsEvaded = 1;
	return state;
}

describe('save and load', () => {
	it('round-trips the whole game through storage', () => {
		const store = createStore(memoryStorage());
		const state = played();
		expect(writeSave(store, state, 1_700_000_000_000)).toBe(true);
		const loaded = readSave(store, random());
		expect(loaded?.savedAt).toBe(1_700_000_000_000);
		expect(loaded?.state).toMatchObject({
			barrels: 12_345.5,
			runTotal: 99_999,
			lifetime: 1_000_000,
			taps: 321,
			upgrades: ['click_bucket', 'pumpjack_1'],
			prestigePoints: 7,
			prestiges: 2,
			achievements: ['first_tap', 'kilo'],
			eventsHandled: 4,
			sanctionsEvaded: 1
		});
		expect(loaded?.state.owned.pumpjack).toBe(12);
		expect(loaded?.state.owned.shadowfleet).toBe(3);
		expect(loaded?.state.owned.tanker).toBe(0);
	});

	it('carries a version and does not save the transient crisis state', () => {
		const state = played();
		state.event = { kind: 'spike', remainingMs: 1000 };
		const data = serialize(state, 5);
		expect(data.version).toBe(SAVE_VERSION);
		expect(data).not.toHaveProperty('event');
		expect(data).not.toHaveProperty('effects');
		expect(JSON.parse(JSON.stringify(data))).toEqual(data);
	});

	it('starts fresh when there is no save', () => {
		expect(readSave(createStore(memoryStorage()), random())).toBeNull();
		expect(readSave(createStore(null), random())).toBeNull();
	});

	it('survives storage that is not valid JSON', () => {
		const store = createStore(memoryStorage({ [`ww3:${SAVE_KEY}`]: '{"version":1,"barrels' }));
		expect(readSave(store, random())).toBeNull();
	});

	it('rejects values that are not a save', () => {
		for (const bad of [null, 42, 'text', [], [1, 2], true, {}, { version: 1 }]) {
			expect(parseSave(bad, random()), JSON.stringify(bad)).toBeNull();
		}
	});

	it('rejects other versions, including unknown future ones', () => {
		const data = serialize(played(), 100);
		expect(parseSave({ ...data, version: 0 }, random())).toBeNull();
		expect(parseSave({ ...data, version: SAVE_VERSION + 1 }, random())).toBeNull();
		expect(parseSave({ ...data, version: '1' }, random())).toBeNull();
		const { version, ...unversioned } = data;
		expect(version).toBe(SAVE_VERSION);
		expect(parseSave(unversioned, random())).toBeNull();
	});

	it('rejects broken or hostile numbers in the key fields', () => {
		const data = serialize(played(), 100);
		for (const field of ['barrels', 'runTotal', 'lifetime', 'savedAt'] as const) {
			for (const bad of [-1, Number.NaN, Infinity, '5', null, undefined, {}]) {
				expect(
					parseSave({ ...data, [field]: bad }, random()),
					`${field}=${String(bad)}`
				).toBeNull();
			}
		}
	});

	it('repairs what it can: clamps counts, drops unknown ids and fixes inconsistent totals', () => {
		const data = serialize(played(), 100);
		const loaded = parseSave(
			{
				...data,
				barrels: 500,
				runTotal: 10,
				lifetime: 20,
				taps: -5,
				prestigePoints: 'lots',
				owned: { pumpjack: 1e12, tanker: -3, refinery: 2.9, nonsense: 5, lobbyist: Number.NaN },
				upgrades: ['click_bucket', 'click_bucket', 'cheat_upgrade', 7, null],
				achievements: 'all'
			},
			random()
		);
		expect(loaded).not.toBeNull();
		const state = loaded!.state;
		expect(state.runTotal).toBe(500);
		expect(state.lifetime).toBe(500);
		expect(state.taps).toBe(0);
		expect(state.prestigePoints).toBe(0);
		expect(state.owned.pumpjack).toBe(MAX_OWNED);
		expect(state.owned.tanker).toBe(0);
		expect(state.owned.refinery).toBe(2);
		expect(state.owned.lobbyist).toBe(0);
		expect(state.upgrades).toEqual(['click_bucket']);
		expect(state.achievements).toEqual([]);
		expect(Object.keys(state.owned).sort()).toEqual(
			Object.keys(createState(random()).owned).sort()
		);
	});

	it('tolerates a save whose owned map or lists are missing', () => {
		const data = serialize(played(), 100) as unknown as Record<string, unknown>;
		delete data.owned;
		delete data.upgrades;
		const loaded = parseSave(data, random());
		expect(loaded?.state.owned.pumpjack).toBe(0);
		expect(loaded?.state.upgrades).toEqual([]);
	});

	it('can be cleared', () => {
		const store = createStore(memoryStorage());
		writeSave(store, played(), 1);
		clearSave(store);
		expect(readSave(store, random())).toBeNull();
	});
});

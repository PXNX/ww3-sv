import { describe, expect, it } from 'vitest';
import { createStore } from '#lib/services/storage.js';
import { claimedGifts, dueGifts, markClaimed, readProgress } from './gifts';

function memoryStore() {
	const map = new Map<string, string>();
	return createStore({
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: (key) => void map.delete(key)
	});
}

const none = { beachheadHeroLevel: 0, raids: 0, hackersMail: 0, hackersNetwork: 0 };

describe('gifts between the games', () => {
	it('reads nothing from an empty device', () => {
		expect(readProgress(memoryStore())).toEqual(none);
	});

	it("sends Prigozhin's hammer to the raids once the hero reaches level 3", () => {
		expect(dueGifts('raid', { ...none, beachheadHeroLevel: 2 }, [])).toEqual([]);
		expect(dueGifts('raid', { ...none, beachheadHeroLevel: 3 }, [])).toEqual(['prigo-hammer']);
		expect(dueGifts('raid', { ...none, beachheadHeroLevel: 9 }, ['prigo-hammer'])).toEqual([]);
	});

	it('only hands each game its own gifts', () => {
		const all = { beachheadHeroLevel: 9, raids: 99, hackersMail: 99, hackersNetwork: 9 };
		expect(dueGifts('beachhead', all, [])).toEqual(['raid-veteran']);
		expect(dueGifts('career', all, [])).toEqual(['hackers-archive']);
		expect(dueGifts('hackers', all, [])).toEqual(['hackers-network']);
	});

	it('remembers what was claimed, once', () => {
		const store = memoryStore();
		markClaimed(store, ['prigo-hammer']);
		markClaimed(store, ['prigo-hammer', 'raid-veteran']);
		expect(claimedGifts(store)).toEqual(['prigo-hammer', 'raid-veteran']);
	});
});

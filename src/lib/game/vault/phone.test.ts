import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	PHONE_DELAY_FLOOR_MS,
	PHONE_DELAY_MS,
	PHONE_FIRST_MIN_MS,
	SHUFFLE_MAX,
	SHUFFLE_MIN
} from './config.js';
import { buildDeck, type Card } from './deck.js';
import { nextPhoneDelay, shuffleCount, shuffleFaceDown } from './phone.js';

function snapshot(cards: Card[]) {
	return cards.map((card) => ({ ...card }));
}

describe('shuffleFaceDown', () => {
	it('moves symbols between face-down cards only and keeps ids and states in place', () => {
		const cards = buildDeck(3, createRandom(8));
		cards[0].state = 'up';
		cards[1].state = 'matched';
		cards[2].state = 'up';
		const before = snapshot(cards);

		const moved = shuffleFaceDown(cards, 6, createRandom(2));

		expect(moved.length).toBeGreaterThanOrEqual(2);
		expect(moved.length).toBeLessThanOrEqual(6);
		for (const index of moved) expect(before[index].state).toBe('down');
		cards.forEach((card, i) => {
			expect(card.id).toBe(before[i].id);
			expect(card.state).toBe(before[i].state);
			if (!moved.includes(i)) expect(card.symbol).toBe(before[i].symbol);
		});
		// The multiset of symbols never changes, so the deck stays solvable
		expect(cards.map((c) => c.symbol).sort()).toEqual(before.map((c) => c.symbol).sort());
		for (const index of moved) expect(cards[index].symbol).not.toBe(before[index].symbol);
	});

	it('reports the moved slots in ascending order and really changes something', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const cards = buildDeck(1, createRandom(seed));
			const before = snapshot(cards);
			const moved = shuffleFaceDown(cards, 2, createRandom(seed + 100));
			expect([...moved].sort((a, b) => a - b)).toEqual(moved);
			const changed = cards.filter((card, i) => card.symbol !== before[i].symbol).length;
			expect(changed).toBe(moved.length);
		}
	});

	it('is deterministic for a seed', () => {
		const a = buildDeck(4, createRandom(1));
		const b = buildDeck(4, createRandom(1));
		expect(shuffleFaceDown(a, 5, createRandom(9))).toEqual(shuffleFaceDown(b, 5, createRandom(9)));
		expect(a).toEqual(b);
	});

	it('does nothing when fewer than two cards are face down', () => {
		const cards = buildDeck(1, createRandom(3));
		cards.forEach((card, i) => (card.state = i === 4 ? 'down' : 'matched'));
		const before = snapshot(cards);
		expect(shuffleFaceDown(cards, 4, createRandom(1))).toEqual([]);
		expect(cards).toEqual(before);
	});

	it('does nothing when the chosen cards all show the same symbol', () => {
		const cards: Card[] = [0, 1].map((id) => ({ id, symbol: 'gold-bar', state: 'down' }));
		expect(shuffleFaceDown(cards, 2, createRandom(1))).toEqual([]);
	});

	it('never moves more cards than asked for, nor more than are face down', () => {
		const cards = buildDeck(2, createRandom(6));
		for (const card of cards.slice(3)) card.state = 'matched';
		expect(shuffleFaceDown(cards, 8, createRandom(4)).length).toBeLessThanOrEqual(3);
		expect(shuffleFaceDown(cards, 1, createRandom(4))).toEqual([]);
	});
});

describe('shuffleCount', () => {
	it('starts small, grows by one per level and is capped', () => {
		expect(shuffleCount(1)).toBe(SHUFFLE_MIN);
		expect(shuffleCount(3)).toBe(SHUFFLE_MIN + 2);
		expect(shuffleCount(50)).toBe(SHUFFLE_MAX);
		expect(shuffleCount(0)).toBe(SHUFFLE_MIN);
	});
});

describe('nextPhoneDelay', () => {
	it('stays within the range on level 1', () => {
		const random = createRandom(5);
		for (let i = 0; i < 50; i++) {
			const delay = nextPhoneDelay(1, random);
			expect(delay).toBeGreaterThanOrEqual(PHONE_DELAY_MS.min);
			expect(delay).toBeLessThanOrEqual(PHONE_DELAY_MS.max);
		}
	});

	it('rings sooner on later levels but never faster than the floor', () => {
		const average = (level: number) => {
			const random = createRandom(7);
			let sum = 0;
			for (let i = 0; i < 200; i++) sum += nextPhoneDelay(level, random);
			return sum / 200;
		};
		expect(average(4)).toBeLessThan(average(1));
		const random = createRandom(1);
		for (let i = 0; i < 50; i++) {
			expect(nextPhoneDelay(99, random)).toBeGreaterThanOrEqual(PHONE_DELAY_FLOOR_MS);
		}
	});

	it('leaves a quiet start for the first call', () => {
		const random = createRandom(3);
		for (let i = 0; i < 50; i++) {
			expect(nextPhoneDelay(99, random, true)).toBeGreaterThanOrEqual(PHONE_FIRST_MIN_MS);
		}
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { buildDeck, levelConfig, pickDesigns } from './deck.js';
import { SPECIAL_PAIR, SYMBOLS } from './symbols.js';

function counts(symbols: string[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const symbol of symbols) map.set(symbol, (map.get(symbol) ?? 0) + 1);
	return map;
}

describe('levelConfig', () => {
	it('grows the grid with the level and keeps an even number of cards', () => {
		const sizes = [1, 2, 3, 4, 5].map((level) => {
			const { cols, rows, pairs } = levelConfig(level);
			expect(cols * rows).toBe(pairs * 2);
			return cols * rows;
		});
		expect(sizes).toEqual([12, 16, 20, 24, 30]);
	});

	it('stays on the biggest grid after the last step', () => {
		expect(levelConfig(9)).toEqual({ ...levelConfig(5), level: 9 });
	});

	it('treats junk levels as level 1', () => {
		expect(levelConfig(0).level).toBe(1);
		expect(levelConfig(-3).level).toBe(1);
		expect(levelConfig(Number.NaN).level).toBe(1);
		expect(levelConfig(2.9).level).toBe(2);
	});
});

describe('pickDesigns', () => {
	it('starts with the special pair and then uses different designs', () => {
		const designs = pickDesigns(8, createRandom(3));
		expect(designs.slice(0, 2)).toEqual([...SPECIAL_PAIR]);
		expect(new Set(designs).size).toBe(8);
	});

	it('repeats designs once a grid has more pairs than designs exist', () => {
		const designs = pickDesigns(15, createRandom(4));
		expect(designs).toHaveLength(15);
		for (const design of designs) expect(SYMBOLS).toContain(design);
		expect(new Set(designs).size).toBe(SYMBOLS.length);
	});
});

describe('buildDeck', () => {
	it('is deterministic for a seed and differs between seeds', () => {
		const a = buildDeck(2, createRandom(11)).map((card) => card.symbol);
		const b = buildDeck(2, createRandom(11)).map((card) => card.symbol);
		const c = buildDeck(2, createRandom(12)).map((card) => card.symbol);
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
	});

	it('deals every design an even number of times, all face down with unique ids', () => {
		for (let level = 1; level <= 7; level++) {
			const deck = buildDeck(level, createRandom(level * 31));
			expect(deck).toHaveLength(levelConfig(level).cols * levelConfig(level).rows);
			for (const count of counts(deck.map((card) => card.symbol)).values()) {
				expect(count % 2).toBe(0);
			}
			expect(deck.every((card) => card.state === 'down')).toBe(true);
			expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
		}
	});

	it('always contains the gold bar and the cheese wheel', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const symbols = buildDeck(1, createRandom(seed)).map((card) => card.symbol);
			for (const special of SPECIAL_PAIR) expect(symbols).toContain(special);
		}
	});

	it('actually shuffles: the pairs are not simply side by side', () => {
		const deck = buildDeck(4, createRandom(5));
		const sidePairs = deck.filter((card, i) => i % 2 === 0 && deck[i + 1].symbol === card.symbol);
		expect(sidePairs.length).toBeLessThan(deck.length / 2);
	});
});

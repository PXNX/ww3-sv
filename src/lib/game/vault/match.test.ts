import { describe, expect, it } from 'vitest';
import { SPECIAL_PAIR, SYMBOLS, SYMBOL_KINDS, matchResult } from './symbols.js';

describe('matchResult', () => {
	it('matches the same design as a plain pair', () => {
		for (const symbol of SYMBOLS) expect(matchResult(symbol, symbol)).toBe('pair');
	});

	it('makes a gold bar with a cheese wheel the special pair, in either order', () => {
		const [gold, cheese] = SPECIAL_PAIR;
		expect(matchResult(gold, cheese)).toBe('special');
		expect(matchResult(cheese, gold)).toBe('special');
	});

	it('does not match anything else, not even the same kind of a different design', () => {
		expect(matchResult('gold-bar', 'gold-coin')).toBeNull();
		expect(matchResult('cheese-wheel', 'cheese-wedge')).toBeNull();
		expect(matchResult('gold-coin', 'cheese-wheel')).toBeNull();
		expect(matchResult('gold-bar', 'cheese-wedge')).toBeNull();
		expect(matchResult('watch-pocket', 'choc-bar')).toBeNull();
	});

	it('is symmetric for every pair of designs', () => {
		for (const a of SYMBOLS)
			for (const b of SYMBOLS) expect(matchResult(a, b)).toBe(matchResult(b, a));
	});

	it('has three designs of each of the four kinds', () => {
		const kinds = new Map<string, number>();
		for (const kind of Object.values(SYMBOL_KINDS)) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
		expect([...kinds.keys()].sort()).toEqual(['cheese', 'chocolate', 'gold', 'watch']);
		expect([...kinds.values()]).toEqual([3, 3, 3, 3]);
	});
});

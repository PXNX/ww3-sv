import { describe, expect, it } from 'vitest';
import {
	createRandom,
	dailySeed,
	dayKey,
	pickOne,
	pickWeighted,
	randomInt,
	seedFromString,
	shuffle
} from './random';

describe('seeded random', () => {
	it('repeats the same sequence for the same seed', () => {
		const a = createRandom(42);
		const b = createRandom(42);
		const first = Array.from({ length: 5 }, a);
		expect(Array.from({ length: 5 }, b)).toEqual(first);
		expect(Array.from({ length: 5 }, createRandom(43))).not.toEqual(first);
	});

	it('stays within [0, 1)', () => {
		const random = createRandom(7);
		for (let i = 0; i < 10_000; i++) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});

	it('produces integers within the requested range', () => {
		const random = createRandom(1);
		const seen = new Set<number>();
		for (let i = 0; i < 1000; i++) seen.add(randomInt(random, 3, 7));
		expect([...seen].sort()).toEqual([3, 4, 5, 6]);
	});

	it('picks items and respects weights', () => {
		const random = createRandom(5);
		expect(['a', 'b']).toContain(pickOne(random, ['a', 'b']));
		expect(() => pickOne(random, [])).toThrow();
		const counts = { rare: 0, common: 0, never: 0 };
		for (let i = 0; i < 2000; i++) {
			const item = pickWeighted(random, [
				{ item: 'rare' as const, weight: 1 },
				{ item: 'common' as const, weight: 9 },
				{ item: 'never' as const, weight: 0 }
			]);
			counts[item]++;
		}
		expect(counts.never).toBe(0);
		expect(counts.common).toBeGreaterThan(counts.rare * 4);
	});

	it('shuffles without losing or duplicating items', () => {
		const items = [1, 2, 3, 4, 5, 6, 7, 8];
		const shuffled = shuffle(createRandom(9), items);
		expect([...shuffled].sort()).toEqual(items);
		expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('derives stable seeds from text', () => {
		expect(seedFromString('wordle')).toBe(seedFromString('wordle'));
		expect(seedFromString('wordle')).not.toBe(seedFromString('vault'));
		expect(Number.isInteger(seedFromString('x'))).toBe(true);
	});

	it('formats the day key in local time with zero padding', () => {
		expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
		expect(dayKey(new Date(2026, 10, 15, 0, 1))).toBe('2026-11-15');
	});

	it('gives the same daily seed all day and a new one each day and mode', () => {
		const morning = new Date(2026, 5, 1, 7, 0);
		const evening = new Date(2026, 5, 1, 22, 30);
		const nextDay = new Date(2026, 5, 2, 7, 0);
		expect(dailySeed('wordle', morning)).toBe(dailySeed('wordle', evening));
		expect(dailySeed('wordle', morning)).not.toBe(dailySeed('wordle', nextDay));
		expect(dailySeed('wordle', morning)).not.toBe(dailySeed('vault', morning));
	});
});

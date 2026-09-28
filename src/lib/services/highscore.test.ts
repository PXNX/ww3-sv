import { describe, expect, it } from 'vitest';
import { bestKey, createHighscores } from './highscore';
import { createStore, type KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const throwingStorage: KeyValueStorage = {
	getItem: () => {
		throw new Error('denied');
	},
	setItem: () => {
		throw new Error('quota exceeded');
	},
	removeItem: () => {
		throw new Error('denied');
	}
};

describe('highscores', () => {
	it('returns null when nothing is stored', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		expect(scores.get(['blocks'])).toBeNull();
	});

	it('records a first positive score as a new best', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		expect(scores.submit(['blocks'], 120)).toEqual({ isNewBest: true, best: 120, previous: null });
		expect(scores.get(['blocks'])).toBe(120);
	});

	it('does not celebrate a first score of zero', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		expect(scores.submit(['blocks'], 0).isNewBest).toBe(false);
		expect(scores.get(['blocks'])).toBeNull();
	});

	it('only replaces the best with a higher score by default', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		scores.submit(['blocks'], 100);
		expect(scores.submit(['blocks'], 80)).toEqual({ isNewBest: false, best: 100, previous: 100 });
		expect(scores.submit(['blocks'], 100).isNewBest).toBe(false);
		expect(scores.submit(['blocks'], 150)).toEqual({ isNewBest: true, best: 150, previous: 100 });
	});

	it('supports lower-is-better values such as fastest times', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		expect(scores.submit(['minefield', 'easy', 'time'], 90, 'lower').isNewBest).toBe(true);
		expect(scores.submit(['minefield', 'easy', 'time'], 120, 'lower').isNewBest).toBe(false);
		expect(scores.submit(['minefield', 'easy', 'time'], 60, 'lower').best).toBe(60);
	});

	it('keeps modes and variants separate', () => {
		const storage = memoryStorage();
		const scores = createHighscores(createStore(storage));
		scores.submit(['minefield', 'easy', 'score'], 10);
		scores.submit(['minefield', 'hard', 'score'], 50);
		scores.submit(['merge', 'score'], 30);
		expect(scores.get(['minefield', 'easy', 'score'])).toBe(10);
		expect(scores.get(['minefield', 'hard', 'score'])).toBe(50);
		expect(scores.get(['merge', 'score'])).toBe(30);
		expect([...storage.data.keys()].sort()).toEqual([
			'ww3:best:merge:score',
			'ww3:best:minefield:easy:score',
			'ww3:best:minefield:hard:score'
		]);
	});

	it('ignores corrupted stored values', () => {
		const storage = memoryStorage();
		storage.setItem(`ww3:${bestKey(['blocks'])}`, '"not a number"');
		const scores = createHighscores(createStore(storage));
		expect(scores.get(['blocks'])).toBeNull();
		storage.setItem(`ww3:${bestKey(['blocks'])}`, '{broken json');
		expect(scores.get(['blocks'])).toBeNull();
	});

	it('ignores non-finite scores', () => {
		const scores = createHighscores(createStore(memoryStorage()));
		expect(scores.submit(['blocks'], Number.NaN).isNewBest).toBe(false);
		expect(scores.submit(['blocks'], Number.POSITIVE_INFINITY).isNewBest).toBe(false);
	});

	it('keeps working when storage is unavailable', () => {
		for (const storage of [null, throwingStorage]) {
			const scores = createHighscores(createStore(storage));
			expect(scores.get(['blocks'])).toBeNull();
			expect(() => scores.submit(['blocks'], 10)).not.toThrow();
		}
	});
});

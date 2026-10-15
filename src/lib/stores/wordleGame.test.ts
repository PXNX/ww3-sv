import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { dailySolution } from '#lib/game/wordle/daily.js';
import { MAX_GUESSES } from '#lib/game/wordle/locales.js';
import { isWordleSave, saveKey, type WordleSave } from '#lib/game/wordle/stats.js';
import { wordLists } from '#lib/game/wordle/words/index.js';
import { createStore, type KeyValueStorage, type Store } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { WordleGame } from './wordleGame.svelte';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const DAY_ONE = new Date(2026, 9, 15, 10, 0, 0);

function setup(
	options: { storage?: KeyValueStorage; locale?: 'en' | 'de' | 'fa'; start?: Date } = {}
) {
	const storage = options.storage ?? memoryStorage();
	const store = createStore(storage);
	const clock = { now: options.start ?? DAY_ONE };
	const make = () =>
		new WordleGame({
			locale: options.locale ?? 'en',
			store: () => store,
			now: () => clock.now,
			random: () => createRandom(11)
		});
	return { game: make(), make, store, storage, clock };
}

function readSave(store: Store): WordleSave | null {
	return store.read<WordleSave | null>(saveKey('en'), null, isWordleSave);
}

/** Types a word letter by letter and submits it */
function play(game: WordleGame, word: string): boolean {
	game.type([...word]);
	return game.submit();
}

/** Some valid word that is not the solution */
function wrongWord(game: WordleGame, skip = 0): string {
	return game.solutions.filter((word) => word !== game.solution)[skip];
}

describe('WordleGame: the daily puzzle', () => {
	it('starts with the word of the day for the locale and an empty board', () => {
		const { game } = setup();
		expect(game.mode).toBe('daily');
		expect(game.solution).toBe(dailySolution('en', wordLists('en').solutions, DAY_ONE));
		expect(game.day).toBe('2026-10-15');
		expect(game.status).toBe('playing');
		expect(game.guesses).toEqual([]);
		expect(game.rows).toHaveLength(MAX_GUESSES);
	});

	it('gives a different word to a different locale', () => {
		const en = setup({ locale: 'en' }).game;
		const de = setup({ locale: 'de' }).game;
		expect(en.solution).not.toBe(de.solution);
		expect(wordLists('de').solutions).toContain(de.solution);
	});

	it('types up to five letters, deletes, and lets an umlaut be two letters', () => {
		const { game } = setup();
		game.type(['A', 'B']);
		expect(game.current).toBe('AB');
		game.backspace();
		expect(game.current).toBe('A');
		game.type(['B', 'C', 'D', 'E', 'F', 'G']);
		expect(game.current).toBe('ABCDE');
		game.type(['X']);
		expect(game.current).toBe('ABCDE');
		game.backspace();
		game.backspace();
		game.backspace();
		game.backspace();
		game.backspace();
		game.backspace();
		expect(game.current).toBe('');
	});

	it('rejects a short guess with a notice and a shake', () => {
		const { game } = setup();
		game.type(['A', 'B']);
		expect(game.submit()).toBe(false);
		expect(game.notice?.kind).toBe('short');
		expect(game.shakes).toBe(1);
		expect(game.guesses).toEqual([]);
		expect(game.current).toBe('AB');
	});

	it('rejects a word that is not in the list and keeps the typed letters', () => {
		const { game } = setup();
		expect(play(game, 'QQQQQ')).toBe(false);
		expect(game.notice?.kind).toBe('unknown');
		expect(game.guesses).toEqual([]);
		expect(game.current).toBe('QQQQQ');
		expect(game.shakes).toBe(1);
	});

	it('accepts a listed word, marks it and clears the typed letters', () => {
		const { game } = setup();
		const word = wrongWord(game);
		expect(play(game, word)).toBe(true);
		expect(game.guesses).toEqual([word]);
		expect(game.current).toBe('');
		expect(game.revealRow).toBe(0);
		expect(game.marks).toHaveLength(1);
		expect(game.rows[0].kind).toBe('submitted');
		expect(game.status).toBe('playing');
	});

	it('is won by the solution: stats, streak and distribution are recorded and saved', () => {
		const { game, store } = setup();
		play(game, wrongWord(game));
		expect(play(game, game.solution)).toBe(true);
		expect(game.status).toBe('won');
		expect(game.won).toBe(true);
		expect(game.finished).toBe(true);
		expect(game.finishes).toBe(1);
		expect(game.stats.played).toBe(1);
		expect(game.stats.won).toBe(1);
		expect(game.stats.streak).toBe(1);
		expect(game.stats.distribution).toEqual([0, 1, 0, 0, 0, 0]);
		expect(game.streak).toBe(1);
		expect(game.winPercent).toBe(100);
		const saved = readSave(store);
		expect(isWordleSave(saved)).toBe(true);
		expect(saved?.status).toBe('won');
	});

	it('is lost after six wrong guesses', () => {
		const { game } = setup();
		for (let i = 0; i < MAX_GUESSES; i++) {
			expect(game.status).toBe('playing');
			play(game, wrongWord(game, i));
		}
		expect(game.status).toBe('lost');
		expect(game.guesses).toHaveLength(MAX_GUESSES);
		expect(game.stats.played).toBe(1);
		expect(game.stats.won).toBe(0);
		expect(game.stats.streak).toBe(0);
		expect(game.streak).toBe(0);
	});

	it('ignores typing and guesses once the puzzle is over', () => {
		const { game } = setup();
		play(game, game.solution);
		game.type(['A']);
		expect(game.current).toBe('');
		expect(game.submit()).toBe(false);
		expect(game.guesses).toHaveLength(1);
		expect(game.stats.played).toBe(1);
	});

	it('keeps the guesses and the result when the page is reopened on the same day', () => {
		const { game, make } = setup();
		const word = wrongWord(game);
		play(game, word);
		const again = make();
		expect(again.guesses).toEqual([word]);
		expect(again.solution).toBe(game.solution);
		expect(again.status).toBe('playing');
		expect(again.revealRow).toBe(-1);

		play(game, game.solution);
		const finished = make();
		expect(finished.status).toBe('won');
		expect(finished.finishes).toBe(0);
		expect(finished.stats.played).toBe(1);
		// the finished puzzle cannot be played a second time
		finished.type(['A']);
		expect(finished.current).toBe('');
	});

	it('keeps the saved word even if the list is later edited', () => {
		const { game, store, make } = setup();
		store.write('wordle:en', { ...readSave(store), solution: 'ZZZZZ' });
		expect(make().solution).toBe('ZZZZZ');
		expect(game.solution).not.toBe('ZZZZZ');
	});

	it('keeps a separate save per locale', () => {
		const storage = memoryStorage();
		const en = setup({ storage, locale: 'en' });
		const de = setup({ storage, locale: 'de' });
		play(en.game, en.game.solution);
		expect(de.make().status).toBe('playing');
		expect(en.make().status).toBe('won');
		expect(saveKey('en')).not.toBe(saveKey('de'));
	});

	it('starts over with a fresh puzzle and a continuing streak on the next day', () => {
		const { game, make, clock } = setup();
		play(game, game.solution);
		expect(game.stats.streak).toBe(1);

		clock.now = new Date(2026, 9, 16, 9, 0, 0);
		const next = make();
		expect(next.day).toBe('2026-10-16');
		expect(next.status).toBe('playing');
		expect(next.guesses).toEqual([]);
		expect(next.solution).toBe(dailySolution('en', wordLists('en').solutions, clock.now));
		// yesterday's win still counts as the streak while today's puzzle is open
		expect(next.streak).toBe(1);

		play(next, next.solution);
		expect(next.stats.streak).toBe(2);
		expect(next.stats.maxStreak).toBe(2);
		expect(next.stats.played).toBe(2);
	});

	it('resets the streak when a day is missed', () => {
		const { game, make, clock } = setup();
		play(game, game.solution);
		clock.now = new Date(2026, 9, 18, 9, 0, 0);
		const later = make();
		expect(later.streak).toBe(0);
		play(later, later.solution);
		expect(later.stats.streak).toBe(1);
		expect(later.stats.maxStreak).toBe(1);
	});

	it('moves to the next puzzle by itself when the day turns while the page is open', () => {
		const { game, clock } = setup();
		play(game, wrongWord(game));
		game.type(['A']);
		clock.now = new Date(2026, 9, 15, 23, 59, 30);
		game.tick();
		expect(game.day).toBe('2026-10-15');
		expect(game.msLeft).toBe(30_000);
		expect(game.notice).toBeNull();

		clock.now = new Date(2026, 9, 16, 0, 0, 1);
		game.tick();
		expect(game.day).toBe('2026-10-16');
		expect(game.guesses).toEqual([]);
		expect(game.current).toBe('');
		expect(game.status).toBe('playing');
		expect(game.solution).toBe(dailySolution('en', wordLists('en').solutions, clock.now));
		expect(game.notice?.kind).toBe('newDay');
		expect(game.msLeft).toBe(24 * 3_600_000 - 1000);
	});

	it('plays with unavailable storage and with a corrupt save', () => {
		const store = createStore(null);
		const game = new WordleGame({ locale: 'en', store: () => store, now: () => DAY_ONE });
		play(game, game.solution);
		expect(game.status).toBe('won');

		const corrupt = setup({ storage: memoryStorage({ 'ww3:wordle:en': '{"nope":1}' }) });
		expect(corrupt.game.status).toBe('playing');
		expect(corrupt.game.stats.played).toBe(0);
		const garbage = setup({ storage: memoryStorage({ 'ww3:wordle:en': 'not json' }) });
		expect(garbage.game.guesses).toEqual([]);
	});

	it('spells umlauts out when typing German', () => {
		const { game } = setup({ locale: 'de' });
		game.type(['K', 'A', 'E', 'S', 'E']);
		expect(game.current).toBe('KAESE');
		expect(game.submit()).toBe(true);
	});
});

describe('WordleGame: practice mode', () => {
	it('gives random words, never the same twice in a row, with no effect on the stats', () => {
		const { game, store } = setup();
		const daily = game.solution;
		game.startPractice();
		expect(game.mode).toBe('practice');
		expect(wordLists('en').solutions).toContain(game.solution);
		const first = game.solution;
		play(game, game.solution);
		expect(game.status).toBe('won');
		expect(game.stats.played).toBe(0);
		expect(game.stats.streak).toBe(0);
		// practice never writes the daily save
		expect(readSave(store)?.guesses).toEqual([]);

		game.startPractice();
		expect(game.status).toBe('playing');
		expect(game.guesses).toEqual([]);
		expect(game.solution).not.toBe(first);

		game.showDaily();
		expect(game.mode).toBe('daily');
		expect(game.solution).toBe(daily);
	});

	it('is lost after six guesses without costing the daily streak', () => {
		const { game } = setup();
		play(game, game.solution);
		const streak = game.stats.streak;
		game.startPractice();
		for (let i = 0; i < MAX_GUESSES; i++) play(game, wrongWord(game, i));
		expect(game.status).toBe('lost');
		expect(game.stats.streak).toBe(streak);
		expect(game.stats.played).toBe(1);
	});

	it('does not roll over with the day', () => {
		const { game, clock } = setup();
		game.startPractice();
		const solution = game.solution;
		clock.now = new Date(2026, 9, 16, 0, 0, 5);
		game.tick();
		expect(game.mode).toBe('practice');
		expect(game.solution).toBe(solution);
		game.showDaily();
		expect(game.day).toBe('2026-10-16');
	});
});

describe('WordleGame: sharing', () => {
	it('shares the squares of a finished puzzle without any letter', () => {
		const { game } = setup();
		const wrong = wrongWord(game);
		play(game, wrong);
		play(game, game.solution);
		const text = game.share('Sanctions Wordle', 'https://example.test');
		const lines = text.split('\n');
		expect(lines[0]).toBe(`Sanctions Wordle EN #${game.puzzleNumber} 2/6`);
		expect(lines).toHaveLength(2 + 2 + 2);
		for (const letter of [...wrong, ...game.solution]) {
			expect(lines.slice(2, 4).join('')).not.toContain(letter);
		}
		expect(lines.at(-1)).toBe('https://example.test');
	});

	it('shares a practice round without a number', () => {
		const { game } = setup();
		game.startPractice();
		play(game, game.solution);
		expect(game.share('T').split('\n')[0]).toBe('T EN 1/6');
	});
});

describe('Sanctions Wordle messages', () => {
	it('has every message in every language', () => {
		expect(missingMessages(['wordle_', 'mode_wordle_'])).toEqual([]);
	});
});

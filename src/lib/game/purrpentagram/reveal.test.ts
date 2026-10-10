import { describe, expect, it } from 'vitest';
import {
	LETTERS_PER_SECOND,
	revealDurationMs,
	revealLines,
	revealsByWord,
	revealUnits,
	shownUnits,
	WORDS_PER_SECOND
} from './reveal';

describe('revealUnits', () => {
	it('splits into letters, keeping umlauts, ß and surrogate pairs whole', () => {
		expect(revealUnits('Größe', false)).toEqual(['G', 'r', 'ö', 'ß', 'e']);
		expect(revealUnits('a🐈b', false)).toEqual(['a', '🐈', 'b']);
	});

	it('splits into words that keep the space after them, for joining scripts', () => {
		expect(revealUnits('گربه سیاه  است', true)).toEqual(['گربه ', 'سیاه  ', 'است']);
		expect(revealUnits('', true)).toEqual([]);
	});

	it('reveals Persian and Arabic by word and everything else by letter', () => {
		expect(revealsByWord('fa')).toBe(true);
		expect(revealsByWord('ar')).toBe(true);
		for (const locale of ['en', 'de', 'uk', 'ru']) expect(revealsByWord(locale)).toBe(false);
	});
});

describe('shownUnits', () => {
	it('shows nothing at first and everything in the end', () => {
		expect(shownUnits(0, 40, false)).toBe(0);
		expect(shownUnits(10_000, 40, false)).toBe(40);
		expect(shownUnits(-50, 40, false)).toBe(0);
	});

	it('follows the letter and word speeds', () => {
		expect(shownUnits(1000, 100, false)).toBe(LETTERS_PER_SECOND);
		expect(shownUnits(1000, 100, true)).toBe(WORDS_PER_SECOND);
	});
});

describe('revealLines', () => {
	const lines = ['abcd', 'efgh'];

	it('hides everything before the start and keeps the whole text so lines hold their shape', () => {
		const [first, second] = revealLines(lines, 0, false);
		expect(first).toEqual({ shown: '', hidden: 'abcd' });
		expect(second).toEqual({ shown: '', hidden: 'efgh' });
	});

	it('reveals a line before starting the next one', () => {
		const partway = revealLines(lines, (2 / LETTERS_PER_SECOND) * 1000 + 1, false);
		expect(partway[0]).toEqual({ shown: 'ab', hidden: 'cd' });
		expect(partway[1].shown).toBe('');

		const next = revealLines(
			lines,
			revealDurationMs('abcd', false) + (2 / LETTERS_PER_SECOND) * 1000 + 1,
			false
		);
		expect(next[0]).toEqual({ shown: 'abcd', hidden: '' });
		expect(next[1]).toEqual({ shown: 'ef', hidden: 'gh' });
	});

	it('is complete once all the lines have had their time', () => {
		const total = lines.reduce((sum, line) => sum + revealDurationMs(line, false), 0);
		const done = revealLines(lines, total + 10, false);
		expect(done.map((line) => line.shown)).toEqual(lines);
		expect(done.every((line) => line.hidden === '')).toBe(true);
	});

	it('shown and hidden always add up to the original line', () => {
		for (const elapsed of [0, 100, 450, 2000]) {
			revealLines(['Größe der Katze', 'zweite Zeile'], elapsed, false).forEach((line, i) => {
				expect(line.shown + line.hidden).toBe(['Größe der Katze', 'zweite Zeile'][i]);
			});
		}
	});
});

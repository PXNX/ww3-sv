import { describe, expect, it } from 'vitest';
import { ALPHABETS, WORDLE_LOCALES, WORD_LENGTH, isValidWord, normalizeWord } from '../locales';
import { isAllowedGuess, rawEntries, wordLists } from './index';

const MIN_SOLUTIONS = 150;
const MIN_ALLOWED = 800;

describe.each(WORDLE_LOCALES)('word lists for %s', (locale) => {
	const raw = rawEntries(locale);
	const lists = wordLists(locale);

	it('has enough solutions and allowed guesses', () => {
		expect(lists.solutions.length).toBeGreaterThanOrEqual(MIN_SOLUTIONS);
		expect(lists.allowed.size).toBeGreaterThanOrEqual(MIN_ALLOWED);
		expect(lists.allowed.size).toBeGreaterThan(lists.solutions.length);
	});

	it('has only five-letter words of the locale alphabet, after normalisation', () => {
		const bad = [...lists.solutions, ...lists.extra].filter((word) => !isValidWord(locale, word));
		expect(bad).toEqual([]);
		for (const word of lists.allowed) {
			expect([...word]).toHaveLength(WORD_LENGTH);
			expect([...word].every((letter) => ALPHABETS[locale].includes(letter))).toBe(true);
		}
	});

	it('has no duplicates, also not across the two lists', () => {
		const all = [...lists.solutions, ...lists.extra];
		const seen = new Set<string>();
		const duplicates = all.filter((word) => (seen.has(word) ? true : (seen.add(word), false)));
		expect(duplicates).toEqual([]);
		expect(lists.allowed.size).toBe(all.length);
	});

	it('allows every solution as a guess (the solutions are a subset of the allowed words)', () => {
		for (const word of lists.solutions) expect(isAllowedGuess(locale, word), word).toBe(true);
		for (const word of lists.extra) expect(isAllowedGuess(locale, word), word).toBe(true);
	});

	it('does not allow words that are not listed', () => {
		expect(isAllowedGuess(locale, '')).toBe(false);
		expect(isAllowedGuess(locale, '12345')).toBe(false);
		expect(isAllowedGuess(locale, 'QQQQQ')).toBe(false);
	});

	it('keeps the list entries free of stray characters', () => {
		// Entries are plain words: no apostrophes, hyphens, digits, punctuation or Latin letters in
		// the non-Latin lists
		for (const entry of [...raw.solutions, ...raw.extra]) {
			expect(entry, entry).toMatch(/^[\p{L}\p{M}]+$/u);
		}
		if (locale !== 'en' && locale !== 'de') {
			for (const entry of [...raw.solutions, ...raw.extra])
				expect(entry, entry).not.toMatch(/[A-Za-z]/);
		}
	});

	it('is stable when normalised again', () => {
		for (const word of lists.allowed) expect(normalizeWord(locale, word)).toBe(word);
	});
});

describe('locale-specific rules in the lists', () => {
	it('never uses Ё in Russian, or Ґ, Є, І, Ї outside Ukrainian words that need them', () => {
		for (const word of wordLists('ru').allowed) expect(word).not.toContain('Ё');
		for (const word of wordLists('ru').allowed) expect(word).not.toMatch(/[ҐЄІЇ]/);
	});

	it('has Ukrainian words that use the Ukrainian letters, and none of the Russian-only ones', () => {
		const uk = [...wordLists('uk').allowed];
		for (const letter of ['Ґ', 'Є', 'І', 'Ї']) {
			expect(
				uk.some((word) => word.includes(letter)),
				letter
			).toBe(true);
		}
		for (const word of uk) expect(word).not.toMatch(/[ЁЪЫЭ]/);
	});

	it('spells German umlauts out, so the stored words are plain A-Z', () => {
		const de = wordLists('de').allowed;
		expect(de.has('KAESE')).toBe(true);
		expect(de.has('GRUEN')).toBe(true);
		expect(de.has('WEISS')).toBe(true);
		for (const word of de) expect(word).toMatch(/^[A-Z]{5}$/);
	});

	it('uses Persian letters in Persian and Arabic letters in Arabic', () => {
		for (const word of wordLists('fa').allowed) {
			expect(word).not.toMatch(/[\u{0643}\u{064A}\u{0649}\u{0629}]/u);
		}
		for (const word of wordLists('ar').allowed) {
			expect(word).not.toMatch(/[\u{06A9}\u{06CC}\u{067E}\u{0686}\u{0698}\u{06AF}]/u);
		}
	});

	it('has thematic words in English', () => {
		const en = wordLists('en').solutions;
		for (const word of ['QUOTA', 'CRUDE', 'TRADE', 'CARGO', 'ENVOY', 'AUDIT']) {
			expect(en, word).toContain(word);
		}
	});
});

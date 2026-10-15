import { describe, expect, it } from 'vitest';
import {
	ALPHABETS,
	KEYBOARDS,
	WORDLE_LOCALES,
	WORD_LENGTH,
	arrangeRow,
	inputLetters,
	isRtlLocale,
	isValidWord,
	isWordleLocale,
	normalizeWord,
	rowDisplayOrder,
	wordleLocale
} from './locales';

// Persian and Arabic letters that look alike are written as escapes in these tests
const PERSIAN_KEHEH = '\u{06A9}';
const PERSIAN_YEH = '\u{06CC}';
const ARABIC_KAF = '\u{0643}';
const ARABIC_YEH = '\u{064A}';

describe('locales and alphabets', () => {
	it('knows the six supported locales', () => {
		expect([...WORDLE_LOCALES].sort()).toEqual(['ar', 'de', 'en', 'fa', 'ru', 'uk']);
		expect(isWordleLocale('de')).toBe(true);
		expect(isWordleLocale('fr')).toBe(false);
		expect(wordleLocale('fr')).toBe('en');
		expect(wordleLocale('uk')).toBe('uk');
	});

	it.each(WORDLE_LOCALES)('%s has an alphabet without duplicates', (locale) => {
		const alphabet = ALPHABETS[locale];
		expect(new Set(alphabet).size).toBe(alphabet.length);
		expect(alphabet.every((letter) => [...letter].length === 1)).toBe(true);
	});

	it('has the expected alphabet sizes', () => {
		expect(ALPHABETS.en).toHaveLength(26);
		expect(ALPHABETS.de).toHaveLength(26);
		expect(ALPHABETS.ru).toHaveLength(32);
		expect(ALPHABETS.uk).toHaveLength(33);
		expect(ALPHABETS.fa).toHaveLength(32);
		expect(ALPHABETS.ar).toHaveLength(28);
	});

	it('keeps the special letters of each language and leaves out the folded ones', () => {
		for (const letter of ['Ґ', 'Є', 'І', 'Ї']) expect(ALPHABETS.uk).toContain(letter);
		for (const letter of ['Ё', 'Ы', 'Э', 'Ъ']) expect(ALPHABETS.uk).not.toContain(letter);
		expect(ALPHABETS.ru).not.toContain('Ё');
		expect(ALPHABETS.ru).not.toContain('Ґ');
		expect(ALPHABETS.de).not.toContain('Ä');
	});

	it('uses Persian kaf and yeh in Persian and Arabic kaf and yeh in Arabic', () => {
		expect(ALPHABETS.fa).toContain(PERSIAN_KEHEH);
		expect(ALPHABETS.fa).toContain(PERSIAN_YEH);
		expect(ALPHABETS.fa).not.toContain(ARABIC_KAF);
		expect(ALPHABETS.fa).not.toContain(ARABIC_YEH);
		expect(ALPHABETS.ar).toContain(ARABIC_KAF);
		expect(ALPHABETS.ar).toContain(ARABIC_YEH);
		expect(ALPHABETS.ar).not.toContain(PERSIAN_KEHEH);
		expect(ALPHABETS.ar).not.toContain(PERSIAN_YEH);
	});
});

describe('keyboard layouts', () => {
	it.each(WORDLE_LOCALES)('%s keyboard has every letter of the alphabet exactly once', (locale) => {
		const keys = KEYBOARDS[locale].flat();
		expect(new Set(keys).size).toBe(keys.length);
		expect([...keys].sort()).toEqual([...ALPHABETS[locale]].sort());
	});

	it.each(WORDLE_LOCALES)('%s keyboard has three rows that fit a phone screen', (locale) => {
		const rows = KEYBOARDS[locale];
		expect(rows).toHaveLength(3);
		for (const row of rows) {
			expect(row.length).toBeGreaterThanOrEqual(5);
			expect(row.length).toBeLessThanOrEqual(12);
		}
	});

	it('uses the QWERTY, QWERTZ and JCUKEN row starts', () => {
		expect(KEYBOARDS.en[0].slice(0, 6).join('')).toBe('QWERTY');
		expect(KEYBOARDS.de[0].slice(0, 6).join('')).toBe('QWERTZ');
		expect(KEYBOARDS.de[2][0]).toBe('Y');
		expect(KEYBOARDS.ru[0].slice(0, 6).join('')).toBe('ЙЦУКЕН');
		expect(KEYBOARDS.uk[0].slice(0, 6).join('')).toBe('ЙЦУКЕН');
	});
});

describe('row display order (right-to-left rows)', () => {
	it('keeps left-to-right locales in typing order', () => {
		for (const locale of ['en', 'de', 'ru', 'uk'] as const) {
			expect(isRtlLocale(locale)).toBe(false);
			expect(rowDisplayOrder(locale)).toEqual([0, 1, 2, 3, 4]);
		}
	});

	it('mirrors the row in Persian and Arabic so the first letter is on the right', () => {
		for (const locale of ['fa', 'ar'] as const) {
			expect(isRtlLocale(locale)).toBe(true);
			expect(rowDisplayOrder(locale)).toEqual([4, 3, 2, 1, 0]);
		}
	});

	it('arranges the cells of a row for the screen without changing the typing order', () => {
		const typed = ['a', 'b', 'c', 'd', 'e'];
		expect(arrangeRow('en', typed)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(arrangeRow('fa', typed)).toEqual(['e', 'd', 'c', 'b', 'a']);
		expect(arrangeRow('ar', typed)).toEqual(['e', 'd', 'c', 'b', 'a']);
		// arranging is not in place
		expect(typed).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('works for other row lengths and the default length', () => {
		expect(rowDisplayOrder('ar', 3)).toEqual([2, 1, 0]);
		expect(rowDisplayOrder('ar')).toHaveLength(WORD_LENGTH);
		expect(arrangeRow('ar', [])).toEqual([]);
	});
});

describe('normalizeWord', () => {
	it('upper-cases English and strips accents', () => {
		expect(normalizeWord('en', 'Grain')).toBe('GRAIN');
		expect(normalizeWord('en', 'café')).toBe('CAFE');
	});

	it('spells out German umlauts and ß', () => {
		expect(normalizeWord('de', 'Käse')).toBe('KAESE');
		expect(normalizeWord('de', 'Öl')).toBe('OEL');
		expect(normalizeWord('de', 'grün')).toBe('GRUEN');
		expect(normalizeWord('de', 'Spaß')).toBe('SPASS');
		expect(normalizeWord('de', 'weiß')).toBe('WEISS');
		expect(normalizeWord('de', 'GROẞ')).toBe('GROSS');
		expect(normalizeWord('de', 'Büro')).toBe('BUERO');
		// decomposed input (a plus a combining diaeresis) gives the same result
		expect(normalizeWord('de', 'a\u{0308}')).toBe('AE');
		expect(normalizeWord('de', 'café')).toBe('CAFE');
	});

	it('counts German words after spelling out', () => {
		expect(isValidWord('de', normalizeWord('de', 'Käse'))).toBe(true);
		expect(isValidWord('de', normalizeWord('de', 'Küste'))).toBe(false);
		expect(isValidWord('de', normalizeWord('de', 'Straße'))).toBe(false);
	});

	it('folds ё into е in Russian and drops stress marks', () => {
		expect(normalizeWord('ru', 'ёлка')).toBe('ЕЛКА');
		expect(normalizeWord('ru', 'Ёж')).toBe('ЕЖ');
		expect(normalizeWord('ru', 'за\u{0301}мок')).toBe('ЗАМОК');
		expect(normalizeWord('ru', 'й')).toBe('Й');
		// a decomposed й (и plus a breve) is composed again
		expect(normalizeWord('ru', 'и\u{0306}')).toBe('Й');
	});

	it('keeps ґ, є, і and ї in Ukrainian', () => {
		expect(normalizeWord('uk', 'ґанок')).toBe('ҐАНОК');
		expect(normalizeWord('uk', 'їжак')).toBe('ЇЖАК');
		expect(normalizeWord('uk', 'є')).toBe('Є');
		expect(normalizeWord('uk', 'і')).toBe('І');
		expect(normalizeWord('uk', 'і\u{0308}')).toBe('Ї');
		expect(isValidWord('uk', normalizeWord('uk', "п'ять"))).toBe(false);
	});

	it('folds Arabic kaf and yeh into the Persian ones and drops diacritics in Persian', () => {
		expect(normalizeWord('fa', `${ARABIC_KAF}\u{062A}\u{0627}\u{0628}`)).toBe(
			`${PERSIAN_KEHEH}\u{062A}\u{0627}\u{0628}`
		);
		expect(normalizeWord('fa', `\u{0633}\u{06CC}\u{0628}${ARABIC_YEH}`)).toBe(
			`\u{0633}\u{06CC}\u{0628}${PERSIAN_YEH}`
		);
		// alef with madda becomes a plain alef
		expect(normalizeWord('fa', '\u{0622}\u{0628}')).toBe('\u{0627}\u{0628}');
		// fatha and kasra are dropped
		expect(normalizeWord('fa', '\u{0645}\u{064E}\u{062F}\u{0631}\u{0650}\u{0633}\u{0647}')).toBe(
			'\u{0645}\u{062F}\u{0631}\u{0633}\u{0647}'
		);
		// teh marbuta becomes heh
		expect(normalizeWord('fa', '\u{0645}\u{062F}\u{0631}\u{0633}\u{0629}')).toBe(
			'\u{0645}\u{062F}\u{0631}\u{0633}\u{0647}'
		);
		// the zero-width non-joiner is dropped
		expect(normalizeWord('fa', '\u{0645}\u{06CC}\u{200C}\u{0631}\u{0648}\u{062F}')).toBe(
			'\u{0645}\u{06CC}\u{0631}\u{0648}\u{062F}'
		);
	});

	it('folds alef forms, alef maqsura, teh marbuta and hamza carriers in Arabic and drops diacritics', () => {
		// alef with hamza above, hamza below and madda become a plain alef
		expect(normalizeWord('ar', '\u{0623}\u{062D}\u{0645}\u{0631}')).toBe(
			'\u{0627}\u{062D}\u{0645}\u{0631}'
		);
		expect(normalizeWord('ar', '\u{0625}\u{0633}\u{0644}\u{0627}\u{0645}')).toBe(
			'\u{0627}\u{0633}\u{0644}\u{0627}\u{0645}'
		);
		expect(normalizeWord('ar', '\u{0622}\u{0645}\u{0646}')).toBe('\u{0627}\u{0645}\u{0646}');
		// teh marbuta becomes heh
		expect(normalizeWord('ar', '\u{0645}\u{062F}\u{0631}\u{0633}\u{0629}')).toBe(
			'\u{0645}\u{062F}\u{0631}\u{0633}\u{0647}'
		);
		// alef maqsura becomes yeh
		expect(normalizeWord('ar', '\u{0639}\u{0644}\u{0649}')).toBe(`\u{0639}\u{0644}${ARABIC_YEH}`);
		// waw with hamza becomes waw
		expect(normalizeWord('ar', '\u{0645}\u{0624}\u{062A}\u{0645}\u{0631}')).toBe(
			'\u{0645}\u{0648}\u{062A}\u{0645}\u{0631}'
		);
		// harakat (fatha, kasra, tanwin) and tatweel are dropped
		expect(normalizeWord('ar', '\u{0643}\u{0650}\u{062A}\u{064E}\u{0627}\u{0628}\u{064C}')).toBe(
			`${ARABIC_KAF}\u{062A}\u{0627}\u{0628}`
		);
		expect(normalizeWord('ar', '\u{0643}\u{0640}\u{062A}\u{0640}\u{0627}\u{0628}')).toBe(
			`${ARABIC_KAF}\u{062A}\u{0627}\u{0628}`
		);
		// Persian keheh and yeh become the Arabic letters
		expect(normalizeWord('ar', `${PERSIAN_KEHEH}\u{062A}\u{0627}\u{0628}`)).toBe(
			`${ARABIC_KAF}\u{062A}\u{0627}\u{0628}`
		);
		expect(normalizeWord('ar', `\u{0628}${PERSIAN_YEH}\u{062A}`)).toBe(
			`\u{0628}${ARABIC_YEH}\u{062A}`
		);
	});

	it('is idempotent', () => {
		for (const [locale, word] of [
			['de', 'Käse'],
			['ru', 'ёлка'],
			['uk', 'ґанок'],
			['fa', '\u{0622}\u{0628}'],
			['ar', '\u{0645}\u{062F}\u{0631}\u{0633}\u{0629}']
		] as const) {
			const once = normalizeWord(locale, word);
			expect(normalizeWord(locale, once)).toBe(once);
		}
	});
});

describe('inputLetters', () => {
	it('gives the letter of a typed key', () => {
		expect(inputLetters('en', 'a')).toEqual(['A']);
		expect(inputLetters('ru', 'ж')).toEqual(['Ж']);
		expect(inputLetters('ar', '\u{0628}')).toEqual(['\u{0628}']);
	});

	it('enters two letters for a German umlaut and ß', () => {
		expect(inputLetters('de', 'ä')).toEqual(['A', 'E']);
		expect(inputLetters('de', 'Ü')).toEqual(['U', 'E']);
		expect(inputLetters('de', 'ß')).toEqual(['S', 'S']);
	});

	it('maps ё to е and variant letters to the locale ones', () => {
		expect(inputLetters('ru', 'ё')).toEqual(['Е']);
		expect(inputLetters('fa', ARABIC_YEH)).toEqual([PERSIAN_YEH]);
		expect(inputLetters('fa', ARABIC_KAF)).toEqual([PERSIAN_KEHEH]);
		expect(inputLetters('ar', PERSIAN_YEH)).toEqual([ARABIC_YEH]);
		expect(inputLetters('ar', '\u{0629}')).toEqual(['\u{0647}']);
	});

	it('ignores keys that are not letters of the locale', () => {
		expect(inputLetters('en', '1')).toEqual([]);
		expect(inputLetters('en', ' ')).toEqual([]);
		expect(inputLetters('uk', 'ы')).toEqual([]);
		expect(inputLetters('uk', 'ъ')).toEqual([]);
		expect(inputLetters('ru', 'a')).toEqual([]);
		expect(inputLetters('ar', 'a')).toEqual([]);
		expect(inputLetters('fa', '\u{0621}')).toEqual([]);
	});
});

describe('isValidWord', () => {
	it('needs exactly five letters of the alphabet', () => {
		expect(isValidWord('en', 'QUOTA')).toBe(true);
		expect(isValidWord('en', 'QUOT')).toBe(false);
		expect(isValidWord('en', 'QUOTAS')).toBe(false);
		expect(isValidWord('en', 'quota')).toBe(false);
		expect(isValidWord('de', 'KÄSE')).toBe(false);
		expect(isValidWord('ru', 'РУБЛЬ')).toBe(true);
		expect(isValidWord('ru', 'QUOTA')).toBe(false);
	});
});

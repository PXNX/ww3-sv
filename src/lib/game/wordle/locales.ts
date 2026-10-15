/*
 * Per-locale letter rules for Sanctions Wordle: the alphabet, the on-screen keyboard layout, how
 * typed text and word-list entries are normalised to that alphabet, and the reading order of a
 * grid row. Everything here is pure so it can be tested without a browser.
 *
 * Normalisation rules (every word list entry and every typed key goes through them):
 *   en  uppercase A-Z; accents are stripped (cafe).
 *   de  uppercase A-Z. Umlauts and ß are spelled out: Ä=AE, Ö=OE, Ü=UE, ß=SS, so KÄSE is KAESE and
 *       GRÜN is GRUEN. A word counts when the spelled-out form is exactly five letters. Typing an
 *       umlaut on a physical keyboard enters both letters.
 *   ru  uppercase Cyrillic without Ё: Ё=Е, stress marks are dropped.
 *   uk  uppercase Cyrillic with Ґ, Є, І, Ї; stress marks are dropped. Words with an apostrophe
 *       are not used, because the apostrophe is not a key.
 *   fa  Persian letters without diacritics: Arabic yeh and kaf become Persian ی and ک, alef with
 *       madda or hamza (آ أ إ) becomes ا, ئ becomes ی, ؤ becomes و, ة becomes ه, and the
 *       zero-width non-joiner is dropped.
 *   ar  Arabic letters without diacritics: alef forms (آ أ إ ٱ) become ا, ى becomes ي, ئ becomes
 *       ي, ؤ becomes و, ة becomes ه, Persian ک and ی become ك and ي, and tatweel is dropped.
 *       A bare hamza (ء) is not a key, so words containing it are not used.
 */

export const WORDLE_LOCALES = ['en', 'de', 'fa', 'ar', 'ru', 'uk'] as const;
export type WordleLocale = (typeof WORDLE_LOCALES)[number];

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export function isWordleLocale(value: string): value is WordleLocale {
	return (WORDLE_LOCALES as readonly string[]).includes(value);
}

/** The game has a list for every shipped locale; anything unknown falls back to English */
export function wordleLocale(value: string): WordleLocale {
	return isWordleLocale(value) ? value : 'en';
}

const LATIN = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export const ALPHABETS: Record<WordleLocale, readonly string[]> = {
	en: LATIN,
	de: LATIN,
	ru: [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'],
	uk: [...'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ'],
	fa: [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'],
	ar: [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي']
};

/**
 * On-screen keyboard rows in reading order: for the right-to-left locales the first key of a
 * row is the rightmost one. Every letter of the alphabet is on the keyboard exactly once.
 */
export const KEYBOARDS: Record<WordleLocale, readonly (readonly string[])[]> = {
	en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row) => [...row]),
	de: ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'].map((row) => [...row]),
	ru: ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮ'].map((row) => [...row]),
	uk: ['ЙЦУКЕНГШЩЗХЇ', 'ФІВАПРОЛДЖЄ', 'ҐЯЧСМИТЬБЮ'].map((row) => [...row]),
	fa: ['ضصثقفغعهخحجچ', 'شسیبلاتنمکگ', 'ظطزرذدپوژ'].map((row) => [...row]),
	ar: ['ضصثقفغعهخحجد', 'شسيبلاتنمكط', 'ذرزوظ'].map((row) => [...row])
};

const RTL_LOCALES: readonly WordleLocale[] = ['fa', 'ar'];

export function isRtlLocale(locale: WordleLocale): boolean {
	return RTL_LOCALES.includes(locale);
}

/**
 * The order in which the cells of one grid row are laid out on screen, as indexes into the letters
 * in typing order. The grid itself stays left-to-right (it is the playfield); in Persian and
 * Arabic the row is mirrored instead, so the first typed letter sits on the right and the row
 * fills in reading order.
 */
export function rowDisplayOrder(locale: WordleLocale, length: number = WORD_LENGTH): number[] {
	const order = Array.from({ length }, (_, index) => index);
	return isRtlLocale(locale) ? order.reverse() : order;
}

/** Puts the cells of a row (in typing order) into their on-screen order */
export function arrangeRow<T>(locale: WordleLocale, cells: readonly T[]): T[] {
	return rowDisplayOrder(locale, cells.length).map((index) => cells[index]);
}

// Combining marks: accents, Arabic harakat (U+064B-065F, U+0670) and the like
const MARKS = /\p{M}/gu;
// Tatweel, zero-width (non-)joiners and the left-to-right and right-to-left marks
const INVISIBLE = /[\u{0640}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}]/gu;

// Grave and acute accent (stress marks) in Cyrillic text
const STRESS_MARKS = /[\u{0300}\u{0301}]/gu;

const GERMAN_SPELLING: Record<string, string> = {
	Ä: 'AE',
	Ö: 'OE',
	Ü: 'UE',
	ẞ: 'SS'
};

// Written as escapes: the letters involved look alike
const PERSIAN_FOLDING: Record<string, string> = {
	'\u0643': '\u06A9', // Arabic kaf
	'\u064A': '\u06CC', // Arabic yeh
	'\u0649': '\u06CC', // alef maqsura
	'\u0626': '\u06CC', // yeh with hamza
	'\u0624': '\u0648', // waw with hamza
	'\u0623': '\u0627', // alef with hamza above
	'\u0625': '\u0627', // alef with hamza below
	'\u0622': '\u0627', // alef with madda
	'\u0671': '\u0627', // alef wasla
	'\u0629': '\u0647', // teh marbuta
	'\u06BE': '\u0647' // heh doachashmee
};

const ARABIC_FOLDING: Record<string, string> = {
	'\u06A9': '\u0643', // Persian keheh
	'\u06CC': '\u064A', // Persian yeh
	'\u0649': '\u064A', // alef maqsura
	'\u0626': '\u064A', // yeh with hamza
	'\u0624': '\u0648', // waw with hamza
	'\u0623': '\u0627', // alef with hamza above
	'\u0625': '\u0627', // alef with hamza below
	'\u0622': '\u0627', // alef with madda
	'\u0671': '\u0627', // alef wasla
	'\u0629': '\u0647', // teh marbuta
	'\u06BE': '\u0647' // heh doachashmee
};

function fold(text: string, table: Record<string, string>): string {
	return [...text].map((char) => table[char] ?? char).join('');
}

/**
 * Turns any text (a word-list entry, a typed key) into the locale's canonical letters, following
 * the rules in the header of this file. Characters outside the alphabet are kept as they are, so
 * callers can tell that a word does not fit; use inputLetters to drop them.
 */
export function normalizeWord(locale: WordleLocale, text: string): string {
	switch (locale) {
		case 'en':
			return text.normalize('NFD').replace(MARKS, '').toUpperCase();
		case 'de': {
			const spelled = [...text.normalize('NFC').toLocaleUpperCase('de')].map(
				(char) => GERMAN_SPELLING[char] ?? char
			);
			// ß upper-cases to SS already in modern engines; the table also covers the capital ẞ
			return spelled.join('').normalize('NFD').replace(MARKS, '');
		}
		case 'ru':
			return text
				.normalize('NFC')
				.replace(STRESS_MARKS, '')
				.toUpperCase()
				.replaceAll('Ё', 'Е')
				.normalize('NFC');
		case 'uk':
			return text.normalize('NFC').replace(STRESS_MARKS, '').toUpperCase().normalize('NFC');
		case 'fa':
			return fold(text.normalize('NFC').replace(MARKS, '').replace(INVISIBLE, ''), PERSIAN_FOLDING);
		case 'ar':
			return fold(text.normalize('NFC').replace(MARKS, '').replace(INVISIBLE, ''), ARABIC_FOLDING);
	}
}

/**
 * The letters a typed character enters: normalised, and only those in the alphabet. An umlaut in
 * German gives two letters; a key that is not a letter of the locale gives none.
 */
export function inputLetters(locale: WordleLocale, text: string): string[] {
	const alphabet = ALPHABETS[locale];
	return [...normalizeWord(locale, text)].filter((char) => alphabet.includes(char));
}

/** Whether a word is exactly WORD_LENGTH letters of the locale's alphabet, already normalised */
export function isValidWord(locale: WordleLocale, word: string): boolean {
	const letters = [...word];
	const alphabet = ALPHABETS[locale];
	return letters.length === WORD_LENGTH && letters.every((letter) => alphabet.includes(letter));
}

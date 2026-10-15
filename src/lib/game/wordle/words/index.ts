/*
 * The word lists of Sanctions Wordle, one module per locale (see locales.ts for the spelling
 * rules). The modules hold readable entries; this file normalises them once and offers the lookups
 * the game needs.
 */
import { normalizeWord, type WordleLocale } from '../locales';
import * as ar from './ar';
import * as de from './de';
import * as en from './en';
import * as fa from './fa';
import * as ru from './ru';
import * as uk from './uk';

interface RawLists {
	SOLUTIONS: string;
	EXTRA: string;
}

const RAW: Record<WordleLocale, RawLists> = { en, de, fa, ar, ru, uk };

export interface WordLists {
	/** Words a puzzle can pick, normalised, in the order of the list */
	solutions: readonly string[];
	/** Further valid guesses, normalised; never the answer */
	extra: readonly string[];
	/** Every word that may be guessed: the solutions and the extra words */
	allowed: ReadonlySet<string>;
}

function entries(text: string): string[] {
	return text.split(/\s+/).filter((entry) => entry.length > 0);
}

/** The entries as written in the list modules, before normalisation (for the list tests) */
export function rawEntries(locale: WordleLocale): { solutions: string[]; extra: string[] } {
	return { solutions: entries(RAW[locale].SOLUTIONS), extra: entries(RAW[locale].EXTRA) };
}

const cache = new Map<WordleLocale, WordLists>();

export function wordLists(locale: WordleLocale): WordLists {
	let lists = cache.get(locale);
	if (!lists) {
		const raw = rawEntries(locale);
		const solutions = raw.solutions.map((word) => normalizeWord(locale, word));
		const extra = raw.extra.map((word) => normalizeWord(locale, word));
		lists = { solutions, extra, allowed: new Set([...solutions, ...extra]) };
		cache.set(locale, lists);
	}
	return lists;
}

/** Whether a normalised word may be guessed in this locale */
export function isAllowedGuess(locale: WordleLocale, word: string): boolean {
	return wordLists(locale).allowed.has(word);
}

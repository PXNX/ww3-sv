import { describe, expect, it } from 'vitest';
import {
	baseLocale,
	hasPersianScript,
	loadMessages,
	locales,
	messageFileCount,
	messageKeys,
	messageParameters,
	missingMessages
} from './testing/messages';

const base = loadMessages(baseLocale);
const translations = locales.filter((locale) => locale !== baseLocale);

describe('message files', () => {
	it('exist for exactly the six supported languages', () => {
		expect([...locales].sort()).toEqual(['ar', 'de', 'en', 'fa', 'ru', 'uk']);
		expect(messageFileCount()).toBe(locales.length);
	});

	it.each(translations)('%s has exactly the same keys as the base language', (locale) => {
		const translated = loadMessages(locale);
		const missing = Object.keys(base).filter((key) => !(key in translated));
		const extra = Object.keys(translated).filter((key) => !(key in base));
		expect({ missing, extra }).toEqual({ missing: [], extra: [] });
	});

	it.each(locales)('%s has no empty messages', (locale) => {
		const empty = Object.entries(loadMessages(locale))
			.filter(([, value]) => typeof value !== 'string' || value.trim() === '')
			.map(([key]) => key);
		expect(empty).toEqual([]);
	});

	it.each(translations)('%s uses the same parameters as the base language', (locale) => {
		const translated = loadMessages(locale);
		for (const key of Object.keys(base)) {
			expect(messageParameters(translated[key] ?? ''), key).toEqual(messageParameters(base[key]));
		}
	});
});

describe('message helpers for new modes', () => {
	it('finds keys by prefix and reports a prefix that matches nothing', () => {
		expect(messageKeys(['game_']).length).toBeGreaterThan(0);
		expect(missingMessages(['game_'])).toEqual([]);
		expect(missingMessages(['no_such_prefix_'])).toEqual(['no keys start with "no_such_prefix_"']);
	});

	it('recognises Persian text', () => {
		expect(hasPersianScript('ادامه')).toBe(true);
		expect(hasPersianScript('Resume')).toBe(false);
	});

	it('has Persian text in the shared pause, game-over and About messages', () => {
		const fa = loadMessages('fa');
		const keys = messageKeys(['game_', 'gameover_', 'about_']);
		const untranslated = keys.filter((key) => !hasPersianScript(fa[key]));
		expect(untranslated).toEqual([]);
	});
});

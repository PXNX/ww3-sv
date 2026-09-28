import { describe, expect, it } from 'vitest';
import settings from '../../project.inlang/settings.json';

type MessageFile = Record<string, string>;

const files = import.meta.glob<Record<string, unknown>>('../../messages/*.json', {
	eager: true,
	import: 'default'
});

function loadMessages(locale: string): MessageFile {
	const messages = { ...files[`../../messages/${locale}.json`] };
	delete messages.$schema;
	return messages as MessageFile;
}

function parameters(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const { baseLocale, locales } = settings;
const base = loadMessages(baseLocale);
const translations = locales.filter((locale) => locale !== baseLocale);

describe('message files', () => {
	it('exist for exactly the three supported languages', () => {
		expect([...locales].sort()).toEqual(['de', 'en', 'fa']);
		expect(Object.keys(files).sort()).toEqual(
			[...locales].sort().map((locale) => `../../messages/${locale}.json`)
		);
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
			expect(parameters(translated[key] ?? ''), key).toEqual(parameters(base[key]));
		}
	});
});

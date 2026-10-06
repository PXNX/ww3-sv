/*
 * Test helpers for the message files, so a new mode can check in its own tests that its strings
 * exist in every language, including Persian. Example:
 *
 *   it('has messages in every language', () => {
 *     expect(missingMessages(['tanker_', 'mode_tanker_'])).toEqual([]);
 *   });
 */
import settings from '../../../project.inlang/settings.json';

export type MessageFile = Record<string, string>;

const files = import.meta.glob<Record<string, unknown>>('../../../messages/*.json', {
	eager: true,
	import: 'default'
});

export const baseLocale: string = settings.baseLocale;
export const locales: readonly string[] = settings.locales;

export function loadMessages(locale: string): MessageFile {
	const messages = { ...files[`../../../messages/${locale}.json`] };
	delete messages.$schema;
	return messages as MessageFile;
}

export function messageFileCount(): number {
	return Object.keys(files).length;
}

/** Names of the parameters in a message, for example "Hi {name}" gives ['name'] */
export function messageParameters(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

/** All keys of the base language that start with one of the prefixes */
export function messageKeys(prefixes: readonly string[]): string[] {
	return Object.keys(loadMessages(baseLocale)).filter((key) =>
		prefixes.some((prefix) => key.startsWith(prefix))
	);
}

/**
 * Lists every "locale:key" that is missing or blank for the keys under the given prefixes, in all
 * languages. Also returns an entry when no key matches a prefix, so a typo cannot pass silently.
 */
export function missingMessages(prefixes: readonly string[]): string[] {
	const problems: string[] = [];
	for (const prefix of prefixes) {
		if (messageKeys([prefix]).length === 0) problems.push(`no keys start with "${prefix}"`);
	}
	const keys = messageKeys(prefixes);
	for (const locale of locales) {
		const messages = loadMessages(locale);
		for (const key of keys) {
			if (typeof messages[key] !== 'string' || messages[key].trim() === '') {
				problems.push(`${locale}:${key}`);
			}
		}
	}
	return problems;
}

const PERSIAN_LETTER = /\p{Script=Arabic}/u;

/** Whether a Persian message contains any Arabic-script letter (it is not an untranslated copy) */
export function hasPersianScript(message: string): boolean {
	return PERSIAN_LETTER.test(message);
}

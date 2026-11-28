/*
 * The legal documents are English-only. The message files keep their translations for the game
 * UI, but every legal text is resolved with the base locale explicitly, so a reader who picked
 * another language still sees the same English wording on /legal/* pages. The proxy injects
 * `{ locale: 'en' }` into every message call and keeps the fully typed `m` surface.
 */
import { m } from '#lib/paraglide/messages.js';

export const legalM = new Proxy(m, {
	get(target, key, receiver) {
		const message = Reflect.get(target, key, receiver);
		if (typeof message !== 'function') return message;
		return (inputs?: Record<string, unknown>) =>
			(message as (inputs: Record<string, unknown>, options: { locale: 'en' }) => string)(inputs ?? {}, {
				locale: 'en'
			});
	}
}) as typeof m;

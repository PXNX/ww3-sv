import { browser } from '$app/env';
import { getLocale } from '#lib/paraglide/runtime.js';
import { textDirection } from '#lib/i18n.js';

// No backend: every page is a static shell, and the locale is resolved in the browser
// (local storage first, then the browser language), so server rendering is turned off
export const ssr = false;
export const prerender = true;

export function load() {
	if (browser) {
		const locale = getLocale();
		document.documentElement.lang = locale;
		document.documentElement.dir = textDirection(locale);
	}
}

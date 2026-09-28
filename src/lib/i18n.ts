import type { Locale } from '$lib/paraglide/runtime';

const RIGHT_TO_LEFT_LOCALES: readonly Locale[] = ['fa'];

// Each language is listed under its own name, so these labels are intentionally not translated
export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch',
	fa: 'فارسی'
};

export function textDirection(locale: Locale): 'ltr' | 'rtl' {
	return RIGHT_TO_LEFT_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

import type { Locale } from '#lib/paraglide/runtime.js';

const RIGHT_TO_LEFT_LOCALES: readonly Locale[] = ['fa', 'ar'];

// Each language is listed under its own name, so these labels are intentionally not translated
export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch',
	fa: 'فارسی',
	ar: 'العربية',
	uk: 'Українська',
	ru: 'Русский'
};

export function textDirection(locale: Locale): 'ltr' | 'rtl' {
	return RIGHT_TO_LEFT_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

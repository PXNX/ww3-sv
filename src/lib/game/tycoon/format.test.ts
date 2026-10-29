import { describe, expect, it } from 'vitest';
import { formatBig, formatCount, formatDuration, formatMultiplier } from './format.js';

describe('formatBig', () => {
	it('prints small numbers in full, rounded down to whole barrels', () => {
		expect(formatBig(0, 'en')).toBe('0');
		expect(formatBig(7.9, 'en')).toBe('7');
		expect(formatBig(999.99, 'en')).toBe('999');
	});

	it('keeps decimals for small rates when asked', () => {
		expect(formatBig(0.1, 'en', 1)).toBe('0.1');
		expect(formatBig(12.34, 'en', 1)).toBe('12.3');
		expect(formatBig(2, 'en', 1)).toBe('2');
	});

	it('abbreviates thousands to trillions in English', () => {
		expect(formatBig(1500, 'en')).toBe('1.5K');
		expect(formatBig(1.5e6, 'en')).toBe('1.5M');
		expect(formatBig(2.5e9, 'en')).toBe('2.5B');
		expect(formatBig(3e12, 'en')).toBe('3T');
		expect(formatBig(999_999, 'en')).toBe('1M');
	});

	it('uses each language’s own abbreviations and separators', () => {
		expect(formatBig(1.5e6, 'de')).toBe('1,5 Mio.');
		expect(formatBig(2.5e9, 'de')).toBe('2,5 Mrd.');
		expect(formatBig(1.5e6, 'ru')).toBe('1,5 млн');
		expect(formatBig(2.5e9, 'ru')).toBe('2,5 млрд');
		expect(formatBig(1.5e6, 'uk')).toBe('1,5 млн');
	});

	it('writes Persian and Arabic in their own digits and words', () => {
		const fa = formatBig(1.5e6, 'fa');
		expect(fa).toMatch(/^[۰-۹٫]+\s*میلیون$/u);
		expect(fa).toContain('۱٫۵');
		const ar = formatBig(2.5e9, 'ar');
		expect(ar).toContain('مليار');
		expect(formatBig(42, 'fa')).toBe('۴۲');
	});

	it('switches to short-scale names beyond trillions', () => {
		expect(formatBig(1.234e17, 'en')).toBe('123.4Qa');
		expect(formatBig(1e15, 'en')).toBe('1Qa');
		expect(formatBig(1.234e17, 'de')).toBe('123,4Qa');
		expect(formatBig(2.5e21, 'en')).toBe('2.5Sx');
		expect(formatBig(9.99e14, 'en')).toBe('999T');
	});

	it('falls back to scientific notation past the last named tier', () => {
		expect(formatBig(1.5e102, 'en')).toBe('1.5E102');
		expect(formatBig(1.234e150, 'de')).toBe('1,23E150');
	});

	it('copes with odd values', () => {
		expect(formatBig(Number.NaN, 'en')).toBe('0');
		expect(formatBig(Infinity, 'en')).toBe('∞');
		expect(formatBig(-Infinity, 'en')).toBe('-∞');
		expect(formatBig(-1500, 'en')).toBe('-1.5K');
		expect(formatBig(1e300, 'en')).toBe('1E300');
	});

	it('does not throw on a locale it does not know', () => {
		expect(formatBig(1500, 'xx-invalid-locale-tag-zzzzzzzzzz')).toMatch(/\d/);
	});
});

describe('other formatters', () => {
	it('formats counts and multipliers', () => {
		expect(formatCount(1234567.8, 'en')).toBe('1,234,567');
		expect(formatCount(1234567, 'de')).toBe('1.234.567');
		expect(formatMultiplier(1.256, 'en')).toBe('1.26');
		expect(formatMultiplier(2, 'de')).toBe('2');
		expect(formatMultiplier(1.5, 'de')).toBe('1,5');
	});

	it('formats away time as hours, minutes or seconds', () => {
		expect(formatDuration(8 * 3600_000, 'en')).toBe('8h');
		expect(formatDuration(2 * 3600_000 + 5 * 60_000, 'en')).toBe('2h 5m');
		expect(formatDuration(90_000, 'en')).toBe('1m');
		expect(formatDuration(45_000, 'en')).toBe('45s');
		expect(formatDuration(-5, 'en')).toBe('0s');
	});
});

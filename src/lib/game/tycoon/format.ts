/*
 * Big-number formatting for the idle game. Small numbers print in full, thousands to trillions use
 * the locale's own compact abbreviations (1.5K, 1,5 Mio., ۱٫۵ میلیون, 1,5 млн) and anything above
 * that switches to scientific notation, so a number never overflows its box.
 */

/** Compact notation stops at trillions; from here on numbers are written as 1.23E15 */
export const SCIENTIFIC_FROM = 1e15;

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let found = cache.get(key);
	if (!found) {
		try {
			found = new Intl.NumberFormat(locale, options);
		} catch {
			// An unknown locale tag: fall back to the runtime default
			found = new Intl.NumberFormat(undefined, options);
		}
		cache.set(key, found);
	}
	return found;
}

/**
 * Formats a barrel count (or any big number) for display.
 * smallDecimals is how many decimals numbers below 1000 keep (0 for whole barrels, 1 for rates).
 */
export function formatBig(value: number, locale: string, smallDecimals = 0): string {
	if (Number.isNaN(value)) return '0';
	if (!Number.isFinite(value)) return value < 0 ? '-∞' : '∞';
	if (value < 0) return `-${formatBig(-value, locale, smallDecimals)}`;
	if (value < 1000) {
		return formatter(locale, {
			maximumFractionDigits: smallDecimals,
			minimumFractionDigits: 0
		}).format(smallDecimals === 0 ? Math.floor(value) : value);
	}
	if (value < SCIENTIFIC_FROM) {
		return formatter(locale, {
			notation: 'compact',
			compactDisplay: 'short',
			maximumFractionDigits: 2
		}).format(value);
	}
	return formatter(locale, { notation: 'scientific', maximumFractionDigits: 2 }).format(value);
}

/** A whole number in the locale's digits, with thousands separators */
export function formatCount(value: number, locale: string): string {
	return formatter(locale, { maximumFractionDigits: 0 }).format(Math.floor(value + 1e-9));
}

/** A multiplier such as 1.25 as "x1.25" digits (no symbol), at most two decimals */
export function formatMultiplier(value: number, locale: string): string {
	return formatter(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}

/** A short length of time such as "2h 5m" (hours and minutes, or minutes, or seconds) */
export function formatDuration(ms: number, locale: string): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const unit = (value: number, name: 'hour' | 'minute' | 'second') =>
		formatter(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value);
	if (hours > 0)
		return minutes > 0 ? `${unit(hours, 'hour')} ${unit(minutes, 'minute')}` : unit(hours, 'hour');
	if (minutes > 0) return unit(minutes, 'minute');
	return unit(seconds, 'second');
}

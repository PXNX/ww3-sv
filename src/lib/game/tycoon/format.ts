/*
 * Big-number formatting for the idle game. Small numbers print in full, thousands to trillions use
 * the locale's own compact abbreviations (1.5K, 1,5 Mio., ۱٫۵ میلیون, 1,5 млн) and anything above
 * that switches to SD (short-scale) notation like 1.23SD instead of scientific notation.
 */

/** Compact notation stops at trillions; from here on SD notation is used */
export const SD_FROM = 1e15;

const SD_NAMES: { min: number; suffix: string }[] = [
	{ min: 1e3, suffix: 'K' },
	{ min: 1e6, suffix: 'M' },
	{ min: 1e9, suffix: 'B' },
	{ min: 1e12, suffix: 'T' },
	{ min: 1e15, suffix: 'Qa' },
	{ min: 1e18, suffix: 'Qi' },
	{ min: 1e21, suffix: 'Sx' },
	{ min: 1e24, suffix: 'Sp' },
	{ min: 1e27, suffix: 'Oc' },
	{ min: 1e30, suffix: 'No' },
	{ min: 1e33, suffix: 'Dc' },
	{ min: 1e36, suffix: 'UDc' },
	{ min: 1e39, suffix: 'DDc' },
	{ min: 1e42, suffix: 'TDc' },
	{ min: 1e45, suffix: 'QaDc' },
	{ min: 1e48, suffix: 'QiDc' },
	{ min: 1e51, suffix: 'SxDc' },
	{ min: 1e54, suffix: 'SD' },
	{ min: 1e57, suffix: 'OcDc' },
	{ min: 1e60, suffix: 'NoDc' },
	{ min: 1e63, suffix: 'Vg' },
	{ min: 1e66, suffix: 'UVg' },
	{ min: 1e69, suffix: 'DVg' },
	{ min: 1e72, suffix: 'TVg' },
	{ min: 1e75, suffix: 'QaVg' },
	{ min: 1e78, suffix: 'QiVg' },
	{ min: 1e81, suffix: 'SxVg' },
	{ min: 1e84, suffix: 'SpVg' },
	{ min: 1e87, suffix: 'OcVg' },
	{ min: 1e90, suffix: 'NoVg' },
	{ min: 1e93, suffix: 'Tg' },
	{ min: 1e96, suffix: 'UTg' },
	{ min: 1e99, suffix: 'DTg' },
];

function sdSuffix(value: number): string {
	for (let i = SD_NAMES.length - 1; i >= 0; i--) {
		if (value >= SD_NAMES[i].min) return SD_NAMES[i].suffix;
	}
	return 'E' + Math.floor(Math.log10(value));
}

function sdFormat(value: number, locale: string, smallDecimals = 0): string {
	const suffix = sdSuffix(value);
	// Scale back to the base unit (e.g. 1.23e54 -> 1.23 SD)
	const tier = SD_NAMES.findIndex((n) => n.suffix === suffix);
	const exp = tier >= 0 ? Math.log10(SD_NAMES[tier].min) : Math.floor(Math.log10(value));
	const scaled = value / Math.pow(10, exp);
	// Build string with up to 2 decimals, stripping trailing zeros
	let s = scaled.toFixed(2);
	s = s.replace(/\.?0+$/, '');
	// If it ended as "1." keep "1"
	if (s.endsWith('.')) s = s.slice(0, -1);
	return s + suffix;
}

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let found = cache.get(key);
	if (!found) {
		try {
			found = new Intl.NumberFormat(locale, options);
		} catch {
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
	if (value < SD_FROM) {
		return formatter(locale, {
			notation: 'compact',
			compactDisplay: 'short',
			maximumFractionDigits: 2
		}).format(value);
	}
	return sdFormat(value, locale, smallDecimals);
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

/** The length of a production cycle, such as "2 s" or "0.8 s" (one decimal below ten seconds) */
export function formatCycle(ms: number, locale: string): string {
	const seconds = Math.max(0, ms / 1000);
	return formatter(locale, {
		style: 'unit',
		unit: 'second',
		unitDisplay: 'narrow',
		maximumFractionDigits: seconds < 10 ? 1 : 0
	}).format(seconds);
}

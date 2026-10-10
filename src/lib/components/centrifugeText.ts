/*
 * Message lookups for Centrifuge Spin: the BREAKING banner texts (one per scare variant) and the
 * lines the calm face mutters. Kept in one place so the components stay short.
 */
import { m } from '#lib/paraglide/messages.js';

/** One entry per variant of a banner scare; BANNER_COUNT in the game config must match */
export const BANNER_TEXTS: readonly (() => string)[] = [
	m.centrifuge_banner_1,
	m.centrifuge_banner_2,
	m.centrifuge_banner_3,
	m.centrifuge_banner_4,
	m.centrifuge_banner_5,
	m.centrifuge_banner_6,
	m.centrifuge_banner_7,
	m.centrifuge_banner_8
];

export const CALM_LINES: readonly (() => string)[] = [
	m.centrifuge_calm_1,
	m.centrifuge_calm_2,
	m.centrifuge_calm_3,
	m.centrifuge_calm_4
];

function pick(list: readonly (() => string)[], index: number): string {
	return list[((index % list.length) + list.length) % list.length]();
}

export const bannerText = (variant: number) => pick(BANNER_TEXTS, variant);
export const calmLine = (index: number) => pick(CALM_LINES, index);

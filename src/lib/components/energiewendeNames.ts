/* Display names, hints and colors of the Energiewende Panic sources and events */
import type { EventKind } from '#lib/game/energiewende/events.js';
import type { CameoKind, Mood, WomanReason } from '#lib/game/energiewende/reactions.js';
import type { SourceId } from '#lib/game/energiewende/sources.js';
import { m } from '#lib/paraglide/messages.js';

export const SOURCE_NAMES: Record<SourceId, () => string> = {
	coal: m.energiewende_source_coal,
	gas: m.energiewende_source_gas,
	nuclear: m.energiewende_source_nuclear,
	wind: m.energiewende_source_wind,
	solar: m.energiewende_source_solar,
	hydro: m.energiewende_source_hydro,
	biomass: m.energiewende_source_biomass,
	batteries: m.energiewende_source_batteries,
	imports: m.energiewende_source_imports
};

export const SOURCE_HINTS: Record<SourceId, () => string> = {
	coal: m.energiewende_source_hint_coal,
	gas: m.energiewende_source_hint_gas,
	nuclear: m.energiewende_source_hint_nuclear,
	wind: m.energiewende_source_hint_wind,
	solar: m.energiewende_source_hint_solar,
	hydro: m.energiewende_source_hint_hydro,
	biomass: m.energiewende_source_hint_biomass,
	batteries: m.energiewende_source_hint_batteries,
	imports: m.energiewende_source_hint_imports
};

/** One color per source for the mix bar; the cards carry the names, so color is never alone */
export const SOURCE_COLORS: Record<SourceId, string> = {
	coal: '#4a4a4a',
	gas: '#e5484d',
	nuclear: '#8a6bbd',
	wind: '#4fa8d8',
	solar: '#f5c83a',
	hydro: '#2f7f8f',
	biomass: '#7c8c5c',
	batteries: '#6a7c9b',
	imports: '#f6c9a0'
};

export const EVENT_NAMES: Record<EventKind, (inputs: { source: string }) => string> = {
	heatwave: () => m.energiewende_event_heatwave_name(),
	dunkelflaute: () => m.energiewende_event_dunkelflaute_name(),
	storm: () => m.energiewende_event_storm_name(),
	drought: () => m.energiewende_event_drought_name(),
	'gas-cut': () => m.energiewende_event_gascut_name(),
	'plant-outage': ({ source }) => m.energiewende_event_plantoutage_name({ source }),
	'big-match': () => m.energiewende_event_bigmatch_name(),
	'import-squeeze': () => m.energiewende_event_importsqueeze_name(),
	'price-spike': () => m.energiewende_event_pricespike_name()
};

export const EVENT_HINTS: Record<EventKind, () => string> = {
	heatwave: m.energiewende_event_heatwave_hint,
	dunkelflaute: m.energiewende_event_dunkelflaute_hint,
	storm: m.energiewende_event_storm_hint,
	drought: m.energiewende_event_drought_hint,
	'gas-cut': m.energiewende_event_gascut_hint,
	'plant-outage': m.energiewende_event_plantoutage_hint,
	'big-match': m.energiewende_event_bigmatch_hint,
	'import-squeeze': m.energiewende_event_importsqueeze_hint,
	'price-spike': m.energiewende_event_pricespike_hint
};

/** Quotes of the Tycoon by mood; there are two per mood and the store alternates them */
const BUSINESSMAN_QUOTES: Record<Mood, readonly [() => string, () => string]> = {
	calm: [m.energiewende_biz_calm_1, m.energiewende_biz_calm_2],
	annoyed: [m.energiewende_biz_annoyed_1, m.energiewende_biz_annoyed_2],
	outraged: [m.energiewende_biz_outraged_1, m.energiewende_biz_outraged_2]
};

const WOMAN_MIX_QUOTES: Record<Mood, readonly [() => string, () => string]> = {
	calm: [m.energiewende_woman_mix_calm_1, m.energiewende_woman_mix_calm_2],
	annoyed: [m.energiewende_woman_mix_annoyed_1, m.energiewende_woman_mix_annoyed_2],
	outraged: [m.energiewende_woman_mix_outraged_1, m.energiewende_woman_mix_outraged_2]
};

const WOMAN_NUCLEAR_QUOTES: Record<Mood, readonly [() => string, () => string]> = {
	calm: WOMAN_MIX_QUOTES.calm,
	annoyed: [m.energiewende_woman_nuclear_annoyed_1, m.energiewende_woman_nuclear_annoyed_2],
	outraged: [m.energiewende_woman_nuclear_outraged_1, m.energiewende_woman_nuclear_outraged_2]
};

export function businessmanQuote(mood: Mood, line: 1 | 2): string {
	return BUSINESSMAN_QUOTES[mood][line - 1]();
}

export function womanQuote(mood: Mood, reason: WomanReason, line: 1 | 2): string {
	const table = reason === 'nuclear' ? WOMAN_NUCLEAR_QUOTES : WOMAN_MIX_QUOTES;
	return table[mood][line - 1]();
}

const CAMEO_ALTS: Record<CameoKind, Record<Mood, () => string>> = {
	businessman: {
		calm: m.energiewende_cameo_alt_biz_calm,
		annoyed: m.energiewende_cameo_alt_biz_annoyed,
		outraged: m.energiewende_cameo_alt_biz_outraged
	},
	woman: {
		calm: m.energiewende_cameo_alt_woman_calm,
		annoyed: m.energiewende_cameo_alt_woman_annoyed,
		outraged: m.energiewende_cameo_alt_woman_outraged
	}
};

export function cameoAlt(kind: CameoKind, mood: Mood): string {
	return CAMEO_ALTS[kind][mood]();
}

export function cameoName(kind: CameoKind): string {
	return kind === 'businessman' ? m.energiewende_biz_name() : m.energiewende_woman_name();
}

const OVER_MESSAGES: Record<CameoKind, Record<Mood, () => string>> = {
	businessman: {
		calm: m.energiewende_over_biz_calm,
		annoyed: m.energiewende_over_biz_annoyed,
		outraged: m.energiewende_over_biz_outraged
	},
	woman: {
		calm: m.energiewende_over_woman_calm,
		annoyed: m.energiewende_over_woman_annoyed,
		outraged: m.energiewende_over_woman_outraged
	}
};

/** The game-over line of a cameo; the Critic has a special one for nuclear flip-flopping */
export function overMessage(kind: CameoKind, mood: Mood, nuclear: boolean): string {
	if (kind === 'woman' && nuclear) return m.energiewende_over_woman_nuclear();
	return OVER_MESSAGES[kind][mood]();
}

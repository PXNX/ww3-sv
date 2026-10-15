/* Translated names and descriptions for the oil tycoon's producers, upgrades, achievements and crises */
import type { AchievementDef, ProducerId, UpgradeDef } from '#lib/game/tycoon/config.js';
import { formatBig, formatCount, formatMultiplier } from '#lib/game/tycoon/format.js';
import type { EffectId, EventKind, EventOutcome } from '#lib/game/tycoon/types.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';

const PRODUCER_NAMES: Record<ProducerId, () => string> = {
	pumpjack: m.tycoon_producer_pumpjack_name,
	tanker: m.tycoon_producer_tanker_name,
	refinery: m.tycoon_producer_refinery_name,
	lobbyist: m.tycoon_producer_lobbyist_name,
	shadowfleet: m.tycoon_producer_shadowfleet_name,
	paperwork: m.tycoon_producer_paperwork_name,
	summit: m.tycoon_producer_summit_name
};

const PRODUCER_FLAVORS: Record<ProducerId, () => string> = {
	pumpjack: m.tycoon_producer_pumpjack_flavor,
	tanker: m.tycoon_producer_tanker_flavor,
	refinery: m.tycoon_producer_refinery_flavor,
	lobbyist: m.tycoon_producer_lobbyist_flavor,
	shadowfleet: m.tycoon_producer_shadowfleet_flavor,
	paperwork: m.tycoon_producer_paperwork_flavor,
	summit: m.tycoon_producer_summit_flavor
};

export function producerName(id: ProducerId): string {
	return PRODUCER_NAMES[id]();
}

export function producerFlavor(id: ProducerId): string {
	return PRODUCER_FLAVORS[id]();
}

const UNIQUE_UPGRADE_NAMES: Record<string, () => string> = {
	click_bucket: m.tycoon_upgrade_click_bucket,
	click_valve: m.tycoon_upgrade_click_valve,
	click_hammer: m.tycoon_upgrade_click_hammer,
	click_wrench: m.tycoon_upgrade_click_wrench,
	clickcps_hands: m.tycoon_upgrade_clickcps_hands,
	clickcps_ribbon: m.tycoon_upgrade_clickcps_ribbon,
	global_regulator: m.tycoon_upgrade_global_regulator,
	global_agency: m.tycoon_upgrade_global_agency,
	global_amendment: m.tycoon_upgrade_global_amendment
};

export function upgradeName(upgrade: UpgradeDef): string {
	if (upgrade.kind === 'producer' && upgrade.producer) {
		const producer = producerName(upgrade.producer);
		if (upgrade.tier === 2) return m.tycoon_upgrade_tier2({ producer });
		if (upgrade.tier === 3) return m.tycoon_upgrade_tier3({ producer });
		return m.tycoon_upgrade_tier1({ producer });
	}
	return UNIQUE_UPGRADE_NAMES[upgrade.id]?.() ?? upgrade.id;
}

export function upgradeEffect(upgrade: UpgradeDef): string {
	const locale = getLocale();
	switch (upgrade.kind) {
		case 'click':
			return m.tycoon_upgrade_effect_click({ mult: formatMultiplier(upgrade.value, locale) });
		case 'clickCps':
			return m.tycoon_upgrade_effect_clickcps({
				percent: formatCount(upgrade.value * 100, locale)
			});
		case 'producer':
			return m.tycoon_upgrade_effect_producer({ producer: producerName(upgrade.producer!) });
		case 'global':
			return m.tycoon_upgrade_effect_global({ mult: formatMultiplier(upgrade.value, locale) });
	}
}

const ACHIEVEMENT_NAMES: Record<string, () => string> = {
	first_tap: m.tycoon_ach_name_first_tap,
	tapper: m.tycoon_ach_name_tapper,
	tap_master: m.tycoon_ach_name_tap_master,
	kilo: m.tycoon_ach_name_kilo,
	mega: m.tycoon_ach_name_mega,
	giga: m.tycoon_ach_name_giga,
	tera: m.tycoon_ach_name_tera,
	stack: m.tycoon_ach_name_stack,
	hoard: m.tycoon_ach_name_hoard,
	diversified: m.tycoon_ach_name_diversified,
	flow: m.tycoon_ach_name_flow,
	torrent: m.tycoon_ach_name_torrent,
	paper_trail: m.tycoon_ach_name_paper_trail,
	crisis_manager: m.tycoon_ach_name_crisis_manager,
	loophole: m.tycoon_ach_name_loophole,
	nationalised: m.tycoon_ach_name_nationalised,
	serial_nationaliser: m.tycoon_ach_name_serial_nationaliser
};

export function achievementName(id: string): string {
	return ACHIEVEMENT_NAMES[id]?.() ?? id;
}

export function achievementDescription(def: AchievementDef): string {
	const locale = getLocale();
	const count = formatCount(def.threshold, locale);
	const amount = formatBig(def.threshold, locale);
	switch (def.kind) {
		case 'taps':
			return m.tycoon_ach_desc_taps({ count });
		case 'lifetime':
			return m.tycoon_ach_desc_lifetime({ amount });
		case 'owned':
			return m.tycoon_ach_desc_owned({ count });
		case 'producers':
			return m.tycoon_ach_desc_producers();
		case 'cps':
			return m.tycoon_ach_desc_cps({ amount });
		case 'upgrades':
			return m.tycoon_ach_desc_upgrades({ count });
		case 'events':
			return m.tycoon_ach_desc_events({ count });
		case 'evaded':
			return m.tycoon_ach_desc_evaded({ count });
		case 'prestige':
			return m.tycoon_ach_desc_prestige({ count });
	}
}

export function eventTitle(kind: EventKind): string {
	switch (kind) {
		case 'spike':
			return m.tycoon_event_spike_title();
		case 'sanctions':
			return m.tycoon_event_sanctions_title();
		case 'pipeline':
			return m.tycoon_event_pipeline_title();
		case 'protest':
			return m.tycoon_event_protest_title();
	}
}

export function eventText(kind: EventKind, producer?: ProducerId): string {
	switch (kind) {
		case 'spike':
			return m.tycoon_event_spike_text();
		case 'sanctions':
			return m.tycoon_event_sanctions_text({ producer: producer ? producerName(producer) : '' });
		case 'pipeline':
			return m.tycoon_event_pipeline_text();
		case 'protest':
			return m.tycoon_event_protest_text();
	}
}

/** The two answers of a crisis; the first one may cost or pay barrels (already formatted) */
export function eventChoices(kind: EventKind, amount: string): { a: string; b: string } {
	switch (kind) {
		case 'spike':
			return { a: m.tycoon_event_spike_a({ amount }), b: m.tycoon_event_spike_b() };
		case 'sanctions':
			return { a: m.tycoon_event_sanctions_a({ amount }), b: m.tycoon_event_sanctions_b() };
		case 'pipeline':
			return { a: m.tycoon_event_pipeline_a(), b: m.tycoon_event_pipeline_b() };
		case 'protest':
			return { a: m.tycoon_event_protest_a({ amount }), b: m.tycoon_event_protest_b() };
	}
}

export function effectLabel(id: EffectId, producer?: ProducerId): string {
	switch (id) {
		case 'boom':
			return m.tycoon_effect_boom();
		case 'crash':
			return m.tycoon_effect_crash();
		case 'sanctioned':
			return m.tycoon_effect_sanctioned({ producer: producer ? producerName(producer) : '' });
		case 'maintenance':
			return m.tycoon_effect_maintenance();
		case 'leak':
			return m.tycoon_effect_leak();
		case 'protest':
			return m.tycoon_effect_protest();
	}
}

/** Whether an effect is good news for the player, for the colour of its chip */
export function effectIsGood(id: EffectId): boolean {
	return id === 'boom';
}

export function outcomeText(outcome: EventOutcome, values: { barrels: string }): string {
	switch (outcome) {
		case 'sold':
			return m.tycoon_outcome_sold(values);
		case 'boom':
			return m.tycoon_outcome_boom();
		case 'crash':
			return m.tycoon_outcome_crash();
		case 'ignored':
			return m.tycoon_outcome_ignored();
		case 'reflagged':
			return m.tycoon_outcome_reflagged();
		case 'sanctioned':
			return m.tycoon_outcome_sanctioned();
		case 'fixed':
			return m.tycoon_outcome_fixed();
		case 'fine':
			return m.tycoon_outcome_fine();
		case 'leak':
			return m.tycoon_outcome_leak();
		case 'greenwashed':
			return m.tycoon_outcome_greenwashed();
		case 'protest':
			return m.tycoon_outcome_protest();
	}
}

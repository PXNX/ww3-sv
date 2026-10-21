/*
 * Translated names and descriptions for the oil tycoon's producers, upgrades, achievements, the
 * nationalization shop and crises
 */
import type {
	AchievementDef,
	AchievementReward,
	PerkId,
	ProducerId,
	UpgradeDef
} from '#lib/game/tycoon/config.js';
import { COST_GROWTH, OFFLINE_EFFICIENCY } from '#lib/game/tycoon/config.js';
import { perkEffect } from '#lib/game/tycoon/economy.js';
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
	summit: m.tycoon_producer_summit_name,
	offshore: m.tycoon_producer_offshore_name,
	cartel: m.tycoon_producer_cartel_name,
	arctic: m.tycoon_producer_arctic_name
};

const PRODUCER_FLAVORS: Record<ProducerId, () => string> = {
	pumpjack: m.tycoon_producer_pumpjack_flavor,
	tanker: m.tycoon_producer_tanker_flavor,
	refinery: m.tycoon_producer_refinery_flavor,
	lobbyist: m.tycoon_producer_lobbyist_flavor,
	shadowfleet: m.tycoon_producer_shadowfleet_flavor,
	paperwork: m.tycoon_producer_paperwork_flavor,
	summit: m.tycoon_producer_summit_flavor,
	offshore: m.tycoon_producer_offshore_flavor,
	cartel: m.tycoon_producer_cartel_flavor,
	arctic: m.tycoon_producer_arctic_flavor
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
	tap_legend: m.tycoon_ach_name_tap_legend,
	kilo: m.tycoon_ach_name_kilo,
	mega: m.tycoon_ach_name_mega,
	giga: m.tycoon_ach_name_giga,
	tera: m.tycoon_ach_name_tera,
	peta: m.tycoon_ach_name_peta,
	stack: m.tycoon_ach_name_stack,
	hoard: m.tycoon_ach_name_hoard,
	centurion: m.tycoon_ach_name_centurion,
	diversified: m.tycoon_ach_name_diversified,
	flow: m.tycoon_ach_name_flow,
	torrent: m.tycoon_ach_name_torrent,
	gusher: m.tycoon_ach_name_gusher,
	paper_trail: m.tycoon_ach_name_paper_trail,
	crisis_manager: m.tycoon_ach_name_crisis_manager,
	loophole: m.tycoon_ach_name_loophole,
	nationalised: m.tycoon_ach_name_nationalised,
	serial_nationaliser: m.tycoon_ach_name_serial_nationaliser,
	state_owned: m.tycoon_ach_name_state_owned,
	investor: m.tycoon_ach_name_investor,
	magnate: m.tycoon_ach_name_magnate
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
		case 'perks':
			return m.tycoon_ach_desc_perks({ count });
	}
}

/** The boost an achievement unlocks, such as "+5% per tap" */
export function achievementReward(reward: AchievementReward): string {
	const percent = formatCount(reward.value * 100, getLocale());
	switch (reward.kind) {
		case 'tap':
			return m.tycoon_ach_reward_tap({ percent });
		case 'output':
			return m.tycoon_ach_reward_output({ percent });
		case 'speed':
			return m.tycoon_ach_reward_speed({ percent });
		case 'discount':
			return m.tycoon_ach_reward_discount({ percent });
		case 'producer':
			return m.tycoon_ach_reward_producer({ percent, producer: producerName(reward.producer) });
	}
}

const PERK_NAMES: Record<PerkId, () => string> = {
	growth: m.tycoon_perk_growth_name,
	output: m.tycoon_perk_output_name,
	speed: m.tycoon_perk_speed_name,
	tap: m.tycoon_perk_tap_name,
	seed: m.tycoon_perk_seed_name,
	offline: m.tycoon_perk_offline_name
};

export function perkName(id: PerkId): string {
	return PERK_NAMES[id]();
}

/** What a perk does at a level, as a short value such as "+30%" or "1K" */
function perkValue(id: PerkId, level: number): string {
	const locale = getLocale();
	const effect = perkEffect(id, level);
	switch (id) {
		case 'growth':
			return `${formatCount((COST_GROWTH - effect - 1) * 100, locale)}%`;
		case 'seed':
			return formatBig(effect, locale);
		case 'offline':
			return `${formatCount(Math.min(1, OFFLINE_EFFICIENCY + effect) * 100, locale)}%`;
		default:
			return `+${formatCount(effect * 100, locale)}%`;
	}
}

/** What a perk does now and, unless it is maxed, at the next level: "Per tap: +50% → +100%" */
export function perkEffectText(id: PerkId, level: number, maxed: boolean): string {
	const value = maxed
		? perkValue(id, level)
		: `${perkValue(id, level)} → ${perkValue(id, level + 1)}`;
	switch (id) {
		case 'growth':
			return m.tycoon_perk_growth_effect({ value });
		case 'output':
			return m.tycoon_perk_output_effect({ value });
		case 'speed':
			return m.tycoon_perk_speed_effect({ value });
		case 'tap':
			return m.tycoon_perk_tap_effect({ value });
		case 'seed':
			return m.tycoon_perk_seed_effect({ value });
		case 'offline':
			return m.tycoon_perk_offline_effect({ value });
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

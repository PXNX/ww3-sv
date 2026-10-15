/*
 * The idle game's rules: creating a state, tapping, buying, the production tick, offline progress,
 * achievements and prestige. The state is a plain object; every function that changes it returns
 * the events the store turns into toasts and sounds.
 */
import type { Random } from '#lib/game/random.js';
import {
	ACHIEVEMENTS,
	OFFLINE_CAP_MS,
	OFFLINE_EFFICIENCY,
	EVENT_AFTER_RETURN_MS,
	PRODUCER_IDS,
	PRODUCERS,
	type AchievementDef,
	type ProducerId
} from './config.js';
import {
	calmProduction,
	hasUpgrade,
	maxAffordable,
	prestigeGain,
	producerCost,
	producerDef,
	productionPerSecond,
	requirementMet,
	tapValue,
	upgradeDef
} from './economy.js';
import { firstEventDelay, nextEventDelay, stepEvents } from './events.js';
import type { TycoonEvent, TycoonState } from './types.js';

export function emptyOwned(): Record<ProducerId, number> {
	return Object.fromEntries(PRODUCER_IDS.map((id) => [id, 0])) as Record<ProducerId, number>;
}

/** A brand-new game; the random source only decides when the first crisis comes */
export function createState(random: Random): TycoonState {
	return {
		barrels: 0,
		runTotal: 0,
		lifetime: 0,
		taps: 0,
		owned: emptyOwned(),
		upgrades: [],
		prestigePoints: 0,
		prestiges: 0,
		achievements: [],
		eventsHandled: 0,
		sanctionsEvaded: 0,
		event: null,
		effects: [],
		nextEventMs: firstEventDelay(random),
		lastEvent: null
	};
}

/** Pumps barrels by hand; returns the barrels it made (0 while protesters block the derrick) */
export function tap(state: TycoonState): { gained: number; events: TycoonEvent[] } {
	const gained = tapValue(state);
	state.barrels += gained;
	state.runTotal += gained;
	state.lifetime += gained;
	state.taps += 1;
	return { gained, events: checkAchievements(state) };
}

/**
 * Buys units of a producer: a fixed amount, or 'max' for as many as the barrels allow.
 * Returns how many were bought (0 when the player cannot afford even one).
 */
export function buyProducer(
	state: TycoonState,
	id: ProducerId,
	amount: number | 'max' = 1
): { bought: number; events: TycoonEvent[] } {
	const def = producerDef(id);
	const owned = state.owned[id];
	const wanted = amount === 'max' ? maxAffordable(def, owned, state.barrels) : Math.floor(amount);
	if (wanted <= 0) return { bought: 0, events: [] };
	const cost = producerCost(def, owned, wanted);
	if (!(cost <= state.barrels)) return { bought: 0, events: [] };
	state.barrels -= cost;
	state.owned[id] = owned + wanted;
	return { bought: wanted, events: checkAchievements(state) };
}

/** Buys an upgrade if it exists, is unlocked, not yet bought and affordable */
export function buyUpgrade(
	state: TycoonState,
	id: string
): { bought: boolean; events: TycoonEvent[] } {
	const upgrade = upgradeDef(id);
	if (!upgrade || hasUpgrade(state, id) || !requirementMet(state, upgrade)) {
		return { bought: false, events: [] };
	}
	if (state.barrels < upgrade.cost) return { bought: false, events: [] };
	state.barrels -= upgrade.cost;
	state.upgrades.push(id);
	return { bought: true, events: checkAchievements(state) };
}

function achieved(state: TycoonState, def: AchievementDef): boolean {
	switch (def.kind) {
		case 'taps':
			return state.taps >= def.threshold;
		case 'lifetime':
			return state.lifetime >= def.threshold;
		case 'owned':
			return Math.max(...PRODUCERS.map((producer) => state.owned[producer.id])) >= def.threshold;
		case 'producers':
			return PRODUCERS.filter((producer) => state.owned[producer.id] > 0).length >= def.threshold;
		case 'cps':
			return productionPerSecond(state) >= def.threshold;
		case 'upgrades':
			return state.upgrades.length >= def.threshold;
		case 'events':
			return state.eventsHandled >= def.threshold;
		case 'evaded':
			return state.sanctionsEvaded >= def.threshold;
		case 'prestige':
			return state.prestiges >= def.threshold;
	}
}

/** Unlocks every achievement whose condition holds; achievements are never lost */
export function checkAchievements(state: TycoonState): TycoonEvent[] {
	const events: TycoonEvent[] = [];
	for (const def of ACHIEVEMENTS) {
		if (state.achievements.includes(def.id) || !achieved(state, def)) continue;
		state.achievements.push(def.id);
		events.push({ type: 'achievement', id: def.id });
	}
	return events;
}

/** One fixed step: the wells produce, crises run their course */
export function stepGame(state: TycoonState, dtMs: number, random: Random): TycoonEvent[] {
	const made = (productionPerSecond(state) * dtMs) / 1000;
	state.barrels += made;
	state.runTotal += made;
	state.lifetime += made;
	const events = stepEvents(state, dtMs, random);
	events.push(...checkAchievements(state));
	return events;
}

export interface OfflineReport {
	/** Away time that was credited, after the cap */
	creditedMs: number;
	/** Barrels it earned */
	barrels: number;
	/** The absence was longer than the cap allows */
	capped: boolean;
}

/**
 * Credits the time the player was away: the calm output at a reduced rate, for at most the cap.
 * A crisis that was going on is dropped (the world carried on without you), and the next one waits
 * a little so it never greets the player the moment they return. Clock changes (a saved time in
 * the future) credit nothing.
 */
export function applyOffline(
	state: TycoonState,
	elapsedMs: number,
	random: Random
): { report: OfflineReport; events: TycoonEvent[] } {
	const away = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
	const creditedMs = Math.min(away, OFFLINE_CAP_MS);
	const barrels = (calmProduction(state) * creditedMs * OFFLINE_EFFICIENCY) / 1000;
	state.barrels += barrels;
	state.runTotal += barrels;
	state.lifetime += barrels;
	if (away > 0) {
		state.event = null;
		state.effects = [];
		state.nextEventMs = Math.max(nextEventDelay(random) / 2, EVENT_AFTER_RETURN_MS);
	}
	return {
		report: { creditedMs, barrels, capped: away > OFFLINE_CAP_MS },
		events: checkAchievements(state)
	};
}

/** Prestige points a nationalization would pay right now */
export function pendingPrestige(state: TycoonState): number {
	return prestigeGain(state.runTotal);
}

export function canPrestige(state: TycoonState): boolean {
	return pendingPrestige(state) >= 1;
}

/**
 * "Nationalize and restart": the run's barrels turn into permanent prestige points; barrels,
 * producers, upgrades and crises start over. Achievements, points and statistics stay.
 */
export function prestige(state: TycoonState, random: Random): TycoonEvent[] {
	const points = pendingPrestige(state);
	if (points < 1) return [];
	state.prestigePoints += points;
	state.prestiges += 1;
	state.barrels = 0;
	state.runTotal = 0;
	state.owned = emptyOwned();
	state.upgrades = [];
	state.event = null;
	state.effects = [];
	state.lastEvent = null;
	state.nextEventMs = firstEventDelay(random);
	return [{ type: 'prestige', points }, ...checkAchievements(state)];
}

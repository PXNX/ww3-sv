/*
 * The idle game's economy: cost curve, production, tap value, upgrades and prestige math. All pure
 * functions of the state, so they are cheap to test and the UI can ask "what would this cost".
 */
import {
	ACHIEVEMENT_BONUS,
	BASE_TAP,
	COST_GROWTH,
	MAX_OWNED,
	PRESTIGE_BONUS,
	PRESTIGE_UNIT,
	PRODUCERS,
	UPGRADES,
	type ProducerDef,
	type ProducerId,
	type UpgradeDef
} from './config.js';
import type { TycoonState } from './types.js';

export function producerDef(id: ProducerId): ProducerDef {
	const def = PRODUCERS.find((producer) => producer.id === id);
	if (!def) throw new Error(`Unknown producer: ${id}`);
	return def;
}

export function upgradeDef(id: string): UpgradeDef | undefined {
	return UPGRADES.find((upgrade) => upgrade.id === id);
}

/**
 * Price of buying `count` more units of a producer when `owned` are already there: the sum of a
 * geometric series, base * growth^owned * (growth^count - 1) / (growth - 1), rounded up to whole
 * barrels. Infinity when the number gets too large to count.
 */
export function producerCost(def: ProducerDef, owned: number, count = 1): number {
	if (count <= 0) return 0;
	const first = def.baseCost * COST_GROWTH ** owned;
	if (count === 1) return Math.ceil(first);
	return Math.ceil((first * (COST_GROWTH ** count - 1)) / (COST_GROWTH - 1));
}

/** How many units a budget buys, at most (never beyond MAX_OWNED) */
export function maxAffordable(def: ProducerDef, owned: number, budget: number): number {
	const room = Math.max(0, MAX_OWNED - owned);
	if (room === 0 || !(budget > 0)) return 0;
	const first = def.baseCost * COST_GROWTH ** owned;
	if (!Number.isFinite(first) || first > budget) return 0;
	let count = Math.floor(
		Math.log(1 + (budget * (COST_GROWTH - 1)) / first) / Math.log(COST_GROWTH)
	);
	count = Math.min(Math.max(0, count), room);
	// The logarithm can be off by one near the edge: settle it with the exact cost
	while (count > 0 && producerCost(def, owned, count) > budget) count--;
	while (count < room && producerCost(def, owned, count + 1) <= budget) count++;
	return count;
}

export function hasUpgrade(state: TycoonState, id: string): boolean {
	return state.upgrades.includes(id);
}

export function totalOwned(state: TycoonState): number {
	return PRODUCERS.reduce((sum, producer) => sum + state.owned[producer.id], 0);
}

/** Whether an upgrade's requirement is met (it does not check whether it is bought) */
export function requirementMet(state: TycoonState, upgrade: UpgradeDef): boolean {
	switch (upgrade.requires.type) {
		case 'none':
			return true;
		case 'owned':
			return state.owned[upgrade.requires.producer] >= upgrade.requires.count;
		case 'total':
			return totalOwned(state) >= upgrade.requires.count;
	}
}

/** The upgrades the player can see and buy now */
export function availableUpgrades(state: TycoonState): UpgradeDef[] {
	return UPGRADES.filter(
		(upgrade) => !hasUpgrade(state, upgrade.id) && requirementMet(state, upgrade)
	);
}

/** Multiplier of one producer from its own upgrades (each tier doubles it) */
export function producerMultiplier(state: TycoonState, id: ProducerId): number {
	let multiplier = 1;
	for (const upgrade of UPGRADES) {
		if (upgrade.kind === 'producer' && upgrade.producer === id && hasUpgrade(state, upgrade.id)) {
			multiplier *= upgrade.value;
		}
	}
	return multiplier;
}

export function prestigeMultiplier(points: number): number {
	return 1 + PRESTIGE_BONUS * Math.max(0, points);
}

export function achievementMultiplier(count: number): number {
	return 1 + ACHIEVEMENT_BONUS * Math.max(0, count);
}

/** Everything that multiplies all output: prestige, achievements and the global upgrades */
export function globalMultiplier(state: TycoonState): number {
	let multiplier =
		prestigeMultiplier(state.prestigePoints) * achievementMultiplier(state.achievements.length);
	for (const upgrade of UPGRADES) {
		if (upgrade.kind === 'global' && hasUpgrade(state, upgrade.id)) multiplier *= upgrade.value;
	}
	return multiplier;
}

/** Product of the output multipliers of all running crisis effects */
export function effectProductionMultiplier(state: TycoonState): number {
	return state.effects.reduce((product, effect) => product * effect.prodMult, 1);
}

export function effectClickMultiplier(state: TycoonState): number {
	return state.effects.reduce((product, effect) => product * effect.clickMult, 1);
}

/** Whether a sanction currently silences this producer */
export function isCut(state: TycoonState, id: ProducerId): boolean {
	return state.effects.some((effect) => effect.producer === id);
}

/** Output of one producer in barrels per second, with everything that applies to it */
export function producerOutput(state: TycoonState, id: ProducerId): number {
	if (isCut(state, id)) return 0;
	return (
		state.owned[id] *
		producerDef(id).baseCps *
		producerMultiplier(state, id) *
		globalMultiplier(state) *
		effectProductionMultiplier(state)
	);
}

/** Barrels per second, as things stand right now */
export function productionPerSecond(state: TycoonState): number {
	return PRODUCERS.reduce((sum, producer) => sum + producerOutput(state, producer.id), 0);
}

/** Barrels per second if no crisis were going on (what offline time earns) */
export function calmProduction(state: TycoonState): number {
	return PRODUCERS.reduce(
		(sum, producer) =>
			sum +
			state.owned[producer.id] *
				producer.baseCps *
				producerMultiplier(state, producer.id) *
				globalMultiplier(state),
		0
	);
}

/** Barrels one tap pumps */
export function tapValue(state: TycoonState): number {
	let click = BASE_TAP;
	let share = 0;
	for (const upgrade of UPGRADES) {
		if (!hasUpgrade(state, upgrade.id)) continue;
		if (upgrade.kind === 'click') click *= upgrade.value;
		else if (upgrade.kind === 'clickCps') share += upgrade.value;
	}
	return (
		(click * globalMultiplier(state) + share * productionPerSecond(state)) *
		effectClickMultiplier(state)
	);
}

/** Prestige points a restart would pay for a run that pumped this many barrels */
export function prestigeGain(runTotal: number): number {
	if (!(runTotal >= PRESTIGE_UNIT)) return 0;
	return Math.floor(Math.sqrt(runTotal / PRESTIGE_UNIT));
}

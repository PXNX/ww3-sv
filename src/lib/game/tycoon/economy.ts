/*
 * The idle game's economy: cost curve, production cycles, tap value, upgrades, achievement boosts,
 * the nationalization shop and the prestige math. All pure functions of the state, so they are
 * cheap to test and the UI can ask "what would this cost".
 */
import {
	ACHIEVEMENTS,
	BASE_TAP,
	CRIT_CHANCE,
	CRIT_MULT,
	COST_GROWTH,
	MAX_OWNED,
	MIN_CYCLE_MS,
	MIN_PRICE_FACTOR,
	OFFLINE_EFFICIENCY,
	PERKS,
	PRESTIGE_BONUS,
	PRESTIGE_UNIT,
	PRODUCERS,
	UPGRADES,
	type AchievementReward,
	type PerkDef,
	type PerkId,
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

export function perkDef(id: PerkId): PerkDef {
	const def = PERKS.find((perk) => perk.id === id);
	if (!def) throw new Error(`Unknown perk: ${id}`);
	return def;
}

/** How producer prices behave: the rise per unit bought, and a factor on every price */
export interface Pricing {
	growth: number;
	factor: number;
}

export const BASE_PRICING: Pricing = { growth: COST_GROWTH, factor: 1 };

/**
 * Price of buying `count` more units of a producer when `owned` are already there: the sum of a
 * geometric series, base * factor * growth^owned * (growth^count - 1) / (growth - 1), rounded up to
 * whole barrels. Infinity when the number gets too large to count.
 */
export function producerCost(
	def: ProducerDef,
	owned: number,
	count = 1,
	pricing: Pricing = BASE_PRICING
): number {
	if (count <= 0) return 0;
	const { growth, factor } = pricing;
	const first = def.baseCost * factor * growth ** owned;
	if (count === 1) return Math.ceil(first);
	return Math.ceil((first * (growth ** count - 1)) / (growth - 1));
}

/** How many units a budget buys, at most (never beyond MAX_OWNED) */
export function maxAffordable(
	def: ProducerDef,
	owned: number,
	budget: number,
	pricing: Pricing = BASE_PRICING
): number {
	const room = Math.max(0, MAX_OWNED - owned);
	if (room === 0 || !(budget > 0)) return 0;
	const { growth, factor } = pricing;
	const first = def.baseCost * factor * growth ** owned;
	if (!Number.isFinite(first) || first > budget) return 0;
	let count = Math.floor(Math.log(1 + (budget * (growth - 1)) / first) / Math.log(growth));
	count = Math.min(Math.max(0, count), room);
	// The logarithm can be off by one near the edge: settle it with the exact cost
	while (count > 0 && producerCost(def, owned, count, pricing) > budget) count--;
	while (count < room && producerCost(def, owned, count + 1, pricing) <= budget) count++;
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

/** Sum of the boosts of one kind the unlocked achievements grant (for one producer, if given) */
export function achievementBonus(
	state: TycoonState,
	kind: AchievementReward['kind'],
	producer?: ProducerId
): number {
	let bonus = 0;
	for (const def of ACHIEVEMENTS) {
		const reward = def.reward;
		if (reward.kind !== kind || !state.achievements.includes(def.id)) continue;
		if (reward.kind === 'producer' && reward.producer !== producer) continue;
		bonus += reward.value;
	}
	return bonus;
}

// The nationalization shop

/** Points the next level of a perk costs, when `level` levels are bought */
export function perkCost(def: PerkDef, level: number): number {
	return Math.ceil(def.baseCost * def.costGrowth ** level);
}

/** Points all the bought levels cost together */
export function pointsSpent(perks: Record<PerkId, number>): number {
	let spent = 0;
	for (const def of PERKS) {
		for (let level = 0; level < perks[def.id]; level++) spent += perkCost(def, level);
	}
	return spent;
}

/** Points left to spend in the shop; points spent on an investment are gone from the balance */
export function availablePoints(state: TycoonState): number {
	return Math.max(0, state.prestigePoints);
}

export function totalPerkLevels(state: TycoonState): number {
	return PERKS.reduce((sum, def) => sum + state.perks[def.id], 0);
}

/** What a perk does at a level, in the unit of its kind (see PerkDef.value) */
export function perkEffect(id: PerkId, level: number): number {
	const def = perkDef(id);
	if (id === 'seed') return level > 0 ? def.value * 10 ** (level - 1) : 0;
	return def.value * level;
}

/** Barrels a new run starts with */
export function seedBarrels(state: TycoonState): number {
	return perkEffect('seed', state.perks.seed);
}

/** Share of the calm output that away time earns */
export function offlineEfficiency(state: TycoonState): number {
	return Math.min(1, OFFLINE_EFFICIENCY + perkEffect('offline', state.perks.offline));
}

/** Producer prices as things stand: the shop flattens the curve, achievements discount it */
export function pricing(state: TycoonState): Pricing {
	return {
		growth: COST_GROWTH - perkEffect('growth', state.perks.growth),
		factor: Math.max(MIN_PRICE_FACTOR, 1 - achievementBonus(state, 'discount'))
	};
}

// Production

/** Multiplier of one producer from its own upgrades (each tier doubles it) and achievements */
export function producerMultiplier(state: TycoonState, id: ProducerId): number {
	let multiplier = 1 + achievementBonus(state, 'producer', id);
	for (const upgrade of UPGRADES) {
		if (upgrade.kind === 'producer' && upgrade.producer === id && hasUpgrade(state, upgrade.id)) {
			multiplier *= upgrade.value;
		}
	}
	return multiplier;
}

export function prestigeMultiplier(points: number, state?: Pick<TycoonState, 'perks'>): number {
	let bonus = PRESTIGE_BONUS * Math.max(0, points);
	if (state) {
		const invest = state.perks?.invest_boost ?? 0;
		bonus += 0.01 * invest * Math.max(0, points);
	}
	return 1 + bonus;
}

/**
 * Everything that multiplies all output: prestige points, the output boosts of achievements and
 * the shop, and the global upgrades
 */
export function globalMultiplier(state: TycoonState): number {
	let multiplier =
		prestigeMultiplier(state.prestigePoints, state) *
		(1 + achievementBonus(state, 'output')) *
		(1 + perkEffect('output', state.perks.output));
	for (const upgrade of UPGRADES) {
		if (upgrade.kind === 'global' && hasUpgrade(state, upgrade.id)) multiplier *= upgrade.value;
	}
	return multiplier;
}

/** How much faster than normal the production cycles run */
export function speedMultiplier(state: TycoonState): number {
	return (1 + achievementBonus(state, 'speed')) * (1 + perkEffect('speed', state.perks.speed));
}

/** How long one cycle of a producer lasts right now */
export function cycleMs(state: TycoonState, id: ProducerId): number {
	return Math.max(MIN_CYCLE_MS, producerDef(id).cycleMs / speedMultiplier(state));
}

/**
 * Barrels per second one unit of a producer makes with every lasting bonus but no crisis. A faster
 * cycle pays as much as a normal one, so speed raises the output as well.
 */
export function unitOutput(state: TycoonState, id: ProducerId): number {
	const def = producerDef(id);
	return (
		((def.baseCps * def.cycleMs) / cycleMs(state, id)) *
		producerMultiplier(state, id) *
		globalMultiplier(state)
	);
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
	return state.owned[id] * unitOutput(state, id) * effectProductionMultiplier(state);
}

/** Barrels per second, as things stand right now (on average over the cycles) */
export function productionPerSecond(state: TycoonState): number {
	return PRODUCERS.reduce((sum, producer) => sum + producerOutput(state, producer.id), 0);
}

/** Barrels per second if no crisis were going on (what offline time earns) */
export function calmProduction(state: TycoonState): number {
	return PRODUCERS.reduce(
		(sum, producer) => sum + state.owned[producer.id] * unitOutput(state, producer.id),
		0
	);
}

/** Multiplier of a tap from the tap boosts of achievements and the shop */
export function tapMultiplier(state: TycoonState): number {
	return (1 + achievementBonus(state, 'tap')) * (1 + perkEffect('tap', state.perks.tap));
}

/** Upgraded critical-tap chance from click upgrades; capped at 0.95 */
export function critChanceUpgrade(state: TycoonState): number {
	const base = UPGRADES.find((upgrade) => upgrade.id === 'crit_chance');
	if (!base || !hasUpgrade(state, 'crit_chance')) return CRIT_CHANCE;
	return Math.min(0.95, CRIT_CHANCE * base.value);
}

/** Upgraded critical-tap multiplier from click upgrades */
export function critMultUpgrade(state: TycoonState): number {
	const base = UPGRADES.find((upgrade) => upgrade.id === 'crit_mult');
	let mult = 1 + CRIT_MULT + achievementBonus(state, 'tap');
	if (base && hasUpgrade(state, 'crit_mult')) mult *= base.value;
	return mult;
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
		(click * tapMultiplier(state) * globalMultiplier(state) + share * productionPerSecond(state)) *
		effectClickMultiplier(state)
	);
}

/** Prestige points a restart would pay for a run that pumped this many barrels */
export function prestigeGain(runTotal: number): number {
	if (!(runTotal >= PRESTIGE_UNIT)) return 0;
	return Math.floor(Math.sqrt(runTotal / PRESTIGE_UNIT));
}

/*
 * Expeditions: send a ship out for a few hours for a price and it comes back with a chest of random
 * rewards: resources, crystals, hero shards and Fake News. The chest is rolled from a seed saved with
 * the expedition, so what is inside is fixed the moment the ship leaves and cannot be rerolled by
 * leaving the page. Only one expedition is out at a time.
 */
import { CRYSTAL_TYPES, addCrystals, type CrystalType } from './crystals.js';
import { addResources, canAfford, type BeachheadSave, type Resources } from './campaign.js';

export interface ExpeditionTier {
	hours: number;
	cost: Resources;
}

export const EXPEDITION_TIERS: readonly ExpeditionTier[] = [
	{ hours: 2, cost: { wood: 150, stone: 0, iron: 60, gold: 8 } },
	{ hours: 4, cost: { wood: 300, stone: 0, iron: 120, gold: 16 } },
	{ hours: 8, cost: { wood: 600, stone: 0, iron: 240, gold: 32 } }
];

export interface ExpeditionState {
	tier: number;
	startedAt: number;
	endsAt: number;
	seed: number;
}

export interface ChestRewards {
	resources: Resources;
	crystals: { type: CrystalType; count: number }[];
	shards: number;
	/** Fake News, paid into the career wallet by the game */
	coins: number;
}

export function expeditionOf(save: BeachheadSave): ExpeditionState | null {
	return save.expedition ?? null;
}

export function expeditionReady(save: BeachheadSave, nowMs: number): boolean {
	const expedition = expeditionOf(save);
	return expedition !== null && nowMs >= expedition.endsAt;
}

/** The small deterministic sequence the chest is rolled from */
function sequence(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** What a chest of this tier holds for this seed: more for the longer trips */
export function rollChest(tier: number, seed: number): ChestRewards {
	const random = sequence(seed);
	const size = Math.max(0, Math.min(EXPEDITION_TIERS.length - 1, tier));
	const scale = 1 + size * 1.2;
	const spread = (base: number) => Math.round(base * scale * (0.6 + random() * 0.9));
	const crystals: ChestRewards['crystals'] = [];
	const kinds = 1 + size + (random() < 0.4 ? 1 : 0);
	for (let kind = 0; kind < kinds; kind++) {
		const type = CRYSTAL_TYPES[Math.floor(random() * CRYSTAL_TYPES.length)];
		const found = crystals.find((entry) => entry.type === type);
		const count = 1 + Math.floor(random() * (2 + size));
		if (found) found.count += count;
		else crystals.push({ type, count });
	}
	return {
		resources: { wood: spread(160), stone: spread(120), iron: spread(80), gold: spread(14) },
		crystals,
		shards: 1 + size + (random() < 0.5 ? 1 : 0),
		coins: Math.round((15 + random() * 25) * scale)
	};
}

export function canStartExpedition(save: BeachheadSave, tier: number): boolean {
	const spec = EXPEDITION_TIERS[tier];
	return spec !== undefined && expeditionOf(save) === null && canAfford(save, spec.cost);
}

/** Sends the ship out; the price is paid at once. The seed makes the chest fixed. */
export function startExpedition(
	save: BeachheadSave,
	tier: number,
	nowMs: number,
	seed: number
): BeachheadSave | null {
	if (!canStartExpedition(save, tier) || !Number.isFinite(nowMs)) return null;
	const spec = EXPEDITION_TIERS[tier];
	return {
		...save,
		resources: {
			wood: save.resources.wood - spec.cost.wood,
			stone: save.resources.stone - spec.cost.stone,
			iron: save.resources.iron - spec.cost.iron,
			gold: save.resources.gold - spec.cost.gold
		},
		expedition: {
			tier,
			startedAt: nowMs,
			endsAt: nowMs + spec.hours * 3_600_000,
			seed: Math.floor(Math.abs(seed)) % 2_147_483_647
		}
	};
}

/** Opens the chest of a ship that is back; returns the new save and what was inside */
export function claimExpedition(
	save: BeachheadSave,
	nowMs: number
): { save: BeachheadSave; rewards: ChestRewards } | null {
	const expedition = expeditionOf(save);
	if (!expedition || nowMs < expedition.endsAt) return null;
	const rewards = rollChest(expedition.tier, expedition.seed);
	let next: BeachheadSave = addResources({ ...save, expedition: undefined }, rewards.resources);
	for (const entry of rewards.crystals) next = addCrystals(next, entry.type, entry.count);
	next = { ...next, hero: { ...next.hero, cards: next.hero.cards + rewards.shards } };
	return { save: next, rewards };
}

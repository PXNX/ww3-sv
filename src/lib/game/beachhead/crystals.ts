/*
 * Crystals: coloured stones that overcharge the base. Two families share one economy. Overcharge
 * crystals sit in a building's slot and change how it fights when the base is attacked: they resist the
 * attacker's skills, mend the building, stretch its range, quicken its fire or toughen it. Base
 * crystals sit in the base's own slots and lift everything at once: the attackers' damage, health and
 * energy, the defence, the drop rate of crystals, the loot and the production. Every type has one
 * level for the whole base; a crystal is raised by merging n² loose crystals of its type when it is at
 * level n, so the last step from level 16 asks for 256.
 */
import type { BeachheadSave } from './campaign.js';

export type OverchargeCrystal = 'aegis' | 'regen' | 'reach' | 'haste' | 'fortify';
export type BaseCrystal =
	'might' | 'vigor' | 'power' | 'bulwark' | 'fortune' | 'plunder' | 'industry';
export type CrystalType = OverchargeCrystal | BaseCrystal;

export const OVERCHARGE_CRYSTALS: readonly OverchargeCrystal[] = [
	'aegis',
	'regen',
	'reach',
	'haste',
	'fortify'
];
export const BASE_CRYSTALS: readonly BaseCrystal[] = [
	'might',
	'vigor',
	'power',
	'bulwark',
	'fortune',
	'plunder',
	'industry'
];
export const CRYSTAL_TYPES: readonly CrystalType[] = [...OVERCHARGE_CRYSTALS, ...BASE_CRYSTALS];

/** Every type has its own colour, in the gem pictures and on the buildings that carry one */
export const CRYSTAL_COLORS: Record<CrystalType, string> = {
	aegis: '#4fa8d8',
	regen: '#3fa65a',
	reach: '#a06be0',
	haste: '#f28c28',
	fortify: '#c9ced6',
	might: '#e5484d',
	vigor: '#e86aa3',
	power: '#f5c83a',
	bulwark: '#6a7c9b',
	fortune: '#38c9b0',
	plunder: '#b8891a',
	industry: '#8a5a2b'
};

export const MAX_CRYSTAL_LEVEL = 17;

export function isOvercharge(type: CrystalType): type is OverchargeCrystal {
	return (OVERCHARGE_CRYSTALS as readonly string[]).includes(type);
}

/** How many overcharge slots the base has: one per headquarters level */
export function overchargeSlots(hq: number): number {
	return Math.max(1, Math.floor(hq));
}

/** How many slots the base crystals have: one, then one more every three headquarters levels */
export function baseSlots(hq: number): number {
	return 1 + Math.floor(Math.max(1, hq) / 3);
}

/** The loose crystals needed to raise a crystal of this level by one: n² for level n, up to 256 */
export function mergeCost(level: number): number | null {
	if (level >= MAX_CRYSTAL_LEVEL) return null;
	return Math.max(1, level) * Math.max(1, level);
}

export interface CrystalState {
	/** Loose crystals, waiting to be merged */
	stock: Partial<Record<CrystalType, number>>;
	/** The level of every type; missing means level one */
	levels: Partial<Record<CrystalType, number>>;
	/** The overcharge crystal in each target's slot; targets are building keys or `defense:<id>` */
	slots: Record<string, OverchargeCrystal>;
	/** The base crystals in the base's own slots, in slot order */
	base: (BaseCrystal | null)[];
}

export function emptyCrystals(): CrystalState {
	return { stock: {}, levels: {}, slots: {}, base: [] };
}

export function crystalsOf(save: BeachheadSave): CrystalState {
	return save.crystals ?? emptyCrystals();
}

export function crystalLevel(save: BeachheadSave, type: CrystalType): number {
	const level = crystalsOf(save).levels[type];
	return Number.isInteger(level) && (level as number) >= 1
		? Math.min(MAX_CRYSTAL_LEVEL, level as number)
		: 1;
}

export function crystalStock(save: BeachheadSave, type: CrystalType): number {
	const count = crystalsOf(save).stock[type];
	return Number.isInteger(count) && (count as number) > 0 ? (count as number) : 0;
}

export function addCrystals(save: BeachheadSave, type: CrystalType, count: number): BeachheadSave {
	const amount = Math.max(0, Math.floor(count));
	if (amount <= 0 || !CRYSTAL_TYPES.includes(type)) return save;
	const state = crystalsOf(save);
	return {
		...save,
		crystals: { ...state, stock: { ...state.stock, [type]: crystalStock(save, type) + amount } }
	};
}

export function canMergeCrystal(save: BeachheadSave, type: CrystalType): boolean {
	const cost = mergeCost(crystalLevel(save, type));
	return cost !== null && crystalStock(save, type) >= cost;
}

/** Spends n² loose crystals of a type to raise its level by one */
export function mergeCrystal(save: BeachheadSave, type: CrystalType): BeachheadSave | null {
	if (!canMergeCrystal(save, type)) return null;
	const level = crystalLevel(save, type);
	const cost = mergeCost(level) as number;
	const state = crystalsOf(save);
	return {
		...save,
		crystals: {
			...state,
			stock: { ...state.stock, [type]: crystalStock(save, type) - cost },
			levels: { ...state.levels, [type]: level + 1 }
		}
	};
}

export function usedOverchargeSlots(save: BeachheadSave): number {
	return Object.keys(crystalsOf(save).slots).length;
}

/** Puts an overcharge crystal into a target's slot, or empties it; refused when every slot is in use */
export function setOvercharge(
	save: BeachheadSave,
	target: string,
	type: OverchargeCrystal | null
): BeachheadSave | null {
	const state = crystalsOf(save);
	const slots = { ...state.slots };
	if (type === null) {
		if (!(target in slots)) return null;
		delete slots[target];
	} else {
		if (!isOvercharge(type)) return null;
		if (!(target in slots) && usedOverchargeSlots(save) >= overchargeSlots(save.levels.hq))
			return null;
		if (slots[target] === type) return null;
		slots[target] = type;
	}
	return { ...save, crystals: { ...state, slots } };
}

/** Puts a base crystal into one of the base's own slots, or empties it */
export function setBaseCrystal(
	save: BeachheadSave,
	index: number,
	type: BaseCrystal | null
): BeachheadSave | null {
	if (!Number.isInteger(index) || index < 0 || index >= baseSlots(save.levels.hq)) return null;
	if (type !== null && !(BASE_CRYSTALS as readonly string[]).includes(type)) return null;
	const state = crystalsOf(save);
	// A type works once; two slots holding the same crystal would only waste one
	if (type !== null && state.base.some((entry, slot) => entry === type && slot !== index))
		return null;
	const base = Array.from(
		{ length: baseSlots(save.levels.hq) },
		(_, slot) => state.base[slot] ?? null
	);
	if (base[index] === type) return null;
	base[index] = type;
	return { ...save, crystals: { ...state, base } };
}

/** What one overcharge crystal does to the building that carries it */
export interface OverchargeEffect {
	/** Share of a support skill's damage the building shrugs off */
	skillResist: number;
	/** Share of its health the building mends every second */
	regenPerSecond: number;
	rangeMultiplier: number;
	reloadMultiplier: number;
	hpMultiplier: number;
}

export function overchargeEffect(
	type: OverchargeCrystal | undefined,
	level: number
): OverchargeEffect {
	const effect: OverchargeEffect = {
		skillResist: 0,
		regenPerSecond: 0,
		rangeMultiplier: 1,
		reloadMultiplier: 1,
		hpMultiplier: 1
	};
	if (!type) return effect;
	const steps = Math.max(1, Math.min(MAX_CRYSTAL_LEVEL, level));
	if (type === 'aegis') effect.skillResist = Math.min(0.7, 0.05 * steps);
	if (type === 'regen') effect.regenPerSecond = 0.004 * steps;
	if (type === 'reach') effect.rangeMultiplier = 1 + 0.03 * steps;
	if (type === 'haste') effect.reloadMultiplier = Math.max(0.4, 1 - 0.03 * steps);
	if (type === 'fortify') effect.hpMultiplier = 1 + 0.06 * steps;
	return effect;
}

/** What the base crystals add everywhere, as fractions (0.1 is ten percent) except the energy */
export interface BaseEffects {
	troopDamage: number;
	troopHealth: number;
	energy: number;
	defense: number;
	dropRate: number;
	loot: number;
	production: number;
}

export function baseEffects(save: BeachheadSave): BaseEffects {
	const effects: BaseEffects = {
		troopDamage: 0,
		troopHealth: 0,
		energy: 0,
		defense: 0,
		dropRate: 0,
		loot: 0,
		production: 0
	};
	const slots = baseSlots(save.levels.hq);
	for (const type of crystalsOf(save).base.slice(0, slots)) {
		if (!type) continue;
		const level = crystalLevel(save, type);
		if (type === 'might') effects.troopDamage += 0.04 * level;
		if (type === 'vigor') effects.troopHealth += 0.04 * level;
		if (type === 'power') effects.energy += 10 * level;
		if (type === 'bulwark') effects.defense += 0.05 * level;
		if (type === 'fortune') effects.dropRate += 0.06 * level;
		if (type === 'plunder') effects.loot += 0.04 * level;
		if (type === 'industry') effects.production += 0.04 * level;
	}
	return effects;
}

/**
 * The crystals a victory drops: at least one, more on the far islands, and the fortune crystal makes
 * the drop likelier. The type is picked by the roll, so a test can pin it down.
 */
export function crystalDrop(
	islandIndex: number,
	roll: number,
	typeRoll: number,
	dropRate = 0
): { type: CrystalType; count: number } | null {
	const safe = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 1;
	const chance = Math.min(1, 0.5 + Math.max(0, islandIndex) * 0.02 + dropRate);
	if (safe >= chance) return null;
	const pick = Math.min(1, Math.max(0, Number.isFinite(typeRoll) ? typeRoll : 0));
	const type =
		CRYSTAL_TYPES[Math.min(CRYSTAL_TYPES.length - 1, Math.floor(pick * CRYSTAL_TYPES.length))];
	return { type, count: 1 + Math.floor(Math.max(0, islandIndex) / 8) };
}

/** Reads a stored crystal state, dropping anything that is not a known type or a sensible number */
export function normalizeCrystals(value: unknown): CrystalState {
	if (typeof value !== 'object' || value === null) return emptyCrystals();
	const raw = value as Record<string, unknown>;
	const numbers = (source: unknown, floor: number, ceiling: number) => {
		const out: Partial<Record<CrystalType, number>> = {};
		if (typeof source !== 'object' || source === null) return out;
		for (const [key, amount] of Object.entries(source)) {
			if (!CRYSTAL_TYPES.includes(key as CrystalType)) continue;
			if (typeof amount !== 'number' || !Number.isInteger(amount)) continue;
			if (amount < floor || amount > ceiling) continue;
			out[key as CrystalType] = amount;
		}
		return out;
	};
	const slots: Record<string, OverchargeCrystal> = {};
	if (typeof raw.slots === 'object' && raw.slots !== null) {
		for (const [target, type] of Object.entries(raw.slots)) {
			if (typeof type === 'string' && isOvercharge(type as CrystalType))
				slots[target] = type as OverchargeCrystal;
		}
	}
	const base = Array.isArray(raw.base)
		? raw.base.map((entry) =>
				typeof entry === 'string' && (BASE_CRYSTALS as readonly string[]).includes(entry)
					? (entry as BaseCrystal)
					: null
			)
		: [];
	return {
		stock: numbers(raw.stock, 0, 1_000_000),
		levels: numbers(raw.levels, 1, MAX_CRYSTAL_LEVEL),
		slots,
		base: base.slice(0, 8)
	};
}

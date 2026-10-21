/*
 * Gear and loot: weapons and armour with a rarity and a level, what they add up to, what an
 * upgrade costs, and the loot table that turns a defeated enemy into drops. Luck (from the
 * minutes survived and from super, mega and boss enemies) shifts the rarity odds upwards.
 */
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';
import {
	ARMOR_SLOTS,
	DAMAGE_PER_LEVEL,
	HELMET_HP,
	MAX_ITEM_LEVEL,
	POWER_PER_ITEM_LEVEL,
	RARITIES,
	RARITY_POWER,
	VEST_ARMOR,
	WEAPON_KINDS,
	WEAPONS,
	type ArmorSlot,
	type Rarity,
	type WeaponKind
} from './config';

export interface WeaponItem {
	id: string;
	type: 'weapon';
	kind: WeaponKind;
	rarity: Rarity;
	level: number;
}

export interface ArmorItem {
	id: string;
	type: 'armor';
	slot: ArmorSlot;
	rarity: Rarity;
	level: number;
}

export type GearItem = WeaponItem | ArmorItem;

/** What can lie on the ground after a fight */
export type LootDrop =
	| { type: 'gear'; item: GearItem }
	| { type: 'gold'; amount: number }
	| { type: 'medkit' }
	| { type: 'weapon-kit' }
	| { type: 'armor-kit' };

let nextId = 1;

/** Unique enough within one device: time plus a counter */
export function newItemId(): string {
	return `${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

export function makeWeapon(kind: WeaponKind, rarity: Rarity = 'common', level = 1): WeaponItem {
	return { id: newItemId(), type: 'weapon', kind, rarity, level };
}

export function makeArmor(slot: ArmorSlot, rarity: Rarity = 'common', level = 1): ArmorItem {
	return { id: newItemId(), type: 'armor', slot, rarity, level };
}

export function levelFactor(level: number): number {
	return 1 + POWER_PER_ITEM_LEVEL * (Math.max(1, level) - 1);
}

/** Shot damage of a weapon for a player of the given level, before critical hits */
export function weaponDamage(item: WeaponItem, playerLevel = 1): number {
	return (
		WEAPONS[item.kind].damage *
		RARITY_POWER[item.rarity] *
		levelFactor(item.level) *
		(1 + DAMAGE_PER_LEVEL * (Math.max(1, playerLevel) - 1))
	);
}

/** Damage per second against a single target, counting all pellets and the average crit */
export function weaponDps(item: WeaponItem, playerLevel = 1): number {
	const spec = WEAPONS[item.kind];
	const crit = 1 + spec.critChance * (spec.critMultiplier - 1);
	return (weaponDamage(item, playerLevel) * spec.pellets * crit * 1000) / spec.fireMs;
}

export function helmetHp(item: ArmorItem | null): number {
	if (!item || item.slot !== 'helmet') return 0;
	return Math.round(HELMET_HP * RARITY_POWER[item.rarity] * levelFactor(item.level));
}

export function vestArmor(item: ArmorItem | null): number {
	if (!item || item.slot !== 'vest') return 0;
	return Math.round(VEST_ARMOR * RARITY_POWER[item.rarity] * levelFactor(item.level));
}

/** Share of incoming damage that gets through an armour value */
export function damageTakenFactor(armor: number): number {
	return 100 / (100 + Math.max(0, armor));
}

/** A single number to compare two pieces of gear of the same kind of slot */
export function gearScore(item: GearItem): number {
	return Math.round(100 * RARITY_POWER[item.rarity] * levelFactor(item.level));
}

/** Gold for the next level, or null at the cap */
export function upgradeCost(item: GearItem): number | null {
	if (item.level >= MAX_ITEM_LEVEL) return null;
	return Math.round(30 * item.level * RARITY_POWER[item.rarity] ** 1.5);
}

/** Gold for breaking an item down */
export function salvageValue(item: GearItem): number {
	return Math.round(8 * item.level * RARITY_POWER[item.rarity] ** 2);
}

export function upgraded<T extends GearItem>(item: T): T {
	return { ...item, level: Math.min(MAX_ITEM_LEVEL, item.level + 1) };
}

// ---------------------------------------------------------------------------------------------
// Loot table

/** Rarity weights for a luck value: 0 is a plain early enemy, 4 or more is a late mega boss */
export function rarityWeights(luck: number): { item: Rarity; weight: number }[] {
	const l = 1 + Math.max(0, luck);
	return [
		{ item: 'common', weight: 60 },
		{ item: 'uncommon', weight: 26 * l },
		{ item: 'rare', weight: 9 * l ** 1.6 },
		{ item: 'epic', weight: 2.6 * l ** 2.2 },
		{ item: 'legendary', weight: 0.5 * l ** 2.8 }
	];
}

export function rollRarity(random: Random, luck: number): Rarity {
	return pickWeighted(random, rarityWeights(luck));
}

/** Rarity never drops below this one, for bosses and mega enemies */
export function atLeast(rarity: Rarity, floor: Rarity): Rarity {
	return RARITIES.indexOf(rarity) >= RARITIES.indexOf(floor) ? rarity : floor;
}

export function rollGear(random: Random, luck: number, level: number, floor?: Rarity): GearItem {
	let rarity = rollRarity(random, luck);
	if (floor) rarity = atLeast(rarity, floor);
	const itemLevel = Math.min(MAX_ITEM_LEVEL, Math.max(1, level + randomInt(random, 0, 2)));
	if (random() < 0.55) {
		return makeWeapon(WEAPON_KINDS[randomInt(random, 0, WEAPON_KINDS.length)], rarity, itemLevel);
	}
	return makeArmor(ARMOR_SLOTS[randomInt(random, 0, ARMOR_SLOTS.length)], rarity, itemLevel);
}

export interface LootRoll {
	/** Chance of an item drop at all (above 1 means guaranteed, the rest is ignored) */
	dropChance: number;
	/** Items beyond the first */
	extraDrops: number;
	luck: number;
	/** Gold on top of the item, already multiplied by the reward multiplier */
	gold: number;
	/** Level of dropped gear */
	itemLevel: number;
	/** Bosses always drop at least one piece of gear */
	guaranteedGear: boolean;
	/** Lowest rarity for guaranteed gear */
	floor?: Rarity;
}

/** Everything one defeated enemy leaves behind */
export function rollLoot(random: Random, roll: LootRoll): LootDrop[] {
	const drops: LootDrop[] = [];
	if (roll.gold > 0) drops.push({ type: 'gold', amount: Math.max(1, Math.round(roll.gold)) });
	if (roll.guaranteedGear) {
		drops.push({ type: 'gear', item: rollGear(random, roll.luck, roll.itemLevel, roll.floor) });
	}
	if (random() >= roll.dropChance) return drops;
	for (let i = 0; i <= roll.extraDrops; i++) {
		const kind = pickWeighted(random, [
			{ item: 'medkit', weight: 24 },
			{ item: 'weapon-kit', weight: 15 },
			{ item: 'armor-kit', weight: 13 },
			{ item: 'gold', weight: 18 },
			// Luck makes gear itself more likely, not only rarer
			{ item: 'gear', weight: 18 + 6 * roll.luck }
		] as const);
		if (kind === 'gear')
			drops.push({ type: 'gear', item: rollGear(random, roll.luck, roll.itemLevel) });
		else if (kind === 'gold')
			drops.push({ type: 'gold', amount: Math.max(2, Math.round(roll.gold * 3 + 3)) });
		else drops.push({ type: kind });
	}
	return drops;
}

/*
 * Gear and loot: weapons and armour with a rarity and a level, the crystals socketed into
 * weapons, what they all add up to, what an upgrade costs, and the loot table that turns a
 * defeated enemy into drops. Luck (from the minutes survived and from super, mega and boss
 * enemies) shifts the rarity odds upwards; the rarer crystals only ever come from bosses.
 */
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';
import {
	ARMOR_SLOTS,
	BOOTS_SPEED,
	BURN_DPS_FACTOR,
	CRYSTAL_BONUS,
	CRYSTAL_BOSS_COUNT,
	CRYSTAL_BOSS_WEIGHTS,
	CRYSTAL_ENEMY_CHANCE,
	CRYSTAL_ENEMY_WEIGHTS,
	CRYSTAL_IGNITE_CHANCE,
	CRYSTAL_IGNITE_DPS_SHARE,
	CRYSTAL_IGNITE_MS,
	CRYSTAL_KINDS,
	CRYSTAL_SOCKETS,
	DAMAGE_PER_LEVEL,
	HELMET_HP,
	MAX_ITEM_LEVEL,
	PERK_CHANCE,
	POWER_PER_ITEM_LEVEL,
	RARITIES,
	RARITY_POWER,
	VEST_ARMOR,
	WEAPON_KINDS,
	WEAPONS,
	SLOT_PERKS,
	SPRINT_BOOTS_SPEED,
	type ArmorPerk,
	type ArmorSlot,
	type CrystalKind,
	type Rarity,
	type Variant,
	type WeaponKind
} from './config';

export interface Crystal {
	kind: CrystalKind;
	rarity: Rarity;
}

export interface WeaponItem {
	id: string;
	type: 'weapon';
	kind: WeaponKind;
	rarity: Rarity;
	level: number;
	/** Socketed crystals, at most CRYSTAL_SOCKETS for the rarity (missing in older saves) */
	crystals?: Crystal[];
}

export interface ArmorItem {
	id: string;
	type: 'armor';
	slot: ArmorSlot;
	rarity: Rarity;
	level: number;
	/** A special effect, only ever one of the slot's own (see SLOT_PERKS) */
	perk?: ArmorPerk;
}

export type GearItem = WeaponItem | ArmorItem;

/** What can lie on the ground after a fight */
export type LootDrop =
	| { type: 'gear'; item: GearItem }
	| { type: 'gold'; amount: number }
	| { type: 'scrap'; amount: number }
	| { type: 'crystal'; crystal: Crystal }
	| { type: 'medkit' }
	| { type: 'weapon-kit' }
	| { type: 'armor-kit' };

let nextId = 1;

/** Unique enough within one device: time plus a counter */
export function newItemId(): string {
	return `${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

export function makeWeapon(kind: WeaponKind, rarity: Rarity = 'common', level = 1): WeaponItem {
	return { id: newItemId(), type: 'weapon', kind, rarity, level, crystals: [] };
}

export function makeArmor(
	slot: ArmorSlot,
	rarity: Rarity = 'common',
	level = 1,
	perk?: ArmorPerk
): ArmorItem {
	const item: ArmorItem = { id: newItemId(), type: 'armor', slot, rarity, level };
	if (perk && SLOT_PERKS[slot].includes(perk)) item.perk = perk;
	return item;
}

/** The perk of a worn piece, if it has one */
export function perkOf(item: ArmorItem | null): ArmorPerk | null {
	return item?.perk ?? null;
}

export function levelFactor(level: number): number {
	return 1 + POWER_PER_ITEM_LEVEL * (Math.max(1, level) - 1);
}

// ---------------------------------------------------------------------------------------------
// Crystals

export const rarityIndex = (rarity: Rarity) => RARITIES.indexOf(rarity);

export function crystalBonus(crystal: Crystal): number {
	return CRYSTAL_BONUS[crystal.kind][rarityIndex(crystal.rarity)];
}

/** The rarity above, or null for legendary */
export function nextRarity(rarity: Rarity): Rarity | null {
	return RARITIES[rarityIndex(rarity) + 1] ?? null;
}

export function socketsOf(item: WeaponItem): number {
	return CRYSTAL_SOCKETS[item.rarity];
}

export const crystalsOf = (item: WeaponItem): readonly Crystal[] => item.crystals ?? [];

/** Sum of one kind of crystal's bonus over a weapon's sockets */
function bonusOf(item: WeaponItem, kind: CrystalKind): number {
	return crystalsOf(item)
		.filter((crystal) => crystal.kind === kind)
		.reduce((sum, crystal) => sum + crystalBonus(crystal), 0);
}

/** A crystal stock is counted by kind and rarity, under keys such as "crit:rare" */
export type CrystalKey = `${CrystalKind}:${Rarity}`;
export type CrystalStock = Partial<Record<CrystalKey, number>>;

export const crystalKey = (crystal: Crystal): CrystalKey => `${crystal.kind}:${crystal.rarity}`;

export function parseCrystalKey(key: string): Crystal | null {
	const [kind, rarity] = key.split(':');
	if (!(CRYSTAL_KINDS as readonly string[]).includes(kind)) return null;
	if (!(RARITIES as readonly string[]).includes(rarity)) return null;
	return { kind: kind as CrystalKind, rarity: rarity as Rarity };
}

// ---------------------------------------------------------------------------------------------
// Weapon stats

export interface WeaponStats {
	/** Damage per projectile (or per drone) before critical hits */
	damage: number;
	fireMs: number;
	critChance: number;
	critMultiplier: number;
	/** How long a hit sets an enemy on fire, 0 if it does not */
	burnMs: number;
	/** Chance per shot to set a fire, 1 for weapons that always burn */
	burnChance: number;
	/** Damage per second a fire set by this weapon does */
	burnDps: number;
	/** Multiplier on every status effect (burning) this weapon causes */
	statusFactor: number;
}

/** Everything a weapon does once rarity, level, player level and its crystals are counted */
export function weaponStats(item: WeaponItem, playerLevel = 1): WeaponStats {
	const spec = WEAPONS[item.kind];
	const statusFactor = 1 + bonusOf(item, 'status');
	// A status crystal on a weapon that cannot burn lets its shots start small fires
	const ignite = crystalsOf(item)
		.filter((crystal) => crystal.kind === 'status')
		.reduce((sum, crystal) => sum + CRYSTAL_IGNITE_CHANCE[rarityIndex(crystal.rarity)], 0);
	const burns = spec.burnMs > 0;
	const damage =
		spec.damage *
		RARITY_POWER[item.rarity] *
		levelFactor(item.level) *
		(1 + DAMAGE_PER_LEVEL * (Math.max(1, playerLevel) - 1)) *
		(1 + bonusOf(item, 'damage'));
	return {
		damage,
		fireMs: spec.fireMs / (1 + bonusOf(item, 'fire')),
		critChance: Math.min(1, spec.critChance + bonusOf(item, 'crit')),
		critMultiplier: spec.critMultiplier,
		burnMs: (burns ? spec.burnMs : ignite > 0 ? CRYSTAL_IGNITE_MS : 0) * statusFactor,
		burnChance: burns ? 1 : Math.min(1, ignite),
		// Fires started by a crystal on a hard-hitting weapon burn at a fraction of its shot
		burnDps: damage * BURN_DPS_FACTOR * (burns ? 1 : CRYSTAL_IGNITE_DPS_SHARE),
		statusFactor
	};
}

/** Shot damage of a weapon for a player of the given level, before critical hits */
export function weaponDamage(item: WeaponItem, playerLevel = 1): number {
	return weaponStats(item, playerLevel).damage;
}

/** Damage per second against a single target, counting all pellets and the average crit */
export function weaponDps(item: WeaponItem, playerLevel = 1): number {
	const spec = WEAPONS[item.kind];
	const stats = weaponStats(item, playerLevel);
	const crit = 1 + stats.critChance * (stats.critMultiplier - 1);
	return (stats.damage * spec.pellets * crit * 1000) / stats.fireMs;
}

export function helmetHp(item: ArmorItem | null): number {
	if (!item || item.slot !== 'helmet') return 0;
	return Math.round(HELMET_HP * RARITY_POWER[item.rarity] * levelFactor(item.level));
}

export function vestArmor(item: ArmorItem | null): number {
	if (!item || item.slot !== 'vest') return 0;
	return Math.round(VEST_ARMOR * RARITY_POWER[item.rarity] * levelFactor(item.level));
}

/** Extra walking speed from boots, as a share (sprint boots add a lot more) */
export function bootsSpeed(item: ArmorItem | null): number {
	if (!item || item.slot !== 'boots') return 0;
	const base = BOOTS_SPEED * RARITY_POWER[item.rarity] * Math.sqrt(levelFactor(item.level));
	let extra = item.perk === 'sprint' ? SPRINT_BOOTS_SPEED : 0;
	extra += item.perk === 'boost' ? BOOST_SPEED : 0;
	return base + extra;
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

/** Scrap for breaking an item down, the material crystals are combined with */
export function salvageScrap(item: GearItem): number {
	return Math.round(3 * RARITY_POWER[item.rarity] ** 2 * (1 + 0.25 * (item.level - 1)));
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

/** Rarity never drops below this one, for bosses */
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
	const slot = ARMOR_SLOTS[randomInt(random, 0, ARMOR_SLOTS.length)];
	const perks = SLOT_PERKS[slot];
	const perk =
		random() < PERK_CHANCE[rarity] ? perks[randomInt(random, 0, perks.length)] : undefined;
	return makeArmor(slot, rarity, itemLevel, perk);
}

function rollCrystal(random: Random, weights: readonly number[]): Crystal {
	const rarity = pickWeighted(
		random,
		RARITIES.map((item, index) => ({ item, weight: weights[index] }))
	);
	return { kind: CRYSTAL_KINDS[randomInt(random, 0, CRYSTAL_KINDS.length)], rarity };
}

/**
 * The crystals one defeated enemy drops: bosses always drop a few, and only they can drop rare,
 * epic or legendary ones (a mega boss the most and the rarest); everyone else rarely drops one.
 */
export function rollCrystals(random: Random, boss: boolean, variant: Variant): Crystal[] {
	if (!boss) {
		return random() < CRYSTAL_ENEMY_CHANCE[variant]
			? [rollCrystal(random, CRYSTAL_ENEMY_WEIGHTS)]
			: [];
	}
	const [fewest, most] = CRYSTAL_BOSS_COUNT[variant];
	const count = randomInt(random, fewest, most + 1);
	return Array.from({ length: count }, () => rollCrystal(random, CRYSTAL_BOSS_WEIGHTS[variant]));
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

/** Everything one defeated enemy leaves behind, apart from crystals */
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
			{ item: 'scrap', weight: 12 },
			// Gear is a rare find; luck makes it a little more likely, not only rarer
			{ item: 'gear', weight: 5 + 2 * roll.luck }
		] as const);
		if (kind === 'gear')
			drops.push({ type: 'gear', item: rollGear(random, roll.luck, roll.itemLevel) });
		else if (kind === 'gold')
			drops.push({ type: 'gold', amount: Math.max(2, Math.round(roll.gold * 3 + 3)) });
		else if (kind === 'scrap')
			drops.push({ type: 'scrap', amount: Math.max(1, Math.round(roll.gold + 1)) });
		else drops.push({ type: kind });
	}
	return drops;
}

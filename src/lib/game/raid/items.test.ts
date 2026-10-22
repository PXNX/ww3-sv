import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { MAX_ITEM_LEVEL, RARITIES, SKILL_IDS, WEAPON_KINDS, WEAPONS } from './config';
import {
	atLeast,
	damageTakenFactor,
	gearScore,
	helmetHp,
	makeArmor,
	makeWeapon,
	rarityWeights,
	rollLoot,
	salvageValue,
	upgradeCost,
	upgraded,
	vestArmor,
	weaponDamage,
	weaponDps
} from './items';

describe('weapons', () => {
	it('starts the rifle with the heal and grenade, and the marksman with the high crit chance', () => {
		expect(WEAPONS.rifle.skills).toEqual(['heal', 'grenade']);
		const highestOther = Math.max(
			...Object.entries(WEAPONS)
				.filter(([kind]) => kind !== 'marksman')
				.map(([, spec]) => spec.critChance)
		);
		expect(WEAPONS.marksman.critChance).toBeGreaterThan(highestOther * 4);
	});

	it('gives every weapon two skills of its own', () => {
		const skills = Object.values(WEAPONS).flatMap((spec) => spec.skills);
		expect(skills).toHaveLength(WEAPON_KINDS.length * 2);
		expect(new Set(skills).size).toBe(skills.length);
		expect([...skills].sort()).toEqual([...SKILL_IDS].sort());
	});

	it('grows with rarity, item level and player level', () => {
		const base = weaponDamage(makeWeapon('rifle'));
		expect(weaponDamage(makeWeapon('rifle', 'epic'))).toBeGreaterThan(base);
		expect(weaponDamage(makeWeapon('rifle', 'common', 5))).toBeGreaterThan(base);
		expect(weaponDamage(makeWeapon('rifle'), 10)).toBeGreaterThan(base);
	});

	it('keeps the starting weapons in the same damage-per-second league', () => {
		const rifle = weaponDps(makeWeapon('rifle'));
		const marksman = weaponDps(makeWeapon('marksman'));
		expect(marksman / rifle).toBeGreaterThan(0.8);
		expect(marksman / rifle).toBeLessThan(1.5);
	});
});

describe('armour', () => {
	it('gives health from helmets and armour from vests only', () => {
		expect(helmetHp(makeArmor('helmet'))).toBeGreaterThan(0);
		expect(helmetHp(makeArmor('vest'))).toBe(0);
		expect(vestArmor(makeArmor('vest'))).toBeGreaterThan(0);
		expect(vestArmor(null)).toBe(0);
	});

	it('lets less damage through with more armour', () => {
		expect(damageTakenFactor(0)).toBe(1);
		expect(damageTakenFactor(50)).toBeLessThan(damageTakenFactor(20));
	});
});

describe('upgrades', () => {
	it('costs more for higher levels and rarer gear, and stops at the cap', () => {
		const common = makeWeapon('smg');
		expect(upgradeCost(upgraded(common))!).toBeGreaterThan(upgradeCost(common)!);
		expect(upgradeCost(makeWeapon('smg', 'legendary'))!).toBeGreaterThan(upgradeCost(common)!);
		expect(upgradeCost(makeWeapon('smg', 'common', MAX_ITEM_LEVEL))).toBeNull();
		expect(upgraded(makeWeapon('smg', 'common', MAX_ITEM_LEVEL)).level).toBe(MAX_ITEM_LEVEL);
	});

	it('scores and salvages rarer gear higher', () => {
		expect(gearScore(makeArmor('vest', 'rare'))).toBeGreaterThan(gearScore(makeArmor('vest')));
		expect(salvageValue(makeArmor('vest', 'rare'))).toBeGreaterThan(
			salvageValue(makeArmor('vest'))
		);
	});
});

describe('loot', () => {
	const share = (luck: number, rarity: (typeof RARITIES)[number]) => {
		const weights = rarityWeights(luck);
		const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
		return weights.find((entry) => entry.item === rarity)!.weight / total;
	};

	it('makes rare gear more likely with luck', () => {
		expect(share(3, 'legendary')).toBeGreaterThan(share(0, 'legendary') * 10);
		expect(share(3, 'common')).toBeLessThan(share(0, 'common'));
	});

	it('respects a rarity floor', () => {
		expect(atLeast('common', 'rare')).toBe('rare');
		expect(atLeast('legendary', 'rare')).toBe('legendary');
	});

	it('always drops gear for a guaranteed roll and the gold it is given', () => {
		const random = createRandom(4);
		for (let i = 0; i < 50; i++) {
			const drops = rollLoot(random, {
				dropChance: 0,
				extraDrops: 0,
				luck: 2,
				gold: 12,
				itemLevel: 3,
				guaranteedGear: true,
				floor: 'epic'
			});
			expect(drops).toHaveLength(2);
			expect(drops[0]).toEqual({ type: 'gold', amount: 12 });
			const gear = drops[1];
			expect(gear.type).toBe('gear');
			if (gear.type === 'gear') {
				expect(['epic', 'legendary']).toContain(gear.item.rarity);
				expect(gear.item.level).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('drops more often for super and mega style rolls', () => {
		const count = (dropChance: number, extraDrops: number) => {
			const random = createRandom(9);
			let items = 0;
			for (let i = 0; i < 400; i++) {
				items += rollLoot(random, {
					dropChance,
					extraDrops,
					luck: 0,
					gold: 0,
					itemLevel: 1,
					guaranteedGear: false
				}).length;
			}
			return items;
		};
		expect(count(0.6, 0)).toBeGreaterThan(count(0.1, 0) * 3);
		expect(count(1.1, 1)).toBe(800);
	});
});

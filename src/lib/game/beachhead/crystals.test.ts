import { describe, expect, it } from 'vitest';
import {
	MAX_CRYSTAL_LEVEL,
	addCrystals,
	baseEffects,
	baseSlots,
	canMergeCrystal,
	crystalDrop,
	crystalLevel,
	crystalStock,
	mergeCost,
	mergeCrystal,
	normalizeCrystals,
	overchargeEffect,
	overchargeSlots,
	setBaseCrystal,
	setOvercharge
} from './crystals';
import { createBattle, castSkill, stepBattle } from './battle';
import { modifiersFor, newSave, parseSave, incomeRate } from './campaign';
import { ISLAND_IDS } from './config';

const withHq = (hq: number) => {
	const save = newSave(0);
	return { ...save, levels: { ...save.levels, hq } };
};

describe('merging crystals', () => {
	it('asks for n² loose crystals at level n, up to 256 for the last step', () => {
		expect(mergeCost(1)).toBe(1);
		expect(mergeCost(2)).toBe(4);
		expect(mergeCost(9)).toBe(81);
		expect(mergeCost(16)).toBe(256);
		expect(mergeCost(MAX_CRYSTAL_LEVEL)).toBeNull();
	});

	it('spends the stock and raises the level of the whole type', () => {
		let save = addCrystals(newSave(0), 'haste', 5);
		expect(crystalLevel(save, 'haste')).toBe(1);
		save = mergeCrystal(save, 'haste')!;
		expect(crystalLevel(save, 'haste')).toBe(2);
		expect(crystalStock(save, 'haste')).toBe(4);
		expect(canMergeCrystal(save, 'haste')).toBe(true);
		save = mergeCrystal(save, 'haste')!;
		expect(crystalLevel(save, 'haste')).toBe(3);
		expect(crystalStock(save, 'haste')).toBe(0);
		expect(mergeCrystal(save, 'haste')).toBeNull();
	});

	it('keeps the types apart', () => {
		const save = addCrystals(addCrystals(newSave(0), 'reach', 3), 'regen', 1);
		expect(crystalStock(save, 'reach')).toBe(3);
		expect(crystalStock(save, 'regen')).toBe(1);
		expect(addCrystals(save, 'reach', -4)).toBe(save);
	});
});

describe('slots', () => {
	it('grow with the headquarters level', () => {
		expect(overchargeSlots(1)).toBe(1);
		expect(overchargeSlots(8)).toBe(8);
		expect(baseSlots(1)).toBe(1);
		expect(baseSlots(8)).toBeGreaterThan(baseSlots(1));
	});

	it('hold one overcharge crystal per building and stop at the limit', () => {
		let save = withHq(2);
		save = setOvercharge(save, 'hq', 'aegis')!;
		save = setOvercharge(save, 'defense:4', 'haste')!;
		expect(setOvercharge(save, 'bunker', 'regen')).toBeNull();
		// A crystal can be swapped for another in the same slot, or taken out to free it
		save = setOvercharge(save, 'hq', 'fortify')!;
		save = setOvercharge(save, 'defense:4', null)!;
		expect(setOvercharge(save, 'bunker', 'regen')).not.toBeNull();
		expect(setOvercharge(save, 'hq', 'might' as never)).toBeNull();
	});

	it('hold each base crystal once', () => {
		let save = withHq(6);
		save = setBaseCrystal(save, 0, 'might')!;
		expect(setBaseCrystal(save, 1, 'might')).toBeNull();
		expect(setBaseCrystal(save, 1, 'vigor')).not.toBeNull();
		expect(setBaseCrystal(save, 9, 'vigor')).toBeNull();
	});
});

describe('what the crystals do', () => {
	it('overcharge a building: resist, mend, reach, quicken and toughen', () => {
		expect(overchargeEffect('aegis', 4).skillResist).toBeGreaterThan(0);
		expect(overchargeEffect('regen', 4).regenPerSecond).toBeGreaterThan(0);
		expect(overchargeEffect('reach', 4).rangeMultiplier).toBeGreaterThan(1);
		expect(overchargeEffect('haste', 4).reloadMultiplier).toBeLessThan(1);
		expect(overchargeEffect('fortify', 4).hpMultiplier).toBeGreaterThan(1);
		expect(overchargeEffect(undefined, 9)).toEqual({
			skillResist: 0,
			regenPerSecond: 0,
			rangeMultiplier: 1,
			reloadMultiplier: 1,
			hpMultiplier: 1
		});
		expect(overchargeEffect('haste', 99).reloadMultiplier).toBeGreaterThanOrEqual(0.4);
	});

	it('make a battle building tougher, quicker, longer-reaching and harder to hit with skills', () => {
		const island = (crystal?: {
			type: 'aegis' | 'haste' | 'fortify' | 'reach';
			level: number;
		}) => ({
			id: 'x',
			buildings: [
				{ kind: 'hq' as const, x: 9, y: 3 },
				{ kind: 'field-cannon' as const, x: 6, y: 3, ...(crystal ? { crystal } : {}) }
			]
		});
		const plain = createBattle(island()).buildings[1];
		expect(createBattle(island({ type: 'fortify', level: 5 })).buildings[1].maxHp).toBeGreaterThan(
			plain.maxHp
		);
		expect(createBattle(island({ type: 'haste', level: 5 })).buildings[1].reloadMs).toBeLessThan(
			plain.reloadMs
		);
		expect(
			createBattle(island({ type: 'reach', level: 5 })).buildings[1].rangeMultiplier
		).toBeGreaterThan(1);

		const hit = (crystal?: { type: 'aegis'; level: number }) => {
			const state = createBattle(island(crystal));
			castSkill(state, 'flamingo', 6.5, 3.5);
			for (let step = 0; step < 30; step++) stepBattle(state, 100);
			return state.buildings[1].maxHp - state.buildings[1].hp;
		};
		expect(hit({ type: 'aegis', level: 8 })).toBeLessThan(hit());
	});

	it('mends a building that carries a regen crystal', () => {
		const state = createBattle({
			id: 'x',
			buildings: [
				{ kind: 'hq', x: 9, y: 3 },
				{ kind: 'depot', x: 6, y: 3, crystal: { type: 'regen', level: 10 } }
			]
		});
		const depot = state.buildings[1];
		depot.hp = 100;
		stepBattle(state, 100);
		const before = depot.hp;
		for (let step = 0; step < 20; step++) stepBattle(state, 100);
		expect(depot.hp).toBeGreaterThan(before);
	});

	it('lift the whole base: troops, energy, defence, drops, loot and production', () => {
		let save = withHq(8);
		for (const [slot, type] of (['might', 'vigor', 'power'] as const).entries()) {
			save = setBaseCrystal(save, slot, type) ?? save;
		}
		const effects = baseEffects(save);
		expect(effects.troopDamage + effects.troopHealth + effects.energy).toBeGreaterThan(0);
		const plain = modifiersFor(newSave(0));
		const boosted = modifiersFor(save);
		expect(boosted.squads[0][0].hp).toBeGreaterThan(plain.squads[0][0].hp);
		expect(boosted.energyBonus).toBeGreaterThan(0);
		const industry = setBaseCrystal(withHq(3), 0, 'industry')!;
		expect(incomeRate(industry, ISLAND_IDS).wood).toBeGreaterThanOrEqual(
			incomeRate(withHq(3), ISLAND_IDS).wood
		);
	});
});

describe('crystal drops', () => {
	it('come with most victories, more often with the fortune crystal', () => {
		expect(crystalDrop(0, 0.2, 0.1)).not.toBeNull();
		expect(crystalDrop(0, 0.9, 0.1)).toBeNull();
		expect(crystalDrop(0, 0.7, 0.1, 0.3)).not.toBeNull();
		expect(crystalDrop(16, 0.1, 0.1)!.count).toBeGreaterThan(crystalDrop(0, 0.1, 0.1)!.count);
		expect(crystalDrop(0, 0.1, 0)!.type).not.toBe(crystalDrop(0, 0.1, 0.99)!.type);
	});
});

describe('saving crystals', () => {
	it('survives a round trip and drops garbage', () => {
		let save = addCrystals(withHq(3), 'power', 7);
		save = setOvercharge(save, 'hq', 'regen')!;
		save = setBaseCrystal(save, 0, 'fortune')!;
		const loaded = parseSave(JSON.parse(JSON.stringify(save)))!;
		expect(loaded.crystals).toEqual(save.crystals);
		const junk = normalizeCrystals({
			stock: { aegis: 3, nonsense: 5, reach: -1, haste: 1.5 },
			levels: { aegis: 99, regen: 4 },
			slots: { hq: 'aegis', bunker: 'might' },
			base: ['might', 'aegis', 4]
		});
		expect(junk.stock).toEqual({ aegis: 3 });
		expect(junk.levels).toEqual({ regen: 4 });
		expect(junk.slots).toEqual({ hq: 'aegis' });
		expect(junk.base).toEqual(['might', null, null]);
	});
});

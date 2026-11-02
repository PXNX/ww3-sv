import { describe, expect, it } from 'vitest';
import { ISLAND_IDS } from './config';
import {
	HOME_INCOME_PER_MIN,
	INCOME_CAP_MS,
	ISLAND_INCOME,
	MAX_UPGRADE,
	STARTING_SUPPLIES,
	addSupplies,
	applyUpgrade,
	canUpgrade,
	claimIncome,
	controlIsland,
	controlledCount,
	incomeRate,
	isBeachheadSave,
	isUnlocked,
	lootFor,
	modifiersFor,
	newSave,
	starsOf,
	totalStars,
	upgradeCost,
	upgradeLocked
} from './campaign';

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);

function saveWithControlled(...indexes: number[]) {
	let save = newSave(NOW);
	for (const index of indexes) save = controlIsland(save, ISLAND_IDS[index], 2);
	return save;
}

describe('the campaign save', () => {
	it('starts with a small stock, level one everywhere and only the first island open', () => {
		const save = newSave(NOW);
		expect(save.supplies).toBe(STARTING_SUPPLIES);
		expect(save.upgrades).toEqual({ hq: 1, troops: 1, landing: 1 });
		expect(save.islands).toEqual({});
		expect(isUnlocked(save, ISLAND_IDS, 0)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(false);
		expect(isUnlocked(save, ISLAND_IDS, 5)).toBe(false);
	});

	it('opens the next island only after the previous one is controlled', () => {
		const save = controlIsland(newSave(NOW), ISLAND_IDS[0], 2);
		expect(isUnlocked(save, ISLAND_IDS, 1)).toBe(true);
		expect(isUnlocked(save, ISLAND_IDS, 2)).toBe(false);
	});

	it('keeps the better stars when an island is taken again', () => {
		let save = controlIsland(newSave(NOW), ISLAND_IDS[0], 3);
		save = controlIsland(save, ISLAND_IDS[0], 1);
		expect(starsOf(save, ISLAND_IDS[0])).toBe(3);
		expect(starsOf(save, ISLAND_IDS[1])).toBe(0);
		expect(totalStars(save, ISLAND_IDS)).toBe(3);
	});

	it('pays more for a first capture than for a replay', () => {
		expect(lootFor(0, true)).toBeGreaterThan(lootFor(0, false));
		expect(lootFor(5, true)).toBeGreaterThan(lootFor(0, true));
	});

	it('rejects broken save files', () => {
		const save = newSave(NOW);
		expect(isBeachheadSave(save)).toBe(true);
		expect(isBeachheadSave(null)).toBe(false);
		expect(isBeachheadSave({ ...save, version: 2 })).toBe(false);
		expect(isBeachheadSave({ ...save, supplies: -1 })).toBe(false);
		expect(isBeachheadSave({ ...save, supplies: Number.NaN })).toBe(false);
		expect(isBeachheadSave({ ...save, upgrades: { hq: 0, troops: 1, landing: 1 } })).toBe(false);
		expect(
			isBeachheadSave({
				...save,
				islands: { [ISLAND_IDS[0]]: { stars: 4, controlled: true } }
			})
		).toBe(false);
		expect(
			isBeachheadSave({
				...save,
				islands: { [ISLAND_IDS[0]]: { stars: 0, controlled: true } }
			})
		).toBe(false);
	});
});

describe('tax income', () => {
	it('pays only the home shore with no islands controlled', () => {
		expect(incomeRate(newSave(NOW), ISLAND_IDS)).toBe(HOME_INCOME_PER_MIN);
	});

	it('adds the production of every controlled island', () => {
		const save = saveWithControlled(0, 2);
		expect(controlledCount(save, ISLAND_IDS)).toBe(2);
		expect(incomeRate(save, ISLAND_IDS)).toBe(
			HOME_INCOME_PER_MIN + ISLAND_INCOME[0] + ISLAND_INCOME[2]
		);
	});

	it('raises all income with the headquarters', () => {
		let save = saveWithControlled(0);
		save = { ...save, supplies: 10_000, upgrades: { ...save.upgrades, hq: 2 } };
		expect(incomeRate(save, ISLAND_IDS)).toBe(3.8);
	});

	it('banks whole minutes only', () => {
		const save = newSave(NOW);
		expect(claimIncome(save, ISLAND_IDS, NOW + 30_000)).toBe(save);
		const minute = claimIncome(save, ISLAND_IDS, NOW + 60_000);
		expect(minute.supplies).toBe(STARTING_SUPPLIES + HOME_INCOME_PER_MIN);
		expect(minute.lastIncomeMs).toBe(NOW + 60_000);
	});

	it('stops earning after the cap', () => {
		const save = newSave(NOW);
		const capped = claimIncome(save, ISLAND_IDS, NOW + INCOME_CAP_MS * 3);
		expect(capped.supplies).toBe(
			STARTING_SUPPLIES + Math.floor((HOME_INCOME_PER_MIN * INCOME_CAP_MS) / 60_000)
		);
	});

	it('adds loot to the stock', () => {
		expect(addSupplies(newSave(NOW), 85).supplies).toBe(STARTING_SUPPLIES + 85);
		expect(addSupplies(newSave(NOW), -10).supplies).toBe(STARTING_SUPPLIES);
	});
});

describe('upgrades', () => {
	it('charges the listed cost and raises the level', () => {
		const save = newSave(NOW);
		const cost = upgradeCost(save, 'troops') as number;
		expect(cost).toBeGreaterThan(0);
		expect(canUpgrade(save, 'troops')).toBe(true);
		const bought = applyUpgrade(save, 'troops');
		expect(bought.upgrades.troops).toBe(2);
		expect(bought.supplies).toBe(save.supplies - cost);
	});

	it('refuses an upgrade that costs more than the stock', () => {
		const save = { ...newSave(NOW), supplies: 0 };
		expect(canUpgrade(save, 'hq')).toBe(false);
		expect(applyUpgrade(save, 'hq')).toBe(save);
	});

	it('only lets troops and landing craft outgrow the headquarters by one level', () => {
		const save = newSave(NOW);
		expect(upgradeLocked(save, 'troops')).toBe(false);
		const troops = applyUpgrade(save, 'troops');
		expect(troops.upgrades.troops).toBe(2);
		expect(upgradeLocked(troops, 'troops')).toBe(true);

		const hq = { ...troops, supplies: 10_000 };
		expect(upgradeLocked(hq, 'troops')).toBe(true);
		const upgradedHq = applyUpgrade(hq, 'hq');
		expect(upgradedHq.upgrades.hq).toBe(2);
		expect(upgradeLocked(upgradedHq, 'troops')).toBe(false);
	});

	it('stops at the maximum level', () => {
		const save = {
			...newSave(NOW),
			supplies: 100_000,
			upgrades: { hq: MAX_UPGRADE.hq, troops: MAX_UPGRADE.troops, landing: MAX_UPGRADE.landing }
		};
		for (const key of ['hq', 'troops', 'landing'] as const) {
			expect(upgradeCost(save, key)).toBeNull();
			expect(canUpgrade(save, key)).toBe(false);
		}
	});

	it('makes troops tougher and fits one more soldier per craft', () => {
		const save = {
			...newSave(NOW),
			upgrades: { hq: 3, troops: 3, landing: 3 }
		};
		const modifiers = modifiersFor(save);
		expect(modifiers.troopHp).toBeGreaterThan(100);
		expect(modifiers.troopDamage).toBeGreaterThan(16);
		expect(modifiers.troopsPerSquad).toBe(6);
	});
});

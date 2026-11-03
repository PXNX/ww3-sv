import { describe, expect, it } from 'vitest';
import { newSave, parseSave, storageCapacity } from './campaign';

describe('warehouse capacity', () => {
	it('is only what the warehouses of a resource hold, and grows with their levels', () => {
		const save = newSave(0);
		const small = storageCapacity(save, 'iron');
		const grown = {
			...save,
			levels: { ...save.levels, warehouses: save.levels.warehouses.map(() => 4) }
		};
		expect(storageCapacity(grown, 'iron')).toBeGreaterThan(small * 3);
	});

	it('trims a stock that an old save holds beyond what the warehouses can keep', () => {
		const save = newSave(0);
		const bloated = { ...save, resources: { wood: 99_999, stone: 5, iron: 99_999, gold: 1 } };
		const loaded = parseSave(JSON.parse(JSON.stringify(bloated)))!;
		expect(loaded.resources.wood).toBe(storageCapacity(save, 'wood'));
		expect(loaded.resources.iron).toBe(storageCapacity(save, 'iron'));
		expect(loaded.resources.stone).toBe(5);
	});
});

describe('hero shards', () => {
	it('drop on every conquest, more on far islands and with a lucky roll', async () => {
		const { shardsForWin } = await import('./campaign');
		expect(shardsForWin(0, 0.9)).toBe(1);
		expect(shardsForWin(0, 0.1)).toBe(2);
		expect(shardsForWin(12, 0.9)).toBeGreaterThan(shardsForWin(0, 0.9));
		expect(shardsForWin(-3, Number.NaN)).toBe(1);
	});
});

describe('the bunker', () => {
	it('keeps 20% of a stockpile safe at level one and 80% at the top', async () => {
		const { exposedStock, securedShare, upgradeCost } = await import('./campaign');
		const { MAX_BUNKER_LEVEL } = await import('./config');
		const save = newSave(0);
		expect(securedShare(save)).toBeCloseTo(0.2, 5);
		const top = { ...save, levels: { ...save.levels, bunker: MAX_BUNKER_LEVEL } };
		expect(securedShare(top)).toBeCloseTo(0.8, 5);
		const stocked = { ...save, resources: { wood: 1000, stone: 0, iron: 0, gold: 0 } };
		expect(exposedStock(stocked, 'wood')).toBe(800);
		expect(exposedStock({ ...stocked, levels: top.levels }, 'wood')).toBe(200);
		expect(upgradeCost(save, 'bunker')).not.toBeNull();
		expect(upgradeCost(top, 'bunker')).toBeNull();
	});

	it('is upgraded like any other building and survives a save round trip', async () => {
		const { finishBuilds, startUpgrade, securedShare } = await import('./campaign');
		let save = {
			...newSave(0),
			levels: { ...newSave(0).levels, hq: 3 },
			resources: { wood: 9999, stone: 9999, iron: 9999, gold: 999 }
		};
		save = startUpgrade(save, 'bunker', 0, 1)!;
		save = finishBuilds(save, 10 * 60 * 60 * 1000);
		expect(save.levels.bunker).toBe(2);
		expect(securedShare(parseSave(JSON.parse(JSON.stringify(save)))!)).toBeCloseTo(0.32, 5);
	});
});

describe('cutting a build with an advert', () => {
	it('takes a tenth of the total time off, a few times, and never ends in the past', async () => {
		const { canCutBuild, cutBuildTime, startUpgrade, MAX_AD_CUTS } = await import('./campaign');
		const start = {
			...newSave(0),
			resources: { wood: 999, stone: 999, iron: 999, gold: 99 }
		};
		let save = startUpgrade(start, 'boat-0', 0, 1)!;
		const task = save.builders[0];
		const total = task.endsAt - task.startedAt;
		expect(canCutBuild(save, 'training')).toBe(false);
		save = cutBuildTime(save, 'boat-0', 0)!;
		expect(save.builders[0].endsAt).toBe(task.endsAt - Math.round(total * 0.1));
		for (let cut = 1; cut < MAX_AD_CUTS; cut++) save = cutBuildTime(save, 'boat-0', 0)!;
		expect(cutBuildTime(save, 'boat-0', 0)).toBeNull();
		// A cut never moves the end before now
		const late = cutBuildTime(startUpgrade(start, 'boat-0', 0, 1)!, 'boat-0', task.endsAt)!;
		expect(late.builders[0].endsAt).toBe(task.endsAt);
	});
});

describe('the producers', () => {
	it('pay half as much again with every level', async () => {
		const { HOME_PRODUCTION, homeProduction, levelOf } = await import('./campaign');
		const save = newSave(0);
		expect(homeProduction(save)).toEqual(HOME_PRODUCTION);
		const grown = {
			...save,
			levels: {
				...save.levels,
				producers: { sawmill: 3, quarry: 2, mine: 5, 'house-0': 4 } as const
			}
		};
		expect(levelOf(grown, 'sawmill')).toBe(3);
		expect(homeProduction(grown).wood).toBeCloseTo(HOME_PRODUCTION.wood + 2 * 0.5 * 2, 5);
		expect(homeProduction(grown).stone).toBeCloseTo(HOME_PRODUCTION.stone + 2 * 0.5, 5);
		expect(homeProduction(grown).iron).toBeCloseTo(HOME_PRODUCTION.iron + 1 * 0.5 * 4, 5);
		expect(homeProduction(grown).gold).toBeCloseTo(HOME_PRODUCTION.gold + 1 * 0.5 * 3, 5);
	});

	it('are upgraded like any building and make the cottage sturdier in the defence test', async () => {
		const { finishBuilds, startUpgrade, levelOf, upgradeCost } = await import('./campaign');
		const { testIslandOf } = await import('./defenseTest');
		const { defaultLayout } = await import('./baseLayout');
		const { createBattle } = await import('./battle');
		let save = { ...newSave(0), resources: { wood: 999, stone: 999, iron: 999, gold: 99 } };
		expect(upgradeCost(save, 'sawmill')).not.toBeNull();
		save = startUpgrade(save, 'house-1', 0, 1)!;
		save = finishBuilds(save, 24 * 3600 * 1000);
		expect(levelOf(save, 'house-1')).toBe(2);
		const plain = createBattle(testIslandOf(defaultLayout()));
		const sturdy = createBattle(
			testIslandOf(defaultLayout(), undefined, (house) =>
				levelOf(save, `house-${house}` as 'house-0')
			)
		);
		const hp = (state: typeof plain) =>
			state.buildings.reduce((sum, building) => sum + building.maxHp, 0);
		expect(hp(sturdy)).toBeGreaterThan(hp(plain));
	});
});

describe('troop research', () => {
	it('takes minutes at first and hours later, one troop at a time, and finishes on its own', async () => {
		const { finishResearch, researchOf, startTroopResearch, troopResearchMs, troopLevel } =
			await import('./campaign');
		expect(troopResearchMs(1)).toBe(10 * 60_000);
		expect(troopResearchMs(7)).toBeGreaterThan(3 * 3_600_000);
		const save = {
			...newSave(0),
			levels: { ...newSave(0).levels, training: 8 },
			resources: { wood: 99_999, stone: 99_999, iron: 99_999, gold: 9_999 }
		};
		const started = startTroopResearch(save, 'assault', 0)!;
		expect(started.resources.wood).toBeLessThan(save.resources.wood);
		expect(researchOf(started)!.endsAt).toBe(10 * 60_000);
		expect(startTroopResearch(started, 'tank', 1)).toBeNull();
		expect(finishResearch(started, 5 * 60_000)).toBe(started);
		const done = finishResearch(started, 10 * 60_000);
		expect(troopLevel(done, 'assault')).toBe(2);
		expect(researchOf(done)).toBeNull();
		expect(startTroopResearch(done, 'tank', 10 * 60_000)).not.toBeNull();
	});
});

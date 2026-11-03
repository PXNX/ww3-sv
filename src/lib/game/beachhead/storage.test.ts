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

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

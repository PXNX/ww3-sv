import { describe, expect, it } from 'vitest';
import { exposedStock, newSave } from './campaign';
import { applyRaidLoss, raidLog, rivalIsland } from './rivals';

describe('raids between players', () => {
	it('never takes what the bunker protects', () => {
		const save = { ...newSave(0), resources: { wood: 1000, stone: 1000, iron: 1000, gold: 1000 } };
		const exposed = exposedStock(save, 'gold');
		const after = applyRaidLoss(save, { wood: 10, stone: 0, iron: 0, gold: 999_999 });
		expect(after.resources.wood).toBe(990);
		expect(after.resources.gold).toBe(1000 - exposed);
		expect(after.resources.stone).toBe(1000);
	});

	it('turns a rival base into an island that is never stored as a campaign island', () => {
		const island = rivalIsland('42', { buildings: [{ kind: 'hq', x: 9, y: 3 }], defenseScale: 1 });
		expect(island.id).toBe('rival-42');
		expect(island.buildings).toHaveLength(1);
	});

	it('logs raids at the home bay', () => {
		const lines = raidLog([
			{
				id: '1',
				kind: 'raided',
				player: { id: 'p', name: 'Nadja' },
				loot: { wood: 1, stone: 0, iron: 0, gold: 0 },
				atMs: 5
			}
		]);
		expect(lines[0]).toMatchObject({
			kind: 'raided',
			island: 'home',
			player: 'Nadja',
			id: 'raid-1'
		});
	});
});

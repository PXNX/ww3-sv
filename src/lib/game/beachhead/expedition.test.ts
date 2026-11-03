import { describe, expect, it } from 'vitest';
import {
	EXPEDITION_TIERS,
	canStartExpedition,
	claimExpedition,
	expeditionReady,
	rollChest,
	startExpedition
} from './expedition';
import { newSave, parseSave } from './campaign';
import { crystalStock } from './crystals';

const rich = () => ({
	...newSave(0),
	resources: { wood: 5000, stone: 5000, iron: 5000, gold: 500 }
});

describe('expeditions', () => {
	it('cost money, last hours and allow only one ship at sea', () => {
		const save = rich();
		const sent = startExpedition(save, 1, 1000, 42)!;
		expect(sent.resources.wood).toBe(save.resources.wood - EXPEDITION_TIERS[1].cost.wood);
		expect(sent.expedition!.endsAt - sent.expedition!.startedAt).toBe(4 * 3_600_000);
		expect(canStartExpedition(sent, 0)).toBe(false);
		expect(startExpedition(sent, 0, 2000, 1)).toBeNull();
		expect(startExpedition(newSave(0), 2, 0, 1)).toBeNull();
	});

	it('fills a chest that is the same every time for one seed and bigger for longer trips', () => {
		expect(rollChest(1, 7)).toEqual(rollChest(1, 7));
		expect(rollChest(1, 7)).not.toEqual(rollChest(1, 8));
		const worth = (tier: number) => {
			let total = 0;
			for (let seed = 1; seed <= 60; seed++) {
				const chest = rollChest(tier, seed);
				total += chest.resources.wood + chest.shards * 100 + chest.coins * 10;
			}
			return total;
		};
		expect(worth(2)).toBeGreaterThan(worth(0));
	});

	it('hands over the chest only when the ship is back, and only once', () => {
		const sent = startExpedition(rich(), 0, 0, 99)!;
		expect(expeditionReady(sent, 3_600_000)).toBe(false);
		expect(claimExpedition(sent, 3_600_000)).toBeNull();
		const opened = claimExpedition(sent, 2 * 3_600_000)!;
		expect(opened.save.expedition).toBeUndefined();
		expect(opened.save.hero.cards).toBe(opened.rewards.shards);
		for (const entry of opened.rewards.crystals) {
			expect(crystalStock(opened.save, entry.type)).toBeGreaterThanOrEqual(entry.count);
		}
		expect(claimExpedition(opened.save, 3 * 3_600_000)).toBeNull();
	});

	it('survives a save round trip and drops a broken expedition', () => {
		const sent = startExpedition(rich(), 2, 5, 123)!;
		expect(parseSave(JSON.parse(JSON.stringify(sent)))!.expedition).toEqual(sent.expedition);
		const broken = JSON.parse(JSON.stringify({ ...sent, expedition: { tier: 'x' } }));
		expect(parseSave(broken)!.expedition).toBeUndefined();
	});
});

import { describe, expect, it } from 'vitest';
import {
	HELMET_FLY_MS,
	DEFENSE_KINDS,
	HELMET_POP_MS,
	MAX_LEVEL,
	SELL_REFUND,
	STARTING_HELMETS,
	buildCost,
	sellValue,
	totalSpent,
	upgradeCost
} from './config';
import { build, collectHelmets, dropHelmet, sell, upgrade } from './economy';
import { createGame } from './state';
import { soldierAt } from './testHelpers';

describe('costs', () => {
	it('every defense can be built with the starting helmets and costs more to upgrade', () => {
		for (const kind of DEFENSE_KINDS) {
			// The expensive artillery needs a few helmets from the first kills
			expect(buildCost(kind)).toBeLessThanOrEqual(
				kind === 'squad' || kind === 'trench' ? STARTING_HELMETS : 45
			);
			expect(upgradeCost(kind, 1)).toBeGreaterThan(0);
			expect(upgradeCost(kind, MAX_LEVEL)).toBeNull();
			expect(upgradeCost(kind, 0)).toBeNull();
		}
		expect(upgradeCost('squad', 2)!).toBeGreaterThan(upgradeCost('squad', 1)!);
	});

	it('sells for a share of everything spent', () => {
		expect(totalSpent('squad', 1)).toBe(buildCost('squad'));
		expect(totalSpent('squad', 3)).toBe(
			buildCost('squad') + upgradeCost('squad', 1)! + upgradeCost('squad', 2)!
		);
		expect(sellValue('squad', 1)).toBe(Math.floor(buildCost('squad') * SELL_REFUND));
		expect(sellValue('squad', 3)).toBeGreaterThan(sellValue('squad', 1));
		expect(sellValue('squad', 3)).toBeLessThan(totalSpent('squad', 3));
	});
});

describe('building and upgrading', () => {
	it('spends helmets and fills the slot', () => {
		const state = createGame();
		expect(build(state, 0, 'squad')).toEqual({ ok: true, cost: buildCost('squad') });
		expect(state.currency).toBe(STARTING_HELMETS - buildCost('squad'));
		expect(state.defenses[0]).toMatchObject({ kind: 'squad', level: 1 });
	});

	it('refuses without enough helmets and charges nothing', () => {
		const state = createGame();
		state.currency = buildCost('mortar') - 1;
		expect(build(state, 0, 'mortar')).toEqual({ ok: false, reason: 'poor' });
		expect(state.currency).toBe(buildCost('mortar') - 1);
		expect(state.defenses[0]).toBeNull();
	});

	it('refuses an occupied or unknown slot', () => {
		const state = createGame();
		build(state, 1, 'squad');
		expect(build(state, 1, 'trench')).toEqual({ ok: false, reason: 'occupied' });
		expect(build(state, 99, 'trench')).toEqual({ ok: false, reason: 'bad-slot' });
		expect(build(state, -1, 'trench')).toEqual({ ok: false, reason: 'bad-slot' });
	});

	it('upgrades up to the top level and then stops', () => {
		const state = createGame();
		state.currency = 500;
		build(state, 0, 'nest');
		for (let level = 2; level <= MAX_LEVEL; level++) expect(upgrade(state, 0).ok).toBe(true);
		expect(state.defenses[0]?.level).toBe(MAX_LEVEL);
		expect(upgrade(state, 0)).toEqual({ ok: false, reason: 'max-level' });
		expect(state.currency).toBe(500 - totalSpent('nest', MAX_LEVEL));
	});

	it('refuses to upgrade when poor or when the slot is empty', () => {
		const state = createGame();
		expect(upgrade(state, 3)).toEqual({ ok: false, reason: 'empty' });
		build(state, 3, 'squad');
		state.currency = upgradeCost('squad', 1)! - 1;
		expect(upgrade(state, 3)).toEqual({ ok: false, reason: 'poor' });
		expect(state.defenses[3]?.level).toBe(1);
	});

	it('sells for a refund and frees the slot', () => {
		const state = createGame();
		build(state, 0, 'squad');
		const before = state.currency;
		const result = sell(state, 0);
		expect(result).toEqual({ ok: true, cost: sellValue('squad', 1) });
		expect(state.currency).toBe(before + sellValue('squad', 1));
		expect(state.defenses[0]).toBeNull();
		expect(sell(state, 0)).toEqual({ ok: false, reason: 'empty' });
	});

	it('does nothing once the game is over', () => {
		const state = createGame();
		state.over = true;
		expect(build(state, 0, 'squad')).toEqual({ ok: false, reason: 'game-over' });
		expect(state.currency).toBe(STARTING_HELMETS);
	});
});

describe('helmets', () => {
	it('drops where the soldier fell, worth its value', () => {
		const state = createGame();
		const soldier = soldierAt(300, 'brute');
		const helmet = dropHelmet(state, soldier, 3);
		expect(state.helmets).toEqual([helmet]);
		expect(helmet).toMatchObject({ x: soldier.x, y: soldier.y, value: 3 });
	});

	it('collects itself: pops up, flies to the counter, then pays its value', () => {
		const state = createGame();
		dropHelmet(state, soldierAt(300, 'brute'), 3);
		expect(collectHelmets(state, HELMET_POP_MS + HELMET_FLY_MS - 1)).toEqual([]);
		expect(state.currency).toBe(STARTING_HELMETS);
		expect(state.helmets).toHaveLength(1);
		const events = collectHelmets(state, 2);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ type: 'helmet-collected', value: 3 });
		expect(state.currency).toBe(STARTING_HELMETS + 3);
		expect(state.collected).toBe(3);
		expect(state.helmets).toHaveLength(0);
	});

	it('never fades away: every dropped helmet ends up in the pocket', () => {
		const state = createGame();
		for (let i = 0; i < 5; i++) dropHelmet(state, soldierAt(300 + i * 10), 1);
		for (let i = 0; i < 100; i++) collectHelmets(state, 20);
		expect(state.currency).toBe(STARTING_HELMETS + 5);
		expect(state.helmets).toHaveLength(0);
	});
});

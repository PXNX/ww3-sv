import { describe, expect, it } from 'vitest';
import {
	DEFENSE_COST,
	GUARD_KINDS,
	GUARD_UNLOCK_HQ,
	addMine,
	defaultLayout,
	defenseUnlocked,
	normalizeLayout
} from './baseLayout';
import { BUILDINGS, TROOPS, type TroopKind } from './config';
import { createBattle, deploy, stepBattle } from './battle';
import { testIslandOf } from './defenseTest';
import { setOvercharge, usedOverchargeSlots } from './crystals';
import {
	allDefenseUpgrades,
	buyMine,
	canAffordMine,
	layoutOf,
	newSave,
	sellMine,
	finishBuilds,
	startDefenseUpgrade
} from './campaign';

const rich = (hq: number) => {
	const save = newSave(0);
	return {
		...save,
		levels: { ...save.levels, hq },
		resources: { wood: 9999, stone: 9999, iron: 9999, gold: 999 }
	};
};

describe('the home guard', () => {
	it('is unlocked one gun after another as the headquarters grows', () => {
		const order = [...GUARD_KINDS].sort((a, b) => GUARD_UNLOCK_HQ[a] - GUARD_UNLOCK_HQ[b]);
		expect(GUARD_UNLOCK_HQ[order[0]]).toBeGreaterThan(1);
		expect(GUARD_UNLOCK_HQ.jammer).toBeGreaterThan(GUARD_UNLOCK_HQ.sniper);
		expect(defenseUnlocked('mine-at', 1)).toBe(true);
		for (const kind of GUARD_KINDS) {
			expect(defenseUnlocked(kind, GUARD_UNLOCK_HQ[kind] - 1)).toBe(false);
			expect(defenseUnlocked(kind, GUARD_UNLOCK_HQ[kind])).toBe(true);
		}
	});

	it('costs more the later it unlocks', () => {
		const price = (kind: (typeof GUARD_KINDS)[number]) =>
			Object.values(DEFENSE_COST[kind]).reduce((sum, value) => sum + value, 0);
		expect(price('himars')).toBeGreaterThan(price('sniper'));
		expect(price('patriot')).toBeGreaterThan(price('flame'));
	});

	it('can only be bought once the headquarters is high enough', () => {
		expect(canAffordMine(rich(1), 'himars')).toBe(false);
		expect(buyMine(rich(1), 'himars')).toBeNull();
		const bought = buyMine(rich(GUARD_UNLOCK_HQ.himars), 'himars')!;
		expect(layoutOf(bought).mines[0].kind).toBe('himars');
	});

	it('is kept in a stored layout and brought into the defence test as real guns', () => {
		const layout = addMine(addMine(defaultLayout(), 'jammer')!, 'patriot')!;
		expect(normalizeLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
		const kinds = testIslandOf(layout).buildings.map((b) => b.kind);
		expect(kinds).toContain('jammer');
		expect(kinds).toContain('patriot');
	});

	it('has a Patriot that homes in and a HIMARS that lobs from afar', () => {
		expect(BUILDINGS.patriot.homing).toBe(true);
		expect(BUILDINGS.himars.range).toBeGreaterThan(BUILDINGS.mortar.range);
		expect(BUILDINGS.himars.minRange).toBeGreaterThan(0);
	});
});

describe('the jammer', () => {
	it('shakes every troop near it on a rhythm and leaves far ones alone', () => {
		const state = createBattle({
			id: 'jam',
			buildings: [
				{ kind: 'hq', x: 9, y: 3 },
				{ kind: 'jammer', x: 5, y: 3 }
			]
		});
		const unit = (kind: TroopKind) => ({
			kind,
			hp: TROOPS[kind].hp,
			damage: TROOPS[kind].damage,
			range: TROOPS[kind].range,
			speed: 0,
			attackMs: TROOPS[kind].attackMs
		});
		const withSquad = createBattle(
			{
				id: 'jam',
				buildings: [
					{ kind: 'hq', x: 9, y: 3 },
					{ kind: 'jammer', x: 5, y: 3 }
				]
			},
			{ squads: [[unit('assault'), unit('assault')]] }
		);
		expect(state.buildings).toHaveLength(2);
		deploy(withSquad, 3);
		const [near, far] = withSquad.troops;
		near.x = 5.5;
		near.y = 3.5;
		far.x = 1.2;
		far.y = 7.5;
		for (let step = 0; step < 6; step++) stepBattle(withSquad, 100);
		expect(near.stunMs).toBeGreaterThan(0);
		expect(far.stunMs).toBe(0);
		expect(withSquad.events.some((event) => event.kind === 'jammer-pulse')).toBe(true);
	});
});

describe('what can be taken away again', () => {
	it('lets you sell mines and hedgehogs but not a gun that is placed', async () => {
		const { sellMine } = await import('./campaign');
		const { isRemovable } = await import('./baseLayout');
		expect(isRemovable('mine-at')).toBe(true);
		expect(isRemovable('hedgehog')).toBe(true);
		expect(isRemovable('himars')).toBe(false);
		let save = buyMine(rich(8), 'mine-emp')!;
		save = buyMine(save, 'hedgehog')!;
		save = buyMine(save, 'himars')!;
		const [mine, hedgehog, gun] = layoutOf(save).mines;
		expect(sellMine(save, gun.id)).toBeNull();
		expect(sellMine(save, mine.id)).not.toBeNull();
		expect(sellMine(save, hedgehog.id)).not.toBeNull();
	});
});

describe('upgrading defences', () => {
	it('raises every mine of a kind on one builder, taking the time of the slowest, never past the headquarters level', () => {
		let save = rich(2);
		// Three mines in all is what a level 2 headquarters allows
		for (let index = 0; index < 2; index++) save = buyMine(save, 'mine-at')!;
		save = buyMine(save, 'mine-emp')!;
		expect(buyMine(save, 'mine-at')).toBeNull();
		const plan = allDefenseUpgrades(save, 'mine-at');
		expect(plan.ids).toHaveLength(2);
		expect(plan.cost.iron).toBeGreaterThan(0);
		expect(plan.ms).toBeGreaterThan(0);
		const started = startDefenseUpgrade(save, plan, 1000, 1)!;
		// Nothing changes until the builder is done, and the defences cannot be started twice
		expect(layoutOf(started).mines.every((mine) => (mine.level ?? 1) === 1)).toBe(true);
		expect(allDefenseUpgrades(started, 'mine-at').ids).toHaveLength(0);
		expect(
			startDefenseUpgrade(started, allDefenseUpgrades(started, 'mine-emp'), 1000, 1)
		).toBeNull();
		const early = finishBuilds(started, 1000 + plan.ms - 1);
		expect(layoutOf(early).mines.every((mine) => (mine.level ?? 1) === 1)).toBe(true);
		const raised = finishBuilds(started, 1000 + plan.ms);
		const levels = layoutOf(raised).mines.map((mine) => [mine.kind, mine.level ?? 1]);
		expect(levels.filter(([kind, level]) => kind === 'mine-at' && level === 2)).toHaveLength(2);
		expect(levels.find(([kind]) => kind === 'mine-emp')?.[1]).toBe(1);
		// The headquarters is level two, so a second round is refused
		expect(allDefenseUpgrades(raised, 'mine-at').ids).toHaveLength(0);
	});

	it('makes mines dearer than before', () => {
		expect(DEFENSE_COST['mine-personnel'].wood).toBeGreaterThanOrEqual(30);
	});
});

describe('crystals on defences', () => {
	it('free their slot when the mine is sold', () => {
		let save = buyMine(rich(3), 'mine-emp')!;
		const id = layoutOf(save).mines[0].id;
		save = setOvercharge(save, `defense:${id}`, 'aegis')!;
		expect(usedOverchargeSlots(save)).toBe(1);
		const sold = sellMine(save, id)!;
		expect(usedOverchargeSlots(sold)).toBe(0);
	});
});

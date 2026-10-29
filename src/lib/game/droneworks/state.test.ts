import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { missingMessages } from '#lib/testing/messages.js';
import {
	BUILDINGS,
	CONTRACTS,
	DAMAGED_OUTPUT,
	DRONES,
	REPAIR_COST_DAMAGED,
	REPAIR_COST_DESTROYED,
	REPAIR_MS_DAMAGED,
	REPAIR_MS_DESTROYED,
	SLOT_COUNT,
	SLOWED_OUTPUT,
	STARTING_STEEL
} from './config.js';
import {
	build,
	canBuild,
	canRepair,
	createGame,
	demolish,
	displayAmount,
	droneSpec,
	flakCount,
	outputFactor,
	quotaShare,
	recipeStock,
	repair,
	repairCost,
	stepGame,
	timeShare,
	type DroneworksState
} from './state.js';

/** A random stub that never rolls a strike or a bottleneck */
const calm = () => 0.99;

/** A fresh game with every clock that could interrupt a test pushed far away */
function quiet(): DroneworksState {
	const state = createGame();
	state.strikeInMs = Number.MAX_SAFE_INTEGER;
	state.slowInMs = Number.MAX_SAFE_INTEGER;
	return state;
}

/** Steps the plant in small fixed slices, collecting every event */
function run(state: DroneworksState, seconds: number, random = calm) {
	const events = [];
	for (let spent = 0; spent < seconds * 1000; spent += 100) {
		events.push(...stepGame(state, 100, random));
	}
	return events;
}

function fill(state: DroneworksState) {
	state.stock.steel = 500;
	state.stock.ore = 500;
	state.stock.chips = 500;
	state.stock.engines = 500;
	state.stock.airframes = 500;
}

describe('the supply chain', () => {
	it('starts with a mine, a mine and a smelter and steel in the yard', () => {
		const state = createGame();
		expect(state.slots).toHaveLength(SLOT_COUNT);
		expect(state.slots.filter((slot) => slot !== null)).toHaveLength(3);
		expect(state.slots[0]?.id).toBe('mine');
		expect(state.slots[2]?.id).toBe('smelter');
		expect(state.stock.steel).toBe(STARTING_STEEL);
		expect(state.contract).toBe(0);
		expect(state.delivered).toBe(0);
		expect(state.timeLeftMs).toBe(CONTRACTS[0].timeMs);
	});

	it('turns ore into steel and never spends more ore than it has', () => {
		const state = quiet();
		run(state, 10);
		expect(state.stock.ore).toBeGreaterThan(0);
		expect(state.stock.steel).toBeGreaterThan(STARTING_STEEL);
		for (const slot of state.slots) if (slot) expect(slot.condition).toBe('ok');
		expect(state.stock.ore).toBeGreaterThanOrEqual(0);
	});

	it('lets a smelter run on the stock it has and then stop', () => {
		const state = quiet();
		state.slots[0] = null;
		state.slots[1] = null;
		state.stock.ore = 1;
		state.stock.steel = 0;
		run(state, 5);
		expect(state.stock.steel).toBeGreaterThan(0.4);
		expect(state.stock.steel).toBeLessThan(0.8);
		expect(state.stock.ore).toBeCloseTo(0, 5);
	});

	it('charges budget for a building and refuses a slot that is taken or unpaid', () => {
		const state = quiet();
		state.credits = BUILDINGS.chipfab.cost;
		expect(canBuild(state, 3, 'chipfab')).toBe(true);
		build(state, 3, 'chipfab');
		expect(state.slots[3]?.id).toBe('chipfab');
		expect(state.credits).toBe(0);
		expect(state.stats.spent).toBe(BUILDINGS.chipfab.cost);
		expect(canBuild(state, 3, 'mine')).toBe(false);
		expect(canBuild(state, 4, 'chipfab')).toBe(false);
	});

	it('gives part of the budget back when a building is torn down', () => {
		const state = quiet();
		const before = state.credits;
		const events = demolish(state, 0);
		expect(events).toEqual([{ type: 'demolished', slot: 0, id: 'mine', refund: 6 }]);
		expect(state.credits).toBe(before + 6);
		expect(state.slots[0]).toBeNull();
	});

	it('only starts an assembly when the whole recipe is on the shelf', () => {
		const state = quiet();
		state.slots[3] = null;
		fill(state);
		build(state, 3, 'assembly');
		state.stock.airframes = 1;
		state.stock.engines = 0;
		run(state, 3);
		expect(state.delivered).toBe(0);
		state.stock.airframes = 2;
		state.stock.engines = 1;
		run(state, 7);
		expect(state.delivered).toBe(1);
		expect(state.stats.shipped).toBe(1);
	});
});

describe('the contracts', () => {
	it('counts a delivered drone and pays for it', () => {
		const state = quiet();
		fill(state);
		build(state, 3, 'assembly');
		const events = run(state, 7);
		expect(events).toContainEqual({
			type: 'delivered',
			slot: 3,
			drone: 'flamingo',
			delivered: 1,
			quota: CONTRACTS[0].quota,
			points: DRONES.flamingo.points
		});
		expect(state.score).toBe(DRONES.flamingo.points);
		expect(quotaShare(state)).toBeCloseTo(1 / CONTRACTS[0].quota, 10);
	});

	it('signs off a contract, pays the time bonus and moves on to the next drone', () => {
		const state = quiet();
		state.delivered = CONTRACTS[0].quota - 1;
		state.timeLeftMs = 60_000;
		fill(state);
		build(state, 3, 'assembly');
		const events = run(state, 7);
		const done = events.find((event) => event.type === 'contract-done');
		expect(done).toMatchObject({ drone: 'flamingo' });
		expect((done as { bonus: number }).bonus).toBeGreaterThan(0);
		expect(state.contract).toBe(1);
		expect(state.delivered).toBe(0);
		expect(state.timeLeftMs).toBeLessThanOrEqual(CONTRACTS[1].timeMs);
		expect(droneSpec(state)).toBe(DRONES.freyja);
		expect(events.some((event) => event.type === 'contract' && event.drone === 'freyja')).toBe(
			true
		);
	});

	it('wins the run when the last contract is delivered', () => {
		const state = quiet();
		state.contract = CONTRACTS.length - 1;
		state.delivered = CONTRACTS[state.contract].quota - 1;
		fill(state);
		build(state, 3, 'assembly');
		const events = run(state, 11);
		expect(events.some((event) => event.type === 'won')).toBe(true);
		expect(state.over).toBe(true);
		expect(state.outcome).toBe('delivered');
	});

	it('loses the night when the contract clock runs out', () => {
		const state = quiet();
		state.timeLeftMs = 500;
		const events = run(state, 1);
		expect(events).toContainEqual({ type: 'lost' });
		expect(state.over).toBe(true);
		expect(state.outcome).toBe('deadline');
		expect(stepGame(state, 1000, calm)).toEqual([]);
	});

	it('reports shares for the meters between 0 and 1', () => {
		const state = quiet();
		expect(quotaShare(state)).toBe(0);
		expect(timeShare(state)).toBeGreaterThan(0.99);
		state.delivered = CONTRACTS[0].quota * 2;
		expect(quotaShare(state)).toBe(1);
		state.timeLeftMs = -5;
		expect(timeShare(state)).toBe(0);
	});
});

describe('Putin strikes back', () => {
	it('stops a destroyed building and lets a repair bring it back', () => {
		const state = quiet();
		state.strikeInMs = 100;
		// 0.9 for the target pick, 0.9 for the severity: a destroy
		const destroy = () => 0.9;
		const events = run(state, 0.2, destroy);
		const strike = events.find((event) => event.type === 'strike');
		expect(strike).toMatchObject({ severity: 'destroyed' });
		const slot = (strike as { slot: number }).slot;
		const building = state.slots[slot]!;
		expect(building.condition).toBe('destroyed');
		expect(outputFactor(building)).toBe(0);
		expect(canRepair(state, slot)).toBe(true);
		expect(repairCost(building)).toBe(REPAIR_COST_DESTROYED);
		repair(state, slot);
		run(state, REPAIR_MS_DESTROYED / 1000 + 0.2);
		expect(state.slots[slot]?.condition).toBe('ok');
		expect(state.stats.repaired).toBe(1);
	});

	it('leaves a damaged supplier at half output until it is fixed', () => {
		const state = quiet();
		state.strikeInMs = 100;
		// 0.1 for the target pick and for the severity check: a damage
		const damage = () => 0.1;
		const events = run(state, 0.2, damage);
		const strike = events.find((event) => event.type === 'strike');
		const slot = (strike as { slot: number }).slot;
		const building = state.slots[slot]!;
		expect(building.condition).toBe('damaged');
		expect(outputFactor(building)).toBe(DAMAGED_OUTPUT);
		repair(state, slot);
		run(state, REPAIR_MS_DAMAGED / 1000 + 0.2);
		expect(state.slots[slot]?.condition).toBe('ok');
	});

	it('shoots a strike down when a flak battery stands', () => {
		const state = quiet();
		state.stock.steel = 500;
		build(state, 3, 'flak');
		expect(flakCount(state)).toBe(1);
		state.strikeInMs = 100;
		const events = run(state, 0.2, () => 0);
		expect(events).toContainEqual({ type: 'strike', slot: null, severity: 'intercepted' });
		expect(state.stats.intercepted).toBe(1);
		expect(state.slots[0]?.condition).toBe('ok');
	});

	it('halves the output of a supplier that falls behind for a while', () => {
		const state = quiet();
		state.slowInMs = 100;
		const events = run(state, 0.2, calm);
		const slow = events.find((event) => event.type === 'slowdown');
		expect(slow).toBeDefined();
		const building = state.slots[(slow as { slot: number }).slot]!;
		expect(building.slowLeftMs).toBeGreaterThan(0);
		expect(outputFactor(building)).toBe(SLOWED_OUTPUT);
		run(state, 11);
		expect(state.slots[(slow as { slot: number }).slot]?.slowLeftMs).toBe(0);
	});

	it('tightens the strike interval with every wave', () => {
		const state = quiet();
		state.strikeInMs = 100;
		run(state, 0.2, calm);
		const first = state.strikeInMs;
		state.strikeInMs = 100;
		run(state, 0.2, calm);
		expect(state.strikeInMs).toBeLessThan(first);
	});
});

describe('supply chain helpers', () => {
	it('counts how many recipes the shelf covers', () => {
		const stock = { ore: 0, steel: 0, chips: 3, engines: 5, airframes: 4 };
		expect(recipeStock(stock, DRONES.flamingo.recipe)).toBe(2);
		expect(recipeStock(stock, DRONES.freyja.recipe)).toBe(1.5);
		expect(recipeStock(stock, {})).toBe(Number.POSITIVE_INFINITY);
	});

	it('formats a small stock with one decimal and a large one without', () => {
		expect(displayAmount(0)).toBe('0.0');
		expect(displayAmount(9.87)).toBe('9.9');
		expect(displayAmount(42.7)).toBe('42');
	});

	it('costs more to rebuild a destroyed building than to repair a damaged one', () => {
		const state = quiet();
		state.slots[0]!.condition = 'damaged';
		const damaged = repairCost(state.slots[0]!);
		state.slots[0]!.condition = 'destroyed';
		expect(repairCost(state.slots[0]!)).toBeGreaterThan(damaged);
		expect(damaged).toBe(REPAIR_COST_DAMAGED);
		expect(REPAIR_MS_DESTROYED).toBeGreaterThan(REPAIR_MS_DAMAGED);
	});
});

describe('Drone Works messages', () => {
	it('has its own and its mode messages in every language', () => {
		expect(missingMessages(['droneworks_', 'mode_droneworks_'])).toEqual([]);
	});
});

describe('a competent shift', () => {
	it('can deliver the first contract inside its clock', () => {
		const state = quiet();
		const order = ['chipfab', 'airframe', 'engine', 'smelter', 'mine', 'assembly'] as const;
		const random = createRandom(7);
		let next = 0;
		for (let step = 0; step < CONTRACTS[0].timeMs / 100; step++) {
			if (next < order.length && canBuild(state, 3 + next, order[next])) {
				build(state, 3 + next, order[next]);
				next += 1;
			}
			stepGame(state, 100, random);
			if (state.contract > 0) break;
		}
		expect(state.contract).toBe(1);
		expect(state.over).toBe(false);
	});
});

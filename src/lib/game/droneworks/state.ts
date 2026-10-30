/*
 * Drone Works rules as a plain state machine, in the spirit of a very small Factorio: a shop floor
 * of build slots, a handful of buildings that each turn one resource into the next, and a contract
 * for the drone that has to leave the hall tonight. Resources are continuous and per second, so the
 * chain runs by itself once it stands; the player spends steel, decides what to build next, repairs
 * what the strikes hit and decides what to tear down when the recipe changes.
 *
 * Putin's strikes arrive on their own clock. A hit either damages a building (half output) or
 * destroys it (no output) until the player pays for a repair, which takes time and stops production
 * while it runs. Air defence batteries can shoot a strike down before it lands. On top of that a
 * supplier can fall behind for a while, halving one building's output.
 */
import type { Random } from '../random.js';
import {
	BUILDINGS,
	BUDGET_PER_DRONE,
	BUDGET_PER_SECOND,
	CONTRACTS,
	DAMAGE_SHARE,
	DAMAGED_OUTPUT,
	DRONES,
	FIRST_SLOWDOWN_MS,
	FIRST_STRIKE_MS,
	INTERCEPT_MAX,
	INTERCEPT_PER_FLAK,
	REFUND_SHARE,
	REPAIR_COST_DAMAGED,
	REPAIR_COST_DESTROYED,
	REPAIR_MS_DAMAGED,
	REPAIR_MS_DESTROYED,
	RESOURCES,
	SLOT_COUNT,
	SLOWDOWN_EVERY_MS,
	SLOWDOWN_MS,
	SLOWED_OUTPUT,
	STARTING_BUILDINGS,
	STARTING_CREDITS,
	STARTING_STEEL,
	STRIKE_BASE_MS,
	STRIKE_MIN_MS,
	STRIKE_STEP_MS,
	TIME_BONUS_PER_SECOND,
	type BuildingId,
	type DroneId,
	type ResourceId
} from './config.js';
export { REPAIR_COST_DAMAGED, REPAIR_COST_DESTROYED } from './config.js';

export type Condition = 'ok' | 'damaged' | 'destroyed';

export interface Building {
	id: BuildingId;
	condition: Condition;
	/** Milliseconds left of a repair in progress; 0 when none runs */
	repairLeftMs: number;
	/** Length of the repair in progress, for the progress bar */
	repairTotalMs: number;
	/** Milliseconds left of a supply bottleneck, during which output is halved */
	slowLeftMs: number;
	/** Milliseconds left on the assembly line; only the assembly hall uses it */
	workLeftMs: number;
}

export interface DroneworksStats {
	/** Drones handed over to the front */
	shipped: number;
	/** Strikes shot down by the flak batteries */
	intercepted: number;
	/** Strikes that landed */
	hits: number;
	/** Buildings destroyed outright */
	destroyed: number;
	repaired: number;
	/** Budget spent on buildings and repairs */
	spent: number;
}

/** How the night ended: all contracts delivered, or the clock ran out */
export type DroneworksOutcome = 'delivered' | 'deadline';

export interface DroneworksState {
	slots: (Building | null)[];
	stock: Record<ResourceId, number>;
	/** Procurement budget: the only thing buildings and repairs are paid with */
	credits: number;
	/** Index into CONTRACTS */
	contract: number;
	/** Drones of the current contract delivered */
	delivered: number;
	timeLeftMs: number;
	elapsedMs: number;
	score: number;
	over: boolean;
	outcome: DroneworksOutcome | null;
	/** Milliseconds until the next strike wave */
	strikeInMs: number;
	strikes: number;
	/** Milliseconds until the next supplier bottleneck */
	slowInMs: number;
	stats: DroneworksStats;
}

export type DroneworksEvent =
	| { type: 'built'; slot: number; id: BuildingId }
	| { type: 'demolished'; slot: number; id: BuildingId; refund: number }
	| { type: 'repair-start'; slot: number; cost: number; ms: number }
	| { type: 'repaired'; slot: number; id: BuildingId }
	| { type: 'strike'; slot: number | null; severity: 'damaged' | 'destroyed' | 'intercepted' }
	| { type: 'slowdown'; slot: number; id: BuildingId }
	| {
			type: 'delivered';
			slot: number;
			drone: DroneId;
			delivered: number;
			quota: number;
			points: number;
	  }
	| { type: 'contract-done'; contract: number; drone: DroneId; bonus: number }
	| { type: 'contract'; contract: number; drone: DroneId; quota: number }
	| { type: 'won' }
	| { type: 'lost' };

function emptyStock(): Record<ResourceId, number> {
	return { ore: 0, steel: 0, chips: 0, engines: 0, airframes: 0 };
}

export function createBuilding(id: BuildingId): Building {
	return {
		id,
		condition: 'ok',
		repairLeftMs: 0,
		repairTotalMs: 0,
		slowLeftMs: 0,
		workLeftMs: 0
	};
}

export function createGame(): DroneworksState {
	const slots: (Building | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
	STARTING_BUILDINGS.forEach((id, index) => {
		slots[index] = createBuilding(id);
	});
	const stock = emptyStock();
	stock.steel = STARTING_STEEL;
	return {
		slots,
		stock,
		credits: STARTING_CREDITS,
		contract: 0,
		delivered: 0,
		timeLeftMs: CONTRACTS[0].timeMs,
		elapsedMs: 0,
		score: 0,
		over: false,
		outcome: null,
		strikeInMs: FIRST_STRIKE_MS,
		strikes: 0,
		slowInMs: FIRST_SLOWDOWN_MS,
		stats: { shipped: 0, intercepted: 0, hits: 0, destroyed: 0, repaired: 0, spent: 0 }
	};
}

export function contractSpec(state: DroneworksState) {
	return CONTRACTS[state.contract];
}

export function droneSpec(state: DroneworksState) {
	return DRONES[contractSpec(state).drone];
}

/** Share of the current quota already delivered, 0 to 1 */
export function quotaShare(state: DroneworksState): number {
	const quota = contractSpec(state).quota;
	if (quota <= 0) return 1;
	return Math.max(0, Math.min(1, state.delivered / quota));
}

/** Share of the contract clock still left, 0 to 1 */
export function timeShare(state: DroneworksState): number {
	const total = contractSpec(state).timeMs;
	if (total <= 0) return 0;
	return Math.max(0, Math.min(1, state.timeLeftMs / total));
}

/** How much of its rated output a building currently gives, 0 to 1 */
export function outputFactor(building: Building): number {
	if (building.condition === 'damaged') return DAMAGED_OUTPUT;
	if (building.condition === 'destroyed') return 0;
	return building.slowLeftMs > 0 ? SLOWED_OUTPUT : 1;
}

/** Flak batteries still standing and not in repair */
export function flakCount(state: DroneworksState): number {
	return state.slots.filter((slot) => slot?.id === 'flak' && slot.condition === 'ok').length;
}

/** Buildings that can still produce: everything but the flak, flak never produces anything */
function producers(state: DroneworksState): { slot: number; building: Building }[] {
	const found: { slot: number; building: Building }[] = [];
	state.slots.forEach((building, slot) => {
		if (building && building.id !== 'flak') found.push({ slot, building });
	});
	return found;
}

export function canBuild(state: DroneworksState, slot: number, id: BuildingId): boolean {
	return (
		!state.over &&
		slot >= 0 &&
		slot < SLOT_COUNT &&
		state.slots[slot] === null &&
		state.credits >= BUILDINGS[id].cost
	);
}

/** Puts a building on an empty slot and pays for it out of the procurement budget */
export function build(state: DroneworksState, slot: number, id: BuildingId): DroneworksEvent[] {
	if (!canBuild(state, slot, id)) return [];
	const cost = BUILDINGS[id].cost;
	state.credits -= cost;
	state.stats.spent += cost;
	state.slots[slot] = createBuilding(id);
	return [{ type: 'built', slot, id }];
}

/** Tears a building down and gets part of the budget back */
export function demolish(state: DroneworksState, slot: number): DroneworksEvent[] {
	if (state.over) return [];
	const building = state.slots[slot];
	if (!building) return [];
	const refund = Math.floor(BUILDINGS[building.id].cost * REFUND_SHARE);
	state.credits += refund;
	state.slots[slot] = null;
	return [{ type: 'demolished', slot, id: building.id, refund }];
}

export function repairCost(building: Building): number {
	return building.condition === 'destroyed' ? REPAIR_COST_DESTROYED : REPAIR_COST_DAMAGED;
}

export function canRepair(state: DroneworksState, slot: number): boolean {
	const building = state.slots[slot];
	if (state.over || !building) return false;
	if (building.condition === 'ok' || building.repairLeftMs > 0) return false;
	return state.credits >= repairCost(building);
}

/** Pays for and starts a repair; the building produces nothing until it is done */
export function repair(state: DroneworksState, slot: number): DroneworksEvent[] {
	if (!canRepair(state, slot)) return [];
	const building = state.slots[slot]!;
	const cost = repairCost(building);
	const ms = building.condition === 'destroyed' ? REPAIR_MS_DESTROYED : REPAIR_MS_DAMAGED;
	state.credits -= cost;
	state.stats.spent += cost;
	building.repairLeftMs = ms;
	building.repairTotalMs = ms;
	return [{ type: 'repair-start', slot, cost, ms }];
}

/** How many of a recipe the stock covers */
export function recipeStock(
	stock: Record<ResourceId, number>,
	recipe: Partial<Record<ResourceId, number>>
): number {
	let count = Number.POSITIVE_INFINITY;
	for (const [resource, need] of Object.entries(recipe) as [ResourceId, number][]) {
		if (need <= 0) continue;
		count = Math.min(count, stock[resource] / need);
	}
	return Number.isFinite(count) ? count : Number.POSITIVE_INFINITY;
}

/** Rounds a resource for display, keeping one decimal below ten */
export function displayAmount(value: number): string {
	const clamped = Math.max(0, value);
	return clamped >= 10 ? String(Math.floor(clamped)) : clamped.toFixed(1);
}

function tickStrikes(
	state: DroneworksState,
	dtMs: number,
	random: Random,
	events: DroneworksEvent[]
) {
	state.strikeInMs -= dtMs;
	if (state.strikeInMs > 0) return;

	state.strikes += 1;
	const interval = Math.max(STRIKE_MIN_MS, STRIKE_BASE_MS - state.strikes * STRIKE_STEP_MS);
	state.strikeInMs = interval;

	const targets = state.slots
		.map((building, slot) => ({ building, slot }))
		.filter((entry) => entry.building !== null);
	if (targets.length === 0) return;

	const flak = flakCount(state);
	if (flak > 0 && random() < Math.min(INTERCEPT_MAX, INTERCEPT_PER_FLAK * flak)) {
		state.stats.intercepted += 1;
		events.push({ type: 'strike', slot: null, severity: 'intercepted' });
		return;
	}

	const target = targets[Math.min(targets.length - 1, Math.floor(random() * targets.length))];
	const building = target.building!;
	const severity = random() < DAMAGE_SHARE ? 'damaged' : 'destroyed';
	building.condition = severity;
	building.repairLeftMs = 0;
	building.repairTotalMs = 0;
	building.slowLeftMs = 0;
	state.stats.hits += 1;
	if (severity === 'destroyed') state.stats.destroyed += 1;
	events.push({ type: 'strike', slot: target.slot, severity });
}

function tickSlowdowns(
	state: DroneworksState,
	dtMs: number,
	random: Random,
	events: DroneworksEvent[]
) {
	state.slowInMs -= dtMs;
	if (state.slowInMs > 0) return;
	state.slowInMs = SLOWDOWN_EVERY_MS;

	const candidates = producers(state).filter(
		({ building }) => building.condition === 'ok' && building.slowLeftMs <= 0
	);
	if (candidates.length === 0) return;
	const picked =
		candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
	picked.building.slowLeftMs = SLOWDOWN_MS;
	events.push({ type: 'slowdown', slot: picked.slot, id: picked.building.id });
}

/** Runs every producer for one step, consuming inputs only as far as the stock allows */
function produce(state: DroneworksState, dtSeconds: number) {
	for (const { building } of producers(state)) {
		const spec = BUILDINGS[building.id];
		if (building.id === 'assembly') continue;
		const factor = outputFactor(building);
		if (factor <= 0) continue;

		// The chain is only as fast as its scarcest input
		let scale = factor;
		for (const [resource, need] of Object.entries(spec.input) as [ResourceId, number][]) {
			if (need <= 0) continue;
			scale = Math.min(scale, state.stock[resource] / (need * dtSeconds));
		}
		scale = Math.max(0, Math.min(factor, scale));
		if (scale <= 0) continue;

		for (const [resource, need] of Object.entries(spec.input) as [ResourceId, number][]) {
			state.stock[resource] = Math.max(0, state.stock[resource] - need * dtSeconds * scale);
		}
		for (const [resource, rate] of Object.entries(spec.output) as [ResourceId, number][]) {
			state.stock[resource] += rate * dtSeconds * scale;
		}
	}
}

function tickRepairs(state: DroneworksState, dtMs: number, events: DroneworksEvent[]) {
	state.slots.forEach((building, slot) => {
		if (!building) return;
		if (building.slowLeftMs > 0) building.slowLeftMs = Math.max(0, building.slowLeftMs - dtMs);
		if (building.repairLeftMs <= 0) return;
		building.repairLeftMs = Math.max(0, building.repairLeftMs - dtMs);
		if (building.repairLeftMs > 0) return;
		building.condition = 'ok';
		building.repairTotalMs = 0;
		state.stats.repaired += 1;
		events.push({ type: 'repaired', slot, id: building.id });
	});
}

/** The assembly halls build the contract's drone, one at a time per hall */
function runAssembly(state: DroneworksState, dtMs: number, events: DroneworksEvent[]) {
	const contract = contractSpec(state);
	const drone = DRONES[contract.drone];
	if (state.delivered >= contract.quota) return;

	for (const { building, slot } of producers(state)) {
		if (building.id !== 'assembly' || building.condition !== 'ok') continue;
		if (state.delivered >= contract.quota) break;

		if (building.workLeftMs <= 0) {
			// The line only starts when the whole recipe is on the shelf
			if (recipeStock(state.stock, drone.recipe) < 1) continue;
			for (const [resource, need] of Object.entries(drone.recipe) as [ResourceId, number][]) {
				state.stock[resource] = Math.max(0, state.stock[resource] - need);
			}
			building.workLeftMs = drone.buildMs;
		}

		building.workLeftMs -= dtMs;
		if (building.workLeftMs > 0) continue;

		building.workLeftMs = 0;
		state.delivered += 1;
		state.stats.shipped += 1;
		state.score += drone.points;
		// The ministry pays for what actually reaches the front
		state.credits += BUDGET_PER_DRONE;
		events.push({
			type: 'delivered',
			slot,
			drone: contract.drone,
			delivered: state.delivered,
			quota: contract.quota,
			points: drone.points
		});
	}
}

function tickContract(state: DroneworksState, dtMs: number, events: DroneworksEvent[]) {
	const contract = contractSpec(state);
	state.timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);

	if (state.delivered >= contract.quota) {
		const bonus = Math.floor(state.timeLeftMs / 1000) * TIME_BONUS_PER_SECOND;
		state.score += bonus;
		events.push({ type: 'contract-done', contract: state.contract, drone: contract.drone, bonus });
		if (state.contract >= CONTRACTS.length - 1) {
			state.over = true;
			state.outcome = 'delivered';
			events.push({ type: 'won' });
			return;
		}
		state.contract += 1;
		state.delivered = 0;
		state.timeLeftMs = CONTRACTS[state.contract].timeMs;
		events.push({
			type: 'contract',
			contract: state.contract,
			drone: CONTRACTS[state.contract].drone,
			quota: CONTRACTS[state.contract].quota
		});
		return;
	}

	if (state.timeLeftMs <= 0 && !state.over) {
		state.over = true;
		state.outcome = 'deadline';
		events.push({ type: 'lost' });
	}
}

/** One fixed step of the whole plant */
export function stepGame(state: DroneworksState, dtMs: number, random: Random): DroneworksEvent[] {
	if (state.over || dtMs <= 0) return [];
	const events: DroneworksEvent[] = [];
	const dtSeconds = dtMs / 1000;
	state.elapsedMs += dtMs;
	state.credits += BUDGET_PER_SECOND * dtSeconds;

	tickStrikes(state, dtMs, random, events);
	tickSlowdowns(state, dtMs, random, events);
	produce(state, dtSeconds);
	runAssembly(state, dtMs, events);
	tickRepairs(state, dtMs, events);
	tickContract(state, dtMs, events);

	for (const resource of RESOURCES) {
		if (state.stock[resource] < 0) state.stock[resource] = 0;
	}

	return events;
}

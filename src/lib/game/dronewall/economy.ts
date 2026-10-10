/*
 * The helmet economy: helmets are the only currency. Fallen enemies drop them, they fly to the
 * counter by themselves, and they pay for building, upgrading (and the refund when selling).
 */
import {
	HELMET_FLY_MS,
	HELMET_POP_MS,
	buildCost,
	eliteTier,
	sellValue,
	upgradeCost,
	type DefenseKind
} from './config';
import type { DroneWallEvent, DroneWallState, Helmet, Soldier } from './state';

export type EconomyFailure =
	'game-over' | 'bad-slot' | 'occupied' | 'empty' | 'max-level' | 'poor' | 'locked' | 'cooldown';

export type EconomyResult = { ok: true; cost: number } | { ok: false; reason: EconomyFailure };

const fail = (reason: EconomyFailure): EconomyResult => ({ ok: false, reason });

export function canAfford(state: DroneWallState, cost: number): boolean {
	return state.currency >= cost;
}

export function build(state: DroneWallState, slot: number, kind: DefenseKind): EconomyResult {
	if (state.over) return fail('game-over');
	if (!state.map.slots[slot]) return fail('bad-slot');
	if (state.defenses[slot]) return fail('occupied');
	const cost = buildCost(kind);
	if (!canAfford(state, cost)) return fail('poor');
	state.currency -= cost;
	// A new defense needs a moment to get ready
	state.defenses[slot] = { kind, level: 1, cooldownMs: 500, aim: Math.PI / 2, firedMs: 0 };
	return { ok: true, cost };
}

export function upgrade(state: DroneWallState, slot: number): EconomyResult {
	if (state.over) return fail('game-over');
	const defense = state.defenses[slot];
	if (!state.map.slots[slot]) return fail('bad-slot');
	if (!defense) return fail('empty');
	const cost = upgradeCost(defense.kind, defense.level);
	if (cost === null) return fail('max-level');
	if (!canAfford(state, cost)) return fail('poor');
	state.currency -= cost;
	defense.level += 1;
	// The first elite defense unlocks the powers; higher elite tiers make them stronger
	state.eliteRank = Math.max(state.eliteRank, eliteTier(defense.level));
	return { ok: true, cost };
}

/** Removes a defense and refunds part of what it cost; `cost` in the result is the refund */
export function sell(state: DroneWallState, slot: number): EconomyResult {
	if (state.over) return fail('game-over');
	const defense = state.defenses[slot];
	if (!state.map.slots[slot]) return fail('bad-slot');
	if (!defense) return fail('empty');
	const refund = sellValue(defense.kind, defense.level);
	state.currency += refund;
	state.defenses[slot] = null;
	state.units = state.units.filter((unit) => unit.slot !== slot);
	return { ok: true, cost: refund };
}

/** A fallen enemy drops one helmet where it fell */
export function dropHelmet(
	state: DroneWallState,
	enemy: Pick<Soldier, 'x' | 'y'>,
	value: number
): Helmet {
	const helmet: Helmet = { id: state.nextId++, x: enemy.x, y: enemy.y, value, ageMs: 0 };
	state.helmets.push(helmet);
	return helmet;
}

/**
 * Helmets collect themselves: each pops up, flies to the counter and is added to the pocket when
 * it lands. Ages them and returns an event for every one that landed.
 */
export function collectHelmets(state: DroneWallState, dtMs: number): DroneWallEvent[] {
	const events: DroneWallEvent[] = [];
	for (const helmet of state.helmets) helmet.ageMs += dtMs;
	state.helmets = state.helmets.filter((helmet) => {
		if (helmet.ageMs < HELMET_POP_MS + HELMET_FLY_MS) return true;
		state.currency += helmet.value;
		state.collected += helmet.value;
		events.push({ type: 'helmet-collected', x: helmet.x, y: helmet.y, value: helmet.value });
		return false;
	});
	return events;
}

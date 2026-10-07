/*
 * The helmet economy: helmets are the only currency. Fallen soldiers drop them, a tap collects
 * them before they fade, and they pay for building, upgrading (and the refund when selling).
 */
import {
	HELMET_PICK_RADIUS,
	HELMET_TTL_MS,
	SLOTS,
	buildCost,
	sellValue,
	upgradeCost,
	type DefenseKind
} from './config';
import { distanceBetween } from './path';
import type { DroneWallEvent, DroneWallState, Helmet, Soldier } from './state';

export type EconomyFailure = 'game-over' | 'bad-slot' | 'occupied' | 'empty' | 'max-level' | 'poor';

export type EconomyResult = { ok: true; cost: number } | { ok: false; reason: EconomyFailure };

const fail = (reason: EconomyFailure): EconomyResult => ({ ok: false, reason });

export function canAfford(state: DroneWallState, cost: number): boolean {
	return state.currency >= cost;
}

export function build(state: DroneWallState, slot: number, kind: DefenseKind): EconomyResult {
	if (state.over) return fail('game-over');
	if (!SLOTS[slot]) return fail('bad-slot');
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
	if (!SLOTS[slot]) return fail('bad-slot');
	if (!defense) return fail('empty');
	const cost = upgradeCost(defense.kind, defense.level);
	if (cost === null) return fail('max-level');
	if (!canAfford(state, cost)) return fail('poor');
	state.currency -= cost;
	defense.level += 1;
	return { ok: true, cost };
}

/** Removes a defense and refunds part of what it cost; `cost` in the result is the refund */
export function sell(state: DroneWallState, slot: number): EconomyResult {
	if (state.over) return fail('game-over');
	const defense = state.defenses[slot];
	if (!SLOTS[slot]) return fail('bad-slot');
	if (!defense) return fail('empty');
	const refund = sellValue(defense.kind, defense.level);
	state.currency += refund;
	state.defenses[slot] = null;
	return { ok: true, cost: refund };
}

/** A fallen soldier drops one helmet where it fell */
export function dropHelmet(state: DroneWallState, soldier: Soldier, value: number): Helmet {
	const helmet: Helmet = { id: state.nextId++, x: soldier.x, y: soldier.y, value, ageMs: 0 };
	state.helmets.push(helmet);
	return helmet;
}

/** Collects the helmet closest to the tap, if one is within reach */
export function collectHelmetAt(
	state: DroneWallState,
	x: number,
	y: number,
	radius = HELMET_PICK_RADIUS
): DroneWallEvent | null {
	if (state.over) return null;
	let bestIndex = -1;
	let bestDistance = radius;
	state.helmets.forEach((helmet, index) => {
		const distance = distanceBetween(helmet, { x, y });
		if (distance <= bestDistance) {
			bestDistance = distance;
			bestIndex = index;
		}
	});
	if (bestIndex < 0) return null;
	const [helmet] = state.helmets.splice(bestIndex, 1);
	state.currency += helmet.value;
	state.collected += helmet.value;
	return { type: 'helmet-collected', x: helmet.x, y: helmet.y, value: helmet.value };
}

/** Ages the helmets and removes the ones that faded away */
export function ageHelmets(state: DroneWallState, dtMs: number): DroneWallEvent[] {
	const events: DroneWallEvent[] = [];
	for (const helmet of state.helmets) helmet.ageMs += dtMs;
	state.helmets = state.helmets.filter((helmet) => {
		if (helmet.ageMs < HELMET_TTL_MS) return true;
		events.push({ type: 'helmet-expired', x: helmet.x, y: helmet.y });
		return false;
	});
	return events;
}

/*
 * Powers: things the player calls in by hand, for helmets, on a cooldown. The first elite defense
 * unlocks the F-16 airstrike, an elite II defense the Storm Shadow missile, and the highest elite
 * tier reached (the elite rank) makes them hit harder. Their damage also grows with the wave, so
 * a power stays worth its price. Both land as shells on the road, so they use the same blast code
 * as the artillery.
 */
import { AIRSTRIKE, POWERS, STORM_SHADOW, WORLD_WIDTH, powerScale, type PowerKind } from './config';
import type { EconomyResult } from './economy';
import type { DroneWallEvent, DroneWallState } from './state';

const fail = (reason: 'game-over' | 'locked' | 'cooldown' | 'poor'): EconomyResult => ({
	ok: false,
	reason
});

export function isPowerUnlocked(state: DroneWallState, power: PowerKind): boolean {
	return state.eliteRank >= POWERS[power].unlockRank;
}

/** Checks the power can be called and takes its price; null when everything is fine */
function pay(state: DroneWallState, power: PowerKind): EconomyResult | null {
	if (state.over) return fail('game-over');
	if (!isPowerUnlocked(state, power)) return fail('locked');
	if (state.powers[power].cooldownMs > 0) return fail('cooldown');
	if (state.currency < POWERS[power].cost) return fail('poor');
	state.currency -= POWERS[power].cost;
	state.powers[power].cooldownMs = POWERS[power].cooldownMs;
	return null;
}

const rankIndex = (state: DroneWallState) => Math.min(3, Math.max(1, state.eliteRank)) - 1;

/**
 * F-16s carpet-bomb a band of the field around `y` (world units): a row of bombs falls across
 * the whole width, left to right, as the jets pass over.
 */
export function callAirstrike(
	state: DroneWallState,
	y: number,
	events: DroneWallEvent[] = []
): EconomyResult {
	const failed = pay(state, 'airstrike');
	if (failed) return failed;
	const rank = rankIndex(state);
	const count = AIRSTRIKE.bombs[rank];
	const damage = AIRSTRIKE.damage * AIRSTRIKE.rankDamage[rank] * powerScale(state.wave);
	const centre = Math.min(Math.max(y, AIRSTRIKE.halfBand * 0.5), state.map.lineY - 10);
	const span = WORLD_WIDTH + 80;

	for (let i = 0; i < count; i++) {
		const x = 20 + ((i + 0.5) * (WORLD_WIDTH - 40)) / count;
		// The bombs fall in a staggered line across the band, no two on the same height
		const offset = ((((i * 0.618) % 1) - 0.5) * 2 * AIRSTRIKE.halfBand * 0.5) | 0;
		const toY = Math.min(centre + offset, state.map.lineY - 8);
		state.shells.push({
			id: state.nextId++,
			kind: 'bomb',
			fromX: x,
			fromY: toY - 80,
			toX: x,
			toY,
			ageMs: -((x + 40) / span) * AIRSTRIKE.crossMs,
			flightMs: AIRSTRIKE.fallMs,
			damage,
			radius: AIRSTRIKE.radius
		});
	}
	state.runs.push({
		id: state.nextId++,
		y: centre,
		ageMs: 0,
		durationMs: AIRSTRIKE.crossMs
	});
	events.push({ type: 'power-called', power: 'airstrike', x: WORLD_WIDTH / 2, y: centre });
	return { ok: true, cost: POWERS.airstrike.cost };
}

/** A Storm Shadow cruise missile flies in from the side of the field and hits one spot */
export function callStormShadow(
	state: DroneWallState,
	x: number,
	y: number,
	events: DroneWallEvent[] = []
): EconomyResult {
	const failed = pay(state, 'stormshadow');
	if (failed) return failed;
	const rank = rankIndex(state);
	const toX = Math.min(Math.max(x, 0), WORLD_WIDTH);
	const toY = Math.min(Math.max(y, 0), state.map.lineY);
	state.shells.push({
		id: state.nextId++,
		kind: 'cruise',
		fromX: toX < WORLD_WIDTH / 2 ? WORLD_WIDTH + 70 : -70,
		fromY: Math.max(-40, toY - 90),
		toX,
		toY,
		ageMs: 0,
		flightMs: STORM_SHADOW.flightMs,
		damage: STORM_SHADOW.damage * STORM_SHADOW.rankDamage[rank] * powerScale(state.wave),
		radius: STORM_SHADOW.radius
	});
	events.push({ type: 'power-called', power: 'stormshadow', x: toX, y: toY });
	return { ok: true, cost: POWERS.stormshadow.cost };
}

/** Calls a power on a spot of the field (an airstrike only cares about the height) */
export function callPower(
	state: DroneWallState,
	power: PowerKind,
	x: number,
	y: number,
	events: DroneWallEvent[] = []
): EconomyResult {
	return power === 'airstrike'
		? callAirstrike(state, y, events)
		: callStormShadow(state, x, y, events);
}

/** Runs the cooldowns and ages the bombing runs */
export function updatePowers(state: DroneWallState, dtMs: number) {
	for (const power of Object.values(state.powers)) {
		power.cooldownMs = Math.max(0, power.cooldownMs - dtMs);
	}
	for (const run of state.runs) run.ageMs += dtMs;
	state.runs = state.runs.filter((run) => run.ageMs < run.durationMs);
}

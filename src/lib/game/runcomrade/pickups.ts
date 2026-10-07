/*
 * Pickups and the power they give. A helmet is a speed boost: the runner sprints faster, plows
 * through anything in the way and leaves the drone behind. A rice bowl is a one-hit shield that
 * soaks up the next stumble or the next drone contact, whichever comes first.
 */
import { BOOST_MS, BOOST_SPEED, LANE_OVERLAP, PICKUP_HALF_DEPTH, type PickupKind } from './config';
import type { Pickup } from './patterns';

export interface Power {
	/** Time left of the helmet boost, 0 when none */
	boostMs: number;
	/** A rice bowl is ready to take the next hit */
	shield: boolean;
}

export function createPower(): Power {
	return { boostMs: 0, shield: false };
}

export function isBoosted(power: Power): boolean {
	return power.boostMs > 0;
}

/** Applies a collected pickup. A second helmet restarts the boost; a second bowl changes nothing. */
export function applyPickup(power: Power, kind: PickupKind): void {
	if (kind === 'helmet') power.boostMs = BOOST_MS;
	else power.shield = true;
}

/** Counts the boost down */
export function tickPower(power: Power, dtMs: number): { boostEnded: boolean } {
	if (power.boostMs <= 0) return { boostEnded: false };
	power.boostMs = Math.max(0, power.boostMs - dtMs);
	return { boostEnded: power.boostMs === 0 };
}

/** Uses up the shield if there is one; returns whether a hit was absorbed */
export function absorbHit(power: Power): boolean {
	if (!power.shield) return false;
	power.shield = false;
	return true;
}

export function speedFactor(power: Power): number {
	return isBoosted(power) ? BOOST_SPEED : 1;
}

/** Whether a runner at this distance and lane position picks the pickup up */
export function reaches(pickup: Pickup, distance: number, lanePosition: number): boolean {
	return (
		!pickup.taken &&
		Math.abs(pickup.z - distance) <= PICKUP_HALF_DEPTH &&
		Math.abs(pickup.lane - lanePosition) < LANE_OVERLAP
	);
}

/*
 * The chasing FPV drone. All it has is a gap: how many units it trails the runner. A stumble closes
 * the gap, clean running slowly opens it again, a helmet boost pulls it back fast, and when the gap
 * is gone the drone makes contact (which costs a heart, or the rice shield). Hiding the drone in
 * tall sunflowers and the buzz that stands in for sight are decided here too.
 */
import {
	BOOST_DRONE_PULL,
	CONTACT_GRACE_MS,
	DRONE_CONTACT_GAP,
	DRONE_MAX_GAP,
	DRONE_RECOVER_RATE,
	DRONE_RESET_GAP,
	DRONE_START_GAP,
	STUMBLE_CLOSE,
	type ObstacleKind
} from './config';

export interface Drone {
	/** Units between the drone and the runner */
	gap: number;
	/** While above zero the drone cannot make contact (it was just shaken off) */
	graceMs: number;
	/** Counts up while the drone is in sight, drives its wobble */
	phase: number;
}

export function createDrone(): Drone {
	return { gap: DRONE_START_GAP, graceMs: 0, phase: 0 };
}

/** A stumble: the drone gains on the runner */
export function closeIn(drone: Drone, kind: ObstacleKind): void {
	drone.gap = Math.max(0, drone.gap - STUMBLE_CLOSE[kind]);
}

export interface DroneStep {
	/** The gap is used up: the drone caught the runner this step */
	contact: boolean;
}

/** One step of the chase: the gap opens a little, a boost opens it faster, then contact is checked */
export function stepDrone(drone: Drone, dtMs: number, boosted: boolean): DroneStep {
	const seconds = dtMs / 1000;
	drone.phase += seconds;
	drone.graceMs = Math.max(0, drone.graceMs - dtMs);
	const rate = DRONE_RECOVER_RATE + (boosted ? BOOST_DRONE_PULL : 0);
	drone.gap = Math.min(DRONE_MAX_GAP, drone.gap + rate * seconds);
	if (drone.gap <= DRONE_CONTACT_GAP && drone.graceMs <= 0) {
		return { contact: true };
	}
	return { contact: false };
}

/** After a contact the drone is knocked back, and cannot touch the runner for a moment */
export function knockBack(drone: Drone): void {
	drone.gap = DRONE_RESET_GAP;
	drone.graceMs = CONTACT_GRACE_MS;
}

/** How near the drone is, from 0 (at the far end of the chase) to 1 (on the runner's heels) */
export function closeness(gap: number): number {
	return Math.min(1, Math.max(0, 1 - gap / DRONE_MAX_GAP));
}

/** Time between two buzzes: quick when the drone is close, lazy when it is far */
export function buzzIntervalMs(gap: number): number {
	return 1500 - 1100 * closeness(gap);
}

/**
 * Volume of a buzz from 0 to 1. Tall sunflowers hide the drone, so the buzz gets louder then, as the
 * only warning the player has.
 */
export function buzzIntensity(gap: number, hidden: boolean): number {
	const base = 0.25 + 0.6 * closeness(gap);
	return Math.min(1, base + (hidden ? 0.15 : 0));
}

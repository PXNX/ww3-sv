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
	MIDDLE_LANE,
	STUMBLE_CLOSE,
	type Lane,
	type ObstacleKind
} from './config';

export interface Drone {
	/** Units between the drone and the runner */
	gap: number;
	/** While above zero the drone cannot make contact (it was just shaken off) */
	graceMs: number;
	/** Counts up while the drone is in sight, drives its wobble */
	phase: number;
	/** The lane the drone is in; it follows the runner a moment after he changes lane */
	lane: Lane;
	/** Where the drone is across the course, in lanes (slides towards `lane`) */
	x: number;
	/** How long the runner has been in another lane than the drone */
	laneWaitMs: number;
	/** Time until the next menacing swoop while the drone is close */
	menaceMs: number;
}

/** The drone changes lane this long after the runner did */
export const DRONE_LANE_DELAY_MS = 350;
export const DRONE_SLIDE_MS = 320;
/** Gaps the drone dives through on its way in: crossing one downwards is a swoop */
export const SWOOP_GAPS: readonly number[] = [6, 3];
/** While the drone is this close it swoops now and then, even without a stumble */
export const MENACE_GAP = 4;
export const MENACE_EVERY_MS = 2600;
/** Two maneuver sounds are at least this far apart */
export const MANEUVER_SOUND_GAP_MS = 500;

export function createDrone(): Drone {
	return {
		gap: DRONE_START_GAP,
		graceMs: 0,
		phase: 0,
		lane: MIDDLE_LANE,
		x: MIDDLE_LANE,
		laneWaitMs: 0,
		menaceMs: MENACE_EVERY_MS
	};
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

/**
 * The drone drifts after the runner: when he has been in another lane for a moment it changes lane
 * too, and slides over. Returns true on the step it changes lane (a maneuver you can hear).
 */
export function followRunner(drone: Drone, runnerLane: Lane, dtMs: number): boolean {
	let changed = false;
	if (drone.lane !== runnerLane) {
		drone.laneWaitMs += dtMs;
		if (drone.laneWaitMs >= DRONE_LANE_DELAY_MS) {
			drone.lane = runnerLane;
			drone.laneWaitMs = 0;
			changed = true;
		}
	} else {
		drone.laneWaitMs = 0;
	}
	const slide = dtMs / DRONE_SLIDE_MS;
	drone.x =
		drone.x < drone.lane
			? Math.min(drone.lane, drone.x + slide)
			: Math.max(drone.lane, drone.x - slide);
	return changed;
}

/** Whether the gap just dropped through one of the swoop distances */
export function swoopedThrough(before: number, after: number): boolean {
	return SWOOP_GAPS.some((limit) => before > limit && after <= limit);
}

/** While the drone is close it dives at the runner every so often; true on the step it does */
export function stepMenace(drone: Drone, dtMs: number): boolean {
	if (drone.gap > MENACE_GAP) {
		drone.menaceMs = MENACE_EVERY_MS;
		return false;
	}
	drone.menaceMs -= dtMs;
	if (drone.menaceMs > 0) return false;
	drone.menaceMs = MENACE_EVERY_MS;
	return true;
}

/** Maneuver sounds are throttled so bursts never pile up */
export function maneuverSoundDue(nowMs: number, lastMs: number | null): boolean {
	return lastMs === null || nowMs - lastMs >= MANEUVER_SOUND_GAP_MS;
}

/** Volume and pitch of a maneuver burst: louder and higher the closer the drone is */
export function maneuverIntensity(gap: number): number {
	return Math.min(1, 0.2 + 0.8 * closeness(gap));
}

/** Stereo position of the drone for its sounds, from -0.7 (left lane) to 0.7 (right lane) */
export function dronePan(x: number): number {
	return Math.max(-0.7, Math.min(0.7, (x - MIDDLE_LANE) * 0.6));
}

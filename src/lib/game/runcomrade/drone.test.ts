import { describe, expect, it } from 'vitest';
import {
	BOOST_DRONE_PULL,
	CONTACT_GRACE_MS,
	DRONE_CONTACT_GAP,
	DRONE_MAX_GAP,
	DRONE_RECOVER_RATE,
	DRONE_RESET_GAP,
	DRONE_START_GAP,
	STUMBLE_CLOSE
} from './config';
import {
	DRONE_LANE_DELAY_MS,
	MANEUVER_SOUND_GAP_MS,
	MENACE_EVERY_MS,
	buzzIntensity,
	buzzIntervalMs,
	closeIn,
	closeness,
	createDrone,
	dronePan,
	followRunner,
	maneuverIntensity,
	maneuverSoundDue,
	stepMenace,
	swoopedThrough,
	knockBack,
	stepDrone
} from './drone';

const STEP = 1000 / 60;

function run(drone: ReturnType<typeof createDrone>, ms: number, boosted = false) {
	let contacts = 0;
	for (let t = 0; t < ms; t += STEP) {
		if (stepDrone(drone, STEP, boosted).contact) {
			contacts += 1;
			knockBack(drone);
		}
	}
	return contacts;
}

describe('drone chase', () => {
	it('starts a comfortable distance behind', () => {
		const drone = createDrone();
		expect(drone.gap).toBe(DRONE_START_GAP);
		expect(drone.gap).toBeGreaterThan(STUMBLE_CLOSE.mine);
	});

	it('closes in by an amount that depends on the obstacle, and never below zero', () => {
		const drone = createDrone();
		closeIn(drone, 'ditch');
		expect(drone.gap).toBeCloseTo(DRONE_START_GAP - STUMBLE_CLOSE.ditch);
		closeIn(drone, 'mine');
		closeIn(drone, 'mine');
		closeIn(drone, 'mine');
		expect(drone.gap).toBe(0);
	});

	it('falls back slowly while the runner keeps clean, up to a limit', () => {
		const drone = createDrone();
		closeIn(drone, 'arm');
		const gap = drone.gap;
		run(drone, 2000);
		expect(drone.gap).toBeCloseTo(gap + DRONE_RECOVER_RATE * 2, 1);
		run(drone, 60_000);
		expect(drone.gap).toBe(DRONE_MAX_GAP);
	});

	it('is pulled away much faster during a helmet boost', () => {
		const calm = createDrone();
		const boosted = createDrone();
		closeIn(calm, 'arm');
		closeIn(boosted, 'arm');
		run(calm, 1000);
		run(boosted, 1000, true);
		expect(boosted.gap - calm.gap).toBeCloseTo(BOOST_DRONE_PULL, 1);
	});

	it('makes contact once the gap is used up', () => {
		const drone = createDrone();
		closeIn(drone, 'mine');
		closeIn(drone, 'mine');
		expect(drone.gap).toBeLessThanOrEqual(DRONE_CONTACT_GAP + 2);
		closeIn(drone, 'ditch');
		expect(stepDrone(drone, STEP, false).contact).toBe(true);
	});

	it('two stumbles in a row are survivable, the third catches the runner', () => {
		const drone = createDrone();
		closeIn(drone, 'ditch');
		expect(stepDrone(drone, STEP, false).contact).toBe(false);
		closeIn(drone, 'ditch');
		expect(stepDrone(drone, STEP, false).contact).toBe(false);
		closeIn(drone, 'ditch');
		expect(stepDrone(drone, STEP, false).contact).toBe(true);
	});

	it('is knocked back after contact and cannot strike again straight away', () => {
		const drone = createDrone();
		drone.gap = 0;
		expect(stepDrone(drone, STEP, false).contact).toBe(true);
		knockBack(drone);
		expect(drone.gap).toBe(DRONE_RESET_GAP);
		expect(drone.graceMs).toBe(CONTACT_GRACE_MS);
		// even a stumble straight after cannot cause a second contact during the grace time
		drone.gap = 0;
		expect(stepDrone(drone, STEP, false).contact).toBe(false);
		run(drone, CONTACT_GRACE_MS);
		drone.gap = 0;
		expect(stepDrone(drone, STEP, false).contact).toBe(true);
	});

	it('does not cost a heart for a runner who stumbles only now and then', () => {
		const drone = createDrone();
		let contacts = 0;
		for (let i = 0; i < 3; i++) {
			closeIn(drone, 'ditch');
			contacts += run(drone, 3500);
		}
		expect(contacts).toBe(0);
	});

	it('does catch a runner who keeps stumbling, even with pauses in between', () => {
		const drone = createDrone();
		let contacts = 0;
		for (let i = 0; i < 12; i++) {
			closeIn(drone, 'ditch');
			contacts += run(drone, 3500);
		}
		expect(contacts).toBeGreaterThan(0);
	});
});

describe('buzz', () => {
	it('is quicker and louder the closer the drone is', () => {
		expect(closeness(0)).toBe(1);
		expect(closeness(DRONE_MAX_GAP)).toBe(0);
		expect(closeness(-5)).toBe(1);
		expect(buzzIntervalMs(1)).toBeLessThan(buzzIntervalMs(9));
		expect(buzzIntensity(1, false)).toBeGreaterThan(buzzIntensity(9, false));
		for (const gap of [0, 3, 6, 12]) {
			expect(buzzIntensity(gap, true)).toBeLessThanOrEqual(1);
			expect(buzzIntensity(gap, false)).toBeGreaterThan(0);
			expect(buzzIntervalMs(gap)).toBeGreaterThan(200);
		}
	});

	it('is louder when tall sunflowers hide the drone', () => {
		expect(buzzIntensity(6, true)).toBeGreaterThan(buzzIntensity(6, false));
	});
});

describe('maneuvers', () => {
	it('follows the runner into another lane a moment later, and says so once', () => {
		const drone = createDrone();
		let changes = 0;
		for (let t = 0; t < DRONE_LANE_DELAY_MS - 2 * STEP; t += STEP) {
			if (followRunner(drone, 0, STEP)) changes += 1;
		}
		expect(changes).toBe(0);
		expect(drone.lane).toBe(1);
		for (let t = 0; t < 4 * STEP; t += STEP) {
			if (followRunner(drone, 0, STEP)) changes += 1;
		}
		expect(changes).toBe(1);
		expect(drone.lane).toBe(0);
		for (let t = 0; t < 1000; t += STEP) {
			if (followRunner(drone, 0, STEP)) changes += 1;
		}
		expect(drone.x).toBe(0);
		expect(changes).toBe(1);
	});

	it('does not follow a runner who changes lane and straight back', () => {
		const drone = createDrone();
		let changes = 0;
		for (let t = 0; t < 200; t += STEP) if (followRunner(drone, 2, STEP)) changes += 1;
		for (let t = 0; t < 2000; t += STEP) if (followRunner(drone, 1, STEP)) changes += 1;
		expect(changes).toBe(0);
		expect(drone.lane).toBe(1);
	});

	it('swoops when a stumble brings it through a swoop distance, not for a small move', () => {
		expect(swoopedThrough(9, 5.8)).toBe(true);
		expect(swoopedThrough(5.8, 2.6)).toBe(true);
		expect(swoopedThrough(9, 7)).toBe(false);
		expect(swoopedThrough(5, 4)).toBe(false);
		expect(swoopedThrough(2.5, 5)).toBe(false);
	});

	it('menaces now and then only while it is close', () => {
		const far = createDrone();
		let farSwoops = 0;
		for (let t = 0; t < 20_000; t += STEP) if (stepMenace(far, STEP)) farSwoops += 1;
		expect(farSwoops).toBe(0);
		const near = createDrone();
		near.gap = 2;
		let nearSwoops = 0;
		for (let t = 0; t < MENACE_EVERY_MS * 3 + 100; t += STEP) {
			if (stepMenace(near, STEP)) nearSwoops += 1;
		}
		expect(nearSwoops).toBe(3);
	});

	it('throttles maneuver sounds so bursts never stack', () => {
		expect(maneuverSoundDue(0, null)).toBe(true);
		expect(maneuverSoundDue(MANEUVER_SOUND_GAP_MS - 1, 0)).toBe(false);
		expect(maneuverSoundDue(MANEUVER_SOUND_GAP_MS, 0)).toBe(true);
	});

	it('is louder and higher the closer the drone, and pans with its lane', () => {
		expect(maneuverIntensity(1)).toBeGreaterThan(maneuverIntensity(9));
		expect(maneuverIntensity(0)).toBeLessThanOrEqual(1);
		expect(maneuverIntensity(12)).toBeGreaterThan(0);
		expect(dronePan(0)).toBeLessThan(0);
		expect(dronePan(1)).toBe(0);
		expect(dronePan(2)).toBeGreaterThan(0);
		expect(Math.abs(dronePan(9))).toBeLessThanOrEqual(0.7);
	});
});

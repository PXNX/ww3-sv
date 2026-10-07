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
	buzzIntensity,
	buzzIntervalMs,
	closeIn,
	closeness,
	createDrone,
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

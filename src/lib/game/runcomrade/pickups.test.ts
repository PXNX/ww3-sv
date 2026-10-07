import { describe, expect, it } from 'vitest';
import { BOOST_MS, BOOST_SPEED, PICKUP_HALF_DEPTH } from './config';
import {
	absorbHit,
	applyPickup,
	createPower,
	isBoosted,
	reaches,
	speedFactor,
	tickPower
} from './pickups';
import type { Pickup } from './patterns';

const pickup = (overrides: Partial<Pickup> = {}): Pickup => ({
	id: 1,
	kind: 'helmet',
	lane: 1,
	z: 50,
	taken: false,
	...overrides
});

describe('helmet', () => {
	it('gives a speed boost that runs out', () => {
		const power = createPower();
		expect(speedFactor(power)).toBe(1);
		applyPickup(power, 'helmet');
		expect(isBoosted(power)).toBe(true);
		expect(speedFactor(power)).toBe(BOOST_SPEED);
		expect(tickPower(power, BOOST_MS - 1).boostEnded).toBe(false);
		expect(isBoosted(power)).toBe(true);
		expect(tickPower(power, 1).boostEnded).toBe(true);
		expect(isBoosted(power)).toBe(false);
		expect(speedFactor(power)).toBe(1);
		// it only announces the end once
		expect(tickPower(power, 100).boostEnded).toBe(false);
	});

	it('restarts the boost when a second helmet is picked up', () => {
		const power = createPower();
		applyPickup(power, 'helmet');
		tickPower(power, BOOST_MS - 500);
		applyPickup(power, 'helmet');
		expect(power.boostMs).toBe(BOOST_MS);
	});

	it('leaves the shield alone', () => {
		const power = createPower();
		applyPickup(power, 'helmet');
		expect(power.shield).toBe(false);
	});
});

describe('rice bowl', () => {
	it('gives a shield that absorbs exactly one hit', () => {
		const power = createPower();
		expect(absorbHit(power)).toBe(false);
		applyPickup(power, 'rice');
		expect(power.shield).toBe(true);
		expect(isBoosted(power)).toBe(false);
		expect(absorbHit(power)).toBe(true);
		expect(power.shield).toBe(false);
		expect(absorbHit(power)).toBe(false);
	});

	it('does not stack: a second bowl is still one hit', () => {
		const power = createPower();
		applyPickup(power, 'rice');
		applyPickup(power, 'rice');
		expect(absorbHit(power)).toBe(true);
		expect(absorbHit(power)).toBe(false);
	});

	it('keeps the shield while the boost runs and after it ends', () => {
		const power = createPower();
		applyPickup(power, 'rice');
		applyPickup(power, 'helmet');
		tickPower(power, BOOST_MS);
		expect(power.shield).toBe(true);
	});
});

describe('reaching a pickup', () => {
	it('needs the runner in its lane and within reach along the course', () => {
		expect(reaches(pickup(), 50, 1)).toBe(true);
		expect(reaches(pickup(), 50 + PICKUP_HALF_DEPTH - 0.01, 1)).toBe(true);
		expect(reaches(pickup(), 50 + PICKUP_HALF_DEPTH + 0.2, 1)).toBe(false);
		expect(reaches(pickup(), 50 - PICKUP_HALF_DEPTH - 0.2, 1)).toBe(false);
		expect(reaches(pickup(), 50, 0)).toBe(false);
		expect(reaches(pickup(), 50, 2)).toBe(false);
	});

	it('also counts while the runner is still sliding into the lane', () => {
		expect(reaches(pickup({ lane: 2 }), 50, 1.6)).toBe(true);
		expect(reaches(pickup({ lane: 2 }), 50, 1.3)).toBe(false);
	});

	it('cannot be picked up twice', () => {
		expect(reaches(pickup({ taken: true }), 50, 1)).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import { BATTERY_X, BATTERY_Y, INTERCEPTOR_SPEED } from './config.js';
import { angleDifference, launchInterceptor, leadPoint, stepInterceptor } from './intercept.js';
import { distance, flightPoint, type Flight } from './trajectory.js';

const STEP = 1000 / 60;
const battery = { x: BATTERY_X, y: BATTERY_Y };

const slow: Flight = { startX: -24, startY: 60, impactX: 272, lift: 100, flightMs: 7000 };

/** Flies an interceptor at a rocket and reports whether it hit before the rocket landed */
function chase(flight: Flight, startAt = 0) {
	const interceptor = launchInterceptor(1, 1, flight, startAt);
	let elapsed = startAt;
	for (let t = 0; t < 6000; t += STEP) {
		elapsed += STEP;
		if (elapsed >= flight.flightMs) return { hit: false, elapsed };
		if (stepInterceptor(interceptor, STEP, flight, elapsed)) return { hit: true, elapsed };
	}
	return { hit: false, elapsed };
}

describe('guidance', () => {
	it('aims at where the rocket will be, not where it is', () => {
		const lead = leadPoint(battery, slow, 1000);
		const now = flightPoint(slow, 1000);
		expect(distance(lead.point, now)).toBeGreaterThan(10);
		// The interceptor needs as long to get there as the rocket needs to arrive
		expect(distance(battery, lead.point) / INTERCEPTOR_SPEED).toBeCloseTo(lead.timeMs / 1000, 1);
		const rocketThere = flightPoint(slow, 1000 + lead.timeMs);
		expect(distance(rocketThere, lead.point)).toBeLessThan(1);
		expect(lead.reachable).toBe(true);
	});

	it('hits a rocket that has just appeared', () => {
		expect(chase(slow).hit).toBe(true);
	});

	it('hits a rocket from every side while it is still high up', () => {
		for (const startX of [-24, 664]) {
			for (const impactX of [60, 158, 272, 392, 560]) {
				const flight: Flight = { startX, startY: 50, impactX, lift: 90, flightMs: 5000 };
				expect(chase(flight, 800).hit, `${startX} to ${impactX}`).toBe(true);
			}
		}
	});

	it('hits a fast rocket that has already been flying for a while', () => {
		const fast: Flight = { ...slow, flightMs: 3400 };
		expect(chase(fast, 600).hit).toBe(true);
	});

	it('is too late for a rocket that lands before it can get there', () => {
		expect(leadPoint(battery, slow, slow.flightMs - 20).reachable).toBe(false);
		expect(chase({ ...slow, impactX: 600, flightMs: 3400 }, 3300).hit).toBe(false);
	});

	it('turns toward the target within its turn rate', () => {
		const interceptor = launchInterceptor(1, 1, slow, 0);
		interceptor.heading += Math.PI;
		const before = interceptor.heading;
		stepInterceptor(interceptor, STEP, slow, 0);
		expect(Math.abs(angleDifference(before, interceptor.heading))).toBeLessThan(0.11);
	});

	it('normalises angle differences to the shortest turn', () => {
		expect(angleDifference(0.1, -0.1)).toBeCloseTo(-0.2);
		expect(angleDifference(3, -3)).toBeCloseTo(2 * Math.PI - 6);
		expect(angleDifference(0, 0)).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import { GROUND_Y } from './config.js';
import {
	flightHeading,
	flightPoint,
	flightProgress,
	highestPoint,
	predictedImpact,
	remainingPath,
	timeToImpact,
	type Flight
} from './trajectory.js';

const flight: Flight = { startX: -24, startY: 60, impactX: 272, lift: 100, flightMs: 6000 };

describe('trajectory', () => {
	it('starts at the start point and ends on the ground at the impact column', () => {
		expect(flightPoint(flight, 0)).toEqual({ x: -24, y: 60 });
		const end = flightPoint(flight, flight.flightMs);
		expect(end.x).toBeCloseTo(272);
		expect(end.y).toBeCloseTo(GROUND_Y);
	});

	it('stays on the landing point once it has landed and before it starts', () => {
		expect(flightPoint(flight, 99999)).toEqual(flightPoint(flight, flight.flightMs));
		expect(flightPoint(flight, -50)).toEqual(flightPoint(flight, 0));
		expect(flightProgress(flight, 3000)).toBe(0.5);
	});

	it('lifts the middle of the arc above the straight line', () => {
		const middle = flightPoint(flight, 3000);
		expect(middle.x).toBeCloseTo((-24 + 272) / 2);
		expect(middle.y).toBeCloseTo((60 + GROUND_Y) / 2 - 100);
		const flat = flightPoint({ ...flight, lift: 0 }, 3000);
		expect(flat.y).toBeGreaterThan(middle.y);
	});

	it('predicts the landing point from the very start', () => {
		expect(predictedImpact(flight)).toEqual({ x: 272, y: GROUND_Y });
		const last = remainingPath(flight, 0).at(-1)!;
		expect(last.x).toBeCloseTo(predictedImpact(flight).x);
		expect(last.y).toBeCloseTo(predictedImpact(flight).y);
	});

	it('draws only the rest of the path for a rocket already underway', () => {
		const path = remainingPath(flight, 4500, 10);
		expect(path).toHaveLength(11);
		expect(path[0]).toEqual(flightPoint(flight, 4500));
		expect(path.at(-1)!.x).toBeCloseTo(272);
		const landed = remainingPath(flight, flight.flightMs, 4);
		expect(landed.every((point) => point.x === landed[0].x && point.y === landed[0].y)).toBe(true);
	});

	it('heads upward at the start of a lifted arc and downward at the end', () => {
		expect(Math.sin(flightHeading(flight, 0))).toBeLessThan(0);
		expect(Math.sin(flightHeading(flight, flight.flightMs))).toBeGreaterThan(0);
	});

	it('counts down the time to impact and finds the top of the arc', () => {
		expect(timeToImpact(flight, 1500)).toBe(4500);
		expect(timeToImpact(flight, 9000)).toBe(0);
		expect(highestPoint(flight)).toBeLessThan(60);
	});
});

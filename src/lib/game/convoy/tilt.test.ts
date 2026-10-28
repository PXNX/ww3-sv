import { describe, expect, it } from 'vitest';
import {
	TILT_DEAD_ZONE_DEG,
	TILT_FULL_SCALE_DEG,
	TiltSteering,
	radiansToDegrees,
	screenAngle,
	sidewaysTilt,
	tiltDeflection,
	tiltLane
} from './tilt';

describe('reading the tilt', () => {
	it('turns the radians Telegram reports into degrees', () => {
		expect(radiansToDegrees(0)).toBe(0);
		expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 6);
		expect(radiansToDegrees(-Math.PI / 4)).toBeCloseTo(-45, 6);
	});

	it('uses gamma on an upright phone and follows the screen when it is turned', () => {
		// Gamma is the sideways roll in portrait: positive when the right side goes down
		expect(sidewaysTilt(40, 12, 0)).toBe(12);
		// Sideways on the left, the same movement arrives as beta, with the sign flipped
		expect(sidewaysTilt(12, 0, 90)).toBe(-12);
		expect(sidewaysTilt(12, 0, -90)).toBe(12);
		expect(sidewaysTilt(40, 12, 270)).toBe(40);
		// Upside down, gamma has to be flipped as well
		expect(sidewaysTilt(12, 7, 180)).toBe(-7);
	});

	it('only corrects exact quarter turns and leaves any other angle alone', () => {
		expect(sidewaysTilt(11, 7, 30)).toBe(7);
		expect(sidewaysTilt(11, 7, 359)).toBe(7);
	});

	it('has no screen to read outside the browser', () => {
		expect(screenAngle()).toBe(0);
	});
});

describe('turning a tilt into a deflection', () => {
	it('holds the tanker still inside the dead zone', () => {
		expect(tiltDeflection(0, 0)).toBe(0);
		expect(tiltDeflection(TILT_DEAD_ZONE_DEG, 0)).toBe(0);
		expect(tiltDeflection(-TILT_DEAD_ZONE_DEG, 0)).toBe(0);
		// The neutral pose is whatever the phone was doing when the run started
		expect(tiltDeflection(31, 30)).toBe(0);
	});

	it('scales between the dead zone and full tilt', () => {
		const half = (TILT_DEAD_ZONE_DEG + TILT_FULL_SCALE_DEG) / 2;
		expect(tiltDeflection(half, 0)).toBeCloseTo(0.5, 6);
		expect(tiltDeflection(-half, 0)).toBeCloseTo(-0.5, 6);
		expect(tiltDeflection(TILT_FULL_SCALE_DEG, 0)).toBe(1);
		expect(tiltDeflection(-TILT_FULL_SCALE_DEG, 0)).toBe(-1);
	});

	it('stays at full deflection beyond full tilt', () => {
		expect(tiltDeflection(90, 0)).toBe(1);
		expect(tiltDeflection(-90, 0)).toBe(-1);
	});
});

describe('where the deflection points', () => {
	it('maps level to the middle and full tilt to the edges of the open water', () => {
		const lanes = { min: 0, max: 4 };
		expect(tiltLane(0, lanes)).toBe(2);
		expect(tiltLane(-1, lanes)).toBe(0);
		expect(tiltLane(1, lanes)).toBe(4);
		expect(tiltLane(0.5, lanes)).toBe(3);
	});

	it('uses whatever water the banks leave open', () => {
		expect(tiltLane(0, { min: 1, max: 2 })).toBe(1.5);
		expect(tiltLane(-1, { min: 1, max: 2 })).toBe(1);
		expect(tiltLane(1, { min: 1, max: 2 })).toBe(2);
		// A single open lane leaves nowhere to go
		expect(tiltLane(1, { min: 3, max: 3 })).toBe(3);
	});

	it('clamps a deflection that escaped its range', () => {
		expect(tiltLane(-4, { min: 0, max: 4 })).toBe(0);
		expect(tiltLane(9, { min: 0, max: 4 })).toBe(4);
	});
});

describe('the sensor listener', () => {
	it('is not available without a browser', () => {
		expect(TiltSteering.supported()).toBe(false);
	});
});

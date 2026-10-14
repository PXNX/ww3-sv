import { describe, expect, it } from 'vitest';
import { ANCHOR_CHAIN, TANKER_SPEED } from './config';
import { tankerPose } from './tanker';

const route = { from: { x: 4, y: 10 }, to: { x: 12, y: 10 } };
const length = 8;

describe('tanker', () => {
	it('starts at the beginning of its route heading along it', () => {
		const pose = tankerPose(route, 0);
		expect(pose.hull).toEqual(route.from);
		expect(pose.heading).toEqual({ x: 1, y: 0 });
	});

	it('sails at its speed', () => {
		const pose = tankerPose(route, 2);
		expect(pose.hull.x).toBeCloseTo(4 + 2 * TANKER_SPEED);
	});

	it('turns round at the end and comes back', () => {
		const atEnd = length / TANKER_SPEED;
		expect(tankerPose(route, atEnd).hull.x).toBeCloseTo(12);
		const back = tankerPose(route, atEnd + 1);
		expect(back.hull.x).toBeCloseTo(12 - TANKER_SPEED);
		expect(back.heading.x).toBe(-1);
		expect(back.heading.y).toBeCloseTo(0);
		expect(tankerPose(route, (2 * length) / TANKER_SPEED).hull.x).toBeCloseTo(4);
	});

	it('drags the anchor behind it on the chain', () => {
		const out = tankerPose(route, 3);
		expect(out.hull.x - out.anchor.x).toBeCloseTo(ANCHOR_CHAIN);
		const back = tankerPose(route, length / TANKER_SPEED + 3);
		expect(back.anchor.x - back.hull.x).toBeCloseTo(ANCHOR_CHAIN);
	});

	it('follows a slanted route', () => {
		const slanted = { from: { x: 0, y: 0 }, to: { x: 3, y: 4 } };
		const pose = tankerPose(slanted, 1);
		expect(pose.heading.x).toBeCloseTo(0.6);
		expect(pose.heading.y).toBeCloseTo(0.8);
		expect(Math.hypot(pose.hull.x, pose.hull.y)).toBeCloseTo(TANKER_SPEED);
	});
});

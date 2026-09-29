import { describe, expect, it } from 'vitest';
import { BIRDS, SPLIT_GAP, SPLIT_SPREAD, isBirdKind, splitOffsets, splitVelocities } from './birds';

const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
const angle = (v: { x: number; y: number }) => Math.atan2(v.y, v.x);

describe('birds', () => {
	it('makes the pelican heavy and hard-hitting, with no ability and a higher, floatier arc', () => {
		const { flamingo, pelican } = BIRDS;
		const mass = (bird: typeof pelican) => bird.density * bird.radius ** 2;
		expect(mass(pelican)).toBeGreaterThan(mass(flamingo) * 2);
		expect(pelican.speedFactor).toBeLessThan(flamingo.speedFactor);
		expect(pelican.damageMultiplier).toBeGreaterThan(flamingo.damageMultiplier);
		expect(pelican.gravityScale).toBeLessThan(flamingo.gravityScale);
		expect(pelican.ability).toBeNull();
		expect(flamingo.ability).toBe('split');
	});

	it('recognizes bird kinds', () => {
		expect(isBirdKind('flamingo')).toBe(true);
		expect(isBirdKind('goose')).toBe(false);
		expect(isBirdKind('eagle')).toBe(false);
		expect(isBirdKind(3)).toBe(false);
	});

	it('splits a flamingo into three at the same speed, fanned around the flight direction', () => {
		const velocity = { x: 8, y: 3 };
		const split = splitVelocities(velocity);
		expect(split).toHaveLength(3);
		for (const v of split) expect(speed(v)).toBeCloseTo(speed(velocity));
		expect(angle(split[0]) - angle(velocity)).toBeCloseTo(SPLIT_SPREAD);
		expect(angle(split[1])).toBeCloseTo(angle(velocity));
		expect(angle(velocity) - angle(split[2])).toBeCloseTo(SPLIT_SPREAD);
	});

	it('places the split flamingos side by side, perpendicular to the flight', () => {
		const velocity = { x: 6, y: 0 };
		const offsets = splitOffsets(velocity);
		expect(offsets[0].x).toBeCloseTo(0);
		expect(offsets[0].y).toBeCloseTo(SPLIT_GAP);
		expect(Math.hypot(offsets[1].x, offsets[1].y)).toBe(0);
		expect(offsets[2].y).toBeCloseTo(-SPLIT_GAP);
	});
});

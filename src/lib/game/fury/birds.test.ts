import { describe, expect, it } from 'vitest';
import {
	BIRDS,
	BOOST_MAX_SPEED,
	BOOST_MIN_SPEED,
	SPLIT_GAP,
	SPLIT_SPREAD,
	boostVelocity,
	isBirdKind,
	splitOffsets,
	splitVelocities
} from './birds';

const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
const angle = (v: { x: number; y: number }) => Math.atan2(v.y, v.x);

describe('birds', () => {
	it('makes the pelican heavy, slow and hard-hitting, with no ability', () => {
		const { flamingo, goose, pelican } = BIRDS;
		const mass = (bird: typeof pelican) => bird.density * bird.radius ** 2;
		expect(mass(pelican)).toBeGreaterThan(mass(flamingo) * 2);
		expect(pelican.speedFactor).toBeLessThan(flamingo.speedFactor);
		expect(pelican.damageMultiplier).toBeGreaterThan(goose.damageMultiplier);
		expect(pelican.ability).toBeNull();
		expect(flamingo.ability).toBe('split');
		expect(goose.ability).toBe('boost');
	});

	it('recognizes bird kinds', () => {
		expect(isBirdKind('goose')).toBe(true);
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

	it('boosts the goose along its direction, within the speed limits', () => {
		const velocity = { x: 6, y: -2 };
		const boosted = boostVelocity(velocity);
		expect(angle(boosted)).toBeCloseTo(angle(velocity));
		expect(speed(boosted)).toBeGreaterThan(speed(velocity));
		expect(speed(boostVelocity({ x: 25, y: 0 }))).toBeCloseTo(BOOST_MAX_SPEED);
		expect(speed(boostVelocity({ x: 1, y: 0 }))).toBeCloseTo(BOOST_MIN_SPEED);
		expect(boostVelocity({ x: 0, y: 0 })).toEqual({ x: BOOST_MIN_SPEED, y: 0 });
	});
});

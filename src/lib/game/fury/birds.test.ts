import { describe, expect, it } from 'vitest';
import {
	BIRDS,
	BIRD_KINDS,
	BLAST_RADIUS,
	BOOMERANG_KEEP,
	BOOMERANG_LIFT,
	DASH_FACTOR,
	DASH_MAX_SPEED,
	DIVE_ANGLE,
	DIVE_MIN_SPEED,
	EGG_DRIFT,
	EGG_DROP_SPEED,
	SPLIT_GAP,
	SPLIT_SPREAD,
	blastFalloff,
	boomerangVelocity,
	dashVelocity,
	diveVelocity,
	eggVelocity,
	isBirdKind,
	splitOffsets,
	splitVelocities
} from './birds';

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
		expect(isBirdKind('goose')).toBe(true);
		expect(isBirdKind('ostrich')).toBe(false);
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

	it('has seven birds, five of them with their own tap ability', () => {
		expect(BIRD_KINDS).toEqual([
			'flamingo',
			'pelican',
			'stork',
			'goose',
			'falcon',
			'phoenix',
			'parrot'
		]);
		expect(BIRDS.phoenix.ability).toBe('blast');
		expect(BIRDS.parrot.ability).toBe('boomerang');
		expect(BIRDS.stork.ability).toBe('dash');
		expect(BIRDS.goose.ability).toBe('egg');
		expect(BIRDS.falcon.ability).toBe('dive');
		for (const kind of BIRD_KINDS) expect(BIRDS[kind].kind).toBe(kind);
		const abilities = BIRD_KINDS.map((kind) => BIRDS[kind].ability);
		expect(new Set(abilities).size).toBe(abilities.length);
	});

	it('makes the stork dash forward faster, up to a cap', () => {
		const dashed = dashVelocity({ x: 6, y: 3 });
		expect(speed(dashed)).toBeCloseTo(speed({ x: 6, y: 3 }) * DASH_FACTOR);
		expect(angle(dashed)).toBeCloseTo(angle({ x: 6, y: 3 }));
		expect(speed(dashVelocity({ x: 20, y: 0 }))).toBe(DASH_MAX_SPEED);
		expect(dashVelocity({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
	});

	it('makes the falcon dive steeply forward, never slowly', () => {
		const dived = diveVelocity({ x: 8, y: 4 });
		expect(dived.x).toBeGreaterThan(0);
		expect(angle(dived)).toBeCloseTo(-DIVE_ANGLE);
		expect(speed(dived)).toBeGreaterThanOrEqual(DIVE_MIN_SPEED);
		expect(speed(diveVelocity({ x: 1, y: 0 }))).toBe(DIVE_MIN_SPEED);
		expect(diveVelocity({ x: -5, y: 0 }).x).toBeLessThan(0);
	});

	it('drops the goose’s egg downwards, faster than the bird falls', () => {
		const rising = eggVelocity({ x: 10, y: 5 });
		expect(rising.y).toBe(-EGG_DROP_SPEED);
		expect(rising.x).toBeCloseTo(10 * EGG_DRIFT);
		expect(eggVelocity({ x: 10, y: -8 }).y).toBeLessThan(-8);
	});

	it('turns the parrot around: back the way it came, a little higher', () => {
		const back = boomerangVelocity({ x: 10, y: -3 });
		expect(back.x).toBeCloseTo(-10 * BOOMERANG_KEEP);
		expect(back.y).toBe(BOOMERANG_LIFT);
		expect(boomerangVelocity({ x: 8, y: 5 }).y).toBe(5 + BOOMERANG_LIFT);
	});

	it('fades the phoenix blast out with distance', () => {
		expect(blastFalloff(0)).toBe(1);
		expect(blastFalloff(BLAST_RADIUS / 2)).toBeCloseTo(0.5);
		expect(blastFalloff(BLAST_RADIUS)).toBe(0);
		expect(blastFalloff(BLAST_RADIUS * 3)).toBe(0);
	});
});

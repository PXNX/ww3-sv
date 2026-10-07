import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	APEX_MAX,
	APEX_MIN,
	DECOY_KINDS,
	GRAVITY,
	THREAT_KINDS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	isDecoy,
	specOf,
	type FlyerKind
} from './config';
import {
	FIRST_VOLLEY_MS,
	arcAt,
	createSpawner,
	difficultyAt,
	launchFlyer,
	planVolley,
	stepSpawner,
	timeToApex
} from './spawner';

const ALL_KINDS: FlyerKind[] = [...THREAT_KINDS, ...DECOY_KINDS];

describe('launchFlyer', () => {
	it('starts just below the bottom edge, moving up', () => {
		const random = createRandom(1);
		for (const kind of ALL_KINDS) {
			const launch = launchFlyer(random, kind);
			expect(launch.y).toBe(WORLD_HEIGHT + specOf(kind).radius);
			expect(launch.vy).toBeLessThan(0);
			expect(launch.gravity).toBeCloseTo(GRAVITY * specOf(kind).gravityScale);
		}
	});

	it('peaks inside the allowed band and comes back down', () => {
		const random = createRandom(2);
		for (let i = 0; i < 200; i++) {
			const launch = launchFlyer(random, ALL_KINDS[i % ALL_KINDS.length]);
			const apex = arcAt(launch, timeToApex(launch));
			expect(apex.y).toBeGreaterThanOrEqual(WORLD_HEIGHT * APEX_MIN - 1e-6);
			expect(apex.y).toBeLessThanOrEqual(WORLD_HEIGHT * APEX_MAX + 1e-6);
			const back = arcAt(launch, timeToApex(launch) * 2);
			expect(back.y).toBeCloseTo(launch.y, 5);
		}
	});

	it('stays inside the field from side to side for the whole flight', () => {
		const random = createRandom(3);
		for (let i = 0; i < 300; i++) {
			const kind = ALL_KINDS[i % ALL_KINDS.length];
			const launch = launchFlyer(random, kind);
			const { radius } = specOf(kind);
			const flight = timeToApex(launch) * 2;
			for (let step = 0; step <= 20; step++) {
				const { x } = arcAt(launch, (flight * step) / 20);
				expect(x).toBeGreaterThanOrEqual(radius - 1e-6);
				expect(x).toBeLessThanOrEqual(WORLD_WIDTH - radius + 1e-6);
			}
		}
	});

	it('is deterministic for a seed', () => {
		const a = launchFlyer(createRandom(9), 'kalibr');
		const b = launchFlyer(createRandom(9), 'kalibr');
		expect(a).toEqual(b);
	});

	it('makes zircons fast and balloons floaty', () => {
		const random = createRandom(4);
		const zircon = launchFlyer(random, 'zircon');
		const balloon = launchFlyer(random, 'balloon');
		expect(timeToApex(zircon)).toBeLessThan(timeToApex(balloon));
	});
});

describe('difficultyAt', () => {
	it('speeds up, bursts more and adds decoys, within limits', () => {
		const early = difficultyAt(0);
		const late = difficultyAt(600_000);
		expect(late.intervalMs).toBeLessThan(early.intervalMs);
		expect(late.intervalMs).toBeGreaterThanOrEqual(650);
		expect(late.burstChance).toBeGreaterThan(early.burstChance);
		expect(late.burstChance).toBeLessThanOrEqual(0.7);
		expect(late.decoyChance).toBeGreaterThan(early.decoyChance);
		expect(late.maxBurst).toBeGreaterThan(early.maxBurst);
	});
});

describe('planVolley', () => {
	it('always opens with a threat and never exceeds the burst limit', () => {
		const random = createRandom(5);
		for (let i = 0; i < 300; i++) {
			const timeMs = (i % 150) * 1000;
			const volley = planVolley(random, timeMs);
			expect(volley.length).toBeGreaterThanOrEqual(1);
			expect(volley.length).toBeLessThanOrEqual(difficultyAt(timeMs).maxBurst);
			expect(isDecoy(volley[0].kind)).toBe(false);
		}
	});

	it('only brings decoys once the bursts are bigger than one', () => {
		const random = createRandom(6);
		let single = 0;
		let decoys = 0;
		for (let i = 0; i < 500; i++) {
			const volley = planVolley(random, 120_000);
			if (volley.length === 1) single += 1;
			decoys += volley.filter((launch) => isDecoy(launch.kind)).length;
		}
		expect(single).toBeGreaterThan(0);
		expect(decoys).toBeGreaterThan(0);
	});
});

describe('stepSpawner', () => {
	it('waits for the first volley, then repeats on the interval', () => {
		const spawner = createSpawner();
		const random = createRandom(7);
		expect(stepSpawner(spawner, random, FIRST_VOLLEY_MS - 10, 100)).toEqual([]);
		expect(stepSpawner(spawner, random, 20, FIRST_VOLLEY_MS + 10).length).toBeGreaterThan(0);
		const interval = difficultyAt(FIRST_VOLLEY_MS + 10).intervalMs;
		expect(stepSpawner(spawner, random, interval - 100, 2000)).toEqual([]);
		expect(stepSpawner(spawner, random, 200, 2200).length).toBeGreaterThan(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	APEX_MAX,
	APEX_MIN,
	DECOY_KINDS,
	GRAVITY,
	PICKUP_KINDS,
	STARTING_LIVES,
	THREAT_KINDS,
	WAVE_COUNT,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	isDecoy,
	isPickup,
	specOf,
	waveVolleys,
	type FlyerKind
} from './config';
import {
	FIRST_VOLLEY_MS,
	arcAt,
	beginWave,
	createSpawner,
	difficultyAt,
	launchFlyer,
	planVolley,
	stepSpawner,
	timeToApex
} from './spawner';

const ALL_KINDS: FlyerKind[] = [...THREAT_KINDS, ...DECOY_KINDS, ...PICKUP_KINDS];

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
	it('speeds up, bursts more and adds decoys wave by wave, within limits', () => {
		const early = difficultyAt(1);
		const late = difficultyAt(WAVE_COUNT);
		expect(late.intervalMs).toBeLessThan(early.intervalMs);
		expect(late.intervalMs).toBeGreaterThanOrEqual(650);
		expect(late.burstChance).toBeGreaterThan(early.burstChance);
		expect(late.burstChance).toBeLessThanOrEqual(0.7);
		expect(late.decoyChance).toBeGreaterThan(early.decoyChance);
		expect(late.maxBurst).toBeGreaterThan(early.maxBurst);
		expect(early.pickupChance).toBe(0);
		expect(late.pickupChance).toBeGreaterThan(0);
	});
});

describe('planVolley', () => {
	it('always opens with a threat and never exceeds the burst limit', () => {
		const random = createRandom(5);
		for (let i = 0; i < 300; i++) {
			const wave = 1 + (i % WAVE_COUNT);
			const volley = planVolley(random, wave);
			const flyers = volley.filter((launch) => !isPickup(launch.kind));
			expect(flyers.length).toBeGreaterThanOrEqual(1);
			expect(flyers.length).toBeLessThanOrEqual(difficultyAt(wave).maxBurst);
			expect(isDecoy(volley[0].kind)).toBe(false);
			expect(isPickup(volley[0].kind)).toBe(false);
		}
	});

	it('only brings decoys once the bursts are bigger than one', () => {
		const random = createRandom(6);
		let single = 0;
		let decoys = 0;
		for (let i = 0; i < 500; i++) {
			const volley = planVolley(random, WAVE_COUNT);
			if (volley.filter((launch) => !isPickup(launch.kind)).length === 1) single += 1;
			decoys += volley.filter((launch) => isDecoy(launch.kind)).length;
		}
		expect(single).toBeGreaterThan(0);
		expect(decoys).toBeGreaterThan(0);
	});

	it('unlocks the new kinds wave by wave and never launches bomblets', () => {
		const random = createRandom(8);
		const seen = (wave: number) => {
			const kinds = new Set<FlyerKind>();
			for (let i = 0; i < 800; i++) {
				for (const launch of planVolley(random, wave, 1)) kinds.add(launch.kind);
			}
			return kinds;
		};
		const first = seen(1);
		expect(first.has('iskander') || first.has('cluster') || first.has('mine')).toBe(false);
		expect(first.has('focus') || first.has('repair')).toBe(false);
		const late = seen(WAVE_COUNT);
		for (const kind of ['iskander', 'cluster', 'mine', 'focus', 'repair'] as const) {
			expect(late.has(kind)).toBe(true);
		}
		expect(late.has('bomblet')).toBe(false);
	});

	it('offers a repair only while a heart is missing', () => {
		const random = createRandom(9);
		for (let i = 0; i < 600; i++) {
			const volley = planVolley(random, WAVE_COUNT, STARTING_LIVES);
			expect(volley.some((launch) => launch.kind === 'repair')).toBe(false);
		}
	});
});

describe('stepSpawner', () => {
	it('waits for the first volley, then repeats on the interval', () => {
		const spawner = createSpawner();
		const random = createRandom(7);
		expect(stepSpawner(spawner, random, FIRST_VOLLEY_MS - 10)).toEqual([]);
		expect(stepSpawner(spawner, random, 20).length).toBeGreaterThan(0);
		const interval = difficultyAt(1).intervalMs;
		expect(stepSpawner(spawner, random, interval - 100)).toEqual([]);
		expect(stepSpawner(spawner, random, 200).length).toBeGreaterThan(0);
	});

	it('stops once the wave has launched all its volleys', () => {
		const spawner = createSpawner();
		const random = createRandom(7);
		let volleys = 0;
		for (let i = 0; i < 400; i++) {
			if (stepSpawner(spawner, random, 100).length > 0) volleys += 1;
		}
		expect(volleys).toBe(waveVolleys(1));
		expect(spawner.volleysLeft).toBe(0);
	});

	it('starts the next wave with a short pause and its own volley count', () => {
		const spawner = createSpawner();
		beginWave(spawner, 3);
		expect(spawner.wave).toBe(3);
		expect(spawner.volleysLeft).toBe(waveVolleys(3));
		expect(spawner.announce).toBe(true);
		expect(stepSpawner(spawner, createRandom(1), 10)).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { DECOY_KINDS, HOLE_COUNT, TARGET_KINDS, isDecoy, specOf } from './config';
import {
	FIRST_SPAWN_MS,
	RETRY_MS,
	createSpawner,
	difficultyAt,
	planSpawn,
	stepSpawner
} from './spawner';

const ALL_HOLES = Array.from({ length: HOLE_COUNT }, (_, hole) => hole);

describe('difficultyAt', () => {
	it('starts gentle', () => {
		const start = difficultyAt(0);
		expect(start.maxActive).toBe(2);
		expect(start.speakScale).toBe(1);
		expect(start.intervalMs).toBeGreaterThan(1000);
	});

	it('ramps up over time: faster pop-ups, more at once, shorter statements, more decoys', () => {
		const early = difficultyAt(5_000);
		const late = difficultyAt(80_000);
		expect(late.intervalMs).toBeLessThan(early.intervalMs);
		expect(late.maxActive).toBeGreaterThan(early.maxActive);
		expect(late.speakScale).toBeLessThan(early.speakScale);
		expect(late.decoyChance).toBeGreaterThan(early.decoyChance);
	});

	it('levels off at sane limits', () => {
		const extreme = difficultyAt(10_000_000);
		expect(extreme.intervalMs).toBe(420);
		expect(extreme.maxActive).toBe(5);
		expect(extreme.speakScale).toBe(0.6);
		expect(extreme.decoyChance).toBe(0.35);
		expect(extreme.maxActive).toBeLessThan(HOLE_COUNT);
	});

	it('treats negative time as the start', () => {
		expect(difficultyAt(-500)).toEqual(difficultyAt(0));
	});
});

describe('planSpawn', () => {
	it('picks only free podiums', () => {
		const random = createRandom(3);
		for (let i = 0; i < 200; i++) {
			const spawn = planSpawn(random, 30_000, [2, 5, 8], 1);
			expect(spawn).not.toBeNull();
			expect([2, 5, 8]).toContain(spawn!.hole);
		}
	});

	it('returns null when no podium is free but still consumes the same random values', () => {
		const a = createRandom(9);
		const b = createRandom(9);
		expect(planSpawn(a, 0, [], 0)).toBeNull();
		planSpawn(b, 0, ALL_HOLES, 0);
		expect(a()).toBe(b());
	});

	it('never plans a decoy while no target is up', () => {
		const random = createRandom(11);
		for (let i = 0; i < 300; i++) {
			expect(isDecoy(planSpawn(random, 200_000, ALL_HOLES, 0)!.kind)).toBe(false);
		}
	});

	it('mixes in decoys when a target is up, and more of them later in the run', () => {
		const share = (timeMs: number) => {
			const random = createRandom(21);
			let decoys = 0;
			for (let i = 0; i < 2000; i++) {
				if (isDecoy(planSpawn(random, timeMs, ALL_HOLES, 1)!.kind)) decoys += 1;
			}
			return decoys / 2000;
		};
		expect(share(0)).toBeGreaterThan(0.05);
		expect(share(0)).toBeLessThan(0.2);
		expect(share(120_000)).toBeGreaterThan(share(0));
	});

	it('uses every kind and keeps the life time near the scaled base', () => {
		const random = createRandom(5);
		const seen = new Set<string>();
		for (let i = 0; i < 600; i++) {
			const spawn = planSpawn(random, 0, ALL_HOLES, 1)!;
			seen.add(spawn.kind);
			const base = specOf(spawn.kind).lifeMs;
			expect(spawn.lifeMs).toBeGreaterThanOrEqual(base * 0.9 - 1);
			expect(spawn.lifeMs).toBeLessThanOrEqual(base * 1.1 + 1);
		}
		for (const kind of [...TARGET_KINDS, ...DECOY_KINDS]) expect(seen.has(kind)).toBe(true);
	});

	it('shortens statements as the run goes on', () => {
		const first = planSpawn(() => 0.5, 0, [0], 0)!;
		const later = planSpawn(() => 0.5, 100_000, [0], 0)!;
		expect(later.kind).toBe(first.kind);
		expect(later.lifeMs).toBeLessThan(first.lifeMs);
	});

	it('is reproducible from the seed', () => {
		const run = () => {
			const random = createRandom(77);
			return Array.from({ length: 20 }, () => planSpawn(random, 10_000, ALL_HOLES, 1));
		};
		expect(run()).toEqual(run());
	});
});

describe('stepSpawner', () => {
	it('waits for the first pop-up, then spawns once the timer runs out', () => {
		const spawner = createSpawner();
		const random = createRandom(1);
		expect(stepSpawner(spawner, random, FIRST_SPAWN_MS - 1, 0, new Set(), 0)).toEqual([]);
		expect(stepSpawner(spawner, random, 2, 0, new Set(), 0)).toHaveLength(1);
	});

	it('schedules the next pop-up one interval later', () => {
		const spawner = createSpawner();
		stepSpawner(spawner, createRandom(1), FIRST_SPAWN_MS, 0, new Set(), 0);
		expect(spawner.nextMs).toBeCloseTo(difficultyAt(0).intervalMs, 5);
	});

	it('holds back while the field is at its limit and looks again soon', () => {
		const spawner = createSpawner();
		spawner.nextMs = 0;
		const full = new Set([0, 1]);
		expect(stepSpawner(spawner, createRandom(1), 16, 0, full, 1)).toEqual([]);
		expect(spawner.nextMs).toBe(RETRY_MS);
	});

	it('spawns faster later in the run', () => {
		const countSpawns = (startMs: number) => {
			const spawner = { nextMs: 0 };
			const random = createRandom(4);
			let count = 0;
			for (let t = 0; t < 20_000; t += 16) {
				count += stepSpawner(spawner, random, 16, startMs + t, new Set(), 0).length;
			}
			return count;
		};
		expect(countSpawns(100_000)).toBeGreaterThan(countSpawns(0) * 1.5);
	});
});

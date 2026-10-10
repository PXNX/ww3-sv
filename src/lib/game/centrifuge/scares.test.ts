import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { BANNER_COUNT } from './config.js';
import {
	createScheduler,
	forceScare,
	gapMs,
	jitterOf,
	markReacted,
	maxConcurrent,
	scareKindsAt,
	spawnScare,
	stepScheduler,
	type Scare
} from './scares.js';

const STEP = 50;

function run(seed: number, difficulty: number, seconds: number) {
	const random = createRandom(seed);
	const scheduler = createScheduler(1000);
	const started: Scare[] = [];
	const ended: Scare[] = [];
	let peak = 0;
	for (let t = 0; t < seconds * 1000; t += STEP) {
		const result = stepScheduler(scheduler, random, STEP, difficulty);
		started.push(...result.started);
		ended.push(...result.ended);
		peak = Math.max(peak, scheduler.active.length);
	}
	return { scheduler, started, ended, peak };
}

describe('scare scheduler', () => {
	it('waits for the first scare, then starts it on time', () => {
		const random = createRandom(1);
		const scheduler = createScheduler(2500);
		let startedAt = -1;
		for (let t = STEP; t <= 5000 && startedAt < 0; t += STEP) {
			if (stepScheduler(scheduler, random, STEP, 0).started.length > 0) startedAt = t;
		}
		expect(startedAt).toBe(2500);
	});

	it('ends every scare after its duration and reports it once', () => {
		const { started, ended, scheduler } = run(2, 0.3, 60);
		expect(started.length).toBeGreaterThan(3);
		expect(ended.length + scheduler.active.length).toBe(started.length);
		for (const scare of ended) {
			expect(scare.ageMs).toBeGreaterThanOrEqual(scare.durationMs);
			expect(scare.durationMs).toBeGreaterThan(2000);
		}
		expect(new Set(started.map((scare) => scare.id)).size).toBe(started.length);
	});

	it('comes faster and stronger as the difficulty rises', () => {
		const easy = run(3, 0, 120);
		const hard = run(3, 1, 120);
		expect(hard.started.length).toBeGreaterThan(easy.started.length * 1.8);
		const mean = (scares: Scare[]) =>
			scares.reduce((sum, scare) => sum + scare.intensity, 0) / scares.length;
		expect(mean(hard.started)).toBeGreaterThan(mean(easy.started));
		expect(gapMs(1, createRandom(4))).toBeLessThan(gapMs(0, createRandom(4)));
	});

	it('introduces shake and the looming Something only later', () => {
		const kinds = (difficulty: number) => scareKindsAt(difficulty).map((entry) => entry.item);
		expect(kinds(0)).toEqual(['siren', 'banner']);
		expect(kinds(0.2)).toContain('shake');
		expect(kinds(0.2)).not.toContain('something');
		expect(kinds(1)).toContain('something');
		expect(new Set(run(5, 0, 120).started.map((scare) => scare.kind))).toEqual(
			new Set(['siren', 'banner'])
		);
		expect(new Set(run(5, 1, 120).started.map((scare) => scare.kind)).size).toBe(4);
	});

	it('overlaps scares only as far as the difficulty allows, never the same kind twice', () => {
		expect(maxConcurrent(0)).toBe(1);
		expect(maxConcurrent(0.6)).toBe(2);
		expect(maxConcurrent(1)).toBe(3);
		expect(run(6, 0, 120).peak).toBe(1);
		const hard = run(6, 1, 120);
		expect(hard.peak).toBeGreaterThan(1);
		expect(hard.peak).toBeLessThanOrEqual(3);
	});

	it('refuses a forced scare when the screen is full', () => {
		const random = createRandom(7);
		const scheduler = createScheduler(10_000);
		expect(forceScare(scheduler, random, 0)).not.toBeNull();
		expect(forceScare(scheduler, random, 0)).toBeNull();
		expect(scheduler.active).toHaveLength(1);
	});

	it('returns null when every available kind is already running', () => {
		const random = createRandom(8);
		const scheduler = createScheduler(10_000);
		spawnScare(scheduler, random, 0);
		spawnScare(scheduler, random, 0);
		expect(spawnScare(scheduler, random, 0)).toBeNull();
	});

	it('gives banner variants inside the message range', () => {
		for (const scare of run(9, 1, 120).started) {
			expect(scare.variant).toBeGreaterThanOrEqual(0);
			expect(scare.variant).toBeLessThan(BANNER_COUNT);
		}
	});

	it('is deterministic for one seed', () => {
		const ids = (seed: number) =>
			run(seed, 0.7, 60).started.map((scare) => `${scare.kind}:${scare.intensity.toFixed(4)}`);
		expect(ids(12)).toEqual(ids(12));
		expect(ids(12)).not.toEqual(ids(13));
	});
});

describe('scare jitter', () => {
	const scare = (overrides: Partial<Scare>): Scare => ({
		id: 1,
		kind: 'siren',
		intensity: 1,
		durationMs: 4000,
		ageMs: 2000,
		variant: 0,
		reacted: false,
		...overrides
	});

	it('is zero with no scare and fades in and out', () => {
		expect(jitterOf([])).toBe(0);
		expect(jitterOf([scare({ ageMs: 0 })])).toBe(0);
		expect(jitterOf([scare({ ageMs: 250 })])).toBeCloseTo(0.35, 5);
		expect(jitterOf([scare({ ageMs: 2000 })])).toBeCloseTo(0.7, 5);
		expect(jitterOf([scare({ ageMs: 4000 })])).toBe(0);
	});

	it('follows the strongest scare, with shake the twitchiest kind', () => {
		const calm = scare({ kind: 'banner', intensity: 0.4 });
		const shake = scare({ kind: 'shake', intensity: 0.8 });
		expect(jitterOf([calm, shake])).toBeCloseTo(0.8, 5);
		expect(jitterOf([calm])).toBeCloseTo(0.2, 5);
	});
});

describe('reacting', () => {
	it('spoils every scare on screen but not later ones', () => {
		const random = createRandom(10);
		const scheduler = createScheduler(10_000);
		spawnScare(scheduler, random, 0);
		markReacted(scheduler);
		expect(scheduler.active.every((scare) => scare.reacted)).toBe(true);
		scheduler.active = [];
		const later = spawnScare(scheduler, random, 0);
		expect(later?.reacted).toBe(false);
	});
});

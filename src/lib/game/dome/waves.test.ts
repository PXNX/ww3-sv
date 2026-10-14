import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { FAST_FACTOR, GROUND_Y, TARGETS, WORLD_WIDTH } from './config.js';
import { groundAt, targetIndexAt } from './city.js';
import { highestPoint } from './trajectory.js';
import { planWave, waveParams } from './waves.js';

describe('wave parameters', () => {
	it('brings more rockets, faster flights and shorter gaps every wave', () => {
		const first = waveParams(1);
		const later = waveParams(6);
		expect(later.count).toBeGreaterThan(first.count);
		expect(later.flightMs).toBeLessThan(first.flightMs);
		expect(later.gapMs).toBeLessThan(first.gapMs);
		expect(later.harmlessShare).toBeGreaterThan(first.harmlessShare);
		expect(first.fastShare).toBe(0);
		expect(later.fastShare).toBeGreaterThan(0);
	});

	it('keeps every value inside sane limits however far you get', () => {
		const far = waveParams(500);
		expect(far.count).toBeLessThanOrEqual(30);
		expect(far.flightMs).toBeGreaterThanOrEqual(3000);
		expect(far.gapMs).toBeGreaterThanOrEqual(480);
		expect(far.harmlessShare).toBeLessThanOrEqual(0.5);
		expect(waveParams(0)).toEqual(waveParams(1));
	});
});

describe('wave plan', () => {
	it('is the same for the same seed and different for another', () => {
		expect(planWave(3, createRandom(9))).toEqual(planWave(3, createRandom(9)));
		expect(planWave(3, createRandom(9))).not.toEqual(planWave(3, createRandom(10)));
	});

	it('launches the planned number of rockets in time order', () => {
		for (const wave of [1, 4, 9]) {
			const plan = planWave(wave, createRandom(wave));
			expect(plan).toHaveLength(waveParams(wave).count);
			for (let i = 1; i < plan.length; i++) {
				expect(plan[i].atMs).toBeGreaterThanOrEqual(plan[i - 1].atMs);
			}
		}
	});

	it('aims every rocket where the plan says: a building, or nothing at all', () => {
		for (let seed = 1; seed <= 20; seed++) {
			for (const spawn of planWave(1 + (seed % 8), createRandom(seed))) {
				expect(targetIndexAt(spawn.flight.impactX), `seed ${seed}`).toBe(spawn.targetIndex);
				if (spawn.targetIndex === null) expect(groundAt(spawn.flight.impactX)).not.toBe('city');
			}
		}
	});

	it('keeps arcs on screen and landings inside the picture', () => {
		for (let seed = 1; seed <= 20; seed++) {
			for (const spawn of planWave(8, createRandom(seed))) {
				expect(highestPoint(spawn.flight)).toBeGreaterThanOrEqual(8);
				expect(spawn.flight.impactX).toBeGreaterThan(0);
				expect(spawn.flight.impactX).toBeLessThan(WORLD_WIDTH);
				expect(spawn.flight.startY).toBeLessThan(GROUND_Y);
				expect(Math.abs(spawn.flight.impactX - spawn.flight.startX)).toBeGreaterThanOrEqual(150);
			}
		}
	});

	it('makes fast rockets fly faster than the wave speed', () => {
		const plan = planWave(12, createRandom(5));
		const params = waveParams(12);
		const fast = plan.filter((spawn) => spawn.kind === 'fast');
		expect(fast.length).toBeGreaterThan(0);
		for (const spawn of fast) {
			expect(spawn.flight.flightMs).toBeLessThanOrEqual(params.flightMs * 1.15 * FAST_FACTOR + 1);
		}
	});

	it('mixes buildings and harmless rockets, and every building gets targeted over time', () => {
		const hit = new Set<number>();
		let harmless = 0;
		let total = 0;
		for (let seed = 1; seed <= 30; seed++) {
			for (const spawn of planWave(6, createRandom(seed))) {
				total += 1;
				if (spawn.targetIndex === null) harmless += 1;
				else hit.add(spawn.targetIndex);
			}
		}
		expect(hit.size).toBe(TARGETS.length);
		expect(harmless / total).toBeGreaterThan(0.2);
		expect(harmless / total).toBeLessThan(0.6);
	});
});

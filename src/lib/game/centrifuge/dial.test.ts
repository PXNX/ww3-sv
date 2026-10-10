import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { BAND, CALM_LIMIT, CRITICAL } from './config.js';
import {
	createDial,
	driftSpeed,
	driftTimes,
	fixDial,
	inBand,
	isOutOfBand,
	startDrift,
	stepDial
} from './dial.js';

const STEP = 50;

describe('dial without a drift', () => {
	it('starts in the middle of the safe band', () => {
		const dial = createDial();
		expect(dial.value).toBe(0);
		expect(dial.drift).toBeNull();
		expect(isOutOfBand(dial)).toBe(false);
	});

	it('never leaves the band, even at maximum scare jitter', () => {
		for (const seed of [1, 2, 3, 4, 5]) {
			const random = createRandom(seed);
			const dial = createDial();
			let peak = 0;
			for (let t = 0; t < 120_000; t += STEP) {
				expect(stepDial(dial, random, STEP, 1)).toEqual([]);
				peak = Math.max(peak, Math.abs(dial.value));
			}
			expect(peak).toBeLessThanOrEqual(CALM_LIMIT);
			expect(peak).toBeLessThan(BAND);
		}
	});

	it('twitches much more under a scare than in a quiet moment', () => {
		const spread = (jitter: number) => {
			const random = createRandom(11);
			const dial = createDial();
			let sum = 0;
			let count = 0;
			for (let t = 0; t < 60_000; t += STEP) {
				stepDial(dial, random, STEP, jitter);
				sum += dial.value * dial.value;
				count++;
			}
			return Math.sqrt(sum / count);
		};
		expect(spread(1)).toBeGreaterThan(spread(0) * 1.8);
	});

	it('is deterministic for one seed', () => {
		const run = () => {
			const random = createRandom(9);
			const dial = createDial();
			for (let t = 0; t < 5000; t += STEP) stepDial(dial, random, STEP, 0.5);
			return dial.value;
		};
		expect(run()).toBe(run());
	});
});

describe('a real drift', () => {
	it('pushes the needle one way, leaves the band once, then hits the end of the dial', () => {
		const random = createRandom(3);
		const dial = createDial();
		expect(startDrift(dial, random, 0)).toBe(true);
		const dir = dial.drift!.dir;
		const events: string[] = [];
		let last = 0;
		for (let t = 0; t < 30_000 && !dial.returning; t += STEP) {
			for (const event of stepDial(dial, random, STEP, 0)) events.push(event.type);
			expect(Math.sign(dial.value - last) * dir).toBeGreaterThanOrEqual(0);
			last = dial.value;
		}
		expect(events).toEqual(['band-exit', 'critical']);
		expect(Math.abs(dial.value)).toBe(CRITICAL);
		expect(dial.drift).toBeNull();
		expect(dial.returning).toBe(true);
	});

	it('takes the time the speed predicts to leave the band', () => {
		const random = createRandom(4);
		const dial = createDial();
		startDrift(dial, random, 0.5);
		const { toBandMs } = driftTimes(dial.drift!.speed);
		let elapsed = 0;
		while (inBand(dial.value)) {
			stepDial(dial, random, STEP, 0);
			elapsed += STEP;
		}
		expect(Math.abs(elapsed - toBandMs)).toBeLessThanOrEqual(STEP);
	});

	it('counts the time spent outside the band, and only that', () => {
		const random = createRandom(5);
		const dial = createDial();
		startDrift(dial, random, 0);
		let outside = 0;
		for (let t = 0; t < 2000; t += STEP) {
			stepDial(dial, random, STEP, 0);
			if (!inBand(dial.value)) outside += STEP;
		}
		expect(dial.outMs).toBe(outside);
		expect(dial.outMs).toBeGreaterThan(0);
		expect(isOutOfBand(dial)).toBe(true);
	});

	it('creeps slower as the difficulty rises, within a small random spread', () => {
		const random = createRandom(6);
		const early = Array.from({ length: 50 }, () => driftSpeed(0, random));
		const late = Array.from({ length: 50 }, () => driftSpeed(1, random));
		expect(Math.max(...late)).toBeLessThan(Math.min(...early));
		// Even the fastest drift leaves a fair time to react between the band edge and the end
		expect(driftTimes(Math.max(...early)).toEndMs).toBeGreaterThan(1500);
	});

	it('cannot start a second drift while one runs or the needle is returning', () => {
		const random = createRandom(7);
		const dial = createDial();
		expect(startDrift(dial, random, 0)).toBe(true);
		expect(startDrift(dial, random, 0)).toBe(false);
		fixDial(dial);
		expect(startDrift(dial, random, 0)).toBe(false);
	});
});

describe('after a fix', () => {
	it('eases the needle back to the middle and then goes calm again', () => {
		const random = createRandom(8);
		const dial = createDial();
		startDrift(dial, random, 0);
		while (inBand(dial.value)) stepDial(dial, random, STEP, 0);
		fixDial(dial);
		expect(dial.drift).toBeNull();
		expect(dial.returning).toBe(true);
		const out = Math.abs(dial.value);
		stepDial(dial, random, STEP, 1);
		expect(Math.abs(dial.value)).toBeLessThan(out);
		for (let t = 0; t < 2000 && dial.returning; t += STEP) stepDial(dial, random, STEP, 0);
		expect(dial.returning).toBe(false);
		expect(inBand(dial.value)).toBe(true);
	});
});

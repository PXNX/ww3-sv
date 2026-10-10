import { describe, expect, it } from 'vitest';
import { GENTLE_MAX_SPEED, MIN_PET_SPEED, SCRUB_SPEED } from './config';
import { feelOf, petSample, purrVolume, speedFactor, startStroke, type PetStroke } from './petting';

/** Strokes back and forth along a line at a steady speed (units per second) for `ms` */
function stroke(speed: number, ms: number, from: PetStroke = startStroke(), t0 = 0): PetStroke {
	let result = petSample(from, { x: 0, y: 0, t: t0 });
	const stepMs = 16;
	let x = 0;
	for (let t = stepMs; t <= ms; t += stepMs) {
		x += (speed * stepMs) / 1000;
		result = petSample(result, { x, y: 0, t: t0 + t });
	}
	return result;
}

describe('purrVolume', () => {
	it('is silent for a finger that is still, or has not travelled yet', () => {
		expect(purrVolume(0, 200)).toBe(0);
		expect(purrVolume(900, 0)).toBe(0);
		expect(purrVolume(900, MIN_PET_SPEED - 1)).toBe(0);
	});

	it('grows with the distance covered, towards but never past full volume', () => {
		const volumes = [100, 400, 900, 1800, 4000].map((distance) => purrVolume(distance, 200));
		for (let i = 1; i < volumes.length; i++) expect(volumes[i]).toBeGreaterThan(volumes[i - 1]);
		expect(volumes.at(-1)!).toBeLessThanOrEqual(1);
		expect(volumes.at(-1)!).toBeGreaterThan(0.95);
	});

	it('is the same for any gentle speed, and falls away as the stroke gets quick', () => {
		expect(purrVolume(1500, 100)).toBeCloseTo(purrVolume(1500, GENTLE_MAX_SPEED));
		const quick = purrVolume(1500, (GENTLE_MAX_SPEED + SCRUB_SPEED) / 2);
		expect(quick).toBeLessThan(purrVolume(1500, 100));
		expect(quick).toBeGreaterThan(0);
	});

	it('is silent once the stroke is a scrub', () => {
		expect(purrVolume(5000, SCRUB_SPEED)).toBe(0);
		expect(purrVolume(5000, SCRUB_SPEED * 3)).toBe(0);
	});

	it('ignores a negative distance', () => {
		expect(purrVolume(-50, 200)).toBe(0);
	});
});

describe('speedFactor and feelOf', () => {
	it('ramps in from standing still and out towards scrubbing', () => {
		expect(speedFactor(MIN_PET_SPEED)).toBe(0);
		expect(speedFactor(MIN_PET_SPEED * 1.5)).toBeCloseTo(0.5);
		expect(speedFactor(MIN_PET_SPEED * 2)).toBe(1);
		expect(speedFactor(SCRUB_SPEED - 1)).toBeLessThan(0.01);
	});

	it('names the three feels', () => {
		expect(feelOf(5)).toBe('idle');
		expect(feelOf(200)).toBe('gentle');
		expect(feelOf(SCRUB_SPEED + 1)).toBe('scrub');
	});
});

describe('petSample', () => {
	it('measures speed and distance from the pointer samples', () => {
		const result = stroke(200, 2000);
		expect(result.feel).toBe('gentle');
		expect(result.speed).toBeCloseTo(200, 0);
		expect(result.distance).toBeCloseTo(400, -1);
	});

	it('gives a growing purr to a slow stroke kept up for a while', () => {
		const early = stroke(200, 600);
		const later = stroke(200, 4000);
		expect(purrVolume(later.distance, later.speed)).toBeGreaterThan(
			purrVolume(early.distance, early.speed)
		);
	});

	it('calls a quick scrubbing motion a scrub and gives no purr', () => {
		const result = stroke(1600, 800);
		expect(result.feel).toBe('scrub');
		expect(purrVolume(result.distance, result.speed)).toBe(0);
	});

	it('loses half of the progress when a gentle stroke turns into scrubbing', () => {
		const gentle = stroke(250, 3000);
		const scrubbed = stroke(2000, 200, gentle, 3000);
		expect(scrubbed.distance).toBeLessThan(gentle.distance);
	});

	it('does not count a finger that has stopped', () => {
		const moving = stroke(200, 1000);
		const stopped = petSample(
			petSample(moving, { x: moving.last!.x, y: 0, t: moving.last!.t + 200 }),
			{ x: moving.last!.x, y: 0, t: moving.last!.t + 400 }
		);
		expect(stopped.distance).toBeCloseTo(moving.distance, 5);
		expect(stopped.speed).toBeLessThan(moving.speed);
	});

	it('merges samples that arrive in the same millisecond instead of spiking the speed', () => {
		let result = petSample(startStroke(), { x: 0, y: 0, t: 0 });
		result = petSample(result, { x: 3, y: 0, t: 16 });
		const before = result;
		result = petSample(result, { x: 400, y: 0, t: 16 });
		expect(result).toBe(before);
	});
});

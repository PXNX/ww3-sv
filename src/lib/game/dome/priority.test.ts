import { describe, expect, it } from 'vitest';
import { MAX_MULTIPLIER, WASTE_PENALTY } from './config.js';
import {
	comboMultiplier,
	interceptScore,
	pickRocket,
	rankThreats,
	threatPriority
} from './priority.js';

describe('threat priority', () => {
	it('ranks a harmless rocket at zero however close it is', () => {
		expect(threatPriority(0, 100)).toBe(0);
		expect(threatPriority(0, 5000)).toBe(0);
	});

	it('values the hospital over the plant over the house at the same time left', () => {
		expect(threatPriority(50, 4000)).toBeGreaterThan(threatPriority(30, 4000));
		expect(threatPriority(30, 4000)).toBeGreaterThan(threatPriority(10, 4000));
	});

	it('raises the priority as the impact gets closer', () => {
		expect(threatPriority(10, 1000)).toBeGreaterThan(threatPriority(10, 5000));
	});

	it('lets a house about to land outrank a hospital with plenty of time left', () => {
		expect(threatPriority(10, 400)).toBeGreaterThan(threatPriority(50, 20000));
	});

	it('ranks threats most urgent first and puts harmless ones last', () => {
		const ranked = rankThreats([
			{ id: 1, value: 0, timeToImpactMs: 300 },
			{ id: 2, value: 10, timeToImpactMs: 4000 },
			{ id: 3, value: 50, timeToImpactMs: 4000 },
			{ id: 4, value: 30, timeToImpactMs: 4000 }
		]);
		expect(ranked.map((threat) => threat.id)).toEqual([3, 4, 2, 1]);
	});

	it('breaks exact ties by the sooner impact and then the older rocket', () => {
		const ranked = rankThreats([
			{ id: 5, value: 0, timeToImpactMs: 900 },
			{ id: 4, value: 0, timeToImpactMs: 900 },
			{ id: 3, value: 0, timeToImpactMs: 100 }
		]);
		expect(ranked.map((threat) => threat.id)).toEqual([3, 4, 5]);
	});

	it('does not change its input', () => {
		const input = [
			{ id: 1, value: 10, timeToImpactMs: 1000 },
			{ id: 2, value: 50, timeToImpactMs: 1000 }
		];
		rankThreats(input);
		expect(input.map((threat) => threat.id)).toEqual([1, 2]);
	});
});

describe('combo and score', () => {
	it('starts at one and grows every second efficient intercept up to a cap', () => {
		expect([0, 1, 2, 3, 4, 5].map(comboMultiplier)).toEqual([1, 1, 1, 1.5, 1.5, 2]);
		expect(comboMultiplier(500)).toBe(MAX_MULTIPLIER);
	});

	it('pays the value of the building a rocket was bound for, times the multiplier', () => {
		expect(interceptScore(50, 1)).toEqual({ points: 50, multiplier: 1, wasted: false });
		expect(interceptScore(10, 3)).toEqual({ points: 15, multiplier: 1.5, wasted: false });
		expect(interceptScore(30, 5).points).toBe(60);
	});

	it('charges a penalty for an interceptor spent on a harmless rocket', () => {
		expect(interceptScore(0, 0)).toEqual({ points: -WASTE_PENALTY, multiplier: 1, wasted: true });
	});
});

describe('picking the rocket a tap means', () => {
	const rockets = [
		{ id: 1, x: 100, y: 100, value: 10, timeToImpactMs: 3000 },
		{ id: 2, x: 300, y: 100, value: 50, timeToImpactMs: 3000 }
	];

	it('takes the nearest rocket within reach', () => {
		expect(pickRocket(rockets, { x: 110, y: 100 })?.id).toBe(1);
		expect(pickRocket(rockets, { x: 290, y: 120 })?.id).toBe(2);
	});

	it('ignores a tap that is nowhere near a rocket', () => {
		expect(pickRocket(rockets, { x: 200, y: 300 })).toBeNull();
		expect(pickRocket([], { x: 1, y: 1 })).toBeNull();
	});

	it('prefers the more valuable rocket when two are about equally near', () => {
		const close = [
			{ id: 1, x: 200, y: 100, value: 10, timeToImpactMs: 3000 },
			{ id: 2, x: 212, y: 100, value: 50, timeToImpactMs: 3000 }
		];
		expect(pickRocket(close, { x: 206, y: 100 })?.id).toBe(2);
		expect(pickRocket(close, { x: 190, y: 100 })?.id).toBe(1);
	});
});

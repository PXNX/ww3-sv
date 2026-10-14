import { describe, expect, it } from 'vitest';
import { CLEAR_WEATHER, weatherAt } from './render';

describe('weatherAt', () => {
	it('is clear at take-off', () => {
		expect(weatherAt(123, 0)).toEqual(CLEAR_WEATHER);
		expect(weatherAt(123, -84)).toEqual(CLEAR_WEATHER);
	});

	it('is the same for the same seed and place', () => {
		expect(weatherAt(77, 4321)).toEqual(weatherAt(77, 4321));
	});

	it('keeps every amount between none and full', () => {
		for (let seed = 1; seed <= 20; seed++) {
			for (let x = 0; x < 30_000; x += 137) {
				const { rain, dust, haze } = weatherAt(seed, x);
				for (const amount of [rain, dust, haze]) {
					expect(amount).toBeGreaterThanOrEqual(0);
					expect(amount).toBeLessThanOrEqual(1);
				}
			}
		}
	});

	it('changes gradually, never jumping between neighboring positions', () => {
		let biggestStep = 0;
		for (let seed = 1; seed <= 10; seed++) {
			let previous = weatherAt(seed, 0);
			for (let x = 5; x < 20_000; x += 5) {
				const next = weatherAt(seed, x);
				biggestStep = Math.max(
					biggestStep,
					Math.abs(next.rain - previous.rain),
					Math.abs(next.dust - previous.dust),
					Math.abs(next.haze - previous.haze)
				);
				previous = next;
			}
		}
		expect(biggestStep).toBeLessThan(0.05);
	});

	it('brings every kind of weather over a long flight', () => {
		const seen = { rain: false, dust: false, haze: false };
		for (let x = 0; x < 60_000; x += 100) {
			const weather = weatherAt(9, x);
			if (weather.rain > 0.5) seen.rain = true;
			if (weather.dust > 0.5) seen.dust = true;
			if (weather.haze > 0.5) seen.haze = true;
		}
		expect(seen).toEqual({ rain: true, dust: true, haze: true });
	});
});

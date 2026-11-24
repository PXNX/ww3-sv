import { describe, expect, it } from 'vitest';
import {
	CLEAR_WEATHER,
	DAY_PHASE_LENGTH,
	SKY_PALETTES,
	skyAt,
	startTimeOfDay,
	weatherAt
} from './render';

const KINDS = ['rain', 'dust', 'haze', 'snow', 'overcast'] as const;

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
				const weather = weatherAt(seed, x);
				for (const amount of KINDS.map((kind) => weather[kind])) {
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
				for (const kind of KINDS) {
					biggestStep = Math.max(biggestStep, Math.abs(next[kind] - previous[kind]));
				}
				previous = next;
			}
		}
		expect(biggestStep).toBeLessThan(0.05);
	});

	it('brings every kind of weather over a long flight', () => {
		const seen = new Set<string>();
		for (let x = 0; x < 90_000; x += 100) {
			const weather = weatherAt(9, x);
			for (const kind of KINDS) if (weather[kind] > 0.5) seen.add(kind);
		}
		expect([...seen].sort()).toEqual([...KINDS].sort());
	});
});

describe('skyAt', () => {
	it("starts a run at its seed's time of day", () => {
		for (let seed = 1; seed <= 20; seed++) {
			expect(skyAt(seed, 0)).toEqual(SKY_PALETTES[startTimeOfDay(seed)]);
		}
	});

	it('starts runs at every time of day, mostly by day', () => {
		const counts = { dawn: 0, day: 0, dusk: 0, night: 0 };
		for (let seed = 1; seed <= 400; seed++) counts[startTimeOfDay(seed)]++;
		for (const count of Object.values(counts)) expect(count).toBeGreaterThan(30);
		expect(counts.day).toBeGreaterThan(counts.night);
	});

	it('moves on through the day over a long flight, gradually', () => {
		const seed = 5;
		const later = skyAt(seed, DAY_PHASE_LENGTH + 10);
		expect(later).not.toEqual(skyAt(seed, 0));
		let biggestStep = 0;
		let previous = skyAt(seed, 0);
		for (let x = 10; x < DAY_PHASE_LENGTH * 5; x += 10) {
			const next = skyAt(seed, x);
			biggestStep = Math.max(biggestStep, Math.abs(next.night - previous.night));
			expect(next.sky).toMatch(/^#[0-9a-f]{6}$/);
			previous = next;
		}
		expect(biggestStep).toBeLessThan(0.05);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { BATTERY_X, BATTERY_Y, GROUND_Y, INTERCEPTOR_SPEED, WORLD_HEIGHT } from './config.js';
import { BASE_FIELD, domeField, fieldHeightFor, MAX_TALL_RATIO } from './field.js';
import { launchInterceptor, stepInterceptor } from './intercept.js';
import { createGame, step, tapMostUrgent } from './state.js';
import { highestPoint } from './trajectory.js';
import { planWave } from './waves.js';

describe('field shape', () => {
	it('is the standard strip by default', () => {
		expect(BASE_FIELD).toEqual({
			height: WORLD_HEIGHT,
			top: 0,
			stretch: 1,
			interceptorSpeed: INTERCEPTOR_SPEED
		});
	});

	it('grows the sky upwards and keeps the ground where it is', () => {
		const tall = domeField(800);
		expect(tall.top).toBe(-400);
		expect(tall.height).toBe(800);
		expect(tall.stretch).toBeCloseTo((GROUND_Y + 400) / GROUND_Y);
		expect(tall.interceptorSpeed).toBeCloseTo(INTERCEPTOR_SPEED * tall.stretch);
		expect(domeField(100)).toEqual(BASE_FIELD);
	});

	it('stays standard on landscape boxes and fills portrait ones', () => {
		expect(fieldHeightFor(768, 560)).toBe(WORLD_HEIGHT);
		expect(fieldHeightFor(1200, 400)).toBe(WORLD_HEIGHT);
		expect(fieldHeightFor(344, 430)).toBe(800);
		expect(fieldHeightFor(344, 2000)).toBe(Math.round(640 * MAX_TALL_RATIO));
		expect(fieldHeightFor(0, 0)).toBe(WORLD_HEIGHT);
		expect(fieldHeightFor(Number.NaN, 300)).toBe(WORLD_HEIGHT);
	});
});

describe('a taller sky', () => {
	const tall = domeField(800);

	it('launches rockets from the taller sky in the same flight times', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const base = planWave(6, createRandom(seed));
			const high = planWave(6, createRandom(seed), tall);
			expect(high.map((spawn) => spawn.flight.flightMs)).toEqual(
				base.map((spawn) => spawn.flight.flightMs)
			);
			expect(high.map((spawn) => spawn.flight.impactX)).toEqual(
				base.map((spawn) => spawn.flight.impactX)
			);
			for (const spawn of high) {
				expect(spawn.flight.startY).toBeLessThan(0);
				expect(highestPoint(spawn.flight)).toBeGreaterThanOrEqual(tall.top + 8);
			}
		}
	});

	it('gives interceptors the speed to catch the faster rockets', () => {
		const flight = { startX: -24, startY: tall.top + 40, impactX: 300, lift: 200, flightMs: 3000 };
		const from = { x: BATTERY_X, y: BATTERY_Y };
		const interceptor = launchInterceptor(1, 1, flight, 400, from, tall.interceptorSpeed);
		expect(interceptor.speed).toBe(tall.interceptorSpeed);
		let hit = false;
		for (let elapsed = 400; elapsed < flight.flightMs && !hit; elapsed += 16) {
			hit = stepInterceptor(interceptor, 16, flight, elapsed);
		}
		expect(hit).toBe(true);
	});

	it('is about as hard as the standard field for a player who taps the most urgent rocket now and then', () => {
		const play = (height: number) => {
			let waves = 0;
			for (let seed = 1; seed <= 8; seed++) {
				const state = createGame(domeField(height));
				const random = createRandom(seed);
				for (let t = 0; state.phase !== 'over' && t < 600_000; t += 16) {
					step(state, 16, random);
					if (t % 1200 === 0) tapMostUrgent(state);
				}
				waves += state.wave;
			}
			return waves;
		};
		const base = play(WORLD_HEIGHT);
		expect(Math.abs(play(800) - base)).toBeLessThanOrEqual(base * 0.15);
	});
});

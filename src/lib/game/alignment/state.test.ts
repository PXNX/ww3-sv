import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createAlignment, DRIFT_ALARM, recalibrate, reward, ROUNDS, SCENARIOS } from './state.js';

const random = () => createRandom(12);

describe('alignment lab', () => {
	it('starts with a prompt and a calm model', () => {
		const state = createAlignment(random());
		expect(state.current).not.toBeNull();
		expect(state.round).toBe(0);
		expect(state.helpful).toBeGreaterThan(0);
		expect(state.drift).toBeLessThan(DRIFT_ALARM);
	});

	it('moves helpfulness and drift according to the rewarded weight', () => {
		const state = createAlignment(random());
		const before = { helpful: state.helpful, drift: state.drift };
		const next = reward(state, 'precise');
		expect(next.round).toBe(1);
		expect(next.helpful).not.toBe(before.helpful);
		expect(next.drift).not.toBe(before.drift);
		expect(next.feedback).toEqual(state.current!.traits.precise);
	});

	it('loses when drift hits the alarm line', () => {
		const state = createAlignment(random());
		state.drift = DRIFT_ALARM - 1;
		state.current = SCENARIOS.find((scenario) => scenario.id === 'legal')!;
		const next = reward(state, 'please');
		expect(next.status).toBe('lost');
		expect(next.current).toBeNull();
	});

	it('wins after all rounds with a bonus', () => {
		const state = createAlignment(random());
		state.round = ROUNDS - 1;
		state.current = SCENARIOS[0]!;
		state.drift = 10;
		const next = reward(state, 'precise');
		expect(next.status).toBe('won');
		expect(next.score).toBeGreaterThan(state.score);
	});
});

describe('alignment recalibration', () => {
	it('steadies the model twice', () => {
		let state = createAlignment(random());
		state.drift = 60;
		state = recalibrate(state);
		expect(state.drift).toBe(45);
		expect(state.recalibrations).toBe(1);
		state = recalibrate(state);
		expect(state.recalibrations).toBe(0);
		expect(recalibrate(state)).toBe(state);
	});

	it('pays a streak bonus for steady answers', () => {
		const state = createAlignment(random());
		state.current = SCENARIOS.find((scenario) => scenario.id === 'symptoms')!;
		state.streak = 2;
		const next = reward(state, 'precise');
		expect(next.score).toBeGreaterThan(state.score + 25);
	});
});

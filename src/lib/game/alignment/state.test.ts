import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createAlignment, DRIFT_ALARM, reward, ROUNDS, SCENARIOS } from './state.js';

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

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	answer,
	BAND_HIGH,
	BAND_LOW,
	BRIEFINGS,
	createHearing,
	ROUNDS,
	filibuster
} from './state.js';

const random = () => createRandom(44);

describe('model hearing', () => {
	it('starts in the compromise band with five briefings', () => {
		const state = createHearing(random());
		expect(state.policy).toBeGreaterThanOrEqual(BAND_LOW);
		expect(state.policy).toBeLessThanOrEqual(BAND_HIGH);
		expect(state.briefings).toBe(BRIEFINGS);
	});

	it('pushes the dial towards a ban or towards access', () => {
		const state = createHearing(random());
		state.event = { witness: 'lobbyist', push: 0, line: 'briefing' };
		expect(answer(state, 'ban', random()).policy).toBeLessThan(state.policy);
		expect(answer(state, 'access', random()).policy).toBeGreaterThan(state.policy);
		expect(answer(state, 'hold', random()).briefings).toBe(BRIEFINGS);
	});

	it('an investigation exposes the spy and cancels a Huang push', () => {
		const state = createHearing(random());
		state.event = { witness: 'huang', push: 16, line: 'markets' };
		const next = answer(state, 'investigate', random());
		expect(next.policy).toBe(state.policy);
		expect(next.spyRevealed).toBe(true);
		expect(next.credibility).toBeGreaterThan(state.credibility);
		expect(next.briefings).toBe(BRIEFINGS - 1);
	});

	it('refuses an action with no briefings left', () => {
		const state = createHearing(random());
		state.briefings = 0;
		expect(answer(state, 'ban', random())).toBe(state);
	});

	it('ends after ten rounds, winning only inside the band', () => {
		const state = createHearing(random());
		state.round = ROUNDS - 1;
		state.event = { witness: 'lobbyist', push: 0, line: 'briefing' };
		state.policy = 50;
		expect(answer(state, 'hold', random()).status).toBe('won');
		state.policy = 90;
		expect(answer(state, 'hold', random()).status).toBe('lost');
	});
});

describe('filibuster', () => {
	it('cancels a witness without spending a briefing', () => {
		const state = createHearing(random());
		state.event = { witness: 'huang', push: 16, line: 'markets' };
		const next = filibuster(state, random());
		expect(next.policy).toBe(state.policy);
		expect(next.briefings).toBe(state.briefings);
		expect(next.filibusters).toBe(state.filibusters - 1);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { createFeed, MAX_OUTRAGE, MIN_REACH, rank, TURNS, factCheck } from './state.js';

const random = () => createRandom(33);

describe('feed tuner', () => {
	it('starts with a post and safe metrics', () => {
		const state = createFeed(random());
		expect(state.post).not.toBeNull();
		expect(state.reach).toBeGreaterThan(MIN_REACH);
		expect(state.outrage).toBeLessThan(MAX_OUTRAGE);
	});

	it('promoting pays more reach but also more outrage', () => {
		const state = createFeed(random());
		const promoted = rank(state, 'promote', random());
		const demoted = rank({ ...state, turn: 0, post: state.post }, 'demote', random());
		expect(promoted.reach).toBeGreaterThan(demoted.reach);
		expect(promoted.outrage).toBeGreaterThan(demoted.outrage);
	});

	it('loses when outrage hits the ceiling or reach the floor', () => {
		const state = createFeed(random());
		state.outrage = MAX_OUTRAGE - 1;
		state.post = { label: 'outrage', engagement: 13, risk: 14 };
		expect(rank(state, 'promote', random()).status).toBe('lost');

		const thin = createFeed(random());
		thin.reach = MIN_REACH + 1;
		thin.post = { label: 'cat', engagement: 6, risk: 1 };
		expect(rank(thin, 'demote', random()).status).toBe('lost');
	});

	it('wins after every post when the feed stays healthy', () => {
		const state = createFeed(random());
		state.turn = TURNS - 1;
		state.post = { label: 'cat', engagement: 6, risk: 1 };
		expect(rank(state, 'hold', random()).status).toBe('won');
	});
});

describe('fact-checks', () => {
	it('trade reach for outrage twice', () => {
		const state = createFeed(random());
		state.reach = 60;
		state.outrage = 60;
		const once = factCheck(state);
		expect(once.reach).toBeLessThan(60);
		expect(once.outrage).toBeLessThan(60);
		expect(once.factChecks).toBe(1);
		expect(factCheck(factCheck(once)).factChecks).toBe(0);
	});
});

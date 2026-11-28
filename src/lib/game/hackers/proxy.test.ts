import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { PROXY_HOPS, PROXY_TRACE_RELIEF } from './config.js';
import { createGame, rotateProxy } from './state.js';

describe('hackers proxy hops', () => {
	it('starts each run with three hops', () => {
		expect(createGame(createRandom(2)).proxies).toBe(PROXY_HOPS);
	});

	it('buys back trace and spends a hop', () => {
		const state = createGame(createRandom(3));
		state.trace = 60;
		const events = rotateProxy(state);
		expect(events[0]?.type).toBe('proxy');
		expect(state.trace).toBe(60 - PROXY_TRACE_RELIEF);
		expect(state.proxies).toBe(PROXY_HOPS - 1);
	});

	it('runs out and stops helping', () => {
		const state = createGame(createRandom(4));
		state.trace = 100;
		for (let i = 0; i < PROXY_HOPS; i++) rotateProxy(state);
		expect(state.proxies).toBe(0);
		const before = state.trace;
		expect(rotateProxy(state)).toEqual([]);
		expect(state.trace).toBe(before);
	});
});

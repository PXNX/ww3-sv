import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { SPOTTER_CHARGES } from './config.js';
import { createGame, hazardDamage, useSpotter } from './state.js';

describe('falklands reconnaissance', () => {
	it('starts with two spotter sorties', () => {
		expect(createGame(createRandom(7)).spotter).toBe(SPOTTER_CHARGES);
	});

	it('spends a sortie and covers the next zones', () => {
		const state = createGame(createRandom(8));
		useSpotter(state);
		expect(state.spotter).toBe(SPOTTER_CHARGES - 1);
		expect(state.spotterZones).toBeGreaterThan(0);
	});

	it('refuses to spend when none are left', () => {
		const state = createGame(createRandom(9));
		state.spotter = 0;
		expect(useSpotter(state)).toEqual([]);
	});

	it('halves damage to the hull', () => {
		const full = hazardDamage('mine', 'cruise');
		expect(Math.round(full * 0.5)).toBeLessThan(full);
	});
});

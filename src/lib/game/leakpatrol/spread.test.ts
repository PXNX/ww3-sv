import { describe, expect, it } from 'vitest';
import { adjacentRooms } from './rooms.js';
import { FLOOD_SPREAD } from './config.js';
import { createGame, step, type LeakPatrolState } from './state.js';
import { createRandom } from '#lib/game/random.js';

describe('flood spread', () => {
	it('finds rooms that share a wall', () => {
		expect(adjacentRooms(0).sort()).toEqual([1, 3]);
		expect(adjacentRooms(4).sort()).toEqual([1, 3, 5]);
	});

	it('pushes water into neighbours when a room floods', () => {
		const state = createGame();
		state.rooms[0] = 0.99;
		state.leaks = [{ id: 1, room: 0, phase: 'open', ageMs: 0, big: false, fixMs: 0, tapeMs: 0 }];
		const events = step(state, 1000, createRandom(1));
		expect(events.some((event) => event.type === 'flood')).toBe(true);
		expect(events.some((event) => event.type === 'spread')).toBe(true);
		expect(state.rooms[1]).toBeGreaterThan(FLOOD_SPREAD - 0.1);
		expect(state.rooms[3]).toBeGreaterThan(FLOOD_SPREAD - 0.1);
	});
});

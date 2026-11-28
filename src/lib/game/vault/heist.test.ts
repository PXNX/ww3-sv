import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { bankerTell } from './banker.js';
import type { Card } from './deck.js';
import { TIME_MAX_MS, TIME_START_MS } from './config.js';
import { createGame, flipCard, stepGame } from './state.js';
import { SPECIAL_PAIR } from './symbols.js';

const random = () => createRandom(11);

/** Finds two face-down cards that form a matching pair, to drive a clean match */
function findPair(state: ReturnType<typeof createGame>): [number, number] {
	for (let i = 0; i < state.cards.length; i++)
		for (let j = i + 1; j < state.cards.length; j++)
			if (state.cards[i].symbol === state.cards[j].symbol && state.cards[i].state === 'down')
				return [i, j];
	throw new Error('no pair');
}

describe('vault heist timer', () => {
	it('starts with a full timer', () => {
		expect(createGame(random()).timeMs).toBe(TIME_START_MS);
	});

	it('ticks down while playing and ends the run at zero', () => {
		const state = createGame(random());
		const events = stepGame(state, TIME_START_MS + 1, random());
		expect(events.map((event) => event.type)).toContain('time-up');
		expect(state.phase).toBe('over');
	});

	it('rewards matches and charges mismatches, capped at the maximum', () => {
		const state = createGame(random());
		const [a, b] = findPair(state);
		state.timeMs = 10;
		flipCard(state, a);
		flipCard(state, b);
		expect(state.timeMs).toBeGreaterThan(10);
		state.timeMs = TIME_MAX_MS - 1;
		const [c, d] = findPair(state);
		flipCard(state, c);
		flipCard(state, d);
		expect(state.timeMs).toBe(TIME_MAX_MS);
	});
});

describe('banker tell', () => {
	it('points to the side of the grid where the bonus pair hides', () => {
		const cards: Card[] = Array.from({ length: 12 }, (_, id) => ({
			id,
			symbol: 'choc-bar',
			state: 'down'
		}));
		cards[0] = { id: 0, symbol: SPECIAL_PAIR[0], state: 'down' };
		cards[4] = { id: 4, symbol: SPECIAL_PAIR[1], state: 'down' };
		expect(bankerTell(cards, 4, 3)).toBe('left');

		const right = cards.map((card) => ({ ...card }));
		right[0] = { id: 0, symbol: 'choc-bar', state: 'matched' };
		right[4] = { id: 4, symbol: 'choc-bar', state: 'matched' };
		right[3] = { id: 3, symbol: SPECIAL_PAIR[0], state: 'down' };
		right[7] = { id: 7, symbol: SPECIAL_PAIR[1], state: 'down' };
		expect(bankerTell(right, 4, 3)).toBe('right');
	});

	it('goes quiet once the bonus pair has been found', () => {
		const state = createGame(random());
		expect(bankerTell(state.cards, state.cols, state.rows)).not.toBeNull();
		for (const card of state.cards) if (SPECIAL_PAIR.includes(card.symbol)) card.state = 'matched';
		expect(bankerTell(state.cards, state.cols, state.rows)).toBeNull();
	});
});

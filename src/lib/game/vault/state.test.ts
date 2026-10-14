import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { bankerPortrait, raisedEyebrows } from './banker.js';
import {
	CALM_STREAK,
	LEVEL_CLEAR_MS,
	POINTS_FLAWLESS,
	POINTS_LEVEL,
	POINTS_PAIR,
	POINTS_SPECIAL,
	REVEAL_MIN_MS,
	REVEAL_MS,
	RING_MS,
	STARTING_LIVES
} from './config.js';
import {
	cardsLeft,
	createGame,
	flipCard,
	matchPoints,
	revealMs,
	stepGame,
	type VaultState
} from './state.js';
import type { SymbolId } from './symbols.js';

/** A game whose cards are laid out in a known order and whose phone stays quiet */
function rigged(symbols: SymbolId[]): {
	state: VaultState;
	random: ReturnType<typeof createRandom>;
} {
	const random = createRandom(1);
	const state = createGame(random);
	state.cards = symbols.map((symbol, id) => ({ id, symbol, state: 'down' as const }));
	state.phoneMs = 1e9;
	return { state, random };
}

const LAYOUT: SymbolId[] = [
	'gold-coin',
	'gold-coin',
	'watch-pocket',
	'watch-pocket',
	'choc-bar',
	'choc-bar',
	'gold-bar',
	'cheese-wheel'
];

describe('createGame', () => {
	it('starts level 1 with full lives, a quiet banker and a face-down deck', () => {
		const state = createGame(createRandom(5));
		expect(state).toMatchObject({
			phase: 'play',
			level: 1,
			cols: 4,
			rows: 3,
			score: 0,
			lives: STARTING_LIVES,
			eyebrows: 0,
			streak: 0
		});
		expect(state.cards).toHaveLength(12);
		expect(state.cards.every((card) => card.state === 'down')).toBe(true);
	});

	it('is deterministic for a seed', () => {
		const a = createGame(createRandom(5));
		const b = createGame(createRandom(5));
		expect(a).toEqual(b);
	});
});

describe('flipCard', () => {
	it('turns a card face up and waits for the second one', () => {
		const { state } = rigged(LAYOUT);
		expect(flipCard(state, 0)).toEqual([{ type: 'flip', index: 0 }]);
		expect(state.cards[0].state).toBe('up');
		expect(state.selected).toEqual([0]);
	});

	it('ignores a card that is already up or matched, and indices outside the grid', () => {
		const { state } = rigged(LAYOUT);
		flipCard(state, 0);
		expect(flipCard(state, 0)).toEqual([]);
		expect(flipCard(state, -1)).toEqual([]);
		expect(flipCard(state, 99)).toEqual([]);
		flipCard(state, 1);
		expect(flipCard(state, 1)).toEqual([]);
		expect(state.cards[1].state).toBe('matched');
	});

	it('removes a matching pair and scores it', () => {
		const { state } = rigged(LAYOUT);
		flipCard(state, 0);
		const events = flipCard(state, 1);
		expect(events).toContainEqual({
			type: 'match',
			indices: [0, 1],
			special: false,
			points: POINTS_PAIR,
			streak: 1
		});
		expect(state.cards[0].state).toBe('matched');
		expect(state.cards[1].state).toBe('matched');
		expect(state.score).toBe(POINTS_PAIR);
		expect(state.selected).toEqual([]);
		expect(state.eyebrows).toBe(0);
	});

	it('pays the bonus for a gold bar with a cheese wheel', () => {
		const { state } = rigged(LAYOUT);
		flipCard(state, 6);
		const events = flipCard(state, 7);
		expect(events).toContainEqual(expect.objectContaining({ type: 'match', special: true }));
		expect(state.score).toBe(POINTS_SPECIAL);
		expect(state.specialPairs).toBe(1);
		expect(state.cards[6].state).toBe('matched');
		expect(state.cards[7].state).toBe('matched');
		expect(POINTS_SPECIAL).toBeGreaterThan(POINTS_PAIR);
	});

	it('raises the banker eyebrow on a mismatch and locks the board until the cards flip back', () => {
		const { state, random } = rigged(LAYOUT);
		flipCard(state, 0);
		const events = flipCard(state, 2);
		expect(events).toContainEqual({
			type: 'mismatch',
			indices: [0, 2],
			eyebrows: 1,
			heartLost: false
		});
		expect(state.eyebrows).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.hideMs).toBe(REVEAL_MS);
		// Locked: a third card cannot be flipped
		expect(flipCard(state, 4)).toEqual([]);
		expect(state.cards[4].state).toBe('down');

		expect(stepGame(state, REVEAL_MS - 1, random)).toEqual([]);
		const back = stepGame(state, 1, random);
		expect(back).toEqual([{ type: 'unflip', indices: [0, 2] }]);
		expect(state.cards[0].state).toBe('down');
		expect(state.cards[2].state).toBe('down');
		expect(flipCard(state, 4)).toHaveLength(1);
	});

	it('costs a heart on the third eyebrow and starts counting again', () => {
		const { state, random } = rigged(LAYOUT);
		const miss = () => {
			flipCard(state, 0);
			const events = flipCard(state, 2);
			stepGame(state, REVEAL_MS, random);
			return events;
		};
		miss();
		miss();
		expect(state.eyebrows).toBe(2);
		expect(state.lives).toBe(STARTING_LIVES);
		const third = miss();
		expect(third).toContainEqual(expect.objectContaining({ type: 'mismatch', heartLost: true }));
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.eyebrows).toBe(0);
	});

	it('ends the game when the last heart goes, without flipping the pair back', () => {
		const { state, random } = rigged(LAYOUT);
		state.lives = 1;
		state.eyebrows = 2;
		flipCard(state, 0);
		const events = flipCard(state, 2);
		expect(events.at(-1)).toEqual({ type: 'game-over' });
		expect(state.phase).toBe('over');
		expect(state.lives).toBe(0);
		expect(flipCard(state, 4)).toEqual([]);
		expect(stepGame(state, 5000, random)).toEqual([]);
	});

	it('lowers an eyebrow after a streak of matches', () => {
		const { state } = rigged(LAYOUT);
		state.eyebrows = 2;
		const calmEvents = [];
		for (let pair = 0; pair < CALM_STREAK; pair++) {
			flipCard(state, pair * 2);
			calmEvents.push(...flipCard(state, pair * 2 + 1).filter((event) => event.type === 'calm'));
		}
		expect(calmEvents).toEqual([{ type: 'calm', eyebrows: 1 }]);
		expect(state.eyebrows).toBe(1);
	});

	it('breaks the streak on a mismatch', () => {
		const { state, random } = rigged(LAYOUT);
		flipCard(state, 0);
		flipCard(state, 1);
		expect(state.streak).toBe(1);
		flipCard(state, 2);
		flipCard(state, 4);
		expect(state.streak).toBe(0);
		stepGame(state, REVEAL_MS, random);
	});
});

describe('levels', () => {
	function clearAll(state: VaultState) {
		const events = [];
		for (let i = 0; i < state.cards.length; i += 2) {
			flipCard(state, i);
			events.push(...flipCard(state, i + 1));
		}
		return events;
	}

	it('clears a level with a flawless bonus and opens a bigger vault after a pause', () => {
		const { state, random } = rigged(['gold-bar', 'gold-bar', 'choc-bar', 'choc-bar']);
		const events = clearAll(state);
		expect(events.at(-1)).toEqual({
			type: 'level-clear',
			level: 1,
			bonus: POINTS_LEVEL + POINTS_FLAWLESS,
			flawless: true
		});
		expect(state.phase).toBe('clearing');
		expect(state.levelsCleared).toBe(1);
		expect(cardsLeft(state)).toBe(0);
		expect(flipCard(state, 0)).toEqual([]);

		expect(stepGame(state, LEVEL_CLEAR_MS - 1, random)).toEqual([]);
		expect(stepGame(state, 1, random)).toEqual([{ type: 'level', level: 2 }]);
		expect(state).toMatchObject({
			phase: 'play',
			level: 2,
			cols: 4,
			rows: 4,
			eyebrows: 0,
			mismatches: 0
		});
		expect(state.cards).toHaveLength(16);
		expect(state.cards.every((card) => card.state === 'down')).toBe(true);
	});

	it('gives no flawless bonus after a mismatch and keeps hearts across levels', () => {
		const { state, random } = rigged(['gold-bar', 'gold-bar', 'choc-bar', 'choc-bar']);
		flipCard(state, 0);
		flipCard(state, 2);
		stepGame(state, REVEAL_MS, random);
		const before = state.score;
		const events = clearAll(state);
		expect(events.at(-1)).toMatchObject({
			type: 'level-clear',
			flawless: false,
			bonus: POINTS_LEVEL
		});
		expect(state.score).toBeGreaterThan(before);
		stepGame(state, LEVEL_CLEAR_MS, random);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('plays a whole seeded level to the end with a known solution', () => {
		const random = createRandom(21);
		const state = createGame(random);
		state.phoneMs = 1e9;
		const bySymbol = new Map<SymbolId, number[]>();
		state.cards.forEach((card, i) =>
			bySymbol.set(card.symbol, [...(bySymbol.get(card.symbol) ?? []), i])
		);
		for (const slots of bySymbol.values()) {
			for (let i = 0; i < slots.length; i += 2) {
				flipCard(state, slots[i]);
				flipCard(state, slots[i + 1]);
			}
		}
		expect(state.levelsCleared).toBe(1);
		expect(state.specialPairs).toBe(0);
	});

	it('stays solvable after special pairs split the gold bars and cheese wheels', () => {
		const { state } = rigged(['gold-bar', 'gold-bar', 'cheese-wheel', 'cheese-wheel']);
		flipCard(state, 0);
		expect(flipCard(state, 2)).toContainEqual(expect.objectContaining({ special: true }));
		flipCard(state, 1);
		const events = flipCard(state, 3);
		expect(events).toContainEqual(expect.objectContaining({ type: 'level-clear' }));
	});
});

describe('the phone', () => {
	it('rings, then shuffles face-down cards, then waits for the next call', () => {
		const { state, random } = rigged(LAYOUT);
		state.phoneMs = 100;
		expect(stepGame(state, 99, random)).toEqual([]);
		expect(stepGame(state, 1, random)).toEqual([{ type: 'ring' }]);
		expect(state.ringMs).toBe(RING_MS);

		const before = state.cards.map((card) => card.symbol);
		expect(stepGame(state, RING_MS - 1, random)).toEqual([]);
		const [shuffle] = stepGame(state, 1, random);
		expect(shuffle.type).toBe('shuffle');
		const indices = (shuffle as { indices: number[] }).indices;
		expect(indices.length).toBeGreaterThanOrEqual(2);
		state.cards.forEach((card, i) => {
			if (!indices.includes(i)) expect(card.symbol).toBe(before[i]);
		});
		expect(state.ringMs).toBe(0);
		expect(state.phoneMs).toBeGreaterThan(0);
	});

	it('leaves face-up and matched cards where they are', () => {
		const { state, random } = rigged(LAYOUT);
		flipCard(state, 0);
		flipCard(state, 1);
		flipCard(state, 4);
		state.phoneMs = 1;
		stepGame(state, 1, random);
		const symbols = state.cards.map((card) => card.symbol);
		stepGame(state, RING_MS, random);
		for (const index of [0, 1, 4]) expect(state.cards[index].symbol).toBe(symbols[index]);
		expect(state.cards[4].state).toBe('up');
	});

	it('does not ring while a level is being cleared', () => {
		const { state, random } = rigged(['gold-bar', 'gold-bar']);
		state.phoneMs = 1;
		flipCard(state, 0);
		flipCard(state, 1);
		expect(state.phase).toBe('clearing');
		expect(stepGame(state, 10, random)).toEqual([]);
		expect(state.ringMs).toBe(0);
	});

	it('is reproducible for a seed', () => {
		const run = () => {
			const { state, random } = rigged(LAYOUT);
			state.phoneMs = 1;
			return [
				stepGame(state, 1, random),
				stepGame(state, RING_MS, random),
				state.cards.map((c) => c.symbol)
			];
		};
		expect(run()).toEqual(run());
	});
});

describe('scoring and timing helpers', () => {
	it('adds a streak bonus that is capped', () => {
		expect(matchPoints(false, 1)).toBe(POINTS_PAIR);
		expect(matchPoints(false, 3)).toBeGreaterThan(matchPoints(false, 2));
		expect(matchPoints(false, 99)).toBe(matchPoints(false, 50));
		expect(matchPoints(true, 1)).toBe(POINTS_SPECIAL);
	});

	it('shortens the reveal time per level down to a floor', () => {
		expect(revealMs(1)).toBe(REVEAL_MS);
		expect(revealMs(3)).toBeLessThan(revealMs(2));
		expect(revealMs(99)).toBe(REVEAL_MIN_MS);
	});

	it('ignores non-positive time steps', () => {
		const { state, random } = rigged(LAYOUT);
		state.phoneMs = 5;
		expect(stepGame(state, 0, random)).toEqual([]);
		expect(stepGame(state, -10, random)).toEqual([]);
		expect(stepGame(state, Number.NaN, random)).toEqual([]);
		expect(state.phoneMs).toBe(5);
	});
});

describe('banker', () => {
	it('draws at most two raised eyebrows and tolerates junk', () => {
		expect(raisedEyebrows(0)).toBe(0);
		expect(raisedEyebrows(1)).toBe(1);
		expect(raisedEyebrows(2)).toBe(2);
		expect(raisedEyebrows(3)).toBe(2);
		expect(raisedEyebrows(-1)).toBe(0);
		expect(raisedEyebrows(Number.NaN)).toBe(0);
	});

	it('shows the neutral portrait only after a decent run', () => {
		expect(bankerPortrait(0)).toBe('raised');
		expect(bankerPortrait(1)).toBe('raised');
		expect(bankerPortrait(2)).toBe('neutral');
	});
});

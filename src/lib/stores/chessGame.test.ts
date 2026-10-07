import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '$lib/game/chess/cards';
import { parseSquare } from '$lib/game/chess/chess';
import { createHighscores } from '$lib/services/highscore';
import { createStore, type KeyValueStorage } from '$lib/services/storage';
import { missingMessages } from '$lib/testing/messages';
import { ChessGame, VANCE_CHANCE } from './chessGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const HAND: CardId[] = ['marriage-crisis', 'gotcha-ball', 'bear-hug'];
const at = (name: string) => parseSquare(name)!;

function setup(storage = memoryStorage()) {
	// One mutable number stands in for the dice: low rolls Vance, high keeps him away
	const dice = { value: 0.9 };
	const store = createStore(storage);
	const game = new ChessGame({
		store,
		scores: createHighscores(store),
		random: () => dice.value,
		putinDelay: 0,
		hand: HAND
	});
	return { game, dice, storage };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ChessGame', () => {
	it('starts with White to move and three cards in hand', () => {
		const { game } = setup();
		expect(game.cardSlots).toEqual(HAND);
		expect(game.match.position.turn).toBe('w');
		expect(game.canAct).toBe(true);
		expect(game.score).toBe(0);
	});

	it('moves a piece by tapping it and a highlighted square, then Putin answers', () => {
		const { game } = setup();
		game.pressSquare(at('e2'));
		expect(game.selected).toBe(at('e2'));
		expect(game.moveTargets.sort()).toEqual([at('e3'), at('e4')].sort());

		game.pressSquare(at('e4'));
		expect(game.match.actions).toEqual(['e2e4']);
		expect(game.thinking).toBe(true);
		expect(game.canAct).toBe(false);

		vi.runAllTimers();
		expect(game.thinking).toBe(false);
		expect(game.match.actions).toHaveLength(2);
		expect(game.match.position.turn).toBe('w');
		expect(game.canAct).toBe(true);
	});

	it('ignores taps on the board while Putin is thinking', () => {
		const { game } = setup();
		game.pressSquare(at('e2'));
		game.pressSquare(at('e4'));
		game.pressSquare(at('d2'));
		expect(game.selected).toBeNull();
		expect(game.match.actions).toHaveLength(1);
	});

	it('plays a card instead of a move, and the slot stays empty afterwards', () => {
		const { game } = setup();
		game.armCard('marriage-crisis');
		expect(game.armedCard).toBe('marriage-crisis');
		game.playCardNow();

		expect(game.cardSlots).toEqual([null, 'gotcha-ball', 'bear-hug']);
		expect(game.match.position.board.some((piece) => piece?.type === 'q')).toBe(false);
		expect(game.notice).toEqual({ kind: 'card', id: 'marriage-crisis', param: undefined });
		expect(game.thinking).toBe(true);
	});

	it('throws a ball by tapping an enemy piece', () => {
		const { game } = setup();
		game.armCard('gotcha-ball');
		expect(game.cardTargets).toHaveLength(8);
		game.pressSquare(at('d2'));
		expect(game.match.actions).toEqual([]);
		game.pressSquare(at('d7'));
		expect(game.match.position.board[at('d7')]).toEqual({ type: 'p', color: 'w' });
		expect(game.cardSlots).toEqual(['marriage-crisis', null, 'bear-hug']);
		expect(game.score).toBe(10);
	});

	it('lets JD Vance take the card away, leaving the turn with the player', () => {
		const { game, dice } = setup();
		expect(dice.value).toBeGreaterThan(VANCE_CHANCE);
		dice.value = 0;
		game.armCard('bear-hug');
		game.playCardNow();

		expect(game.vance).toBe('bear-hug');
		expect(game.cardSlots).toEqual(['marriage-crisis', 'gotcha-ball', null]);
		expect(game.match.position.turn).toBe('w');
		expect(game.thinking).toBe(false);
		expect(game.canAct).toBe(false);

		game.dismissVance();
		expect(game.canAct).toBe(true);
	});

	it('refuses a card that would do nothing and keeps it in hand', () => {
		const { game } = setup();
		game.armCard('marriage-crisis');
		game.playCardNow();
		vi.runAllTimers();

		// The queens are gone, so there is no enemy queen left for the bear hug to crush
		const actions = game.match.actions.length;
		game.armCard('bear-hug');
		game.playCardNow();
		expect(game.notice).toEqual({ kind: 'refused', id: 'bear-hug' });
		expect(game.cardSlots).toEqual([null, 'gotcha-ball', 'bear-hug']);
		expect(game.match.actions).toHaveLength(actions);
		expect(game.canAct).toBe(true);
	});

	it('picks a saved match up again after a reload', () => {
		const first = setup();
		first.game.pressSquare(at('e2'));
		first.game.pressSquare(at('e4'));
		vi.runAllTimers();
		first.game.armCard('gotcha-ball');
		first.game.pressSquare(at('a7'));
		first.game.destroy();

		const second = setup(first.storage);
		expect(second.game.match.actions).toEqual(first.game.match.actions);
		expect(second.game.cardSlots).toEqual(first.game.cardSlots);
		expect(second.game.match.position).toEqual(first.game.match.position);
	});

	it('starts over with a new deal on restart', () => {
		const { game } = setup();
		game.pressSquare(at('e2'));
		game.pressSquare(at('e4'));
		game.restart();
		expect(game.match.actions).toEqual([]);
		expect(game.thinking).toBe(false);
		expect(game.cardSlots).toHaveLength(3);
	});
});

describe('4D Chess messages', () => {
	it('exist in every language', () => {
		expect(missingMessages(['mode_chess_', 'chess_'])).toEqual([]);
	});
});

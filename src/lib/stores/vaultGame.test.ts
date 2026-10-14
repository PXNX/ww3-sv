import { describe, expect, it } from 'vitest';
import { RING_MS, STARTING_LIVES, REVEAL_MS } from '#lib/game/vault/config.js';
import { SYMBOLS } from '#lib/game/vault/symbols.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { VaultGame } from './vaultGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	return { game: new VaultGame({ scores: () => scores, seed: () => 7 }), scores };
}

/** Slots of the first two cards that match, and two that do not */
function findMatch(game: VaultGame): [number, number] {
	const cards = game.state.cards;
	for (let a = 0; a < cards.length; a++) {
		for (let b = a + 1; b < cards.length; b++) {
			if (cards[a].symbol === cards[b].symbol) return [a, b];
		}
	}
	throw new Error('no pair');
}

function findMismatch(game: VaultGame): [number, number] {
	const cards = game.state.cards;
	const down = cards.flatMap((card, index) => (card.state === 'down' ? [index] : []));
	for (const b of down.slice(1)) {
		if (cards[down[0]].symbol !== cards[b].symbol) return [down[0], b];
	}
	throw new Error('no mismatch');
}

describe('VaultGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.flip(0);
		game.update(60000);
		expect(game.state.cards[0].state).toBe('down');
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.ringing).toBe(false);
	});

	it('does not run while paused and picks up where it stopped', () => {
		const { game } = newGame();
		game.start();
		const phone = game.state.phoneMs;
		game.pause();
		game.update(5000);
		game.flip(0);
		expect(game.state.phoneMs).toBe(phone);
		expect(game.state.cards[0].state).toBe('down');
		game.togglePause();
		expect(game.status).toBe('playing');
		game.flip(0);
		expect(game.cards[0].state).toBe('up');
	});

	it('scores a pair and shows it in the reactive cards', () => {
		const { game } = newGame();
		game.start();
		const [a, b] = findMatch(game);
		game.flip(a);
		game.flip(b);
		expect(game.score).toBeGreaterThan(0);
		expect(game.cards[a].state).toBe('matched');
		expect(game.cards[b].state).toBe('matched');
	});

	it('raises an eyebrow on a mismatch, then flips the pair back', () => {
		const { game } = newGame();
		game.start();
		const [a, b] = findMismatch(game);
		game.flip(a);
		game.flip(b);
		expect(game.eyebrows).toBe(1);
		expect(game.wrong).toEqual([a, b]);
		expect(game.toast).not.toBeNull();
		game.update(REVEAL_MS);
		expect(game.cards[a].state).toBe('down');
		expect(game.cards[b].state).toBe('down');
	});

	it('rings the phone and shuffles after the ring time', () => {
		const { game } = newGame();
		game.start();
		game.update(game.state.phoneMs);
		expect(game.ringing).toBe(true);
		game.update(RING_MS);
		expect(game.ringing).toBe(false);
	});

	it('ends the game when the hearts run out and saves the bests', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.lives = 1;
		game.state.eyebrows = 2;
		const [a, b] = findMismatch(game);
		game.flip(a);
		game.flip(b);
		expect(game.status).toBe('over');
		expect(game.lives).toBe(0);
		expect(scores.get(['vault', 'level'])).toBe(1);
		game.flip(0);
		game.update(1000);
		expect(game.status).toBe('over');
	});

	it('records a new best score and restarts cleanly', () => {
		const { game, scores } = newGame();
		game.start();
		const [x, y] = findMatch(game);
		game.flip(x);
		game.flip(y);
		const earned = game.score;
		game.state.lives = 1;
		game.state.eyebrows = 2;
		const [a, b] = findMismatch(game);
		game.flip(a);
		game.flip(b);
		expect(game.isNewBest).toBe(true);
		expect(scores.get(['vault', 'score'])).toBe(earned);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.score).toBe(0);
		expect(game.lives).toBe(STARTING_LIVES);
		expect(game.isNewBest).toBe(false);
		expect(game.cards.every((card) => card.state === 'down')).toBe(true);
	});

	it('deals the same deck for the same seed', () => {
		const first = newGame().game;
		const second = newGame().game;
		first.start();
		second.start();
		expect(first.state.cards.map((c) => c.symbol)).toEqual(second.state.cards.map((c) => c.symbol));
	});
});

describe('vault messages', () => {
	it('has every key in every language', () => {
		expect(missingMessages(['vault_', 'mode_vault_'])).toEqual([]);
	});

	it('has a name for every treasure', () => {
		const keys = SYMBOLS.map((symbol) => `vault_symbol_${symbol.replaceAll('-', '_')}`);
		expect(missingMessages(keys)).toEqual([]);
	});
});

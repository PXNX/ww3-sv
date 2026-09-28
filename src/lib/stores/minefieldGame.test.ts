import { describe, expect, it } from 'vitest';
import { createHighscores } from '$lib/services/highscore';
import { createStore, type KeyValueStorage } from '$lib/services/storage';
import { MinefieldGame } from './minefieldGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function setup(storage = memoryStorage()) {
	let now = 0;
	const store = createStore(storage);
	const game = new MinefieldGame({
		store,
		scores: createHighscores(store),
		clock: () => now,
		seed: () => 1234
	});
	return { game, store, advance: (ms: number) => (now += ms) };
}

const mineIndex = (game: MinefieldGame) =>
	game.board.cells.findIndex((cell) => cell.mine && cell.state === 'hidden');

describe('MinefieldGame', () => {
	it('starts on the remembered difficulty and remembers a new choice', () => {
		const storage = memoryStorage();
		expect(setup(storage).game.difficultyId).toBe('normal');
		setup(storage).game.newGame('hard');
		const { game } = setup(storage);
		expect(game.difficultyId).toBe('hard');
		expect(game.board.columns).toBe(12);
		expect(game.submarinesLeft).toBe(1);
	});

	it('ignores an invalid stored difficulty', () => {
		const storage = memoryStorage();
		storage.setItem('ww3:minefield:difficulty', '"impossible"');
		expect(setup(storage).game.difficultyId).toBe('normal');
	});

	it('places the mines on the first reveal, which is always safe', () => {
		const { game } = setup();
		expect(game.board.minesPlaced).toBe(false);
		game.reveal(0);
		expect(game.board.minesPlaced).toBe(true);
		expect(game.phase).toBe('playing');
		expect(game.tankersLeft).toBe(3);
		expect(game.board.cells[0].state).toBe('revealed');
		expect(game.score).toBeGreaterThan(0);
	});

	it('flags with the flag mode toggle instead of revealing', () => {
		const { game } = setup();
		game.toggleFlagMode();
		game.activate(5);
		expect(game.board.cells[5].state).toBe('flagged');
		expect(game.board.minesPlaced).toBe(false);
		game.toggleFlagMode();
		expect(game.tool).toBe('reveal');
	});

	it('sinks one tanker per mine and keeps playing', () => {
		const { game } = setup();
		game.reveal(0);
		const mine = mineIndex(game);
		game.reveal(mine);
		expect(game.tankersLeft).toBe(2);
		expect(game.board.cells[mine].state).toBe('detonated');
		expect(game.phase).toBe('playing');
		expect(game.event).toMatchObject({ kind: 'explosion', cells: [mine] });
	});

	it('ends the game when the last tanker sinks', () => {
		const { game } = setup();
		game.reveal(0);
		for (let i = 0; i < 3; i++) game.reveal(mineIndex(game));
		expect(game.phase).toBe('lost');
		expect(game.result?.won).toBe(false);
		expect(game.result?.isNewBestTime).toBe(false);
		// No further moves once the game is over
		const board = game.board;
		game.reveal(mineIndex(game));
		expect(game.board).toBe(board);
	});

	it('sends a submarine once, then returns to revealing', () => {
		const { game } = setup();
		game.reveal(0);
		const mine = mineIndex(game);
		game.toggleSubmarine();
		expect(game.tool).toBe('submarine');
		game.activate(mine);
		expect(game.submarinesLeft).toBe(1);
		expect(game.tool).toBe('reveal');
		expect(game.board.cells[mine]).toMatchObject({ mine: false, defused: true });
		expect(game.event).toMatchObject({ kind: 'defused' });
		expect(game.tankersLeft).toBe(3);
	});

	it('refuses to send a submarine to revealed water', () => {
		const { game } = setup();
		game.reveal(0);
		game.toggleSubmarine();
		game.activate(0);
		expect(game.submarinesLeft).toBe(2);
		expect(game.event).toMatchObject({ kind: 'needs-water' });
	});

	it('wins once a channel is open and records the bests', () => {
		const { game, advance } = setup();
		game.reveal(0);
		advance(42_000);
		for (let index = 0; index < game.board.cells.length && game.phase === 'playing'; index++) {
			const cell = game.board.cells[index];
			if (!cell.mine && cell.state === 'hidden') game.reveal(index);
		}
		expect(game.phase).toBe('won');
		expect(game.channel).not.toBeNull();
		expect(game.result).toMatchObject({ won: true, seconds: 42, isNewBestTime: true });
		expect(game.result!.score.perfect).toBeGreaterThan(0);
		expect(game.bestTime).toBe(42);
		expect(game.bestScore).toBe(game.result!.score.total);
		expect(game.score).toBe(game.result!.score.total);
	});

	it('stops the timer while paused', () => {
		const { game, advance } = setup();
		game.reveal(0);
		advance(5000);
		game.pause();
		advance(60_000);
		game.tick();
		expect(game.elapsedMs).toBe(5000);
		expect(game.canAct).toBe(false);
		game.resume();
		advance(1000);
		game.tick();
		expect(game.elapsedMs).toBe(6000);
	});
});

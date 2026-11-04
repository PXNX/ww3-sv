import { describe, expect, it, vi } from 'vitest';
import { ENDS_TOTAL, MAX_STARS, STONES_PER_END } from '#lib/game/curling/config.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { CurlingGame } from './curlingGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

// The real catalogue is thousands of modules; the store only needs strings to show
vi.mock('#lib/paraglide/messages.js', () => ({ m: new Proxy({}, { get: () => () => 'text' }) }));

const STEP = 1000 / 60;

function newGame() {
	const scores = createHighscores(createStore(memoryStorage()));
	const game = new CurlingGame({ scores: () => scores, seed: () => 7, silent: true });
	game.start();
	return { game, scores };
}

function settle(game: CurlingGame) {
	const from = game.phase;
	for (let i = 0; i < 60 * 40 && game.phase === from; i++) game.update(STEP);
}

function playEnd(game: CurlingGame) {
	for (let i = 0; i < STONES_PER_END; i++) {
		game.aim(i % 2 === 0 ? -1.5 : 1.5, 0.64);
		if (i % 2 === 1 && game.spin > 0) game.toggleSpin();
		game.throw();
		settle(game);
	}
}

describe('CurlingGame', () => {
	it('starts aiming at the first stone of the first end', () => {
		const { game } = newGame();
		expect(game.phase).toBe('aiming');
		expect(game.endIndex).toBe(0);
		expect(game.stoneIndex).toBe(0);
		expect(game.score).toBe(0);
	});

	it('clamps the aim and keeps it out of reach once the stone is away', () => {
		const { game } = newGame();
		game.aim(90, 5);
		expect(game.angle).toBeLessThan(40);
		expect(game.power).toBe(1);
		game.aim(5, 0.6);
		game.throw();
		expect(game.phase).toBe('sliding');
		game.aim(-20, 0.2);
		expect(game.angle).toBe(5);
	});

	it('does not move while paused and carries on after resume', () => {
		const { game } = newGame();
		game.aim(0, 0.6);
		game.throw();
		game.pause();
		const y = game.state.stones[0].y;
		for (let i = 0; i < 30; i++) game.update(STEP);
		expect(game.state.stones[0].y).toBe(y);
		game.resume();
		for (let i = 0; i < 30; i++) game.update(STEP);
		expect(game.state.stones[0].y).toBeLessThan(y);
	});

	it('shows a summary after two stones and the next end after confirming', () => {
		const { game } = newGame();
		playEnd(game);
		expect(game.phase).toBe('summary');
		expect(game.summary).not.toBeNull();
		game.nextEnd();
		expect(game.phase).toBe('aiming');
		expect(game.endIndex).toBe(1);
		expect(game.summary).toBeNull();
		expect(game.newHazard).toBe('wind');
	});

	it('hides the aiming hint for a gamble and shortens it in later ends', () => {
		const { game } = newGame();
		const first = game.hint;
		expect(first && first.length).toBeGreaterThan(5);
		game.toggleGamble();
		expect(game.hint).toBeNull();
		game.toggleGamble();
		for (let end = 0; end < 6; end++) {
			playEnd(game);
			game.nextEnd();
		}
		const late = game.hint;
		expect(late && late.length).toBeLessThan(first!.length);
	});

	it('plays all ends, saves the best and shows the final result', () => {
		const { game, scores } = newGame();
		for (let end = 0; end < ENDS_TOTAL; end++) {
			playEnd(game);
			game.nextEnd();
		}
		expect(game.phase).toBe('over');
		expect(game.final).not.toBeNull();
		expect(game.totalStars).toBeLessThanOrEqual(MAX_STARS);
		expect(game.score).toBe(game.final!.score);
		expect(scores.get(['curling', 'score'])).toBe(game.score);
		expect(game.isNewBest).toBe(game.score > 0);
	});

	it('ends the run when the player gives up and can start over', () => {
		const { game } = newGame();
		playEnd(game);
		game.forfeit();
		expect(game.phase).toBe('over');
		game.start();
		expect(game.phase).toBe('aiming');
		expect(game.score).toBe(0);
		expect(game.final).toBeNull();
	});

	it('has all its messages in every language', () => {
		expect(missingMessages(['curling_'])).toEqual([]);
	});
});

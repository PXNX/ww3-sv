import { describe, expect, it } from 'vitest';
import { STEP_SECONDS } from '#lib/game/flamingo/physics.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { FlamingoGame } from './flamingoGame.svelte';

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
	return { game: new FlamingoGame(9, () => scores), scores };
}

/** Takes off (or flies on after a revival) without flapping again, until the run is over */
function crashWith(game: FlamingoGame, score: number) {
	game.flap();
	game.update(STEP_SECONDS);
	game.sim.score = score;
	for (let i = 0; i < 1000 && game.status !== 'over'; i++) game.update(STEP_SECONDS);
	expect(game.status).toBe('over');
}

describe('FlamingoGame', () => {
	it('ends the run and submits the bests', () => {
		const { game, scores } = newGame();
		crashWith(game, 50);
		expect(game.crash).toBe('ground');
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(50);
		expect(scores.get(['flamingo', 'score'])).toBe(50);
	});

	it('only revives a run that is over', () => {
		const { game } = newGame();
		game.revive();
		expect(game.status).toBe('ready');
		game.flap();
		game.update(STEP_SECONDS);
		game.revive();
		expect(game.status).toBe('playing');
		expect(game.sim.phase).toBe('flying');
	});

	it('continues the same run after a revival, as often as it is bought', () => {
		const { game, scores } = newGame();
		crashWith(game, 50);
		const round = game.round;

		game.revive();
		expect(game.status).toBe('ready');
		expect(game.round).toBe(round);
		expect(game.score).toBe(50);
		expect(game.crash).toBeNull();
		expect(game.sim.phase).toBe('ready');

		// Ending again without beating the best still shows the best this run set
		crashWith(game, 50);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(50);

		game.revive();
		crashWith(game, 80);
		expect(game.isNewBest).toBe(true);
		expect(game.best).toBe(80);
		expect(scores.get(['flamingo', 'score'])).toBe(80);

		game.newGame();
		expect(game.score).toBe(0);
		expect(game.isNewBest).toBe(false);
	});

	it('does not claim a best the run never reached', () => {
		const { game, scores } = newGame();
		scores.submit(['flamingo', 'score'], 100);
		crashWith(game, 30);
		game.revive();
		crashWith(game, 60);
		expect(game.isNewBest).toBe(false);
		expect(game.best).toBe(100);
	});
});

import { describe, expect, it } from 'vitest';
import {
	BOSS_EVERY,
	FEEDBACK_MS,
	GAME_OVER_FEEDBACK_MS,
	NEGLECT_MS,
	START_TRACK
} from '#lib/game/petrobras/config.js';
import type { Choice } from '#lib/game/petrobras/scenarios.js';
import { createHighscores } from '#lib/services/highscore.js';
import { createStore, type KeyValueStorage } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { SCORE_KEY, PetrobrasGame } from './petrobrasGame.svelte';

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
	return { game: new PetrobrasGame({ scores: () => scores, seed: () => 7 }), scores };
}

function right(game: PetrobrasGame): Choice {
	return game.state.prompt.correct;
}

function wrong(game: PetrobrasGame): Choice {
	return game.state.prompt.correct === 'firm' ? 'loose' : 'firm';
}

/** Answers the round and waits out the verdict so the next prompt is dealt */
function answerAndAdvance(game: PetrobrasGame, choice: Choice) {
	game.choose(choice);
	game.update(FEEDBACK_MS + 10);
}

describe('PetrobrasGame', () => {
	it('waits for the start button and ignores input before it', () => {
		const { game } = newGame();
		expect(game.status).toBe('ready');
		game.choose('firm');
		game.update(60_000);
		expect(game.score).toBe(START_TRACK);
		expect(game.correct).toBe(0);
		expect(game.round).toBe(1);
	});

	it('lifts its own front and a little of the other on a right call', () => {
		const { game } = newGame();
		game.start();
		game.choose(right(game));
		expect(game.correct).toBe(1);
		expect(game.streak).toBe(1);
		expect(game.board).toBe(START_TRACK + 12);
		expect(game.society).toBe(START_TRACK + 3);
		expect(game.score).toBe(START_TRACK + 3);
		expect(game.toast).not.toBeNull();
		expect(game.phase).toBe('feedback');
	});

	it('sinks both fronts on a wrong call and shakes the field', () => {
		const { game } = newGame();
		game.start();
		game.choose(wrong(game));
		expect(game.wrong).toBe(1);
		expect(game.streak).toBe(0);
		expect(game.board).toBe(START_TRACK - 15);
		expect(game.society).toBe(START_TRACK - 5);
		expect(game.hurtCount).toBe(1);
		expect(game.shakeCount).toBe(1);
	});

	it('costs both fronts when the clock runs out', () => {
		const { game } = newGame();
		game.start();
		game.update(game.state.promptMs + 10);
		expect(game.timeouts).toBe(1);
		expect(game.last?.kind).toBe('timeout');
		expect(game.board).toBe(START_TRACK - 12);
		// The untended front also drains while the clock is running out
		expect(game.society).toBeLessThan(START_TRACK - 4);
		expect(game.phase).toBe('feedback');
	});

	it('drains the front nobody is answering', () => {
		const { game } = newGame();
		game.start();
		const society = game.society;
		game.update(NEGLECT_MS + 10);
		expect(game.society).toBeLessThan(society);
		expect(game.board).toBe(START_TRACK);
		expect(game.neglectNote).not.toBeNull();
	});

	it('follows the clock down and deals the other front next', () => {
		const { game } = newGame();
		game.start();
		expect(game.front).toBe('board');
		expect(game.clock).toBe(1);
		game.update(game.state.promptMs / 2);
		expect(game.clock).toBeCloseTo(0.5, 1);
		answerAndAdvance(game, right(game));
		expect(game.front).toBe('society');
		expect(game.round).toBe(2);
	});

	it('puts the algorithm in every fifth round and only the press release wins', () => {
		const { game } = newGame();
		game.start();
		for (let round = 1; round < BOSS_EVERY; round++) {
			answerAndAdvance(game, right(game));
		}
		expect(game.round).toBe(BOSS_EVERY);
		expect(game.boss).toBe(true);
		expect(game.front).toBe('boss');
		const board = game.board;
		const society = game.society;
		game.choose('firm');
		expect(game.board).toBeGreaterThan(board);
		expect(game.society).toBeGreaterThan(society);
	});

	it('does not run while paused', () => {
		const { game } = newGame();
		game.start();
		game.pause();
		expect(game.status).toBe('paused');
		game.update(60_000);
		game.choose('firm');
		expect(game.score).toBe(START_TRACK);
		expect(game.correct).toBe(0);
		game.resume();
		expect(game.status).toBe('playing');
	});

	it('ends the run, submits the best score and can be restarted', () => {
		const { game, scores } = newGame();
		game.start();
		game.state.board = 10;
		game.state.society = 60;
		game.choose(wrong(game));
		expect(game.board).toBe(0);
		expect(game.phase).toBe('feedback');
		game.update(GAME_OVER_FEEDBACK_MS + 10);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(true);
		expect(scores.get(SCORE_KEY)).toBe(game.score);
		expect(game.best).toBe(game.score);

		game.start();
		expect(game.status).toBe('playing');
		expect(game.score).toBe(START_TRACK);
		expect(game.round).toBe(1);
		expect(game.isNewBest).toBe(false);
	});

	it('keeps the old best when the new score is lower', () => {
		const { game, scores } = newGame();
		scores.submit(SCORE_KEY, 999_999);
		game.start();
		game.state.board = 1;
		game.choose(wrong(game));
		game.update(GAME_OVER_FEEDBACK_MS + 10);
		expect(game.status).toBe('over');
		expect(game.isNewBest).toBe(false);
		expect(scores.get(SCORE_KEY)).toBe(999_999);
	});
});

describe('messages', () => {
	it('has every Petrobras string in every language', () => {
		expect(missingMessages(['petrobras_', 'mode_petrobras_'])).toEqual([]);
	});
});

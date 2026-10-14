import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { GAME_OVER_FEEDBACK_MS, PACE_STREAK, STARTING_LIVES } from './config.js';
import { answer, clockLeft, createGame, step, type VetoState } from './state.js';
import { feedbackMs, windowMs } from './timing.js';
import { ACTIONS, type Action } from './vote.js';

const random = () => createRandom(17);

function newGame() {
	const rng = random();
	return { state: createGame(rng), rng };
}

/** An action that is wrong for the current round */
function wrongAction(state: VetoState): Action {
	return ACTIONS.find((action) => action !== state.expected)!;
}

/** Runs the verdict display to its end so the next round starts */
function nextRound(state: VetoState, rng: () => number) {
	return step(state, 10_000, rng);
}

describe('a new game', () => {
	it('starts at round one, in the question phase, with full hearts', () => {
		const { state } = newGame();
		expect(state).toMatchObject({
			phase: 'question',
			round: 1,
			lives: STARTING_LIVES,
			score: 0,
			streak: 0
		});
		expect(state.cards).toHaveLength(5);
		expect(state.windowMs).toBe(windowMs(0));
		expect(clockLeft(state)).toBe(1);
	});
});

describe('answering', () => {
	it('scores a correct answer and extends the streak', () => {
		const { state } = newGame();
		const events = answer(state, state.expected);
		expect(events[0]).toMatchObject({ type: 'correct', streak: 1 });
		expect(state.score).toBeGreaterThan(0);
		expect(state.streak).toBe(1);
		expect(state.correct).toBe(1);
		expect(state.phase).toBe('feedback');
	});

	it('pays a quick answer more than a late one', () => {
		const quick = newGame().state;
		answer(quick, quick.expected);
		const slow = newGame().state;
		step(slow, slow.windowMs - 50, random());
		answer(slow, slow.expected);
		expect(quick.score).toBeGreaterThan(slow.score);
	});

	it('costs a heart and the streak for a wrong answer', () => {
		const { state } = newGame();
		answer(state, state.expected);
		nextRound(state, random());
		const events = answer(state, wrongAction(state));
		expect(events[0]).toMatchObject({ type: 'wrong', expected: state.expected });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.streak).toBe(0);
		expect(state.wrong).toBe(1);
		expect(state.last).toMatchObject({ kind: 'wrong' });
	});

	it('ignores taps while the verdict is showing', () => {
		const { state } = newGame();
		answer(state, state.expected);
		const score = state.score;
		expect(answer(state, state.expected)).toEqual([]);
		expect(answer(state, wrongAction(state))).toEqual([]);
		expect(state.score).toBe(score);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('counts the rounds settled by the tie-break veto', () => {
		const rng = random();
		const state = createGame(rng);
		let tieBreaks = 0;
		for (let i = 0; i < 40 && state.phase !== 'over'; i++) {
			if (state.tieBreak) tieBreaks += 1;
			answer(state, state.expected);
			nextRound(state, rng);
		}
		expect(tieBreaks).toBeGreaterThan(0);
		expect(state.tieBreaks).toBe(tieBreaks);
	});
});

describe('the clock', () => {
	it('runs down during a question and costs a heart when it runs out', () => {
		const { state, rng } = newGame();
		expect(step(state, state.windowMs / 2, rng)).toEqual([]);
		expect(clockLeft(state)).toBeCloseTo(0.5, 5);
		const events = step(state, state.windowMs, rng);
		expect(events).toEqual([
			{ type: 'timeout', expected: state.expected, tieBreak: state.tieBreak }
		]);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.timeouts).toBe(1);
		expect(state.last).toEqual({ kind: 'timeout' });
		expect(clockLeft(state)).toBe(0);
	});

	it('does not run during the verdict display', () => {
		const { state, rng } = newGame();
		answer(state, state.expected);
		step(state, 100, rng);
		expect(state.elapsedMs).toBe(0);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('deals the next round once the verdict has been shown', () => {
		const { state, rng } = newGame();
		answer(state, state.expected);
		expect(step(state, feedbackMs(1) - 1, rng)).toEqual([]);
		expect(step(state, 2, rng)).toEqual([{ type: 'round', round: 2 }]);
		expect(state.phase).toBe('question');
		expect(state.elapsedMs).toBe(0);
	});

	it('never shows the same draft twice in a row', () => {
		const { state, rng } = newGame();
		let previous = state.resolution.index;
		for (let i = 0; i < 60; i++) {
			answer(state, state.expected);
			nextRound(state, rng);
			expect(state.resolution.index).not.toBe(previous);
			previous = state.resolution.index;
		}
	});
});

describe('streak speed-up', () => {
	it('announces a speed-up and shortens the next window', () => {
		const { state, rng } = newGame();
		const first = state.windowMs;
		for (let i = 0; i < PACE_STREAK - 1; i++) {
			expect(answer(state, state.expected).some((event) => event.type === 'pace')).toBe(false);
			nextRound(state, rng);
			expect(state.windowMs).toBe(first);
		}
		const events = answer(state, state.expected);
		expect(events.some((event) => event.type === 'pace')).toBe(true);
		nextRound(state, rng);
		expect(state.windowMs).toBeLessThan(first);
	});

	it('goes back to the slow pace after a mistake', () => {
		const { state, rng } = newGame();
		for (let i = 0; i < PACE_STREAK; i++) {
			answer(state, state.expected);
			nextRound(state, rng);
		}
		expect(state.windowMs).toBeLessThan(windowMs(0));
		answer(state, wrongAction(state));
		nextRound(state, rng);
		expect(state.windowMs).toBe(windowMs(0));
	});

	it('remembers the best streak', () => {
		const { state, rng } = newGame();
		for (let i = 0; i < 4; i++) {
			answer(state, state.expected);
			nextRound(state, rng);
		}
		answer(state, wrongAction(state));
		expect(state.streak).toBe(0);
		expect(state.bestStreak).toBe(4);
	});
});

describe('game over', () => {
	it('ends after the last heart, once the verdict has been shown', () => {
		const { state, rng } = newGame();
		for (let i = 0; i < STARTING_LIVES - 1; i++) {
			answer(state, wrongAction(state));
			nextRound(state, rng);
			expect(state.phase).toBe('question');
		}
		answer(state, wrongAction(state));
		expect(state.lives).toBe(0);
		expect(state.phase).toBe('feedback');
		expect(step(state, GAME_OVER_FEEDBACK_MS - 1, rng)).toEqual([]);
		expect(step(state, 2, rng)).toEqual([{ type: 'game-over' }]);
		expect(state.phase).toBe('over');
	});

	it('also ends when the last heart is lost to the clock', () => {
		const { state, rng } = newGame();
		for (let i = 0; i < STARTING_LIVES; i++) {
			step(state, state.windowMs, rng);
			nextRound(state, rng);
		}
		expect(state.phase).toBe('over');
		expect(state.timeouts).toBe(STARTING_LIVES);
	});

	it('does nothing once over', () => {
		const { state, rng } = newGame();
		for (let i = 0; i < STARTING_LIVES; i++) {
			step(state, state.windowMs, rng);
			nextRound(state, rng);
		}
		expect(step(state, 5000, rng)).toEqual([]);
		expect(answer(state, 'veto')).toEqual([]);
		expect(state.lives).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	BOSS_EVERY,
	BOSS_LOSS,
	FEEDBACK_MS,
	NEGLECT_MS,
	PROMPT_MIN_MS,
	START_TRACK,
	TIMEOUT_LOSS,
	TIMEOUT_SPILL,
	WRONG_LOSS,
	WRONG_SPILL
} from './config.js';
import { frontFor, isBossRound, pickScenario, rightChoice, scenarioCount } from './scenarios.js';
import { answer, clockLeft, createGame, promptMs, step } from './state.js';

function fresh() {
	const random = createRandom(5);
	return { random, state: createGame(random) };
}

function right(state: ReturnType<typeof createGame>) {
	return state.prompt.correct;
}

function wrong(state: ReturnType<typeof createGame>) {
	return state.prompt.correct === 'firm' ? 'loose' : 'firm';
}

function nextRound(state: ReturnType<typeof createGame>, random = createRandom(5)) {
	return step(state, FEEDBACK_MS + 1, random);
}

describe('petrobras scenarios', () => {
	it('has a right and a wrong call for every joke', () => {
		for (const front of ['board', 'society', 'boss'] as const) {
			for (let index = 0; index < scenarioCount(front); index++) {
				const right = rightChoice(front, index);
				expect(right === 'firm' || right === 'loose').toBe(true);
			}
		}
	});

	it('only loses to a boring press release in the boss round', () => {
		for (let index = 0; index < scenarioCount('boss'); index++) {
			expect(rightChoice('boss', index)).toBe('firm');
		}
	});

	it('never deals the same joke twice in a row', () => {
		const random = createRandom(9);
		let recent: number[] = [];
		for (let i = 0; i < 100; i++) {
			const index = pickScenario(random, 'board', recent);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(scenarioCount('board'));
			expect(recent.slice(-1)).not.toContain(index);
			recent = [...recent, index].slice(-3);
		}
	});

	it('alternates the fronts outside the boss rounds', () => {
		expect(frontFor(0)).toBe('board');
		expect(frontFor(1)).toBe('society');
		expect(frontFor(2)).toBe('board');
		expect(isBossRound(BOSS_EVERY)).toBe(true);
		expect(isBossRound(BOSS_EVERY + 1)).toBe(false);
		expect(isBossRound(0)).toBe(false);
	});
});

describe('petrobras state', () => {
	it('starts level on both fronts with the board first', () => {
		const { state } = fresh();
		expect(state.phase).toBe('prompt');
		expect(state.round).toBe(1);
		expect(state.prompt.front).toBe('board');
		expect(state.board).toBe(START_TRACK);
		expect(state.society).toBe(START_TRACK);
		expect(state.score).toBe(START_TRACK);
		expect(state.boss).toBe(false);
	});

	it('lifts its own front and a little of the other on a right call', () => {
		const { state } = fresh();
		const events = answer(state, right(state));
		expect(events[0]?.type).toBe('correct');
		expect(state.board).toBe(START_TRACK + 12);
		expect(state.society).toBe(START_TRACK + 3);
		expect(state.streak).toBe(1);
		expect(state.correct).toBe(1);
		expect(state.phase).toBe('feedback');
		expect(state.score).toBe(START_TRACK + 3);
	});

	it('sinks both fronts on a wrong call and resets the streak', () => {
		const { state, random } = fresh();
		answer(state, right(state));
		nextRound(state, random);
		answer(state, wrong(state));
		expect(state.board).toBe(START_TRACK + 12 - WRONG_SPILL);
		expect(state.society).toBe(START_TRACK + 3 - WRONG_LOSS);
		expect(state.streak).toBe(0);
		expect(state.wrong).toBe(1);
	});

	it('costs both fronts on a timeout and counts it', () => {
		const { state, random } = fresh();
		step(state, promptMs(1) + 10, random);
		expect(state.last?.kind).toBe('timeout');
		expect(state.board).toBe(START_TRACK - TIMEOUT_LOSS);
		// The untended front also drains while the clock is running out
		expect(state.society).toBeLessThan(START_TRACK - TIMEOUT_SPILL);
		expect(state.timeouts).toBe(1);
		expect(state.phase).toBe('feedback');
	});

	it('drains the front nobody is watching', () => {
		const { state } = fresh();
		const society = state.society;
		const events = step(state, NEGLECT_MS + 10, createRandom(1));
		expect(society - state.society).toBeGreaterThanOrEqual(1);
		expect(events.some((event) => event.type === 'neglect')).toBe(true);
		expect(state.board).toBe(START_TRACK);
	});

	it('ends the run when the neglected front runs dry', () => {
		const { state, random } = fresh();
		state.society = 1;
		const events = step(state, NEGLECT_MS * 2, random);
		expect(state.society).toBe(0);
		expect(state.doomed).toBe(true);
		expect(state.last?.kind).toBe('neglect');
		expect(events.some((event) => event.type === 'neglect')).toBe(true);
		step(state, 5000, random);
		expect(state.phase).toBe('over');
	});

	it('counts the prompt clock down', () => {
		const { state } = fresh();
		expect(clockLeft(state)).toBe(1);
		step(state, promptMs(1) / 2, createRandom(1));
		expect(clockLeft(state)).toBeCloseTo(0.5, 1);
		expect(promptMs(40)).toBe(PROMPT_MIN_MS);
	});

	it('puts the feed algorithm in every fifth round, where only the press release works', () => {
		const { state, random } = fresh();
		for (let round = 1; round < BOSS_EVERY; round++) {
			answer(state, right(state));
			nextRound(state, random);
		}
		expect(state.round).toBe(BOSS_EVERY);
		expect(state.prompt.front).toBe('boss');
		expect(state.boss).toBe(true);
		expect(state.prompt.correct).toBe('firm');
	});

	it('wins the boss round for both fronts with the press release', () => {
		const { state, random } = fresh();
		for (let round = 1; round < BOSS_EVERY; round++) {
			answer(state, right(state));
			nextRound(state, random);
		}
		const board = state.board;
		const society = state.society;
		answer(state, 'firm');
		expect(state.board).toBeGreaterThan(board);
		expect(state.society).toBeGreaterThan(society);
	});

	it('hits both fronts harder when the boss round goes wrong', () => {
		const { state, random } = fresh();
		for (let round = 1; round < BOSS_EVERY; round++) {
			answer(state, right(state));
			nextRound(state, random);
		}
		const board = state.board;
		const society = state.society;
		answer(state, 'loose');
		expect(state.board).toBe(board - BOSS_LOSS);
		expect(state.society).toBe(society - BOSS_LOSS);
	});

	it('ends the run when a front hits zero and can be restarted', () => {
		const { state, random } = fresh();
		state.board = 1;
		answer(state, wrong(state));
		expect(state.board).toBe(0);
		expect(state.doomed).toBe(true);
		step(state, 5000, random);
		expect(state.phase).toBe('over');
		expect(step(state, 1000, random)).toEqual([]);

		const restarted = createGame(createRandom(6));
		expect(restarted.board).toBe(START_TRACK);
		expect(restarted.round).toBe(1);
		expect(restarted.phase).toBe('prompt');
	});

	it('ignores an answer outside the prompt', () => {
		const { state } = fresh();
		answer(state, right(state));
		expect(answer(state, right(state))).toEqual([]);
		expect(state.correct).toBe(1);
	});
});

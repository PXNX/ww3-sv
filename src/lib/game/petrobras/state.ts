/*
 * Petrobras rules as a plain state machine. Two tracks run at once, the boardroom and the society
 * feed. Each round is a problem on one front with two calls; the right one lifts that front and a
 * little of the other, the wrong one (or letting the clock run out) sinks both. Meanwhile the front
 * that is not being handled loses a point every second and a half, so a player cannot simply camp on
 * one screen. Every fifth round is the feed algorithm itself: only a boring press release beats it.
 * The score is the best the weaker of the two tracks ever was, so one front alone cannot win.
 */
import type { Random } from '../random.js';
import {
	BOSS_GAIN,
	BOSS_LOSS,
	CORRECT_GAIN,
	CORRECT_SPILL,
	FEEDBACK_MS,
	GAME_OVER_FEEDBACK_MS,
	NEGLECT_DECAY,
	NEGLECT_MS,
	PROMPT_BASE_MS,
	PROMPT_MIN_MS,
	PROMPT_STEP_MS,
	START_TRACK,
	TIMEOUT_LOSS,
	TIMEOUT_SPILL,
	WRONG_LOSS,
	WRONG_SPILL
} from './config.js';
import {
	frontFor,
	isBossRound,
	pickScenario,
	rightChoice,
	type Choice,
	type Front
} from './scenarios.js';

export type PetrobrasPhase = 'prompt' | 'feedback' | 'over';

export interface Prompt {
	front: Front;
	/** Index of the joke in the messages, 0 based */
	index: number;
	correct: Choice;
}

export type RoundResult =
	| { kind: 'correct'; choice: Choice }
	| { kind: 'wrong'; choice: Choice; expected: Choice }
	| { kind: 'timeout'; expected: Choice }
	| { kind: 'neglect'; front: Exclude<Front, 'boss'> };

export interface PetrobrasState {
	phase: PetrobrasPhase;
	round: number;
	/** Number of non-boss rounds dealt, so the two fronts alternate evenly */
	frontCount: number;
	boss: boolean;
	prompt: Prompt;
	board: number;
	society: number;
	score: number;
	elapsedMs: number;
	promptMs: number;
	neglectMs: number;
	feedbackLeftMs: number;
	/** A track has run dry: the game ends when the verdict has been shown */
	doomed: boolean;
	streak: number;
	bestStreak: number;
	correct: number;
	wrong: number;
	timeouts: number;
	last: RoundResult | null;
	recent: Record<Front, number[]>;
}

export type PetrobrasEvent =
	| { type: 'round'; round: number; front: Front; boss: boolean }
	| {
			type: 'correct';
			front: Front;
			boss: boolean;
			streak: number;
			board: number;
			society: number;
			score: number;
	  }
	| {
			type: 'wrong';
			front: Front;
			expected: Choice;
			boss: boolean;
			board: number;
			society: number;
			score: number;
	  }
	| {
			type: 'timeout';
			front: Front;
			expected: Choice;
			boss: boolean;
			board: number;
			society: number;
			score: number;
	  }
	| {
			type: 'neglect';
			front: Exclude<Front, 'boss'>;
			board: number;
			society: number;
			score: number;
	  }
	| { type: 'game-over' };

/** The clock for a round, tightening as the run goes on */
export function promptMs(round: number): number {
	return Math.max(PROMPT_MIN_MS, PROMPT_BASE_MS - Math.max(0, round - 1) * PROMPT_STEP_MS);
}

/** Fraction of the prompt clock still left, 1 to 0 */
export function clockLeft(state: PetrobrasState): number {
	if (state.promptMs <= 0) return 0;
	return Math.max(0, Math.min(1, 1 - state.elapsedMs / state.promptMs));
}

function settle(state: PetrobrasState) {
	state.board = Math.max(0, state.board);
	state.society = Math.max(0, state.society);
	// The run is scored by the best the weaker front ever was, so the lower of the two tracks
	// decides the result while the final sheet never reads zero just because one front collapsed.
	state.score = Math.max(state.score, Math.floor(Math.min(state.board, state.society)));
	state.doomed = state.board === 0 || state.society === 0;
}

function deal(state: PetrobrasState, random: Random) {
	state.round += 1;
	state.boss = isBossRound(state.round);
	const front: Front = state.boss ? 'boss' : frontFor(state.frontCount);
	if (!state.boss) state.frontCount += 1;
	const index = pickScenario(random, front, state.recent[front]);
	state.recent[front].push(index);
	if (state.recent[front].length > 3) state.recent[front].shift();
	state.prompt = { front, index, correct: rightChoice(front, index) };
	state.promptMs = promptMs(state.round);
	state.elapsedMs = 0;
	state.neglectMs = 0;
	state.doomed = false;
	state.phase = 'prompt';
	state.last = null;
}

export function createGame(random: Random): PetrobrasState {
	const state: PetrobrasState = {
		phase: 'prompt',
		round: 0,
		frontCount: 0,
		boss: false,
		prompt: { front: 'board', index: 0, correct: 'firm' },
		board: START_TRACK,
		society: START_TRACK,
		score: START_TRACK,
		elapsedMs: 0,
		promptMs: promptMs(1),
		neglectMs: 0,
		feedbackLeftMs: 0,
		doomed: false,
		streak: 0,
		bestStreak: 0,
		correct: 0,
		wrong: 0,
		timeouts: 0,
		last: null,
		recent: { board: [], society: [], boss: [] }
	};
	deal(state, random);
	return state;
}

function showVerdict(state: PetrobrasState) {
	state.phase = 'feedback';
	state.feedbackLeftMs = state.doomed ? GAME_OVER_FEEDBACK_MS : FEEDBACK_MS;
}

/** The player picks one of the two calls; ignored outside the prompt */
export function answer(state: PetrobrasState, choice: Choice): PetrobrasEvent[] {
	if (state.phase !== 'prompt') return [];
	const { front, correct } = state.prompt;
	const boss = state.boss;

	if (choice === correct) {
		const gain = boss ? BOSS_GAIN : CORRECT_GAIN;
		const spill = boss ? BOSS_GAIN : CORRECT_SPILL;
		state.board += boss || front === 'board' ? gain : spill;
		state.society += boss || front === 'society' ? gain : spill;
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		state.correct += 1;
		state.last = { kind: 'correct', choice };
		settle(state);
		showVerdict(state);
		return [
			{
				type: 'correct',
				front,
				boss,
				streak: state.streak,
				board: state.board,
				society: state.society,
				score: state.score
			}
		];
	}

	state.board += boss || front === 'board' ? -(boss ? BOSS_LOSS : WRONG_LOSS) : -WRONG_SPILL;
	state.society += boss || front === 'society' ? -(boss ? BOSS_LOSS : WRONG_LOSS) : -WRONG_SPILL;
	state.streak = 0;
	state.wrong += 1;
	state.last = { kind: 'wrong', choice, expected: correct };
	settle(state);
	showVerdict(state);
	return [
		{
			type: 'wrong',
			front,
			expected: correct,
			boss,
			board: state.board,
			society: state.society,
			score: state.score
		}
	];
}

/** One fixed step: runs the prompt clock, the neglected front or the verdict display */
export function step(state: PetrobrasState, dtMs: number, random: Random): PetrobrasEvent[] {
	if (state.phase === 'over') return [];
	const events: PetrobrasEvent[] = [];

	if (state.phase === 'prompt') {
		state.elapsedMs += dtMs;
		// The front nobody is watching loses a point every so often
		if (!state.boss) {
			state.neglectMs += dtMs;
			const neglected: Exclude<Front, 'boss'> =
				state.prompt.front === 'board' ? 'society' : 'board';
			let ticks = 0;
			while (state.neglectMs >= NEGLECT_MS) {
				state.neglectMs -= NEGLECT_MS;
				ticks += 1;
			}
			if (ticks > 0 && state[neglected] > 0) {
				state[neglected] = Math.max(0, state[neglected] - NEGLECT_DECAY * ticks);
				settle(state);
				events.push({
					type: 'neglect',
					front: neglected,
					board: state.board,
					society: state.society,
					score: state.score
				});
				if (state.doomed) {
					state.streak = 0;
					state.last = { kind: 'neglect', front: neglected };
					showVerdict(state);
					return events;
				}
			}
		}

		if (state.elapsedMs < state.promptMs) return events;
		state.elapsedMs = state.promptMs;
		const boss = state.boss;
		const { front, correct } = state.prompt;
		state.board += boss || front === 'board' ? -TIMEOUT_LOSS : -TIMEOUT_SPILL;
		state.society += boss || front === 'society' ? -TIMEOUT_LOSS : -TIMEOUT_SPILL;
		state.streak = 0;
		state.timeouts += 1;
		state.last = { kind: 'timeout', expected: correct };
		settle(state);
		showVerdict(state);
		events.push({
			type: 'timeout',
			front,
			expected: correct,
			boss,
			board: state.board,
			society: state.society,
			score: state.score
		});
		return events;
	}

	state.feedbackLeftMs -= dtMs;
	if (state.feedbackLeftMs > 0) return [];
	if (state.doomed) {
		state.phase = 'over';
		events.push({ type: 'game-over' });
		return events;
	}
	deal(state, random);
	events.push({ type: 'round', round: state.round, front: state.prompt.front, boss: state.boss });
	return events;
}

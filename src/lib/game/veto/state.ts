/*
 * UN Security Council Veto rules as a plain state machine. A round is a question (the clock runs
 * while the player can answer) followed by feedback (the verdict is on screen), then the next
 * round. A wrong answer or a timeout costs a heart; every correct answer extends the streak, and
 * the streak shortens the time windows. The store and components only react to the events.
 */
import type { Random } from '../random.js';
import { GAME_OVER_FEEDBACK_MS, STARTING_LIVES } from './config.js';
import { generateResolution, type Resolution } from './resolutions.js';
import {
	feedbackMs,
	isExpired,
	paceLevel,
	pointsFor,
	speedTier,
	timeLeft,
	windowMs,
	type SpeedTier
} from './timing.js';
import { dealRound, evaluateVote, verdict, type Action, type Stance } from './vote.js';

export type VetoPhase = 'question' | 'feedback' | 'over';

/** What happened to the last round */
export type RoundResult =
	| { kind: 'correct'; chosen: Action; tier: SpeedTier; points: number }
	| { kind: 'wrong'; chosen: Action }
	| { kind: 'timeout' };

export interface VetoState {
	phase: VetoPhase;
	round: number;
	resolution: Resolution;
	cards: Stance[];
	/** The one right action this round */
	expected: Action;
	/** True when the cards have no majority and the veto stamp breaks the tie */
	tieBreak: boolean;
	elapsedMs: number;
	windowMs: number;
	/** Time left of the verdict display */
	feedbackLeftMs: number;
	/** The last heart was lost: the game ends when the verdict has been shown */
	doomed: boolean;
	lives: number;
	score: number;
	streak: number;
	bestStreak: number;
	correct: number;
	wrong: number;
	timeouts: number;
	/** Rounds settled by the tie-break veto stamp that the player got right */
	tieBreaks: number;
	last: RoundResult | null;
	/** Resolutions already shown, newest last */
	recent: number[];
}

export type VetoEvent =
	| { type: 'round'; round: number }
	| {
			type: 'correct';
			chosen: Action;
			tier: SpeedTier;
			points: number;
			streak: number;
			tieBreak: boolean;
	  }
	| { type: 'wrong'; chosen: Action; expected: Action; tieBreak: boolean }
	| { type: 'timeout'; expected: Action; tieBreak: boolean }
	| { type: 'pace'; level: number }
	| { type: 'game-over' };

function deal(state: VetoState, random: Random) {
	state.round += 1;
	state.resolution = generateResolution(random, state.recent);
	state.recent.push(state.resolution.index);
	state.cards = dealRound(random);
	const result = verdict(state.cards);
	state.expected = result.expected;
	state.tieBreak = result.tieBreak;
	state.elapsedMs = 0;
	state.windowMs = windowMs(state.streak);
	state.phase = 'question';
	state.last = null;
}

export function createGame(random: Random): VetoState {
	const state: VetoState = {
		phase: 'question',
		round: 0,
		resolution: { index: 0, number: 1000 },
		cards: [],
		expected: 'veto',
		tieBreak: false,
		elapsedMs: 0,
		windowMs: windowMs(0),
		feedbackLeftMs: 0,
		doomed: false,
		lives: STARTING_LIVES,
		score: 0,
		streak: 0,
		bestStreak: 0,
		correct: 0,
		wrong: 0,
		timeouts: 0,
		tieBreaks: 0,
		last: null,
		recent: []
	};
	deal(state, random);
	return state;
}

/** Fraction of the round's clock still left, 1 to 0 */
export function clockLeft(state: VetoState): number {
	return timeLeft(state.elapsedMs, state.windowMs);
}

function loseHeart(state: VetoState) {
	state.lives = Math.max(0, state.lives - 1);
	state.streak = 0;
	state.doomed = state.lives === 0;
}

function showVerdict(state: VetoState) {
	state.phase = 'feedback';
	state.feedbackLeftMs = state.doomed ? GAME_OVER_FEEDBACK_MS : feedbackMs(state.streak);
}

/** The player taps an action; ignored outside the question phase */
export function answer(state: VetoState, chosen: Action): VetoEvent[] {
	if (state.phase !== 'question') return [];
	const result = evaluateVote(state.cards, chosen);
	if (!result.correct) {
		state.wrong += 1;
		state.last = { kind: 'wrong', chosen };
		loseHeart(state);
		showVerdict(state);
		return [{ type: 'wrong', chosen, expected: state.expected, tieBreak: state.tieBreak }];
	}

	const before = paceLevel(state.streak);
	const tier = speedTier(state.elapsedMs, state.windowMs);
	state.streak += 1;
	state.bestStreak = Math.max(state.bestStreak, state.streak);
	const points = pointsFor(tier, state.streak);
	state.score += points;
	state.correct += 1;
	if (state.tieBreak) state.tieBreaks += 1;
	state.last = { kind: 'correct', chosen, tier, points };
	showVerdict(state);
	const events: VetoEvent[] = [
		{ type: 'correct', chosen, tier, points, streak: state.streak, tieBreak: state.tieBreak }
	];
	const after = paceLevel(state.streak);
	if (after > before) events.push({ type: 'pace', level: after });
	return events;
}

/** One fixed step: runs the round clock or the verdict display */
export function step(state: VetoState, dtMs: number, random: Random): VetoEvent[] {
	if (state.phase === 'over') return [];
	if (state.phase === 'question') {
		state.elapsedMs += dtMs;
		if (!isExpired(state.elapsedMs, state.windowMs)) return [];
		state.elapsedMs = state.windowMs;
		state.timeouts += 1;
		state.last = { kind: 'timeout' };
		loseHeart(state);
		showVerdict(state);
		return [{ type: 'timeout', expected: state.expected, tieBreak: state.tieBreak }];
	}

	state.feedbackLeftMs -= dtMs;
	if (state.feedbackLeftMs > 0) return [];
	if (state.doomed) {
		state.phase = 'over';
		return [{ type: 'game-over' }];
	}
	deal(state, random);
	return [{ type: 'round', round: state.round }];
}

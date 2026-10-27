/*
 * Red Square rules as a plain state machine. A round is one column crossing the square: the marker
 * sweeps from zero to one and the player has to cue it while it sits in the lit band in front of
 * the tribune. A cue inside the band scores by how close it was to the middle; a cue outside the
 * band, or no cue at all before the marker leaves, costs one point of the general's mood. Every
 * four hits the radio announces the next wave, the crossing gets quicker and the band narrower,
 * while the interceptors left in the sky go down. When the mood runs out the parade is over and the
 * result sheet is the punchline.
 */
import type { Random } from '../random.js';
import { nextColumn, type Column } from './columns.js';
import { FEEDBACK_MS, GAME_OVER_FEEDBACK_MS, STARTING_MOOD } from './config.js';
import {
	accuracyAt,
	cueWindow,
	interceptorsFor,
	pointsFor,
	slotMs,
	streakBonus,
	waveFor,
	type CueWindow
} from './timing.js';

export type RedSquarePhase = 'march' | 'feedback' | 'over';

export type CueResult =
	| { kind: 'hit'; accuracy: number; points: number; perfect: boolean }
	| { kind: 'early' }
	| { kind: 'late' }
	| { kind: 'missed' };

export type CueMissReason = 'early' | 'late' | 'missed';

export interface RedSquareState {
	phase: RedSquarePhase;
	round: number;
	wave: number;
	column: Column;
	/** Milliseconds since the column started crossing */
	elapsedMs: number;
	slotMs: number;
	window: CueWindow;
	/** Time left of the verdict display */
	feedbackLeftMs: number;
	/** The last mood point is gone: the game ends when the verdict has been shown */
	doomed: boolean;
	mood: number;
	score: number;
	streak: number;
	bestStreak: number;
	hits: number;
	misses: number;
	last: CueResult | null;
}

export type RedSquareEvent =
	| { type: 'round'; round: number; column: Column; wave: number }
	| { type: 'hit'; points: number; accuracy: number; perfect: boolean; streak: number }
	| { type: 'miss'; reason: CueMissReason }
	| { type: 'wave'; wave: number; interceptors: number }
	| { type: 'game-over' };

function deal(state: RedSquareState, random: Random) {
	state.round += 1;
	state.column = nextColumn(random, state.round === 1 ? null : state.column);
	state.elapsedMs = 0;
	state.slotMs = slotMs(state.wave);
	state.window = cueWindow(state.wave);
	state.phase = 'march';
	state.last = null;
}

export function createGame(random: Random): RedSquareState {
	const state: RedSquareState = {
		phase: 'march',
		round: 0,
		wave: 1,
		column: 0,
		elapsedMs: 0,
		slotMs: slotMs(1),
		window: cueWindow(1),
		feedbackLeftMs: 0,
		doomed: false,
		mood: STARTING_MOOD,
		score: 0,
		streak: 0,
		bestStreak: 0,
		hits: 0,
		misses: 0,
		last: null
	};
	deal(state, random);
	return state;
}

/** Where the column is, 0 at the edge of the square and 1 past the tribune */
export function markerOf(state: RedSquareState): number {
	if (state.slotMs <= 0) return 1;
	return Math.max(0, Math.min(1, state.elapsedMs / state.slotMs));
}

/** Interceptors the radio claims are still up in this wave */
export function interceptors(state: RedSquareState): number {
	return interceptorsFor(state.wave);
}

function showVerdict(state: RedSquareState) {
	state.phase = 'feedback';
	state.feedbackLeftMs = state.doomed ? GAME_OVER_FEEDBACK_MS : FEEDBACK_MS;
}

function miss(state: RedSquareState, reason: CueMissReason): RedSquareEvent[] {
	state.misses += 1;
	state.streak = 0;
	state.mood = Math.max(0, state.mood - 1);
	state.doomed = state.mood === 0;
	state.last = reason === 'missed' ? { kind: 'missed' } : { kind: reason };
	showVerdict(state);
	return [{ type: 'miss', reason }];
}

/** The player cues the column; ignored outside the march */
export function cue(state: RedSquareState): RedSquareEvent[] {
	if (state.phase !== 'march') return [];
	const position = markerOf(state);
	if (position < state.window.start) return miss(state, 'early');
	if (position > state.window.end) return miss(state, 'late');

	const accuracy = accuracyAt(position, state.window);
	const points = pointsFor(accuracy) + streakBonus(state.streak);
	state.score += points;
	state.hits += 1;
	state.streak += 1;
	state.bestStreak = Math.max(state.bestStreak, state.streak);
	state.last = { kind: 'hit', accuracy, points, perfect: accuracy >= 0.9 };
	showVerdict(state);

	const events: RedSquareEvent[] = [
		{
			type: 'hit',
			points,
			accuracy,
			perfect: accuracy >= 0.9,
			streak: state.streak
		}
	];
	const nextWave = waveFor(state.hits);
	if (nextWave > state.wave) {
		state.wave = nextWave;
		events.push({ type: 'wave', wave: nextWave, interceptors: interceptorsFor(nextWave) });
	}
	return events;
}

/** One fixed step: runs the crossing or the verdict display */
export function step(state: RedSquareState, dtMs: number, random: Random): RedSquareEvent[] {
	if (state.phase === 'over') return [];
	if (state.phase === 'march') {
		state.elapsedMs += dtMs;
		if (state.elapsedMs < state.slotMs) return [];
		state.elapsedMs = state.slotMs;
		return miss(state, 'missed');
	}

	state.feedbackLeftMs -= dtMs;
	if (state.feedbackLeftMs > 0) return [];
	if (state.doomed) {
		state.phase = 'over';
		return [{ type: 'game-over' }];
	}
	deal(state, random);
	return [{ type: 'round', round: state.round, column: state.column, wave: state.wave }];
}

/*
 * Red Square rules as a plain state machine. A round is one column crossing the square: the marker
 * sweeps from zero to one and the player has to cue it while it sits in the lit band in front of
 * the tribune. A cue inside the band scores by how close it was to the middle; a cue outside the
 * band, or no cue at all before the marker leaves, costs one point of the general's mood. Every
 * four hits the radio announces the next wave, the crossing gets quicker and the band narrower,
 * while the interceptors left in the sky go down. From the second wave on, a Ukrainian drone or a
 * Flamingo missile crosses the square now and then and has to be shot down by tapping it, or it
 * costs a mood point as well. When the mood runs out the parade is over and the result sheet is the
 * punchline.
 */
import { pickOne, type Random } from '../random.js';
import { nextColumn, type Column } from './columns.js';
import {
	AIR_CHANCE,
	AIR_CROSS_BASE_MS,
	AIR_CROSS_MIN_MS,
	AIR_CROSS_STEP_MS,
	AIR_FIRST_WAVE,
	AIR_POINTS,
	FEEDBACK_MS,
	GAME_OVER_FEEDBACK_MS,
	STARTING_MOOD
} from './config.js';
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

/** What the air defence has to deal with: a long-range drone or a Flamingo cruise missile */
export type AirKind = 'drone' | 'flamingo';

export const AIR_KINDS: readonly AirKind[] = ['drone', 'flamingo'];

export interface AirTarget {
	kind: AirKind;
	/** Milliseconds the target has been over the square */
	elapsedMs: number;
	/** Milliseconds it needs to cross; it has got through once elapsed reaches it */
	crossMs: number;
}

export interface RedSquareState {
	phase: RedSquarePhase;
	round: number;
	wave: number;
	column: Column;
	/** Milliseconds since the column started crossing */
	elapsedMs: number;
	slotMs: number;
	window: CueWindow;
	/** The drone or missile over the square, if one was sent along with this column */
	air: AirTarget | null;
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
	| { type: 'air'; kind: AirKind }
	| { type: 'air-down'; kind: AirKind; points: number }
	| { type: 'air-escaped'; kind: AirKind }
	| { type: 'game-over' };

/** A target now and then, once the parade has been rolling for a wave */
function sendAir(wave: number, random: Random): AirTarget | null {
	if (wave < AIR_FIRST_WAVE || random() >= AIR_CHANCE) return null;
	return {
		kind: pickOne(random, AIR_KINDS),
		elapsedMs: 0,
		crossMs: Math.max(AIR_CROSS_MIN_MS, AIR_CROSS_BASE_MS - (wave - 1) * AIR_CROSS_STEP_MS)
	};
}

function deal(state: RedSquareState, random: Random) {
	state.round += 1;
	state.column = nextColumn(random, state.round === 1 ? null : state.column);
	state.elapsedMs = 0;
	state.slotMs = slotMs(state.wave);
	state.window = cueWindow(state.wave);
	state.phase = 'march';
	state.last = null;
	// One target at a time: a leftover from the last column keeps flying until it is dealt with
	state.air ??= sendAir(state.wave, random);
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
		air: null,
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

/** Where the air target is, 0 entering the square and 1 gone */
export function airProgress(state: RedSquareState): number {
	const air = state.air;
	if (!air || air.crossMs <= 0) return 1;
	return Math.max(0, Math.min(1, air.elapsedMs / air.crossMs));
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

/** The air defence shot the target down: points, and the sky is clear again */
export function shootAir(state: RedSquareState): RedSquareEvent[] {
	const air = state.air;
	if (!air) return [];
	state.air = null;
	state.score += AIR_POINTS;
	return [{ type: 'air-down', kind: air.kind, points: AIR_POINTS }];
}

/** The target crossed the square unopposed, which the general takes personally */
function airEscaped(state: RedSquareState, kind: AirKind): RedSquareEvent[] {
	state.mood = Math.max(0, state.mood - 1);
	state.doomed = state.mood === 0;
	return [{ type: 'air-escaped', kind }];
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

/** One fixed step: runs the crossing or the verdict display, and the sky over both */
export function step(state: RedSquareState, dtMs: number, random: Random): RedSquareEvent[] {
	if (state.phase === 'over') return [];
	const events: RedSquareEvent[] = [];

	// A target keeps flying while the verdict is up, so it cannot be waited out
	if (state.air) {
		state.air.elapsedMs += dtMs;
		if (state.air.elapsedMs >= state.air.crossMs) {
			const kind = state.air.kind;
			state.air = null;
			events.push(...airEscaped(state, kind));
		}
	}

	if (state.phase === 'march') {
		state.elapsedMs += dtMs;
		if (state.elapsedMs < state.slotMs) return events;
		state.elapsedMs = state.slotMs;
		return [...events, ...miss(state, 'missed')];
	}

	state.feedbackLeftMs -= dtMs;
	if (state.feedbackLeftMs > 0) return events;
	if (state.doomed) {
		state.phase = 'over';
		return [...events, { type: 'game-over' }];
	}
	deal(state, random);
	events.push({ type: 'round', round: state.round, column: state.column, wave: state.wave });
	if (state.air) events.push({ type: 'air', kind: state.air.kind });
	return events;
}

/*
 * Border Shift rules as a plain state machine. A convoy waits at the barrier while its patience
 * runs down; the player may look at the papers and take a photo, each of which costs time, and then
 * waves the convoy through or turns it back. The neighbours are not trying to win a battle, they are
 * trying to make Europe doubt itself: a psy-op waved through is their big win, but a genuine family
 * turned away feeds the same story more slowly. Both wrong calls cost reputation and push the
 * destabilisation meter up; right calls buy a little calm back. Every third correct call the radio
 * announces a new shift: shorter patience, more psy-ops, blurrier clues. When reputation runs out or
 * Europe has lost faith, the night is over and the result sheet is the morning press conference.
 */
import type { Random } from '../random.js';
import {
	DESTABILISATION_MAX,
	DESTAB_RELIEF,
	DESTAB_SLIPPED,
	DESTAB_TURNED_AWAY,
	FEEDBACK_MS,
	GAME_OVER_FEEDBACK_MS,
	INSPECT_MS,
	POINTS_BASE,
	POINTS_PATIENCE,
	STARTING_REPUTATION,
	STREAK_BONUS,
	STREAK_BONUS_MAX
} from './config.js';
import {
	dealConvoy,
	patienceFor,
	waveFor,
	type Convoy,
	type ConvoyTruth,
	type Hint,
	type Tool
} from './convoys.js';

export type BorderShiftPhase = 'watch' | 'verdict' | 'over';

export type Decision = 'pass' | 'refuse';

export type DecisionKind = 'correct' | 'wrong';

/** Which meter ended the night: the post's reputation or Europe's faith in itself */
export type BorderShiftOutcome = 'reputation' | 'destabilised';

export interface DecisionResult {
	kind: DecisionKind;
	truth: ConvoyTruth;
	decision: Decision;
	/** A timeout is the barrier opening by itself */
	reason: 'decision' | 'timeout';
	points: number;
}

export interface BorderShiftStats {
	/** Families waved through */
	admitted: number;
	/** Psy-ops turned back */
	caught: number;
	/** Families turned back, which the morning report does not enjoy */
	turnedAway: number;
	/** Psy-ops waved through */
	slipped: number;
}

export interface BorderShiftState {
	phase: BorderShiftPhase;
	/** The shift, which decides patience, psy-op share and how clear the clues are */
	wave: number;
	convoyNumber: number;
	convoy: Convoy;
	patienceMs: number;
	patienceLeftMs: number;
	/** What each tool has shown so far; null means not used on this convoy */
	revealed: Record<Tool, Hint | null>;
	feedbackLeftMs: number;
	/** The last reputation point is gone: the night ends when the verdict has been shown */
	doomed: boolean;
	/** Why the night ended, once it has */
	outcome: BorderShiftOutcome | null;
	reputation: number;
	/** The radio's campaign: 0 calm, 100 Europe no longer believes in itself */
	destabilisation: number;
	score: number;
	streak: number;
	bestStreak: number;
	correct: number;
	wrong: number;
	stats: BorderShiftStats;
	last: DecisionResult | null;
}

export type BorderShiftEvent =
	| { type: 'convoy'; number: number; vehicle: number; wave: number }
	| { type: 'hint'; tool: Tool; hint: Hint }
	| {
			type: 'correct';
			points: number;
			truth: ConvoyTruth;
			decision: Decision;
			reason: 'decision' | 'timeout';
	  }
	| { type: 'wrong'; truth: ConvoyTruth; decision: Decision; reason: 'decision' | 'timeout' }
	| { type: 'wave'; wave: number }
	| { type: 'game-over' };

function deal(state: BorderShiftState, random: Random) {
	const previous = state.convoyNumber === 0 ? null : state.convoy.vehicle;
	state.convoyNumber += 1;
	state.convoy = dealConvoy(random, state.wave, previous);
	state.patienceMs = patienceFor(state.wave);
	state.patienceLeftMs = state.patienceMs;
	state.revealed = { documents: null, camera: null };
	state.phase = 'watch';
	state.last = null;
}

export function createGame(random: Random): BorderShiftState {
	const state: BorderShiftState = {
		phase: 'watch',
		wave: 1,
		convoyNumber: 0,
		convoy: { vehicle: 0, truth: 'family', hints: { documents: 'unclear', camera: 'unclear' } },
		patienceMs: patienceFor(1),
		patienceLeftMs: patienceFor(1),
		revealed: { documents: null, camera: null },
		feedbackLeftMs: 0,
		doomed: false,
		outcome: null,
		reputation: STARTING_REPUTATION,
		destabilisation: 0,
		score: 0,
		streak: 0,
		bestStreak: 0,
		correct: 0,
		wrong: 0,
		stats: { admitted: 0, caught: 0, turnedAway: 0, slipped: 0 },
		last: null
	};
	deal(state, random);
	return state;
}

/** Share of the patience still left, 0 to 1 */
export function patienceShare(state: BorderShiftState): number {
	if (state.patienceMs <= 0) return 0;
	return Math.max(0, Math.min(1, state.patienceLeftMs / state.patienceMs));
}

/** How far the radio's campaign has got, 0 to 1 */
export function destabilisationShare(state: BorderShiftState): number {
	return Math.max(0, Math.min(1, state.destabilisation / DESTABILISATION_MAX));
}

/** The points a correct call is worth right now */
export function pointsFor(state: BorderShiftState): number {
	const time = Math.round(POINTS_PATIENCE * patienceShare(state));
	const streak = Math.min(STREAK_BONUS_MAX, STREAK_BONUS * state.streak);
	return POINTS_BASE + time + streak;
}

function resolve(
	state: BorderShiftState,
	decision: Decision,
	reason: 'decision' | 'timeout'
): BorderShiftEvent[] {
	const truth = state.convoy.truth;
	const correct = (truth === 'family') === (decision === 'pass');
	const events: BorderShiftEvent[] = [];

	if (correct) {
		const points = pointsFor(state);
		state.score += points;
		state.correct += 1;
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		// A right call is a small counter-story: trust in the post creeps back up
		state.destabilisation = Math.max(0, state.destabilisation - DESTAB_RELIEF);
		if (truth === 'family') state.stats.admitted += 1;
		else state.stats.caught += 1;
		state.last = { kind: 'correct', truth, decision, reason, points };
		events.push({ type: 'correct', points, truth, decision, reason });

		const nextWave = waveFor(state.correct);
		if (nextWave > state.wave) {
			state.wave = nextWave;
			events.push({ type: 'wave', wave: nextWave });
		}
	} else {
		state.wrong += 1;
		state.streak = 0;
		state.reputation = Math.max(0, state.reputation - 1);
		// The radio's win: a psy-op through is the loud version, a family turned away the quiet one
		const damage = truth === 'family' ? DESTAB_TURNED_AWAY : DESTAB_SLIPPED;
		state.destabilisation = Math.min(DESTABILISATION_MAX, state.destabilisation + damage);
		state.doomed = state.reputation === 0 || state.destabilisation >= DESTABILISATION_MAX;
		state.outcome = state.doomed ? (state.reputation === 0 ? 'reputation' : 'destabilised') : null;
		if (truth === 'family') state.stats.turnedAway += 1;
		else state.stats.slipped += 1;
		state.last = { kind: 'wrong', truth, decision, reason, points: 0 };
		events.push({ type: 'wrong', truth, decision, reason });
	}

	state.phase = 'verdict';
	state.feedbackLeftMs = state.doomed ? GAME_OVER_FEEDBACK_MS : FEEDBACK_MS;
	return events;
}

/** Looks at the papers or takes a photo; a tool can only be used once per convoy */
export function inspect(state: BorderShiftState, tool: Tool): BorderShiftEvent[] {
	if (state.phase !== 'watch' || state.revealed[tool] !== null) return [];
	const hint = state.convoy.hints[tool];
	state.revealed[tool] = hint;
	const events: BorderShiftEvent[] = [{ type: 'hint', tool, hint }];
	state.patienceLeftMs -= INSPECT_MS;
	if (state.patienceLeftMs <= 0) {
		state.patienceLeftMs = 0;
		events.push(...resolve(state, 'pass', 'timeout'));
	}
	return events;
}

/** Waves the convoy through or turns it back */
export function decide(state: BorderShiftState, decision: Decision): BorderShiftEvent[] {
	if (state.phase !== 'watch') return [];
	return resolve(state, decision, 'decision');
}

/** One fixed step: drains the patience, or runs the verdict display and deals the next convoy */
export function step(state: BorderShiftState, dtMs: number, random: Random): BorderShiftEvent[] {
	if (state.phase === 'over') return [];
	if (state.phase === 'watch') {
		state.patienceLeftMs -= dtMs;
		if (state.patienceLeftMs > 0) return [];
		state.patienceLeftMs = 0;
		return resolve(state, 'pass', 'timeout');
	}

	state.feedbackLeftMs -= dtMs;
	if (state.feedbackLeftMs > 0) return [];
	if (state.doomed) {
		state.phase = 'over';
		return [{ type: 'game-over' }];
	}
	deal(state, random);
	return [
		{ type: 'convoy', number: state.convoyNumber, vehicle: state.convoy.vehicle, wave: state.wave }
	];
}

/*
 * One fixed step of Spokesperson Whack: pop-ups, statements running out, taps, scoring and
 * hearts. Pure apart from the state it mutates, so tests drive it with a seeded Random.
 */
import {
	CORRECTION_POINTS,
	FACT_CHECK_BONUS,
	FACT_CHECK_MS,
	HITTABLE_RISE,
	LEAVE_MS,
	RISE_MS,
	WHACKED_MS,
	isDecoy,
	specOf
} from './config';
import { holeAt, holeBase, isHole } from './layout';
import { breakCombo, comboActive, hitScore, registerHit } from './scoring';
import { stepSpawner } from './spawner';
import { riseOf, type Mole, type WhackEvent, type WhackState } from './state';
import type { Random } from '#lib/game/random.js';

/** Height of a figure's head above its feet, for effects that should appear on it */
const HEAD_HEIGHT = 56;

function headPosition(mole: Mole): { x: number; y: number } {
	const base = holeBase(mole.hole);
	return { x: base.x, y: base.y - HEAD_HEIGHT * riseOf(mole) };
}

function loseLife(state: WhackState, events: WhackEvent[]) {
	state.lives = Math.max(0, state.lives - 1);
	if (state.lives === 0 && !state.over) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

function moleAt(state: WhackState, hole: number): Mole | undefined {
	return state.moles.find((mole) => mole.hole === hole);
}

function startPhase(mole: Mole, phase: 'whacked' | 'leaving') {
	mole.riseFrom = riseOf(mole);
	mole.phase = phase;
	mole.phaseMs = 0;
}

/**
 * A tap on a podium. A standing target is whacked, a standing decoy costs a heart, and an empty
 * podium only breaks the combo. A figure that is already going down is ignored, so a double tap
 * is harmless.
 */
export function tapHole(state: WhackState, hole: number): WhackEvent[] {
	if (state.over || !isHole(hole)) return [];
	const events: WhackEvent[] = [];
	const mole = moleAt(state, hole);

	if (!mole) {
		const base = holeBase(hole);
		const broke = comboActive(state.combo, state.timeMs);
		breakCombo(state.combo);
		state.emptyTaps += 1;
		events.push({ type: 'empty', hole, x: base.x, y: base.y - HEAD_HEIGHT * 0.5, broke });
		return events;
	}
	if (mole.phase !== 'up' || riseOf(mole) < HITTABLE_RISE) return [];

	const { x, y } = headPosition(mole);
	if (isDecoy(mole.kind)) {
		startPhase(mole, 'whacked');
		state.decoysHit += 1;
		breakCombo(state.combo);
		events.push({ type: 'decoy-hit', kind: mole.kind, hole, x, y });
		loseLife(state, events);
		return events;
	}
	// A funding question is not whacked: the press starts a hold that the step loop completes
	if (mole.statement === 'funding') {
		if (state.factCheck?.moleId !== mole.id) {
			state.factCheck = { hole, moleId: mole.id, heldMs: 0 };
			events.push({ type: 'fact-check-start', hole, x, y });
		}
		return events;
	}
	// A correction is the record correcting itself: hitting it is the mistake
	if (mole.statement === 'correction') {
		startPhase(mole, 'whacked');
		state.wrongCorrections += 1;
		breakCombo(state.combo);
		events.push({ type: 'correction-hit', kind: mole.kind, hole, x, y });
		loseLife(state, events);
		return events;
	}

	startPhase(mole, 'whacked');
	const { streak, multiplier } = registerHit(state.combo, state.timeMs);
	const points = hitScore(specOf(mole.kind).points, multiplier);
	state.score += points;
	state.hits += 1;
	state.bestStreak = Math.max(state.bestStreak, streak);
	events.push({ type: 'hit', kind: mole.kind, hole, x, y, points, streak, multiplier });
	return events;
}

/** A pointer or key release ends a fact-check early; the figure stays up and can be pressed again */
export function releaseHole(state: WhackState) {
	state.factCheck = null;
}

/** Advances a running fact-check and scores it once the hold is long enough */
function advanceFactCheck(state: WhackState, dtMs: number, events: WhackEvent[]) {
	const check = state.factCheck;
	if (!check) return;
	const mole = state.moles.find((candidate) => candidate.id === check.moleId);
	if (!mole || mole.phase !== 'up') {
		state.factCheck = null;
		return;
	}
	check.heldMs += dtMs;
	if (check.heldMs < FACT_CHECK_MS) return;

	const { x, y } = headPosition(mole);
	startPhase(mole, 'whacked');
	state.factCheck = null;
	state.checks += 1;
	const { streak, multiplier } = registerHit(state.combo, state.timeMs);
	const points = hitScore(specOf(mole.kind).points + FACT_CHECK_BONUS, multiplier);
	state.score += points;
	state.hits += 1;
	state.bestStreak = Math.max(state.bestStreak, streak);
	events.push({
		type: 'fact-check',
		kind: mole.kind,
		hole: mole.hole,
		x,
		y,
		points,
		streak,
		multiplier
	});
}

/** A tap at a world position: the hit test followed by the rules above */
export function tapAt(state: WhackState, x: number, y: number): WhackEvent[] {
	const hole = holeAt(x, y);
	return hole === null ? [] : tapHole(state, hole);
}

function moleStep(state: WhackState, dtMs: number, events: WhackEvent[]) {
	const remaining: Mole[] = [];
	for (const mole of state.moles) {
		mole.ageMs += dtMs;
		mole.phaseMs += dtMs;
		if (mole.phase === 'up') {
			mole.progress = Math.min(1, Math.max(0, (mole.ageMs - RISE_MS) / mole.lifeMs));
			if (mole.progress >= 1) {
				const { x, y } = headPosition(mole);
				startPhase(mole, 'leaving');
				if (!isDecoy(mole.kind)) {
					mole.finished = true;
					if (mole.statement === 'correction') {
						// It corrected the record on its own: no heart lost, and a small reward for reading it
						state.corrections += 1;
						state.score += CORRECTION_POINTS;
						events.push({
							type: 'correction-left',
							kind: mole.kind,
							hole: mole.hole,
							x,
							y,
							points: CORRECTION_POINTS
						});
					} else {
						state.escaped += 1;
						breakCombo(state.combo);
						events.push({ type: 'statement-finished', kind: mole.kind, hole: mole.hole, x, y });
						loseLife(state, events);
					}
				}
			}
			remaining.push(mole);
		} else if (mole.phaseMs < (mole.phase === 'whacked' ? WHACKED_MS : LEAVE_MS)) {
			remaining.push(mole);
		}
	}
	state.moles = remaining;
}

export function stepGame(state: WhackState, random: Random, dtMs: number): WhackEvent[] {
	if (state.over) return [];
	const events: WhackEvent[] = [];
	state.timeMs += dtMs;
	advanceFactCheck(state, dtMs, events);
	moleStep(state, dtMs, events);
	if (state.over) return events;

	const occupied = new Set(state.moles.map((mole) => mole.hole));
	const targetsUp = state.moles.filter((mole) => mole.phase === 'up' && !isDecoy(mole.kind)).length;
	for (const spawn of stepSpawner(state.spawner, random, dtMs, state.timeMs, occupied, targetsUp)) {
		state.moles.push({
			id: state.nextId++,
			hole: spawn.hole,
			kind: spawn.kind,
			statement: spawn.statement,
			phase: 'up',
			ageMs: 0,
			phaseMs: 0,
			lifeMs: spawn.lifeMs,
			progress: 0,
			riseFrom: 0,
			finished: false
		});
		events.push({ type: 'spawned', kind: spawn.kind, hole: spawn.hole });
	}
	return events;
}

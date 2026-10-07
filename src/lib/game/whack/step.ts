/*
 * One fixed step of Spokesperson Whack: pop-ups, statements running out, taps, scoring and
 * hearts. Pure apart from the state it mutates, so tests drive it with a seeded Random.
 */
import { HITTABLE_RISE, LEAVE_MS, RISE_MS, WHACKED_MS, isDecoy, specOf } from './config';
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
	startPhase(mole, 'whacked');
	if (isDecoy(mole.kind)) {
		state.decoysHit += 1;
		breakCombo(state.combo);
		events.push({ type: 'decoy-hit', kind: mole.kind, hole, x, y });
		loseLife(state, events);
		return events;
	}

	const { streak, multiplier } = registerHit(state.combo, state.timeMs);
	const points = hitScore(specOf(mole.kind).points, multiplier);
	state.score += points;
	state.hits += 1;
	state.bestStreak = Math.max(state.bestStreak, streak);
	events.push({ type: 'hit', kind: mole.kind, hole, x, y, points, streak, multiplier });
	return events;
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
					state.escaped += 1;
					breakCombo(state.combo);
					events.push({ type: 'statement-finished', kind: mole.kind, hole: mole.hole, x, y });
					loseLife(state, events);
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
	moleStep(state, dtMs, events);
	if (state.over) return events;

	const occupied = new Set(state.moles.map((mole) => mole.hole));
	const targetsUp = state.moles.filter((mole) => mole.phase === 'up' && !isDecoy(mole.kind)).length;
	for (const spawn of stepSpawner(state.spawner, random, dtMs, state.timeMs, occupied, targetsUp)) {
		state.moles.push({
			id: state.nextId++,
			hole: spawn.hole,
			kind: spawn.kind,
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

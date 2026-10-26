/*
 * Simulation state for Spokesperson Whack. A plain object that step.ts mutates and render.ts
 * reads; the store copies the few numbers the page chrome shows into reactive fields.
 */
import {
	LEAVE_MS,
	RISE_MS,
	STARTING_LIVES,
	WHACKED_MS,
	type BoardId,
	type MoleKind,
	type StatementCategory
} from './config';
import { createCombo, type Combo } from './scoring';
import { createSpawner, type Spawner } from './spawner';

/** up: standing at the podium; whacked: bonked and sinking; leaving: ducking away unhurt */
export type MolePhase = 'up' | 'whacked' | 'leaving';

export interface Mole {
	id: number;
	hole: number;
	kind: MoleKind;
	/** What the target is saying; decoys are never whacked for points, so they carry 'lie' */
	statement: StatementCategory;
	phase: MolePhase;
	/** Time since the pop-up began */
	ageMs: number;
	/** Time in the current phase */
	phaseMs: number;
	/** How long the statement runs (or the decoy stays) once fully risen */
	lifeMs: number;
	/** Statement progress from 0 to 1; a target loses you a heart when it gets there */
	progress: number;
	/** How far it had risen when it left the standing phase */
	riseFrom: number;
	/** Whether the statement finished (the player lost a heart for it) */
	finished: boolean;
}

/** A funding question being held for a fact-check */
export interface FactCheck {
	hole: number;
	moleId: number;
	/** Milliseconds the player has held so far */
	heldMs: number;
}

export interface WhackState {
	board: BoardId;
	timeMs: number;
	score: number;
	lives: number;
	moles: Mole[];
	spawner: Spawner;
	combo: Combo;
	factCheck: FactCheck | null;
	nextId: number;
	/** Targets whacked */
	hits: number;
	/** Statements that ran to the end */
	escaped: number;
	/** Decoys whacked */
	decoysHit: number;
	/** Funding questions fact-checked */
	checks: number;
	/** Corrections left alone until they ended */
	corrections: number;
	/** Corrections wrongly whacked */
	wrongCorrections: number;
	/** Taps on an empty podium */
	emptyTaps: number;
	/** Longest streak of fast hits in the run */
	bestStreak: number;
	over: boolean;
}

export function createGame(board: BoardId = 'regime'): WhackState {
	return {
		board,
		timeMs: 0,
		score: 0,
		lives: STARTING_LIVES,
		moles: [],
		spawner: createSpawner(),
		combo: createCombo(),
		factCheck: null,
		nextId: 1,
		hits: 0,
		escaped: 0,
		decoysHit: 0,
		checks: 0,
		corrections: 0,
		wrongCorrections: 0,
		emptyTaps: 0,
		bestStreak: 0,
		over: false
	};
}

/** How far a figure is out of its podium, 0 hidden to 1 fully up */
export function riseOf(mole: Mole): number {
	if (mole.phase === 'up') return Math.min(1, mole.ageMs / RISE_MS);
	const duration = mole.phase === 'whacked' ? WHACKED_MS : LEAVE_MS;
	return mole.riseFrom * Math.max(0, 1 - mole.phaseMs / duration);
}

export type WhackEvent =
	| { type: 'spawned'; kind: MoleKind; hole: number }
	| {
			type: 'hit';
			kind: MoleKind;
			hole: number;
			x: number;
			y: number;
			points: number;
			streak: number;
			multiplier: number;
	  }
	| { type: 'decoy-hit'; kind: MoleKind; hole: number; x: number; y: number }
	| { type: 'correction-hit'; kind: MoleKind; hole: number; x: number; y: number }
	| {
			type: 'correction-left';
			kind: MoleKind;
			hole: number;
			x: number;
			y: number;
			points: number;
	  }
	| { type: 'fact-check-start'; hole: number; x: number; y: number }
	| {
			type: 'fact-check';
			kind: MoleKind;
			hole: number;
			x: number;
			y: number;
			points: number;
			streak: number;
			multiplier: number;
	  }
	| { type: 'statement-finished'; kind: MoleKind; hole: number; x: number; y: number }
	| { type: 'empty'; hole: number; x: number; y: number; broke: boolean }
	| { type: 'game-over' };

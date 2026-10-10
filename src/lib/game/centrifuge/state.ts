/*
 * The whole state of one Centrifuge Spin run as a plain object, and the events the step functions
 * report so the store can add sounds and effects.
 */
import { FIRST_DRIFT_MS, FIRST_SCARE_MS, STARTING_LIVES } from './config.js';
import { createDial, type DialState } from './dial.js';
import { createScheduler, type Scare, type Scheduler } from './scares.js';

export interface CentrifugeState {
	timeMs: number;
	score: number;
	lives: number;
	/** Correct decisions in a row: scares sat out and drifts fixed */
	streak: number;
	bestStreak: number;
	dial: DialState;
	scheduler: Scheduler;
	/** Time until the next real drift starts (counts only while the dial is idle) */
	driftInMs: number;
	/** Presses are ignored while this is above zero */
	lockMs: number;
	over: boolean;
	/** Scares sat through without reacting */
	calmScares: number;
	fixes: number;
	/** Presses while the dial was in the safe band */
	overreactions: number;
	/** Drifts that reached the end of the dial */
	meltdowns: number;
}

export type CentrifugeEvent =
	| { type: 'scare-start'; scare: Scare }
	| { type: 'scare-end'; scare: Scare; points: number }
	| { type: 'drift-start' }
	| { type: 'band-exit' }
	| { type: 'fix'; points: number; reactionMs: number }
	| { type: 'overreact'; duringScare: boolean }
	| { type: 'meltdown' }
	| { type: 'game-over' };

export function createGame(): CentrifugeState {
	return {
		timeMs: 0,
		score: 0,
		lives: STARTING_LIVES,
		streak: 0,
		bestStreak: 0,
		dial: createDial(),
		scheduler: createScheduler(FIRST_SCARE_MS),
		driftInMs: FIRST_DRIFT_MS,
		lockMs: 0,
		over: false,
		calmScares: 0,
		fixes: 0,
		overreactions: 0,
		meltdowns: 0
	};
}

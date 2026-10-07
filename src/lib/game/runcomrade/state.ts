/*
 * Simulation state for Run Comrade. A plain object that step.ts mutates and render.ts reads; the
 * store copies the few numbers the page chrome shows into reactive fields.
 */
import {
	MIDDLE_LANE,
	SCORE_STEP,
	STARTING_LIVES,
	type Lane,
	type ObstacleKind,
	type PickupKind
} from './config';
import { createDrone, type Drone } from './drone';
import { createField, createGenerator, type Field, type Generator } from './patterns';
import { createPower, type Power } from './pickups';

export interface Runner {
	/** The lane the runner is heading for */
	lane: Lane;
	/** Where the runner is across the course, in lanes (slides towards `lane`) */
	x: number;
	/** Time since take-off, -1 on the ground */
	jumpMs: number;
	/** Time left of a duck, 0 when upright */
	duckMs: number;
	/** Time left of the tumble animation after a stumble */
	stumbleMs: number;
	/** Time left of the slow-down after a stumble */
	slowMs: number;
	/** Time left in which another stumble does not count */
	graceMs: number;
}

export interface RunState {
	timeMs: number;
	/** How far the runner has come, in units */
	distance: number;
	/** Points from pickups, on top of the distance */
	bonus: number;
	lives: number;
	/** Current running speed in units per second */
	speed: number;
	runner: Runner;
	drone: Drone;
	power: Power;
	field: Field;
	generator: Generator;
	/** The runner is among tall sunflowers, so the drone is out of sight */
	hidden: boolean;
	stumbles: number;
	contacts: number;
	shieldBlocks: number;
	smashes: number;
	pickups: Record<PickupKind, number>;
	over: boolean;
}

export function createRunner(): Runner {
	return {
		lane: MIDDLE_LANE,
		x: MIDDLE_LANE,
		jumpMs: -1,
		duckMs: 0,
		stumbleMs: 0,
		slowMs: 0,
		graceMs: 0
	};
}

export function createGame(): RunState {
	return {
		timeMs: 0,
		distance: 0,
		bonus: 0,
		lives: STARTING_LIVES,
		speed: 0,
		runner: createRunner(),
		drone: createDrone(),
		power: createPower(),
		field: createField(),
		generator: createGenerator(),
		hidden: false,
		stumbles: 0,
		contacts: 0,
		shieldBlocks: 0,
		smashes: 0,
		pickups: { helmet: 0, rice: 0 },
		over: false
	};
}

/** Distance counts in steps of five points, so the score on screen does not flicker every frame */
export function scoreOf(state: RunState): number {
	return Math.floor(state.distance / SCORE_STEP) * SCORE_STEP + state.bonus;
}

export function isAirborne(runner: Runner): boolean {
	return runner.jumpMs >= 0;
}

export function isDucking(runner: Runner): boolean {
	return runner.duckMs > 0;
}

export type RunEvent =
	| { type: 'jump' }
	| { type: 'duck' }
	| { type: 'land' }
	| { type: 'lane'; lane: Lane }
	| { type: 'stumble'; kind: ObstacleKind; lane: Lane; gap: number }
	| { type: 'smash'; kind: ObstacleKind; lane: Lane }
	| { type: 'shield-block'; source: 'obstacle' | 'drone' }
	| { type: 'pickup'; kind: PickupKind; lane: Lane }
	| { type: 'boost-end' }
	| { type: 'contact'; lives: number }
	| { type: 'game-over' };

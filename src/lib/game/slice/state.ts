/*
 * Simulation state for Radar Slice. A plain object that step.ts mutates and render.ts reads; the
 * store copies the few numbers the page chrome shows into reactive fields.
 */
import { STARTING_LIVES, type FlyerKind } from './config';
import { createCombo, type Combo } from './scoring';
import { createSpawner, type Launch, type Spawner } from './spawner';
import { createTrail, type Trail } from './trail';

export interface Flyer extends Launch {
	id: number;
	ageMs: number;
}

/** One side of a sliced flyer, flying apart under simple physics */
export interface Half {
	id: number;
	kind: FlyerKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	gravity: number;
	angle: number;
	spin: number;
	/** Direction of the cut line in the flyer's own frame, in radians */
	cut: number;
	/** Which side of the cut line this half is: 1 or -1 */
	side: 1 | -1;
	/** Which way the flyer faced (for the gull), 1 or -1 */
	facing: 1 | -1;
	ageMs: number;
}

export interface SliceState {
	timeMs: number;
	score: number;
	lives: number;
	flyers: Flyer[];
	halves: Half[];
	spawner: Spawner;
	trail: Trail;
	combo: Combo;
	nextId: number;
	/** Threats sliced */
	sliced: number;
	/** Threats that fell back unsliced */
	missed: number;
	/** Decoys sliced */
	decoysHit: number;
	/** Longest combo chain of the run */
	bestCombo: number;
	over: boolean;
}

export function createGame(): SliceState {
	return {
		timeMs: 0,
		score: 0,
		lives: STARTING_LIVES,
		flyers: [],
		halves: [],
		spawner: createSpawner(),
		trail: createTrail(),
		combo: createCombo(),
		nextId: 1,
		sliced: 0,
		missed: 0,
		decoysHit: 0,
		bestCombo: 0,
		over: false
	};
}

export type SliceEvent =
	| { type: 'launched'; kind: FlyerKind; x: number }
	| { type: 'sliced'; kind: FlyerKind; x: number; y: number; points: number; chain: number }
	| { type: 'decoy-hit'; kind: FlyerKind; x: number; y: number }
	| { type: 'missed'; kind: FlyerKind; x: number; y: number }
	| { type: 'game-over' };

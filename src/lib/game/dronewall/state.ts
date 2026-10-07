/*
 * Drone Wall: the simulation state (a plain object, read by the renderer every frame) and the
 * events a step reports (sounds, effects, banners).
 */
import {
	FIRST_PREP_MS,
	SLOTS,
	STARTING_HELMETS,
	STARTING_LIVES,
	type DefenseKind,
	type SoldierKind
} from './config';
import type { SpawnEntry } from './waves';

export interface Soldier {
	id: number;
	kind: SoldierKind;
	/** Distance travelled along the road */
	progress: number;
	hp: number;
	maxHp: number;
	/** Base speed in units per second, including this soldier's own variation */
	speed: number;
	/** Sideways position on the road, from -1 to 1 (drawing only) */
	lane: number;
	x: number;
	y: number;
	/** Speed multiplier from trenches during the last step (1 = free) */
	slow: number;
	/** Hit flash, counts down */
	hitMs: number;
}

export interface Defense {
	kind: DefenseKind;
	level: number;
	cooldownMs: number;
	/** Where the defense last aimed, in radians (drawing only) */
	aim: number;
	/** Shows the shooting pose for a moment (drawing only) */
	firedMs: number;
}

export interface Helmet {
	id: number;
	x: number;
	y: number;
	value: number;
	ageMs: number;
}

export interface Shell {
	id: number;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	ageMs: number;
	flightMs: number;
	damage: number;
	radius: number;
}

export type WavePhase = 'prep' | 'wave';

export interface DroneWallState {
	timeMs: number;
	/** Number of the wave that is running or was last played (0 before the first one) */
	wave: number;
	phase: WavePhase;
	/** Time left until the next wave, while in the prep phase */
	prepMs: number;
	/** Time since the current wave started */
	waveMs: number;
	queue: SpawnEntry[];
	queueIndex: number;
	soldiers: Soldier[];
	helmets: Helmet[];
	shells: Shell[];
	/** One entry per slot, null when empty */
	defenses: (Defense | null)[];
	/** Helmets in the player's pocket: the only currency */
	currency: number;
	lives: number;
	score: number;
	/** Soldiers stopped */
	kills: number;
	/** Helmets picked up */
	collected: number;
	over: boolean;
	nextId: number;
}

export function createGame(): DroneWallState {
	return {
		timeMs: 0,
		wave: 0,
		phase: 'prep',
		prepMs: FIRST_PREP_MS,
		waveMs: 0,
		queue: [],
		queueIndex: 0,
		soldiers: [],
		helmets: [],
		shells: [],
		defenses: SLOTS.map(() => null),
		currency: STARTING_HELMETS,
		lives: STARTING_LIVES,
		score: 0,
		kills: 0,
		collected: 0,
		over: false,
		nextId: 1
	};
}

export type DroneWallEvent =
	| { type: 'wave-started'; wave: number }
	| { type: 'wave-cleared'; wave: number; bonus: number }
	| { type: 'soldier-fell'; x: number; y: number; kind: SoldierKind }
	| { type: 'helmet-collected'; x: number; y: number; value: number }
	| { type: 'helmet-expired'; x: number; y: number }
	| { type: 'leak'; x: number; y: number }
	| { type: 'squad-shot'; slot: number; fromX: number; fromY: number; toX: number; toY: number }
	| { type: 'drone-strike'; slot: number; fromX: number; fromY: number; toX: number; toY: number }
	| { type: 'shell-launched'; slot: number; fromX: number; fromY: number; toX: number; toY: number }
	| { type: 'shell-landed'; x: number; y: number; radius: number }
	| { type: 'game-over' };

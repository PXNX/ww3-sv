/*
 * The state of one ritual, as a plain object the step functions mutate. It holds no randomness of
 * its own: everything random (the cats, the riddle, the seats, the room events) comes from the
 * seed, so a ritual can be replayed exactly.
 */
import { createRandom, type Random } from '#lib/game/random.js';
import { generateCats, RESTING_MOOD, type CatProfile } from './cats';
import { FIRST_EVENT_MS, STARTING_LIVES } from './config';
import { catHearts, ritualScore } from './scoring';
import type { PetStroke } from './petting';
import type { Animation, RoomEvent } from './reactions';
import { assignSeats, generateRiddle, type Riddle } from './riddle';

/** What a cat is doing besides sitting: the room's reactions plus the tail flick a scrub causes */
export type MotionKind = Animation | 'flick';

export interface Motion {
	kind: MotionKind;
	remainingMs: number;
}

/** A reaction the player has seen, kept in the notes */
export interface Observation {
	event: RoomEvent;
	animation: Animation;
}

export interface CatState {
	profile: CatProfile;
	/** The pentagram point the cat sits on */
	seat: number;
	/** 0 (upset) to 1 (calm) */
	mood: number;
	/** 0 to 1, grows while the cat purrs; reveals the name tag and then the pitch */
	happiness: number;
	/** The purr that is sounding right now (0 to 1); follows purrTarget with some inertia */
	purr: number;
	purrTarget: number;
	/** The stroke in progress, if the cat is being petted */
	stroke: PetStroke | null;
	/** Time since the last pointer sample of the stroke */
	idleMs: number;
	motion: Motion | null;
	/** Petting is ignored while the cat sulks after a hiss */
	sulkMs: number;
	scrubCooldownMs: number;
	sinceScrubMs: number;
	nameShown: boolean;
	pitchShown: boolean;
	observed: Observation[];
	/** Counts up with every tail flick, so the view can restart the animation */
	flicks: number;
}

export interface RoomEventState {
	kind: RoomEvent;
	remainingMs: number;
	durationMs: number;
}

export type RitualPhase = 'playing' | 'won' | 'over';

export interface RitualState {
	seed: number;
	cats: CatState[];
	riddle: Riddle;
	/** Cats joined so far, in the order the star was drawn */
	chain: number[];
	/** The star is closed: the last cat has been joined back to the first, which completes the ritual */
	closed: boolean;
	lives: number;
	mistakes: number;
	elapsedMs: number;
	event: RoomEventState | null;
	eventBag: RoomEvent[];
	nextEventMs: number;
	phase: RitualPhase;
	/** Time since the ritual was completed */
	finaleMs: number;
}

export type RitualEvent =
	| { type: 'room-event'; event: RoomEvent }
	| { type: 'reaction'; cat: number; animation: Animation }
	| { type: 'name-shown'; cat: number }
	| { type: 'pitch-shown'; cat: number }
	| { type: 'scrub'; cat: number; hiss: boolean }
	| { type: 'line'; from: number; to: number; index: number }
	| { type: 'mistake'; from: number; to: number; livesLeft: number }
	| { type: 'not-ready'; cat: number }
	| { type: 'out-of-turn'; cat: number }
	| { type: 'win' }
	| { type: 'game-over' };

export function createCatState(profile: CatProfile, seat: number): CatState {
	return {
		profile,
		seat,
		mood: RESTING_MOOD[profile.personality],
		happiness: 0,
		purr: 0,
		purrTarget: 0,
		stroke: null,
		idleMs: 0,
		motion: null,
		sulkMs: 0,
		scrubCooldownMs: 0,
		sinceScrubMs: Infinity,
		nameShown: false,
		pitchShown: false,
		observed: [],
		flicks: 0
	};
}

/** A new ritual: the cats, the riddle and the seating all follow from the seed */
export function createRitual(seed: number, random: Random = createRandom(seed)): RitualState {
	const profiles = generateCats(random);
	const riddle = generateRiddle(profiles, random);
	const seatOf = assignSeats(riddle.target, random);
	return {
		seed,
		cats: profiles.map((profile) => createCatState(profile, seatOf[profile.id])),
		riddle,
		chain: [],
		closed: false,
		lives: STARTING_LIVES,
		mistakes: 0,
		elapsedMs: 0,
		event: null,
		eventBag: [],
		nextEventMs: FIRST_EVENT_MS,
		phase: 'playing',
		finaleMs: 0
	};
}

export function totalHearts(state: RitualState): number {
	return state.cats.reduce((sum, cat) => sum + catHearts(cat.happiness), 0);
}

export function scoreOf(state: RitualState): number {
	if (state.phase !== 'won') return 0;
	return ritualScore({
		mistakes: state.mistakes,
		hearts: totalHearts(state),
		elapsedMs: state.elapsedMs
	});
}

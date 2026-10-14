/*
 * The state of one ritual, as a plain object the step functions mutate. It holds no randomness of
 * its own: everything random (the cats, the riddle, the seats, the room events) comes from the
 * seed, so a ritual can be replayed exactly.
 */
import { createRandom, type Random } from '#lib/game/random.js';
import { generateCats, RESTING_MOOD, type CatProfile } from './cats';
import { FIRST_EVENT_MS, STARTING_LIVES } from './config';
import { catHearts, ritualScore } from './scoring';
import type { Animation, RoomEvent } from './reactions';
import { assignSeats, generateRiddle, type Riddle } from './riddle';

/** What a cat is doing besides sitting: how it reacts to what happens in the room */
export interface Motion {
	kind: Animation;
	remainingMs: number;
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
	/** A finger is on the cat right now */
	held: boolean;
	/** The keyboard pet is still counting as petting for this much longer */
	keyPetMs: number;
	/** How long the cat has been petted lately; the purr follows it, and it fades when the petting stops */
	petMs: number;
	motion: Motion | null;
	nameShown: boolean;
	pitchShown: boolean;
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
		held: false,
		keyPetMs: 0,
		petMs: 0,
		motion: null,
		nameShown: false,
		pitchShown: false
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

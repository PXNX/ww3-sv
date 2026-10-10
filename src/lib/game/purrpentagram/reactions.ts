/*
 * How the cats take what happens in the room. reaction(cat, event) is the single rule: it says
 * what the cat does (an animation), how much it unsettles or soothes it (a mood change) and how
 * long the animation lasts. The riddle's "reaction" clues are read from the same table, so what
 * the player sees and what the riddle says can never disagree.
 */
import { randomInt, shuffle, type Random } from '#lib/game/random.js';
import type { CatProfile, Personality } from './cats';
import { EVENT_GAP_MAX_MS, EVENT_GAP_MIN_MS } from './config';

export const ROOM_EVENTS = ['candles', 'dim', 'draft', 'thunder', 'laser', 'creak'] as const;
export type RoomEvent = (typeof ROOM_EVENTS)[number];

/** What a cat can do in answer to an event (a tail flick, which only comes from petting, is separate) */
export const ANIMATIONS = ['ignore', 'flinch', 'hide', 'chase', 'hiss', 'stare', 'doze'] as const;
export type Animation = (typeof ANIMATIONS)[number];

export interface Reaction {
	animation: Animation;
	/** Added to the cat's mood; negative upsets it */
	moodDelta: number;
	/** How long the animation plays; a hiding cat stays hidden until it has been calmed */
	durationMs: number;
}

/** How long each event lasts in the room */
export const EVENT_DURATION_MS: Record<RoomEvent, number> = {
	candles: 3200,
	dim: 4600,
	draft: 3600,
	thunder: 2600,
	laser: 5200,
	creak: 2400
};

const ANIMATION_MS: Record<Animation, number> = {
	ignore: 0,
	flinch: 700,
	hide: 2600,
	chase: 4800,
	hiss: 900,
	stare: 1700,
	doze: 3400
};

type Row = Record<RoomEvent, [Animation, number]>;

/** Per personality and event: the animation and the mood change */
const TABLE: Record<Personality, Row> = {
	skittish: {
		candles: ['flinch', -0.15],
		dim: ['flinch', -0.15],
		draft: ['flinch', -0.2],
		thunder: ['hide', -0.5],
		laser: ['flinch', -0.1],
		creak: ['hide', -0.45]
	},
	lazy: {
		candles: ['ignore', 0],
		dim: ['doze', 0.05],
		draft: ['ignore', 0],
		thunder: ['ignore', 0],
		laser: ['ignore', 0],
		creak: ['ignore', 0]
	},
	curious: {
		candles: ['stare', 0.05],
		dim: ['stare', 0.05],
		draft: ['stare', 0.05],
		thunder: ['flinch', -0.1],
		laser: ['chase', 0.1],
		creak: ['stare', 0.05]
	},
	grumpy: {
		candles: ['hiss', -0.12],
		dim: ['ignore', 0],
		draft: ['hiss', -0.2],
		thunder: ['hiss', -0.15],
		laser: ['ignore', 0],
		creak: ['hiss', -0.12]
	},
	regal: {
		candles: ['ignore', 0],
		dim: ['ignore', 0],
		draft: ['ignore', 0],
		thunder: ['stare', 0],
		laser: ['stare', 0],
		creak: ['stare', 0]
	}
};

export function reaction(cat: Pick<CatProfile, 'personality'>, event: RoomEvent): Reaction {
	const [animation, moodDelta] = TABLE[cat.personality][event];
	return {
		animation,
		moodDelta,
		durationMs: animation === 'chase' ? EVENT_DURATION_MS[event] : ANIMATION_MS[animation]
	};
}

/** Whether a motion takes the cat out of reach, so it cannot be picked for the star stroke */
export function blocksSeat(motion: Animation | 'flick' | null): boolean {
	return motion === 'hide' || motion === 'chase';
}

/**
 * The next event from a bag that holds every event once, so the room cycles through all of them
 * before any repeats and a reaction the riddle mentions always comes round again.
 */
export function drawEvent(bag: RoomEvent[], random: Random): RoomEvent {
	if (bag.length === 0) bag.push(...shuffle(random, ROOM_EVENTS));
	return bag.pop()!;
}

export function nextEventGapMs(random: Random): number {
	return randomInt(random, EVENT_GAP_MIN_MS, EVENT_GAP_MAX_MS);
}

/** Where the laser dot is, given how far through its run it is (0 to 1): a lazy zig-zag over the floor */
export function laserPoint(progress: number): { x: number; y: number } {
	const t = Math.min(1, Math.max(0, progress));
	return {
		x: 500 + 330 * Math.sin(t * Math.PI * 3.1 + 0.6),
		y: 510 + 300 * Math.sin(t * Math.PI * 2.3 + 2.1)
	};
}

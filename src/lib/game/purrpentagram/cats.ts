/*
 * The five cats of a ritual. Every cat differs from the others in each trait the riddle can
 * mention (coat, look, name, purr pitch and personality), and exactly one of them is possessed, so
 * any one of those is enough to point at a single cat.
 */
import { shuffle, type Random } from '#lib/game/random.js';
import { CAT_COUNT } from './config';

export const PERSONALITIES = ['skittish', 'lazy', 'curious', 'grumpy', 'regal'] as const;
export type Personality = (typeof PERSONALITIES)[number];

export const COATS = ['black', 'ginger', 'white', 'grey', 'tabby'] as const;
export type Coat = (typeof COATS)[number];

/**
 * How a cat looks apart from its coat, so every cat is easy to tell apart at a glance. The riddle
 * can name it ("the cat in the top hat"); it says nothing about the cat's personality, which has to
 * be found out by watching.
 */
export const QUIRKS = ['fat', 'tophat', 'crazy', 'glasses', 'crown'] as const;
export type Quirk = (typeof QUIRKS)[number];

/** Names on the cats' tags; they are the same in every language */
export const CAT_NAMES = [
	'Mochi',
	'Pumpkin',
	'Smokey',
	'Biscuit',
	'Luna',
	'Pepper',
	'Ember',
	'Misty',
	'Clover',
	'Nova',
	'Ziggy',
	'Tofu'
] as const;

export interface CatProfile {
	/** Index in the roster, 0 to 4 */
	id: number;
	name: string;
	coat: Coat;
	personality: Personality;
	quirk: Quirk;
	/** A spirit has taken this cat: glowing red eyes and a dark aura; exactly one cat in the room */
	possessed: boolean;
	/** 0 for the deepest purr to 4 for the highest; every cat has a different one */
	purrRank: number;
}

/** A cat's purr pitch in Hz: each rank is a little over a major third above the one below */
export function purrFrequency(rank: number): number {
	return 55 * Math.pow(1.27, rank);
}

/** How settled a cat is when nothing has happened: the grumpy one starts out closest to hissing */
export const RESTING_MOOD: Record<Personality, number> = {
	skittish: 0.7,
	lazy: 0.85,
	curious: 0.8,
	grumpy: 0.6,
	regal: 0.75
};

export function generateCats(random: Random): CatProfile[] {
	const names = shuffle(random, CAT_NAMES).slice(0, CAT_COUNT);
	const coats = shuffle(random, COATS);
	const personalities = shuffle(random, PERSONALITIES);
	const quirks = shuffle(random, QUIRKS);
	const ranks = shuffle(
		random,
		Array.from({ length: CAT_COUNT }, (_, rank) => rank)
	);
	const possessed = Math.floor(random() * CAT_COUNT);
	return names.map((name, id) => ({
		id,
		name,
		coat: coats[id],
		personality: personalities[id],
		quirk: quirks[id],
		possessed: id === possessed,
		purrRank: ranks[id]
	}));
}

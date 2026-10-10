/*
 * The riddle: five clues, one per step of the ritual, each pointing at exactly one cat. The
 * clues are facts the player can find out in the room: the coat they see, the name on a tag a
 * happy cat shows, how deep its purr is (heard, and shown once the cat is happy) and how it reacts
 * to what happens in the room. validateRiddle() checks the whole thing, so a generated riddle can
 * never be ambiguous, and isSolved() is the single test for "the ritual is right".
 */
import { pickOne, shuffle, type Random } from '#lib/game/random.js';
import type { CatProfile, Coat, Personality } from './cats';
import { CAT_COUNT } from './config';
import { starSeat } from './geometry';
import { reaction, type Animation, type RoomEvent } from './reactions';

export const TRAIT_IDS = [
	'hides-thunder',
	'dozes-dim',
	'chases-laser',
	'hisses-draft',
	'stares-laser'
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

/** The event and reaction each trait clue talks about */
export const TRAITS: Record<TraitId, { event: RoomEvent; animation: Animation }> = {
	'hides-thunder': { event: 'thunder', animation: 'hide' },
	'dozes-dim': { event: 'dim', animation: 'doze' },
	'chases-laser': { event: 'laser', animation: 'chase' },
	'hisses-draft': { event: 'draft', animation: 'hiss' },
	'stares-laser': { event: 'laser', animation: 'stare' }
};

/** The one trait clue that picks out each personality */
export const TRAIT_OF: Record<Personality, TraitId> = {
	skittish: 'hides-thunder',
	lazy: 'dozes-dim',
	curious: 'chases-laser',
	grumpy: 'hisses-draft',
	regal: 'stares-laser'
};

export type Clue =
	| { kind: 'coat'; coat: Coat }
	| { kind: 'name'; name: string }
	/** 0 for the deepest purr of the five, 4 for the highest */
	| { kind: 'purr'; rank: number }
	| { kind: 'trait'; trait: TraitId };

export type ClueKind = Clue['kind'];
export const CLUE_KINDS: readonly ClueKind[] = ['coat', 'name', 'purr', 'trait'];

export interface Riddle {
	/** Clue k points at the cat that is joined k-th in the ritual */
	clues: Clue[];
	/** Cat ids in ritual order */
	target: number[];
}

/** How many of the cats purr deeper than this one: its place in the pitch order, from 0 */
function purrPlace(cat: CatProfile, cats: readonly CatProfile[]): number {
	return cats.filter((other) => other.purrRank < cat.purrRank).length;
}

/** Does this clue describe the cat? The purr clue is relative to the cats in the room. */
export function catMatchesClue(cat: CatProfile, clue: Clue, cats: readonly CatProfile[]): boolean {
	switch (clue.kind) {
		case 'coat':
			return cat.coat === clue.coat;
		case 'name':
			return cat.name === clue.name;
		case 'purr':
			return purrPlace(cat, cats) === clue.rank;
		case 'trait': {
			const { event, animation } = TRAITS[clue.trait];
			return reaction(cat, event).animation === animation;
		}
	}
}

/** Ids of every cat the clue describes; a good clue describes exactly one */
export function cluePointsAt(clue: Clue, cats: readonly CatProfile[]): number[] {
	return cats.filter((cat) => catMatchesClue(cat, clue, cats)).map((cat) => cat.id);
}

function clueFor(kind: ClueKind, cat: CatProfile, cats: readonly CatProfile[]): Clue {
	switch (kind) {
		case 'coat':
			return { kind, coat: cat.coat };
		case 'name':
			return { kind, name: cat.name };
		case 'purr':
			return { kind, rank: purrPlace(cat, cats) };
		case 'trait':
			return { kind, trait: TRAIT_OF[cat.personality] };
	}
}

/**
 * A fresh riddle: the cats are put in a random ritual order and each step gets a clue of its own
 * kind, with every kind used at least once so the player has to pet, listen and watch.
 */
export function generateRiddle(cats: readonly CatProfile[], random: Random): Riddle {
	const target = shuffle(
		random,
		cats.map((cat) => cat.id)
	);
	const kinds = shuffle(random, [...CLUE_KINDS, pickOne(random, CLUE_KINDS)]);
	const clues = target.map((id, step) => clueFor(kinds[step], cats[id], cats));
	return { clues, target };
}

/** Everything that is wrong with a riddle; an empty list means it can be solved in exactly one way */
export function validateRiddle(cats: readonly CatProfile[], riddle: Riddle): string[] {
	const problems: string[] = [];
	if (cats.length !== CAT_COUNT) problems.push(`needs ${CAT_COUNT} cats`);
	if (riddle.clues.length !== cats.length) problems.push('needs one clue per cat');
	if (riddle.target.length !== cats.length) problems.push('needs one target per cat');
	if (new Set(riddle.target).size !== riddle.target.length) problems.push('a cat is visited twice');

	riddle.clues.forEach((clue, step) => {
		const pointsAt = cluePointsAt(clue, cats);
		if (pointsAt.length !== 1) problems.push(`clue ${step + 1} points at ${pointsAt.length} cats`);
		else if (pointsAt[0] !== riddle.target[step]) {
			problems.push(`clue ${step + 1} points at the wrong cat`);
		}
	});
	return problems;
}

/** The ritual is right when the cats were joined in exactly the target order */
export function isSolved(order: readonly number[], target: readonly number[]): boolean {
	return order.length === target.length && order.every((id, step) => id === target[step]);
}

/**
 * Which seat each cat sits on, so that the cats in ritual order sit on consecutive points of a
 * star walk; drawing the ritual correctly therefore draws a pentagram. The start and direction
 * are random so the star does not always begin at the top.
 */
export function assignSeats(target: readonly number[], random: Random): number[] {
	const start = Math.floor(random() * CAT_COUNT);
	const direction = random() < 0.5 ? 1 : -1;
	const seatOf: number[] = [];
	target.forEach((id, step) => {
		seatOf[id] = starSeat(start, direction, step);
	});
	return seatOf;
}

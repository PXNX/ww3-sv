/*
 * Pacts: the one risk-and-reward choice made before a ritual begins. Every pact is a boon with a
 * curse, and changes the score the ritual pays out by a multiplier.
 */
import { STARTING_LIVES } from './config';

export const PACTS = ['none', 'mercy', 'shadows', 'plenty'] as const;
export type PactId = (typeof PACTS)[number];

export interface Pact {
	lives: number;
	treats: number;
	/** Multiplies the time between room events: below 1 the room is more restless */
	eventGap: number;
	/** Multiplies the final score */
	scoreFactor: number;
}

export const PACT_TABLE: Record<PactId, Pact> = {
	none: { lives: STARTING_LIVES, treats: 1, eventGap: 1, scoreFactor: 1 },
	// A forgiving ritual: one more life, no treats, and a smaller reward
	mercy: { lives: STARTING_LIVES + 1, treats: 0, eventGap: 1, scoreFactor: 0.85 },
	// The room is restless: events come sooner, and the reward is bigger
	shadows: { lives: STARTING_LIVES, treats: 1, eventGap: 0.65, scoreFactor: 1.3 },
	// Many treats to buy hearts with, but the cats forgive only one slip less
	plenty: { lives: STARTING_LIVES - 1, treats: 4, eventGap: 1, scoreFactor: 1 }
};

export function isPact(value: unknown): value is PactId {
	return typeof value === 'string' && (PACTS as readonly string[]).includes(value);
}

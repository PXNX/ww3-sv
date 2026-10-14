/*
 * The phone call: every so often the vault phone rings and the banker's assistant shuffles a few
 * face-down cards. Only cards lying face down move; the pair the player is looking at stays put.
 */
import { randomInt, shuffle, type Random } from '../random.js';
import {
	PHONE_DELAY_FLOOR_MS,
	PHONE_DELAY_MS,
	PHONE_DELAY_STEP_MS,
	PHONE_FIRST_MIN_MS,
	SHUFFLE_MAX,
	SHUFFLE_MIN
} from './config.js';
import type { Card } from './deck.js';

/** Milliseconds until the next call, a random delay that shrinks with the level */
export function nextPhoneDelay(level: number, random: Random, first = false): number {
	const shrink = Math.max(0, level - 1) * PHONE_DELAY_STEP_MS;
	const min = Math.max(PHONE_DELAY_FLOOR_MS, PHONE_DELAY_MS.min - shrink);
	const max = Math.max(min, PHONE_DELAY_MS.max - shrink);
	const delay = randomInt(random, min, max + 1);
	return first ? Math.max(PHONE_FIRST_MIN_MS, delay) : delay;
}

/** How many cards one call moves: 2 on level 1, one more every level, at most 8 */
export function shuffleCount(level: number): number {
	return Math.min(SHUFFLE_MAX, SHUFFLE_MIN + Math.max(0, Math.floor(level) - 1));
}

/**
 * Shuffles the symbols of up to `count` random face-down cards among their slots and returns the
 * slots that really changed their symbol, in ascending order (empty when there is nothing to
 * shuffle). The cards' ids and states stay with their slots, so the cards never visibly jump.
 * A shuffle never leaves everything as it was unless all chosen cards show the same symbol.
 */
export function shuffleFaceDown(cards: Card[], count: number, random: Random): number[] {
	const down = cards.flatMap((card, index) => (card.state === 'down' ? [index] : []));
	if (down.length < 2 || count < 2) return [];

	const slots = shuffle(random, down).slice(0, Math.min(count, down.length));
	const before = slots.map((slot) => cards[slot].symbol);
	if (before.every((symbol) => symbol === before[0])) return [];

	let after = shuffle(random, before);
	// A shuffle may land on the same arrangement: rotate by one distinct symbol to force a change
	if (after.every((symbol, i) => symbol === before[i])) {
		const swapWith = before.findIndex((symbol) => symbol !== before[0]);
		after = [...before];
		[after[0], after[swapWith]] = [after[swapWith], after[0]];
	}

	const moved: number[] = [];
	slots.forEach((slot, i) => {
		if (cards[slot].symbol !== after[i]) moved.push(slot);
		cards[slot].symbol = after[i];
	});
	return moved.sort((a, b) => a - b);
}

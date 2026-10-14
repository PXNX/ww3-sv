/*
 * Pure rules of Gold & Cheese Vault: flipping cards, matching, the banker's eyebrows, the phone
 * that shuffles face-down cards, and levels with growing grids. The store drives it with flipCard
 * (player input) and stepGame (time); both return events for the effects and sounds.
 */
import type { Random } from '../random.js';
import {
	CALM_STREAK,
	EYEBROWS_PER_HEART,
	LEVEL_CLEAR_MS,
	POINTS_FLAWLESS,
	POINTS_LEVEL,
	POINTS_PAIR,
	POINTS_SPECIAL,
	POINTS_STREAK_MAX,
	POINTS_STREAK_STEP,
	REVEAL_MIN_MS,
	REVEAL_MS,
	REVEAL_STEP_MS,
	RING_MS,
	STARTING_LIVES
} from './config.js';
import { buildDeck, levelConfig, type Card } from './deck.js';
import { nextPhoneDelay, shuffleCount, shuffleFaceDown } from './phone.js';
import { matchResult } from './symbols.js';

export type VaultPhase = 'play' | 'clearing' | 'over';

export interface VaultState {
	phase: VaultPhase;
	level: number;
	cols: number;
	rows: number;
	cards: Card[];
	/** Indices of the face-up cards that are not matched yet, at most two */
	selected: number[];
	score: number;
	lives: number;
	/** Banker's raised eyebrows since the last heart or the start of the level, 0 to 2 */
	eyebrows: number;
	/** Matches in a row */
	streak: number;
	/** Mismatches in the current level, for the flawless bonus */
	mismatches: number;
	levelsCleared: number;
	specialPairs: number;
	/** Milliseconds until a mismatched pair flips back; 0 when no pair is waiting */
	hideMs: number;
	/** Milliseconds until the phone rings; counts down while the phone is quiet */
	phoneMs: number;
	/** Milliseconds the phone has left to ring before the shuffle; 0 when it is quiet */
	ringMs: number;
	clearMs: number;
}

export type VaultEvent =
	| { type: 'flip'; index: number }
	| { type: 'match'; indices: [number, number]; special: boolean; points: number; streak: number }
	| { type: 'mismatch'; indices: [number, number]; eyebrows: number; heartLost: boolean }
	| { type: 'calm'; eyebrows: number }
	| { type: 'unflip'; indices: number[] }
	| { type: 'ring' }
	| { type: 'shuffle'; indices: number[] }
	| { type: 'level-clear'; level: number; bonus: number; flawless: boolean }
	| { type: 'level'; level: number }
	| { type: 'game-over' };

/** Milliseconds a mismatched pair stays visible on a level */
export function revealMs(level: number): number {
	return Math.max(REVEAL_MIN_MS, REVEAL_MS - Math.max(0, level - 1) * REVEAL_STEP_MS);
}

/** Points for a match: more for a longer streak, much more for the special pair */
export function matchPoints(special: boolean, streak: number): number {
	const bonus = Math.min(POINTS_STREAK_MAX, Math.max(0, streak - 1) * POINTS_STREAK_STEP);
	return (special ? POINTS_SPECIAL : POINTS_PAIR) + bonus;
}

/** Cards that are still in play (not matched yet) */
export function cardsLeft(state: VaultState): number {
	return state.cards.filter((card) => card.state !== 'matched').length;
}

function fillLevel(state: VaultState, level: number, random: Random, first: boolean) {
	const config = levelConfig(level);
	state.level = config.level;
	state.cols = config.cols;
	state.rows = config.rows;
	state.cards = buildDeck(config.level, random);
	state.selected = [];
	state.eyebrows = 0;
	state.streak = 0;
	state.mismatches = 0;
	state.hideMs = 0;
	state.ringMs = 0;
	state.clearMs = 0;
	state.phoneMs = nextPhoneDelay(config.level, random, first);
	state.phase = 'play';
}

export function createGame(random: Random): VaultState {
	const state = {
		score: 0,
		lives: STARTING_LIVES,
		levelsCleared: 0,
		specialPairs: 0
	} as VaultState;
	fillLevel(state, 1, random, true);
	return state;
}

/** The player flips the card at an index; ignored while the board is locked */
export function flipCard(state: VaultState, index: number): VaultEvent[] {
	const card = state.cards[index];
	if (!card || state.phase !== 'play' || state.hideMs > 0) return [];
	if (card.state !== 'down' || state.selected.length >= 2) return [];

	card.state = 'up';
	state.selected.push(index);
	const events: VaultEvent[] = [{ type: 'flip', index }];
	if (state.selected.length < 2) return events;

	const [a, b] = state.selected as [number, number];
	const result = matchResult(state.cards[a].symbol, state.cards[b].symbol);
	if (result) {
		state.cards[a].state = 'matched';
		state.cards[b].state = 'matched';
		state.selected = [];
		state.streak += 1;
		const special = result === 'special';
		const points = matchPoints(special, state.streak);
		state.score += points;
		if (special) state.specialPairs += 1;
		events.push({ type: 'match', indices: [a, b], special, points, streak: state.streak });
		if (state.streak % CALM_STREAK === 0 && state.eyebrows > 0) {
			state.eyebrows -= 1;
			events.push({ type: 'calm', eyebrows: state.eyebrows });
		}
		if (cardsLeft(state) === 0) events.push(clearLevel(state));
		return events;
	}

	state.streak = 0;
	state.mismatches += 1;
	state.eyebrows += 1;
	const heartLost = state.eyebrows >= EYEBROWS_PER_HEART;
	if (heartLost) {
		state.eyebrows = 0;
		state.lives -= 1;
	}
	events.push({ type: 'mismatch', indices: [a, b], eyebrows: state.eyebrows, heartLost });
	if (state.lives <= 0) {
		state.phase = 'over';
		state.ringMs = 0;
		events.push({ type: 'game-over' });
	} else {
		state.hideMs = revealMs(state.level);
	}
	return events;
}

function clearLevel(state: VaultState): VaultEvent {
	const flawless = state.mismatches === 0;
	const bonus = POINTS_LEVEL * state.level + (flawless ? POINTS_FLAWLESS : 0);
	state.score += bonus;
	state.levelsCleared += 1;
	state.phase = 'clearing';
	state.clearMs = LEVEL_CLEAR_MS;
	state.ringMs = 0;
	return { type: 'level-clear', level: state.level, bonus, flawless };
}

/** Advances time: mismatched cards flip back, the phone rings and shuffles, the next vault opens */
export function stepGame(state: VaultState, dtMs: number, random: Random): VaultEvent[] {
	const events: VaultEvent[] = [];
	if (state.phase === 'over' || !(dtMs > 0)) return events;

	if (state.phase === 'clearing') {
		state.clearMs -= dtMs;
		if (state.clearMs <= 0) {
			fillLevel(state, state.level + 1, random, false);
			events.push({ type: 'level', level: state.level });
		}
		return events;
	}

	if (state.hideMs > 0) {
		state.hideMs -= dtMs;
		if (state.hideMs <= 0) {
			state.hideMs = 0;
			const indices = state.selected;
			for (const index of indices) state.cards[index].state = 'down';
			state.selected = [];
			events.push({ type: 'unflip', indices });
		}
	}

	if (state.ringMs > 0) {
		state.ringMs -= dtMs;
		if (state.ringMs <= 0) {
			state.ringMs = 0;
			const indices = shuffleFaceDown(state.cards, shuffleCount(state.level), random);
			state.phoneMs = nextPhoneDelay(state.level, random);
			events.push({ type: 'shuffle', indices });
		}
	} else {
		state.phoneMs -= dtMs;
		if (state.phoneMs <= 0) {
			state.phoneMs = 0;
			state.ringMs = RING_MS;
			events.push({ type: 'ring' });
		}
	}
	return events;
}

/*
 * Chip Fab Rush rules: one run is a series of levels, each with Stage A (wafer stacker) followed
 * by Stage B (RAM merge). The wafer's quality decides how many modules Stage B gets. The shortage
 * meter runs throughout; when it fills up a heart is lost, and with no hearts left the run ends.
 *
 * Every level is a customer order (Novideo or OpenAI) and every level after the first opens with a
 * BREAKING news card that bends the rules for that level: faster shortage, wider perfect window,
 * golden HBM layers, spare hearts. Small events also fire inside a level so it never goes quiet.
 * The state is a plain mutable object that the view reads; stepping it returns events.
 */
import type { Direction } from '../merge/mergeBoard';
import type { Random } from '../random';
import {
	GOLD_RELIEF,
	LEVEL_BONUS,
	LOCK_MS,
	MICRO_MAX_MS,
	MICRO_MIN_MS,
	PERFECT_MERGE_BONUS,
	PERFECT_MERGE_MAX,
	STARTING_LIVES,
	WAFER_BONUS,
	CARD_MS
} from './config';
import {
	BASE_MODIFIERS,
	applyCard,
	drawCard,
	drawMicroEvent,
	type CardId,
	type EventCard,
	type Modifiers,
	type MicroKind
} from './events';
import {
	ORDER_PENALTY,
	ORDER_RELIEF,
	orderFor,
	orderMet,
	type Order
} from './orders';
import { createRam, isRamDone, moveRam, type MergeEvent, type RamState } from './ram';
import {
	HEART_RESET,
	PERFECT_RELIEF,
	WAFER_RELIEF,
	applyRelief,
	clampShortage,
	isShortageFull,
	reliefForTier,
	tickShortage
} from './shortage';
import {
	createStacker,
	dropSlab,
	stackedLayers,
	stepStacker,
	waferOutput,
	type DropKind,
	type Layer,
	type StackerState
} from './stacker';

export type Stage = 'stack' | 'merge';

/** Hearts a subsidy card can raise the bar to */
export const MAX_LIVES = 5;

export interface ChipFabState {
	level: number;
	stage: Stage;
	lives: number;
	score: number;
	/** The shortage meter, 0 to 100 */
	shortage: number;
	/** Milliseconds spent in this level, which makes the shortage rise a little faster */
	levelMs: number;
	/** Input and the clock are frozen while this is above zero (right after a stage change) */
	lockMs: number;
	stacker: StackerState;
	/** The module board; only meaningful in the merge stage */
	ram: RamState;
	levelsCleared: number;
	/** The biggest module tier made in the whole run */
	highestTier: number;
	over: boolean;
	/** This level's news card, if one was drawn; it bends the level's rules */
	card: EventCard | null;
	/** How long the news card stays on screen and input stays locked */
	cardMs: number;
	/** Cards already used this run, so the deck does not repeat before it is empty */
	usedCards: CardId[];
	/** The modifiers for the current level, from its card */
	mods: Modifiers;
	/** The customer order this level has to fulfil */
	order: Order;
	/** Best module tier made in this level, for the order */
	bestTier: number;
	/** Most merges in one move in this level, for the order */
	bestCombo: number;
	/** Points multiplier for Stage B, earned by perfect layers in Stage A */
	mergeBonus: number;
	/** Milliseconds until the next small event */
	microMs: number;
	/** Random source for the small events inside a level */
	microRandom: Random;
}

export type ChipFabEvent =
	| {
			type: 'drop';
			kind: DropKind;
			points: number;
			cut: Layer | null;
			streak: number;
			layer: number;
			gold: boolean;
	  }
	| {
			type: 'wafer';
			layers: number;
			perfects: number;
			goldPerfects: number;
			supply: number;
			finished: boolean;
	  }
	| {
			type: 'merge';
			/** The biggest module made by this move */
			tier: number;
			relief: number;
			count: number;
			points: number;
			/** Merges in this single move, for combo orders and toasts */
			combo: number;
			merges: MergeEvent[];
	  }
	| { type: 'slide' }
	| { type: 'stage'; stage: Stage }
	| { type: 'level'; level: number }
	| { type: 'card'; card: EventCard }
	| { type: 'order'; order: Order }
	| { type: 'order-done'; order: Order; bonus: number }
	| { type: 'order-missed'; order: Order }
	| { type: 'micro'; kind: MicroKind; shortage: number; points: number }
	| { type: 'shortage-hit'; lives: number }
	| { type: 'game-over' };

function nextMicroMs(random: Random): number {
	return MICRO_MIN_MS + random() * (MICRO_MAX_MS - MICRO_MIN_MS);
}

function stackerFor(random: Random, level: number, mods: Modifiers): StackerState {
	return createStacker(random, level, {
		goldChance: mods.goldChance,
		toleranceScale: mods.tolerance,
		speedScale: mods.slabSpeed,
		widthBonus: mods.waferWidth
	});
}

export function createGame(random: Random): ChipFabState {
	return {
		level: 1,
		stage: 'stack',
		lives: STARTING_LIVES,
		score: 0,
		shortage: 0,
		levelMs: 0,
		lockMs: 0,
		stacker: stackerFor(random, 1, BASE_MODIFIERS),
		ram: createRam(random, 0, 0),
		levelsCleared: 0,
		highestTier: 0,
		over: false,
		card: null,
		cardMs: 0,
		usedCards: [],
		mods: BASE_MODIFIERS,
		order: orderFor(1, random),
		bestTier: 0,
		bestCombo: 0,
		mergeBonus: 1,
		microMs: nextMicroMs(random),
		microRandom: random
	};
}

/** Shortage as a whole percentage, for the HUD */
export function shortagePercent(state: ChipFabState): number {
	return Math.round(state.shortage);
}

function relieve(state: ChipFabState, amount: number) {
	state.shortage = applyRelief(state.shortage, amount);
}

/** When the meter is full a heart is lost and it falls back; the last heart ends the run */
function resolveShortage(state: ChipFabState, events: ChipFabEvent[]) {
	if (state.over || !isShortageFull(state.shortage)) return;
	state.lives -= 1;
	events.push({ type: 'shortage-hit', lives: state.lives });
	if (state.lives <= 0) {
		state.lives = 0;
		state.over = true;
		events.push({ type: 'game-over' });
	} else {
		state.shortage = HEART_RESET;
	}
}

/** Advances the clock by one fixed step: the shortage rises and the layer in Stage A slides */
export function stepGame(state: ChipFabState, dtMs: number): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over) return events;
	if (state.cardMs > 0) state.cardMs = Math.max(0, state.cardMs - dtMs);
	if (state.lockMs > 0) {
		state.lockMs = Math.max(0, state.lockMs - dtMs);
		return events;
	}
	state.levelMs += dtMs;
	state.shortage = tickShortage(
		state.shortage,
		dtMs,
		state.level,
		state.levelMs / 1000,
		state.mods.shortageRate
	);
	if (state.stage === 'stack') state.stacker = stepStacker(state.stacker, dtMs);
	resolveShortage(state, events);
	if (state.over) return events;

	state.microMs -= dtMs;
	if (state.microMs <= 0) {
		const micro = drawMicroEvent(state.microRandom);
		state.shortage = clampShortage(state.shortage + micro.shortage);
		state.score += micro.points;
		events.push({
			type: 'micro',
			kind: micro.kind,
			shortage: micro.shortage,
			points: micro.points
		});
		state.microMs = nextMicroMs(state.microRandom);
		resolveShortage(state, events);
	}
	return events;
}

/** Lets the player tap the news card away instead of waiting the whole three seconds */
export function skipCard(state: ChipFabState) {
	if (state.cardMs <= 0) return;
	state.cardMs = 0;
	state.lockMs = 0;
}

function startMerge(state: ChipFabState, random: Random, events: ChipFabEvent[]) {
	const output = waferOutput(state.stacker);
	state.ram = createRam(random, output.supply + state.mods.supply, output.quality);
	state.mergeBonus =
		1 + Math.min(PERFECT_MERGE_MAX, PERFECT_MERGE_BONUS * state.stacker.perfects);
	state.stage = 'merge';
	state.lockMs = LOCK_MS;
	events.push({ type: 'stage', stage: 'merge' });
}

/** Settles the level's order, pays the level bonus and opens the next level with a news card */
function finishLevel(state: ChipFabState, random: Random, events: ChipFabEvent[]) {
	const met = orderMet(state.order, state.bestTier, state.bestCombo);
	if (met) {
		state.score += state.order.reward;
		relieve(state, ORDER_RELIEF);
		events.push({ type: 'order-done', order: state.order, bonus: state.order.reward });
	} else {
		state.shortage = clampShortage(state.shortage + ORDER_PENALTY);
		events.push({ type: 'order-missed', order: state.order });
	}

	state.levelsCleared += 1;
	state.score += LEVEL_BONUS * state.level;
	state.level += 1;
	state.levelMs = 0;
	state.bestTier = 0;
	state.bestCombo = 0;

	// A fresh card for every level after the first; it bends this level only
	const card = drawCard(random, state.usedCards);
	state.card = card;
	state.usedCards = [...state.usedCards, card.id];
	state.mods = applyCard(BASE_MODIFIERS, card);
	// One-off effects of the card land right away and are not applied again
	if (card.mods.lives) state.lives = Math.min(MAX_LIVES, state.lives + card.mods.lives);
	if (card.mods.score) state.score += card.mods.score;
	if (card.mods.shortage) state.shortage = clampShortage(state.shortage + card.mods.shortage);
	state.mods = { ...state.mods, lives: 0, score: 0, shortage: 0 };

	state.stacker = stackerFor(random, state.level, state.mods);
	state.stage = 'stack';
	state.cardMs = CARD_MS;
	state.lockMs = CARD_MS;
	state.microMs = nextMicroMs(random);
	state.order = orderFor(state.level, random);

	events.push(
		{ type: 'card', card },
		{ type: 'level', level: state.level },
		{ type: 'order', order: state.order },
		{ type: 'stage', stage: 'stack' }
	);
}

/** Drops the sliding layer in Stage A; ignored in any other situation */
export function dropLayer(state: ChipFabState, random: Random): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over || state.lockMs > 0 || state.stage !== 'stack') return events;
	if (state.stacker.status !== 'running') return events;

	const result = dropSlab(state.stacker, random);
	state.stacker = result.state;
	state.score += Math.round(result.points * state.mods.points);
	if (result.kind === 'perfect') {
		relieve(state, PERFECT_RELIEF + (result.gold ? GOLD_RELIEF : 0));
	}
	events.push({
		type: 'drop',
		kind: result.kind,
		points: result.points,
		cut: result.cut,
		streak: state.stacker.streak,
		layer: stackedLayers(state.stacker),
		gold: result.gold
	});

	if (result.complete || state.stacker.status === 'failed') {
		const finished = result.complete;
		if (finished) {
			state.score += WAFER_BONUS;
			relieve(state, WAFER_RELIEF);
		}
		const output = waferOutput(state.stacker);
		events.push({
			type: 'wafer',
			layers: stackedLayers(state.stacker),
			perfects: state.stacker.perfects,
			goldPerfects: state.stacker.goldPerfects,
			supply: output.supply + state.mods.supply,
			finished
		});
		startMerge(state, random, events);
	}
	return events;
}

/** Slides the memory modules in Stage B; ignored in any other situation */
export function moveModules(
	state: ChipFabState,
	direction: Direction,
	random: Random
): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over || state.lockMs > 0 || state.stage !== 'merge') return events;

	const outcome = moveRam(state.ram, direction, random);
	if (!outcome.changed) return events;
	state.ram = outcome.state;
	const points = Math.round(outcome.points * state.mods.points * state.mergeBonus);
	state.score += points;
	state.highestTier = Math.max(state.highestTier, state.ram.highestTier);
	state.bestTier = Math.max(state.bestTier, state.ram.highestTier);
	state.bestCombo = Math.max(state.bestCombo, outcome.merges.length);

	if (outcome.merges.length === 0) events.push({ type: 'slide' });
	let relief = 0;
	for (const merge of outcome.merges) relief += reliefForTier(merge.tier);
	relieve(state, relief);
	if (outcome.merges.length > 0) {
		events.push({
			type: 'merge',
			tier: bestMerge(outcome.merges),
			relief,
			count: outcome.merges.length,
			points,
			combo: outcome.merges.length,
			merges: outcome.merges
		});
	}

	if (isRamDone(state.ram)) finishLevel(state, random, events);
	return events;
}

function bestMerge(merges: readonly MergeEvent[]): number {
	return merges.reduce((best, merge) => Math.max(best, merge.tier), 0);
}

/*
 * Chip Fab Rush event deck. Between two levels a "BREAKING" news card lands and bends the next
 * level: export controls make the shortage climb faster, an AI boom pays more points, a subsidy
 * buys a spare heart, a smuggled EUV machine widens the perfect window, and so on. Every card is
 * a modifier on top of the base level rules, so one card can never cancel another out of order.
 * The deck is pure and seeded: a card is drawn from the ones not used yet this run.
 */
import { pickWeighted, type Random } from '../random';

export type CardId =
	| 'export-controls'
	| 'ai-boom'
	| 'earthquake'
	| 'water-shortage'
	| 'gpu-launch'
	| 'datacenter-fire'
	| 'subsidy'
	| 'smuggled-euv'
	| 'power-flicker'
	| 'talent-war'
	| 'memory-glut'
	| 'sold-out'
	| 'tariff'
	| 'heat-wave';

export interface Modifiers {
	/** Multiplies the shortage rise */
	shortageRate: number;
	/** Multiplies the stacker's perfect window */
	tolerance: number;
	/** Multiplies the sliding speed of a wafer layer */
	slabSpeed: number;
	/** Multiplies points from layers and merges */
	points: number;
	/** Added to the width of the base layer before a level */
	waferWidth: number;
	/** Chance that a sliding layer is a golden HBM layer */
	goldChance: number;
	/** Extra modules for Stage B on top of the wafer's output */
	supply: number;
	/** Extra hearts, granted once when the card lands */
	lives: number;
	/** Free score when the card lands */
	score: number;
	/** Shortage added when the card lands */
	shortage: number;
}

export const BASE_MODIFIERS: Modifiers = {
	shortageRate: 1,
	tolerance: 1,
	slabSpeed: 1,
	points: 1,
	waferWidth: 0,
	goldChance: 0,
	supply: 0,
	lives: 0,
	score: 0,
	shortage: 0
};

export interface EventCard {
	id: CardId;
	/** The part of the modifiers this card changes */
	mods: Partial<Modifiers>;
}

/**
 * The deck. Numbers lean generous: a run should feel like the news is mostly on the player's
 * side, with a couple of nasty headlines to keep the shortage meter meaningful.
 */
export const EVENT_DECK: readonly EventCard[] = [
	{ id: 'export-controls', mods: { shortageRate: 1.3, supply: 6 } },
	{ id: 'ai-boom', mods: { points: 1.25, shortageRate: 1.15 } },
	{ id: 'earthquake', mods: { waferWidth: -8, score: 150 } },
	{ id: 'water-shortage', mods: { shortageRate: 1.2, shortage: 12, supply: 4 } },
	{ id: 'gpu-launch', mods: { points: 1.15, score: 200 } },
	{ id: 'datacenter-fire', mods: { supply: 10, shortage: 18 } },
	{ id: 'subsidy', mods: { lives: 1 } },
	{ id: 'smuggled-euv', mods: { tolerance: 1.8, slabSpeed: 0.85 } },
	{ id: 'power-flicker', mods: { slabSpeed: 1.35, points: 1.1 } },
	{ id: 'talent-war', mods: { points: 1.3, shortageRate: 1.1 } },
	{ id: 'memory-glut', mods: { supply: 12, points: 0.85 } },
	{ id: 'sold-out', mods: { goldChance: 0.5, points: 1.1 } },
	{ id: 'tariff', mods: { shortageRate: 1.25, score: 250 } },
	{ id: 'heat-wave', mods: { waferWidth: -6, tolerance: 1.25, shortageRate: 1.15 } }
];

/** The whole deck lasts two runs' worth of levels, so a deck never empties before a deep run */
export function drawCard(random: Random, used: readonly CardId[]): EventCard {
	const pool = EVENT_DECK.filter((card) => !used.includes(card.id));
	const source = pool.length > 0 ? pool : EVENT_DECK;
	const chosen = pickWeighted(
		random,
		source.map((card) => ({ item: card, weight: 1 }))
	);
	return chosen;
}

/** A card's modifiers applied on top of the ones already running */
export function applyCard(base: Modifiers, card: EventCard): Modifiers {
	const next: Modifiers = { ...base };
	for (const key of Object.keys(card.mods) as (keyof Modifiers)[]) {
		const value = card.mods[key];
		if (value === undefined) continue;
		if (key === 'supply' || key === 'lives' || key === 'score' || key === 'shortage' || key === 'waferWidth') {
			next[key] = base[key] + value;
		} else {
			next[key] = base[key] * value;
		}
	}
	return next;
}

/** Modifiers after a whole level's cards have landed in order */
export function withCards(base: Modifiers, cards: readonly EventCard[]): Modifiers {
	return cards.reduce((mods, card) => applyCard(mods, card), base);
}

/**
 * Small events that happen inside a level, so the run never goes quiet: a brownout spikes the
 * shortage, the boss posts a boast that calms the market, a rival fabs a batch and floods it.
 */
export type MicroKind = 'brownout' | 'boast' | 'rival-batch';

export interface MicroEvent {
	kind: MicroKind;
	/** Shortage points added (positive) or removed (negative) */
	shortage: number;
	/** Free points */
	points: number;
}

export const MICRO_EVENTS: readonly MicroEvent[] = [
	{ kind: 'brownout', shortage: 6, points: 0 },
	{ kind: 'boast', shortage: -7, points: 25 },
	{ kind: 'rival-batch', shortage: -4, points: 60 }
];

export function drawMicroEvent(random: Random): MicroEvent {
	return pickWeighted(
		random,
		MICRO_EVENTS.map((event) => ({
			item: event,
			weight: event.kind === 'brownout' ? 2 : 1
		}))
	);
}

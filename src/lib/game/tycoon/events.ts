/*
 * Random crises: a scheduler that waits a seeded, random while between crises, starts one that
 * fits the situation, gives the player a few seconds to decide, and applies the outcome. Only one
 * crisis (or its after-effects) is ever going on at a time.
 */
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';
import {
	EVENT_DECISION_MS,
	EVENT_FIRST_MAX_MS,
	EVENT_FIRST_MIN_MS,
	EVENT_GAP_MAX_MS,
	EVENT_GAP_MIN_MS,
	EVENT_RETRY_MS,
	PIPELINE_FIX_MS,
	PIPELINE_FIX_MULT,
	PIPELINE_LEAK_CHANCE,
	PIPELINE_LEAK_MS,
	PIPELINE_LEAK_MULT,
	PRODUCERS,
	PROTEST_GREENWASH_SECONDS,
	PROTEST_MS,
	PROTEST_MULT,
	SANCTION_CUT_MS,
	SANCTION_REFLAG_SECONDS,
	SPIKE_BOOM_CHANCE,
	SPIKE_BOOM_MULT,
	SPIKE_CRASH_MULT,
	SPIKE_EFFECT_MS,
	SPIKE_SELL_SECONDS,
	type ProducerId
} from './config.js';
import { productionPerSecond, producerOutput } from './economy.js';
import type {
	ActiveEffect,
	EffectId,
	EventChoice,
	EventKind,
	EventOutcome,
	PendingEvent,
	TycoonEvent,
	TycoonState
} from './types.js';

export const EVENT_KINDS: readonly EventKind[] = ['spike', 'sanctions', 'pipeline', 'protest'];

/** Quiet time before the very first crisis of a run */
export function firstEventDelay(random: Random): number {
	return randomInt(random, EVENT_FIRST_MIN_MS, EVENT_FIRST_MAX_MS + 1);
}

/** Quiet time between two crises */
export function nextEventDelay(random: Random): number {
	return randomInt(random, EVENT_GAP_MIN_MS, EVENT_GAP_MAX_MS + 1);
}

/** The crises that make sense right now: all of them need something that produces */
export function eligibleKinds(state: TycoonState): EventKind[] {
	return productionPerSecond(state) > 0 ? [...EVENT_KINDS] : [];
}

function effect(
	id: EffectId,
	durationMs: number,
	parts: { prodMult?: number; clickMult?: number; producer?: ProducerId } = {}
): ActiveEffect {
	return {
		id,
		remainingMs: durationMs,
		durationMs,
		prodMult: parts.prodMult ?? 1,
		clickMult: parts.clickMult ?? 1,
		producer: parts.producer
	};
}

/** What reflagging the fleet of a sanctioned producer costs, in barrels */
export function reflagCost(state: TycoonState, producer: ProducerId): number {
	return Math.max(1, Math.ceil(SANCTION_REFLAG_SECONDS * producerOutput(state, producer)));
}

/** What greenwashing a protest costs, in barrels */
export function greenwashCost(state: TycoonState): number {
	return Math.max(1, Math.ceil(PROTEST_GREENWASH_SECONDS * productionPerSecond(state)));
}

/** What selling at the price spike pays, in barrels */
export function spikeSellValue(state: TycoonState): number {
	return Math.ceil(SPIKE_SELL_SECONDS * productionPerSecond(state));
}

/** Barrels the 'a' answer costs (0 when it is free or pays out) */
export function choiceCost(state: TycoonState, event: PendingEvent): number {
	if (event.kind === 'sanctions' && event.producer) return reflagCost(state, event.producer);
	if (event.kind === 'protest') return greenwashCost(state);
	return 0;
}

/** Whether the player can give this answer (paying options need the barrels) */
export function canChoose(state: TycoonState, choice: EventChoice): boolean {
	const event = state.event;
	if (!event) return false;
	if (choice === 'a') return state.barrels >= choiceCost(state, event);
	return true;
}

/** Starts a crisis that fits the situation; null when none does */
export function startEvent(state: TycoonState, random: Random): TycoonEvent | null {
	if (state.event) return null;
	const kinds = eligibleKinds(state);
	if (kinds.length === 0) return null;
	// The same crisis twice in a row is unlikely, not impossible
	const kind = pickWeighted(
		random,
		kinds.map((candidate) => ({ item: candidate, weight: candidate === state.lastEvent ? 0.2 : 1 }))
	);
	const event: PendingEvent = { kind, remainingMs: EVENT_DECISION_MS };
	if (kind === 'sanctions') {
		// Sanctions go after the producers that earn the most
		event.producer = pickWeighted(
			random,
			PRODUCERS.filter((producer) => producerOutput(state, producer.id) > 0).map((producer) => ({
				item: producer.id,
				weight: producerOutput(state, producer.id)
			}))
		);
	}
	state.event = event;
	state.lastEvent = kind;
	return { type: 'event-start', kind, producer: event.producer };
}

function earn(state: TycoonState, barrels: number) {
	state.barrels += barrels;
	state.runTotal += barrels;
	state.lifetime += barrels;
}

/**
 * Applies the player's answer (or the timeout) to the pending crisis. Returns nothing when there
 * is no crisis or the player cannot afford the answer; the crisis then stays open.
 */
export function resolveEvent(
	state: TycoonState,
	choice: EventChoice,
	random: Random
): TycoonEvent[] {
	const event = state.event;
	if (!event || !canChoose(state, choice)) return [];

	let outcome: EventOutcome;
	switch (event.kind) {
		case 'spike':
			if (choice === 'a') {
				earn(state, spikeSellValue(state));
				outcome = 'sold';
			} else if (choice === 'b') {
				if (random() < SPIKE_BOOM_CHANCE) {
					state.effects.push(effect('boom', SPIKE_EFFECT_MS, { prodMult: SPIKE_BOOM_MULT }));
					outcome = 'boom';
				} else {
					state.effects.push(effect('crash', SPIKE_EFFECT_MS, { prodMult: SPIKE_CRASH_MULT }));
					outcome = 'crash';
				}
			} else {
				outcome = 'ignored';
			}
			break;
		case 'sanctions':
			if (choice === 'a') {
				state.barrels -= reflagCost(state, event.producer!);
				state.sanctionsEvaded += 1;
				outcome = 'reflagged';
			} else {
				state.effects.push(effect('sanctioned', SANCTION_CUT_MS, { producer: event.producer }));
				outcome = 'sanctioned';
			}
			break;
		case 'pipeline':
			if (choice === 'b' && random() >= PIPELINE_LEAK_CHANCE) {
				outcome = 'fine';
			} else if (choice === 'b') {
				state.effects.push(effect('leak', PIPELINE_LEAK_MS, { prodMult: PIPELINE_LEAK_MULT }));
				outcome = 'leak';
			} else {
				// Fixing it on purpose, or because nobody answered
				state.effects.push(effect('maintenance', PIPELINE_FIX_MS, { prodMult: PIPELINE_FIX_MULT }));
				outcome = 'fixed';
			}
			break;
		case 'protest':
			if (choice === 'a') {
				state.barrels -= greenwashCost(state);
				outcome = 'greenwashed';
			} else {
				state.effects.push(effect('protest', PROTEST_MS, { prodMult: PROTEST_MULT, clickMult: 0 }));
				outcome = 'protest';
			}
			break;
	}

	state.event = null;
	if (choice !== 'timeout') state.eventsHandled += 1;
	state.nextEventMs = nextEventDelay(random);
	return [{ type: 'event-resolved', kind: event.kind, outcome, choice }];
}

/**
 * Advances the crisis machinery: effects run out, an unanswered crisis times out, and the quiet
 * time before the next one counts down (only while nothing is going on).
 */
export function stepEvents(state: TycoonState, dtMs: number, random: Random): TycoonEvent[] {
	const events: TycoonEvent[] = [];

	if (state.effects.length > 0) {
		for (const running of state.effects) running.remainingMs -= dtMs;
		for (const ended of state.effects.filter((running) => running.remainingMs <= 0)) {
			events.push({ type: 'effect-end', id: ended.id });
		}
		state.effects = state.effects.filter((running) => running.remainingMs > 0);
	}

	if (state.event) {
		state.event.remainingMs -= dtMs;
		if (state.event.remainingMs <= 0) {
			// Whatever the player could not afford does not matter: a timeout costs nothing
			events.push(...resolveEvent(state, 'timeout', random));
		}
	} else if (state.effects.length === 0) {
		state.nextEventMs -= dtMs;
		if (state.nextEventMs <= 0) {
			const started = startEvent(state, random);
			if (started) events.push(started);
			else state.nextEventMs = EVENT_RETRY_MS;
		}
	}
	return events;
}

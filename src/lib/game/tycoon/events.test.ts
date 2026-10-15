import { describe, expect, it } from 'vitest';
import { createRandom, type Random } from '#lib/game/random.js';
import {
	EVENT_DECISION_MS,
	EVENT_FIRST_MAX_MS,
	EVENT_FIRST_MIN_MS,
	EVENT_GAP_MAX_MS,
	EVENT_GAP_MIN_MS,
	EVENT_RETRY_MS,
	PIPELINE_FIX_MS,
	PROTEST_MS,
	SANCTION_CUT_MS,
	SPIKE_BOOM_MULT,
	SPIKE_CRASH_MULT
} from './config.js';
import { producerOutput, productionPerSecond } from './economy.js';
import {
	canChoose,
	choiceCost,
	eligibleKinds,
	firstEventDelay,
	greenwashCost,
	nextEventDelay,
	reflagCost,
	resolveEvent,
	spikeSellValue,
	startEvent,
	stepEvents
} from './events.js';
import { createState } from './state.js';
import type { EventKind, TycoonEvent, TycoonState } from './types.js';

/** A random source that returns the given values in turn, then repeats the last */
function scripted(...values: number[]): Random {
	let index = 0;
	return () => values[Math.min(index++, values.length - 1)];
}

function running(): TycoonState {
	const state = createState(createRandom(1));
	state.owned.tanker = 10;
	state.owned.refinery = 5;
	state.barrels = 100_000;
	return state;
}

function withEvent(kind: EventKind, producer?: 'tanker' | 'refinery'): TycoonState {
	const state = running();
	state.event = { kind, producer, remainingMs: EVENT_DECISION_MS };
	return state;
}

describe('scheduler', () => {
	it('draws the delays from the configured ranges', () => {
		const random = createRandom(11);
		for (let i = 0; i < 200; i++) {
			const first = firstEventDelay(random);
			expect(first).toBeGreaterThanOrEqual(EVENT_FIRST_MIN_MS);
			expect(first).toBeLessThanOrEqual(EVENT_FIRST_MAX_MS);
			const gap = nextEventDelay(random);
			expect(gap).toBeGreaterThanOrEqual(EVENT_GAP_MIN_MS);
			expect(gap).toBeLessThanOrEqual(EVENT_GAP_MAX_MS);
		}
	});

	it('is deterministic for a seed and different between seeds', () => {
		const sequence = (seed: number) => {
			const state = running();
			const random = createRandom(seed);
			state.nextEventMs = firstEventDelay(random);
			const seen: string[] = [];
			for (let i = 0; i < 4000; i++) {
				for (const event of stepEvents(state, 1000, random)) {
					seen.push(event.type + ':' + ('kind' in event ? event.kind : ''));
				}
			}
			return seen;
		};
		expect(sequence(3)).toEqual(sequence(3));
		expect(sequence(3).length).toBeGreaterThan(10);
		expect(sequence(3)).not.toEqual(sequence(4));
	});

	it('waits out the quiet time before starting a crisis', () => {
		const state = running();
		state.nextEventMs = 5000;
		expect(stepEvents(state, 4000, createRandom(2))).toEqual([]);
		expect(state.event).toBeNull();
		const events = stepEvents(state, 1000, createRandom(2));
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe('event-start');
		expect(state.event).not.toBeNull();
		expect(state.event?.remainingMs).toBe(EVENT_DECISION_MS);
	});

	it('does not start a crisis while the wells make nothing, and tries again soon', () => {
		const state = createState(createRandom(1));
		state.nextEventMs = 0;
		expect(eligibleKinds(state)).toEqual([]);
		expect(startEvent(state, createRandom(2))).toBeNull();
		expect(stepEvents(state, 100, createRandom(2))).toEqual([]);
		expect(state.nextEventMs).toBe(EVENT_RETRY_MS);
	});

	it('never has two crises at once, and the clock stops while effects run', () => {
		const state = withEvent('spike');
		state.nextEventMs = 0;
		stepEvents(state, 1000, createRandom(2));
		expect(state.event?.kind).toBe('spike');
		expect(startEvent(state, createRandom(2))).toBeNull();

		const other = running();
		other.nextEventMs = 5000;
		other.effects.push({
			id: 'leak',
			remainingMs: 10_000,
			durationMs: 10_000,
			prodMult: 0.5,
			clickMult: 1
		});
		stepEvents(other, 3000, createRandom(2));
		expect(other.nextEventMs).toBe(5000);
	});

	it('picks a sanctions target among the producers that run, and avoids repeating a crisis', () => {
		for (let seed = 1; seed < 40; seed++) {
			const state = running();
			startEvent(state, createRandom(seed));
			if (state.event?.kind === 'sanctions') {
				expect(['tanker', 'refinery']).toContain(state.event.producer);
			}
		}
		const counts: Record<string, number> = {};
		const random = createRandom(9);
		for (let i = 0; i < 400; i++) {
			const state = running();
			state.lastEvent = 'spike';
			startEvent(state, random);
			counts[state.event!.kind] = (counts[state.event!.kind] ?? 0) + 1;
		}
		expect(counts.spike ?? 0).toBeLessThan(counts.pipeline);
	});

	it('times out an unanswered crisis without cost and schedules the next one', () => {
		const state = withEvent('protest');
		const before = state.barrels;
		const events = stepEvents(state, EVENT_DECISION_MS + 1, createRandom(2));
		expect(events).toEqual([
			{ type: 'event-resolved', kind: 'protest', outcome: 'protest', choice: 'timeout' }
		]);
		expect(state.event).toBeNull();
		expect(state.barrels).toBe(before);
		expect(state.eventsHandled).toBe(0);
		expect(state.nextEventMs).toBeGreaterThanOrEqual(EVENT_GAP_MIN_MS);
	});

	it('removes effects when they run out and reports it', () => {
		const state = running();
		state.effects.push({
			id: 'maintenance',
			remainingMs: 1500,
			durationMs: 1500,
			prodMult: 0.5,
			clickMult: 1
		});
		expect(stepEvents(state, 1000, createRandom(2))).toEqual([]);
		expect(stepEvents(state, 1000, createRandom(2))).toEqual([
			{ type: 'effect-end', id: 'maintenance' }
		]);
		expect(state.effects).toEqual([]);
	});
});

describe('price spike', () => {
	it('selling pays a fixed amount of output at once', () => {
		const state = withEvent('spike');
		const worth = spikeSellValue(state);
		expect(worth).toBeCloseTo(30 * productionPerSecond(state), -1);
		const before = state.barrels;
		const events = resolveEvent(state, 'a', createRandom(1));
		expect(events[0]).toMatchObject({ outcome: 'sold' });
		expect(state.barrels).toBe(before + worth);
		expect(state.lifetime).toBe(worth);
		expect(state.eventsHandled).toBe(1);
	});

	it('holding gambles: a boom quadruples output, a crash halves it', () => {
		const boom = withEvent('spike');
		expect(resolveEvent(boom, 'b', scripted(0.1, 0.5))[0]).toMatchObject({ outcome: 'boom' });
		expect(boom.effects[0].prodMult).toBe(SPIKE_BOOM_MULT);
		const crash = withEvent('spike');
		expect(resolveEvent(crash, 'b', scripted(0.9, 0.5))[0]).toMatchObject({ outcome: 'crash' });
		expect(crash.effects[0].prodMult).toBe(SPIKE_CRASH_MULT);
	});

	it('ignoring it does nothing', () => {
		const state = withEvent('spike');
		expect(resolveEvent(state, 'timeout', createRandom(1))[0]).toMatchObject({
			outcome: 'ignored'
		});
		expect(state.effects).toEqual([]);
	});
});

describe('sanctions', () => {
	it('cut a producer for a while unless the fleet is reflagged', () => {
		const state = withEvent('sanctions', 'refinery');
		const output = productionPerSecond(state);
		const cut = producerOutput(state, 'refinery');
		resolveEvent(state, 'b', createRandom(1));
		expect(state.effects[0]).toMatchObject({
			id: 'sanctioned',
			producer: 'refinery',
			remainingMs: SANCTION_CUT_MS
		});
		expect(productionPerSecond(state)).toBeCloseTo(output - cut, 9);
	});

	it('reflagging costs barrels, counts as dodged and keeps the producer running', () => {
		const state = withEvent('sanctions', 'tanker');
		const cost = reflagCost(state, 'tanker');
		expect(choiceCost(state, state.event!)).toBe(cost);
		const before = state.barrels;
		expect(resolveEvent(state, 'a', createRandom(1))[0]).toMatchObject({ outcome: 'reflagged' });
		expect(state.barrels).toBe(before - cost);
		expect(state.sanctionsEvaded).toBe(1);
		expect(state.effects).toEqual([]);
	});

	it('cannot be reflagged without the barrels, and the crisis stays open', () => {
		const state = withEvent('sanctions', 'tanker');
		state.barrels = 0;
		expect(canChoose(state, 'a')).toBe(false);
		expect(resolveEvent(state, 'a', createRandom(1))).toEqual([]);
		expect(state.event).not.toBeNull();
		expect(canChoose(state, 'b')).toBe(true);
	});
});

describe('pipeline maintenance', () => {
	it('fixing it now slows output for a short while', () => {
		const state = withEvent('pipeline');
		expect(resolveEvent(state, 'a', createRandom(1))[0]).toMatchObject({ outcome: 'fixed' });
		expect(state.effects[0]).toMatchObject({ id: 'maintenance', remainingMs: PIPELINE_FIX_MS });
	});

	it('postponing is usually fine and sometimes a leak', () => {
		const fine = withEvent('pipeline');
		expect(resolveEvent(fine, 'b', scripted(0.9))[0]).toMatchObject({ outcome: 'fine' });
		expect(fine.effects).toEqual([]);
		const leak = withEvent('pipeline');
		expect(resolveEvent(leak, 'b', scripted(0.1))[0]).toMatchObject({ outcome: 'leak' });
		expect(leak.effects[0].id).toBe('leak');
	});
});

describe('environmental protest', () => {
	it('greenwashing costs barrels and nothing else', () => {
		const state = withEvent('protest');
		const cost = greenwashCost(state);
		const before = state.barrels;
		expect(resolveEvent(state, 'a', createRandom(1))[0]).toMatchObject({
			outcome: 'greenwashed'
		});
		expect(state.barrels).toBe(before - cost);
		expect(state.effects).toEqual([]);
	});

	it('waiting it out blocks taps and cuts output', () => {
		const state = withEvent('protest');
		resolveEvent(state, 'b', createRandom(1));
		expect(state.effects[0]).toMatchObject({
			id: 'protest',
			clickMult: 0,
			remainingMs: PROTEST_MS
		});
	});
});

describe('answers', () => {
	it('do nothing without a crisis', () => {
		const state = running();
		expect(canChoose(state, 'b')).toBe(false);
		expect(resolveEvent(state, 'b', createRandom(1))).toEqual([]);
	});

	it('always produce exactly one resolution event of the right kind', () => {
		const kinds: EventKind[] = ['spike', 'sanctions', 'pipeline', 'protest'];
		for (const kind of kinds) {
			for (const choice of ['a', 'b', 'timeout'] as const) {
				const state = withEvent(kind, 'tanker');
				const events: TycoonEvent[] = resolveEvent(state, choice, createRandom(8));
				expect(events).toHaveLength(1);
				expect(events[0]).toMatchObject({ type: 'event-resolved', kind, choice });
				expect(state.event).toBeNull();
			}
		}
	});
});

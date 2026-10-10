import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	createScheduler,
	EVENT_KINDS,
	EVENT_SPECS,
	eventGap,
	eventModifiers,
	FIRST_ANNOUNCE_HOUR,
	KICK_OFF_HOUR,
	neutralModifiers,
	rollEvent,
	stepScheduler,
	intensity,
	RAMP_HOURS,
	STORM_CUT_OUT,
	type GridEvent,
	type SchedulerReport
} from './events.js';

function event(partial: Partial<GridEvent> & Pick<GridEvent, 'kind'>): GridEvent {
	return { id: 1, announcedAt: 0, startHour: 10, endHour: 30, ...partial };
}

/** Runs the scheduler for a number of hours in small steps and collects everything it reports */
function run(seed: number, hours: number, stepHours = 0.25) {
	const random = createRandom(seed);
	const scheduler = createScheduler();
	const log: { hour: number; report: SchedulerReport }[] = [];
	for (let hour = 0; hour <= hours; hour += stepHours) {
		const report = stepScheduler(scheduler, hour, random);
		if (report.announced.length + report.started.length + report.ended.length > 0) {
			log.push({ hour, report });
		}
	}
	return { scheduler, log };
}

describe('scheduler', () => {
	it('stays quiet until the first announcement', () => {
		const { log } = run(1, FIRST_ANNOUNCE_HOUR - 0.5);
		expect(log).toEqual([]);
	});

	it('announces the first event at the first announcement hour', () => {
		const { log } = run(1, 40);
		const first = log[0];
		expect(first.hour).toBeCloseTo(FIRST_ANNOUNCE_HOUR, 1);
		expect(first.report.announced).toHaveLength(1);
	});

	it('is deterministic for a seed and differs between seeds', () => {
		const ids = (seed: number) =>
			run(seed, 150)
				.log.flatMap((entry) => entry.report.announced)
				.map((e) => `${e.kind}@${e.startHour}`);
		expect(ids(5)).toEqual(ids(5));
		expect(ids(5)).not.toEqual(ids(6));
	});

	it('walks every event through announced, started and ended, in that order', () => {
		const { log } = run(3, 300);
		const seen = new Map<number, string[]>();
		for (const { report } of log) {
			for (const e of report.announced) seen.set(e.id, [...(seen.get(e.id) ?? []), 'announced']);
			for (const e of report.started) seen.set(e.id, [...(seen.get(e.id) ?? []), 'started']);
			for (const e of report.ended) seen.set(e.id, [...(seen.get(e.id) ?? []), 'ended']);
		}
		const finished = [...seen.values()].filter((steps) => steps.length === 3);
		expect(finished.length).toBeGreaterThan(3);
		for (const steps of finished) expect(steps).toEqual(['announced', 'started', 'ended']);
	});

	it('warns before it strikes: an event starts after its warning time and lasts its duration', () => {
		const { log } = run(4, 300);
		for (const { report } of log) {
			for (const e of report.announced) {
				expect(e.startHour).toBeGreaterThanOrEqual(e.announcedAt + EVENT_SPECS[e.kind].warning);
				const [min, max] = EVENT_SPECS[e.kind].duration;
				expect(e.endHour - e.startHour).toBeGreaterThanOrEqual(min);
				expect(e.endHour - e.startHour).toBeLessThanOrEqual(max);
			}
		}
	});

	it('keeps the first day gentle: only the mild events can be rolled on day 0', () => {
		const mild = EVENT_KINDS.filter((kind) => EVENT_SPECS[kind].minDay === 0);
		for (let seed = 1; seed <= 40; seed++) {
			const rolled = rollEvent(createScheduler(), 14, createRandom(seed));
			expect(rolled).not.toBeNull();
			expect(mild).toContain(rolled!.kind);
		}
	});

	it('never runs two events of the same kind at once', () => {
		const random = createRandom(9);
		const scheduler = createScheduler();
		for (let hour = 0; hour < 600; hour += 0.5) {
			stepScheduler(scheduler, hour, random);
			const kinds = [...scheduler.upcoming, ...scheduler.active].map((e) => e.kind);
			expect(new Set(kinds).size).toBe(kinds.length);
		}
	});

	it('comes faster on later days, but never faster than every seven hours', () => {
		expect(eventGap(0)).toBeGreaterThan(eventGap(3));
		expect(eventGap(3)).toBeGreaterThan(eventGap(6));
		expect(eventGap(50)).toBe(7);
	});

	it('announces more events per day later in the run', () => {
		const { log } = run(11, 24 * 12);
		const perDay = new Array<number>(12).fill(0);
		for (const { report } of log) {
			for (const e of report.announced) perDay[Math.floor(e.announcedAt / 24)]++;
		}
		const early = perDay.slice(0, 3).reduce((a, b) => a + b, 0);
		const late = perDay.slice(8).reduce((a, b) => a + b, 0);
		expect(late).toBeGreaterThan(early);
	});

	it('starts the big match at kick-off', () => {
		let found = 0;
		for (let seed = 1; seed <= 200 && found < 5; seed++) {
			const rolled = rollEvent(createScheduler(), 14, createRandom(seed));
			if (rolled?.kind !== 'big-match') continue;
			found++;
			expect(rolled.startHour % 24).toBe(KICK_OFF_HOUR);
			expect(rolled.startHour).toBeGreaterThanOrEqual(14 + EVENT_SPECS['big-match'].warning);
		}
		expect(found).toBeGreaterThan(0);
	});

	it('names the plant that trips in a plant outage', () => {
		const scheduler = createScheduler();
		let outage: GridEvent | null = null;
		for (let seed = 1; seed <= 300 && !outage; seed++) {
			const rolled = rollEvent(scheduler, 24 * 3, createRandom(seed));
			if (rolled?.kind === 'plant-outage') outage = rolled;
		}
		expect(outage?.source).toBeDefined();
		expect(['coal', 'gas', 'nuclear', 'biomass']).toContain(outage!.source);
	});

	it('does not announce anything when every kind is already busy', () => {
		const scheduler = createScheduler();
		scheduler.active = EVENT_KINDS.map((kind, index) => event({ id: index + 1, kind }));
		expect(rollEvent(scheduler, 100, createRandom(1))).toBeNull();
	});

	it('catches up when a long stall skips several announcements', () => {
		const random = createRandom(2);
		const scheduler = createScheduler();
		const report = stepScheduler(scheduler, 200, random);
		expect(report.announced.length).toBeGreaterThan(1);
		expect(scheduler.nextAnnounceAt).toBeGreaterThan(200);
	});
});

describe('event modifiers', () => {
	it('are neutral when nothing is going on', () => {
		expect(eventModifiers([], 10)).toEqual(neutralModifiers());
	});

	it('raise the demand in a heatwave and throttle the nuclear plant', () => {
		const modifiers = eventModifiers([event({ kind: 'heatwave' })], 12);
		expect(modifiers.demand).toBeGreaterThan(1);
		expect(modifiers.capacity.nuclear).toBeLessThan(1);
	});

	it('take the wind and sun away in a Dunkelflaute', () => {
		const modifiers = eventModifiers([event({ kind: 'dunkelflaute' })], 12);
		expect(modifiers.wind).toBeLessThan(0.1);
		expect(modifiers.sun).toBeLessThan(0.2);
	});

	it('blow at full strength first and fold the turbines gradually later in a storm', () => {
		const storm = event({ kind: 'storm', startHour: 10, endHour: 30 });
		const cutOutAt = 10 + 20 * STORM_CUT_OUT;
		const early = eventModifiers([storm], cutOutAt - 0.5);
		const folding = eventModifiers([storm], cutOutAt + RAMP_HOURS / 2);
		const late = eventModifiers([storm], cutOutAt + RAMP_HOURS);
		expect(early.windMin).toBe(1);
		expect(early.wind).toBe(1);
		expect(folding.wind).toBeCloseTo(0.5, 5);
		expect(late.wind).toBe(0);
	});

	it('build up after the start and die down before the end', () => {
		const e = event({ kind: 'heatwave', startHour: 10, endHour: 30 });
		expect(intensity(e, 10)).toBe(0);
		expect(intensity(e, 10 + RAMP_HOURS / 2)).toBeCloseTo(0.5, 5);
		expect(intensity(e, 20)).toBe(1);
		expect(intensity(e, 30 - RAMP_HOURS / 2)).toBeCloseTo(0.5, 5);
		expect(intensity(e, 30)).toBe(0);
		expect(eventModifiers([e], 10).demand).toBe(1);
		expect(eventModifiers([e], 20).demand).toBeCloseTo(1.2, 5);
	});

	it('trip exactly the named plant in an outage', () => {
		const modifiers = eventModifiers([event({ kind: 'plant-outage', source: 'nuclear' })], 12);
		expect(modifiers.capacity.nuclear).toBe(0);
		expect(modifiers.capacity.coal).toBe(1);
	});

	it('make gas and imports dearer in a price spike, and multiply when events stack', () => {
		const single = eventModifiers([event({ kind: 'price-spike' })], 12);
		expect(single.price.gas).toBeGreaterThan(1);
		expect(single.price.imports).toBeGreaterThan(1);
		const stacked = eventModifiers(
			[event({ kind: 'price-spike' }), event({ kind: 'gas-cut', id: 2 })],
			12
		);
		expect(stacked.price.gas).toBeGreaterThan(single.price.gas);
		expect(stacked.capacity.gas).toBeLessThan(1);
	});

	it('cut the imports in a squeeze and the water in a drought', () => {
		expect(eventModifiers([event({ kind: 'import-squeeze' })], 12).capacity.imports).toBeLessThan(
			0.5
		);
		expect(eventModifiers([event({ kind: 'drought' })], 12).water).toBeLessThan(0.5);
	});

	it('add demand for a big match', () => {
		expect(eventModifiers([event({ kind: 'big-match' })], 20).demand).toBeGreaterThan(1.1);
	});
});

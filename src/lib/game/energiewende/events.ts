/*
 * The event scheduler: heatwaves, Dunkelflaute, storms and other trouble that hits the grid. An
 * event is first announced (a headline with a few hours of warning), then starts, then ends. The
 * scheduler is pure: it only looks at the game clock and a seeded random, so a run can be replayed
 * and tested. Events come quicker as the days go by.
 */
import { pickOne, pickWeighted, type Random } from '#lib/game/random.js';
import { SOURCE_IDS, type SourceId } from './sources.js';

export const EVENT_KINDS = [
	'heatwave',
	'dunkelflaute',
	'storm',
	'drought',
	'gas-cut',
	'plant-outage',
	'big-match',
	'import-squeeze',
	'price-spike'
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export const HOURS_PER_DAY = 24;

/** The first announcement comes late in the first afternoon, so the first day is a calm tutorial */
export const FIRST_ANNOUNCE_HOUR = 14;

/** Evening kick-off hour of the big match */
export const KICK_OFF_HOUR = 19;

interface EventSpec {
	/** First game day (0 is the first) on which this event may be scheduled */
	minDay: number;
	weight: number;
	/** Hours between the announcement and the start */
	warning: number;
	/** Duration range in hours */
	duration: readonly [number, number];
}

export const EVENT_SPECS: Record<EventKind, EventSpec> = {
	'big-match': { minDay: 0, weight: 3, warning: 5, duration: [4, 4] },
	'price-spike': { minDay: 0, weight: 3, warning: 3, duration: [6, 10] },
	heatwave: { minDay: 1, weight: 3, warning: 6, duration: [10, 16] },
	storm: { minDay: 1, weight: 3, warning: 4, duration: [6, 9] },
	'plant-outage': { minDay: 1, weight: 3, warning: 2, duration: [6, 12] },
	dunkelflaute: { minDay: 2, weight: 3, warning: 5, duration: [12, 20] },
	drought: { minDay: 2, weight: 2, warning: 8, duration: [14, 24] },
	'gas-cut': { minDay: 3, weight: 2, warning: 3, duration: [8, 14] },
	'import-squeeze': { minDay: 3, weight: 2, warning: 3, duration: [8, 14] }
};

/** Plants that can trip out; wind, sun and storage have no single point of failure */
const OUTAGE_SOURCES: readonly SourceId[] = ['coal', 'gas', 'nuclear', 'biomass'];

export interface GridEvent {
	id: number;
	kind: EventKind;
	announcedAt: number;
	startHour: number;
	endHour: number;
	/** The plant that trips, for a plant outage */
	source?: SourceId;
}

export interface Scheduler {
	nextId: number;
	/** Game hour of the next announcement */
	nextAnnounceAt: number;
	/** Announced but not started yet, by start hour */
	upcoming: GridEvent[];
	active: GridEvent[];
}

export interface SchedulerReport {
	announced: GridEvent[];
	started: GridEvent[];
	ended: GridEvent[];
}

export function createScheduler(firstAnnounceAt: number = FIRST_ANNOUNCE_HOUR): Scheduler {
	return { nextId: 1, nextAnnounceAt: firstAnnounceAt, upcoming: [], active: [] };
}

export function dayOf(hour: number): number {
	return Math.floor(hour / HOURS_PER_DAY);
}

/** Average hours between two announcements on a given day: 26 on day 0, never below 7 */
export function eventGap(day: number): number {
	return Math.max(7, 26 - 3 * day);
}

/** The next evening kick-off at or after the given hour */
function nextKickOff(hour: number): number {
	const today = dayOf(hour) * HOURS_PER_DAY + KICK_OFF_HOUR;
	return hour <= today ? today : today + HOURS_PER_DAY;
}

function isBusy(scheduler: Scheduler, kind: EventKind): boolean {
	return [...scheduler.upcoming, ...scheduler.active].some((event) => event.kind === kind);
}

/** Builds one event announced at the given hour; null when nothing is eligible */
export function rollEvent(
	scheduler: Scheduler,
	announcedAt: number,
	random: Random
): GridEvent | null {
	const day = dayOf(announcedAt);
	const eligible = EVENT_KINDS.filter(
		(kind) => EVENT_SPECS[kind].minDay <= day && !isBusy(scheduler, kind)
	).map((kind) => ({ item: kind, weight: EVENT_SPECS[kind].weight }));
	if (eligible.length === 0) return null;

	const kind = pickWeighted(random, eligible);
	const spec = EVENT_SPECS[kind];
	let startHour = announcedAt + spec.warning;
	if (kind === 'big-match') startHour = nextKickOff(startHour);
	const [minDuration, maxDuration] = spec.duration;
	const duration = Math.round(minDuration + random() * (maxDuration - minDuration));
	const event: GridEvent = {
		id: scheduler.nextId++,
		kind,
		announcedAt,
		startHour,
		endHour: startHour + duration
	};
	if (kind === 'plant-outage') event.source = pickOne(random, OUTAGE_SOURCES);
	return event;
}

/**
 * Advances the scheduler to the given game hour: announces what is due, starts what has been
 * warned about long enough and ends what is over. Mutates the scheduler and returns what changed.
 */
export function stepScheduler(scheduler: Scheduler, hour: number, random: Random): SchedulerReport {
	const report: SchedulerReport = { announced: [], started: [], ended: [] };

	while (hour >= scheduler.nextAnnounceAt) {
		const announcedAt = scheduler.nextAnnounceAt;
		const event = rollEvent(scheduler, announcedAt, random);
		if (event) {
			scheduler.upcoming.push(event);
			scheduler.upcoming.sort((a, b) => a.startHour - b.startHour);
			report.announced.push(event);
		}
		scheduler.nextAnnounceAt += eventGap(dayOf(announcedAt)) * (0.75 + 0.5 * random());
	}

	const due = scheduler.upcoming.filter((event) => event.startHour <= hour);
	if (due.length > 0) {
		scheduler.upcoming = scheduler.upcoming.filter((event) => event.startHour > hour);
		scheduler.active.push(...due);
		report.started.push(...due);
	}

	const over = scheduler.active.filter((event) => event.endHour <= hour);
	if (over.length > 0) {
		scheduler.active = scheduler.active.filter((event) => event.endHour > hour);
		report.ended.push(...over);
	}
	return report;
}

/** How the active events bend the grid; every factor is 1 (or 0 for windMin) when all is calm */
export interface Modifiers {
	/** Factor on the demand */
	demand: number;
	/** Factor on the wind output, after the floor */
	wind: number;
	/** Lowest wind capacity factor (a storm blows at full strength) */
	windMin: number;
	sun: number;
	water: number;
	/** Factor on the capacity each source can deliver */
	capacity: Record<SourceId, number>;
	/** Factor on the price of each source */
	price: Record<SourceId, number>;
}

function factors(): Record<SourceId, number> {
	return Object.fromEntries(SOURCE_IDS.map((id) => [id, 1])) as Record<SourceId, number>;
}

export function neutralModifiers(): Modifiers {
	return {
		demand: 1,
		wind: 1,
		windMin: 0,
		sun: 1,
		water: 1,
		capacity: factors(),
		price: factors()
	};
}

/** Share of a storm after which the turbines shut down for their own protection */
export const STORM_CUT_OUT = 0.5;

/** Hours over which an event builds up and dies down, so the player can follow it with the sliders */
export const RAMP_HOURS = 1.5;

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** How strongly an event acts: it ramps up after its start and down before its end */
export function intensity(event: GridEvent, hour: number): number {
	return Math.min(
		clamp01((hour - event.startHour) / RAMP_HOURS),
		clamp01((event.endHour - hour) / RAMP_HOURS)
	);
}

/** Moves a factor from 1 toward its full value by the intensity */
function blend(factor: number, strength: number): number {
	return 1 + (factor - 1) * strength;
}

function apply(modifiers: Modifiers, event: GridEvent, hour: number) {
	const k = intensity(event, hour);
	switch (event.kind) {
		case 'heatwave':
			modifiers.demand *= blend(1.2, k);
			modifiers.sun *= blend(1.1, k);
			// Warm rivers: the plants must throttle back
			modifiers.capacity.nuclear *= blend(0.75, k);
			modifiers.capacity.coal *= blend(0.9, k);
			modifiers.water *= blend(0.85, k);
			break;
		case 'dunkelflaute':
			modifiers.wind *= blend(0.05, k);
			modifiers.sun *= blend(0.12, k);
			modifiers.demand *= blend(1.1, k);
			break;
		case 'storm': {
			const span = Math.max(1, event.endHour - event.startHour);
			const cutOutAt = event.startHour + span * STORM_CUT_OUT;
			// It blows at full strength, then the turbines fold one after another
			modifiers.windMin = Math.max(
				modifiers.windMin,
				clamp01((hour - event.startHour) / RAMP_HOURS)
			);
			modifiers.wind *= 1 - clamp01((hour - cutOutAt) / RAMP_HOURS);
			modifiers.sun *= blend(0.4, clamp01((hour - event.startHour) / RAMP_HOURS));
			break;
		}
		case 'drought':
			modifiers.water *= blend(0.35, k);
			modifiers.capacity.nuclear *= blend(0.9, k);
			break;
		case 'gas-cut':
			modifiers.capacity.gas *= blend(0.4, k);
			modifiers.price.gas *= 1.5;
			break;
		case 'plant-outage':
			// A trip is sudden
			if (event.source) modifiers.capacity[event.source] = 0;
			break;
		case 'big-match':
			modifiers.demand *= blend(1.14, k);
			break;
		case 'import-squeeze':
			modifiers.capacity.imports *= blend(0.25, k);
			modifiers.price.imports *= 1.5;
			break;
		case 'price-spike':
			modifiers.price.gas *= 2.5;
			modifiers.price.imports *= 2;
			break;
	}
}

/** Combines the active events into one set of modifiers for the given game hour */
export function eventModifiers(active: readonly GridEvent[], hour: number): Modifiers {
	const modifiers = neutralModifiers();
	for (const event of active) apply(modifiers, event, hour);
	return modifiers;
}

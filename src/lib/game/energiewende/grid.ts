/*
 * The grid simulation of Energiewende Panic. Nine sources feed one grid; the player sets how much
 * each of them should deliver (a target), the plants follow at their own ramp speed, the weather
 * decides how much wind, sun and water there is, and the demand swings through the day. If supply
 * and demand drift apart for too long the grid trips: a blackout (too little) or an overload (too
 * much) costs a heart.
 *
 * The state is a plain object that stepGrid mutates; there is no framework code in here, and every
 * random number comes from the Random that is passed in, so a run can be replayed in a test.
 */
import type { Random } from '#lib/game/random.js';
import {
	createScheduler,
	eventModifiers,
	HOURS_PER_DAY,
	stepScheduler,
	type GridEvent,
	type Modifiers,
	type Scheduler
} from './events.js';
import {
	FLIP_ANNOYED_HOURS,
	FLIP_OUTRAGED_HOURS,
	reactionsFor,
	severity,
	type Reactions
} from './reactions.js';
import {
	BATTERY_EFFICIENCY,
	BATTERY_ENERGY,
	isThermal,
	SOURCE_IDS,
	SOURCES,
	type SourceId
} from './sources.js';

export const STARTING_LIVES = 3;
/** The game starts in the small hours, a few hours before the demand climbs */
export const START_HOUR = 4;
/** Share of the demand that supply may miss or exceed without any harm */
export const TOLERANCE = 0.03;
/** How fast the grid destabilizes: stress per hour per share of imbalance above the tolerance */
export const STRESS_RATE = 7;
/** Stress that goes away per hour while the grid is within the tolerance */
export const STRESS_RECOVERY = 0.5;
/** Stress left after a trip, and the hours in which nothing new can trip */
export const STRESS_AFTER_TRIP = 0.25;
export const GRACE_HOURS = 3;
/** A new game opens with a short breather before the first trip can happen */
export const OPENING_GRACE_HOURS = 2;
/** Real seconds per game hour: a day lasts a minute */
export const SECONDS_PER_HOUR = 2.5;
/** Sources at or below this many g CO2 per kWh count as clean */
export const CLEAN_CO2 = 50;
/** Time constant in hours of the smoothed price and emission figures */
const AVERAGING_HOURS = 1.5;

export type PerSource<T> = Record<SourceId, T>;

function perSource<T>(make: (id: SourceId) => T): PerSource<T> {
	return Object.fromEntries(SOURCE_IDS.map((id) => [id, make(id)])) as PerSource<T>;
}

export interface Weather {
	/** Wind speed index from 0 (calm) to 1 (gale) */
	wind: number;
	/** How clear the sky is, from 0.3 (overcast) to 1 (cloudless) */
	clear: number;
}

export type GridEventReport =
	| { type: 'blackout' }
	| { type: 'overload' }
	| { type: 'game-over' }
	| { type: 'tripped'; source: SourceId }
	| { type: 'online'; source: SourceId }
	| { type: 'announced'; event: GridEvent }
	| { type: 'started'; event: GridEvent }
	| { type: 'ended'; event: GridEvent };

export interface GridState {
	/** Game hours since midnight of day 0 */
	hour: number;
	weather: Weather;
	/** Slow random swing of the demand around its curve, about 1 */
	drift: number;
	/** What each source delivers in GW; the batteries are positive when discharging */
	outputs: PerSource<number>;
	/** What the player asked for: a share of what the source can deliver, -1 to 1 for batteries */
	targets: PerSource<number>;
	/** Plants that are warm and can deliver */
	online: PerSource<boolean>;
	/** Hours left of a cold start, or null */
	warmup: PerSource<number | null>;
	/** Energy in the batteries in GWh */
	soc: number;
	/** 0 (steady) to 1 (the grid trips) */
	stress: number;
	/** Hours in which the grid cannot trip again */
	grace: number;
	lives: number;
	score: number;
	/** Demand and supply in GW at the last step */
	demand: number;
	supply: number;
	/** Smoothed price in euro per MWh and smoothed emissions in g CO2 per kWh */
	price: number;
	intensity: number;
	/** Game hours at which the nuclear plant was switched on or off */
	nuclearFlips: number[];
	/** Counters for the game-over screen */
	blackouts: number;
	overloads: number;
	/** Hour-weighted sums behind the averages */
	priceHours: number;
	intensityHours: number;
	cleanHours: number;
	/** Hours the cameos spent annoyed or outraged, for the game-over pick */
	grievance: { businessman: number; woman: number };
	scheduler: Scheduler;
	over: boolean;
}

// --- demand and weather ------------------------------------------------------------------------

/** Demand in GW over a day, as (hour, GW) points that are joined smoothly */
const DEMAND_CURVE: readonly (readonly [number, number])[] = [
	[0, 42],
	[3, 37],
	[6, 46],
	[8, 60],
	[12, 62],
	[15, 58],
	[18, 66],
	[20, 68],
	[22, 54],
	[24, 42]
];

/** Demand grows a little every day, up to a limit */
export function growth(day: number): number {
	return 1 + Math.min(0.12, 0.012 * day);
}

/** Demand in GW at a game hour before events and noise */
export function baseDemand(hour: number): number {
	const h = ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
	for (let i = 1; i < DEMAND_CURVE.length; i++) {
		const [h1, d1] = DEMAND_CURVE[i];
		if (h <= h1) {
			const [h0, d0] = DEMAND_CURVE[i - 1];
			const t = (h - h0) / (h1 - h0);
			const eased = (1 - Math.cos(Math.PI * t)) / 2;
			return d0 + (d1 - d0) * eased;
		}
	}
	return DEMAND_CURVE[DEMAND_CURVE.length - 1][1];
}

export function demandAt(hour: number, drift: number, modifiers: Modifiers): number {
	const day = Math.floor(hour / HOURS_PER_DAY);
	return baseDemand(hour) * growth(day) * drift * modifiers.demand;
}

/** Share of the solar capacity the sun delivers at a game hour under a clear sky */
export function sunShape(hour: number): number {
	const h = ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
	if (h <= 6 || h >= 20) return 0;
	return Math.pow(Math.sin((Math.PI * (h - 6)) / 14), 1.5);
}

/** Share of the wind capacity a wind speed index delivers: nothing in a calm, everything in a breeze */
export function windShape(wind: number): number {
	const x = Math.min(1, Math.max(0, (wind - 0.1) / 0.5));
	return x * x * (3 - 2 * x);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function stepWeather(state: GridState, dtHours: number, random: Random) {
	const noise = Math.sqrt(dtHours);
	const weather = state.weather;
	weather.wind = clamp(
		weather.wind + (0.35 - weather.wind) * 0.06 * dtHours + (random() - 0.5) * 0.16 * noise,
		0,
		1
	);
	weather.clear = clamp(
		weather.clear + (0.8 - weather.clear) * 0.1 * dtHours + (random() - 0.5) * 0.25 * noise,
		0.3,
		1
	);
	state.drift = clamp(
		state.drift + (1 - state.drift) * 0.3 * dtHours + (random() - 0.5) * 0.08 * noise,
		0.94,
		1.06
	);
}

// --- what the sources can deliver --------------------------------------------------------------

/** The most a source can deliver right now in GW, given weather and events (batteries: power) */
export function availableOutput(
	id: SourceId,
	hour: number,
	weather: Weather,
	modifiers: Modifiers
): number {
	const { capacity, dependence } = SOURCES[id];
	const derate = modifiers.capacity[id];
	switch (dependence) {
		case 'wind':
			return (
				capacity * Math.max(modifiers.windMin, windShape(weather.wind)) * modifiers.wind * derate
			);
		case 'sun':
			return capacity * sunShape(hour) * weather.clear * modifiers.sun * derate;
		case 'water':
			return capacity * 0.85 * modifiers.water * derate;
		default:
			return capacity * derate;
	}
}

/** Price of a source right now in euro per MWh; imports follow the demand */
export function unitCost(id: SourceId, demand: number, modifiers: Modifiers): number {
	const base = SOURCES[id].cost;
	const market = id === 'imports' ? 0.75 + 0.5 * (demand / 70) : 1;
	return base * market * modifiers.price[id];
}

/** The mains frequency in Hz for an imbalance share: a deficit slows the generators down */
export function frequency(imbalance: number): number {
	return 50 + 6.5 * imbalance;
}

/** Price, emissions and clean share of what the sources deliver right now */
function mixFigures(outputs: PerSource<number>, demand: number, modifiers: Modifiers) {
	let produced = 0;
	let cost = 0;
	let co2 = 0;
	let clean = 0;
	for (const id of SOURCE_IDS) {
		const output = outputs[id];
		if (output <= 0) continue;
		produced += output;
		cost += output * unitCost(id, demand, modifiers);
		co2 += output * SOURCES[id].co2;
		if (SOURCES[id].co2 <= CLEAN_CO2) clean += output;
	}
	return {
		price: produced > 0 ? cost / produced : 0,
		intensity: produced > 0 ? co2 / produced : 0,
		clean: produced > 0 ? clean / produced : 0
	};
}

// --- creating and steering a game --------------------------------------------------------------

export function createGrid(random: Random, startHour: number = START_HOUR): GridState {
	const weather: Weather = { wind: 0.3, clear: 0.7 + random() * 0.2 };
	const modifiers = eventModifiers([], startHour);
	const drift = 1;
	const demand = demandAt(startHour, drift, modifiers);
	const available = perSource((id) => availableOutput(id, startHour, weather, modifiers));

	// A balanced starting point: nuclear and the weather first, coal for the base, gas for the rest
	const targets = perSource(() => 0);
	targets.nuclear = 0.8;
	targets.hydro = 0.6;
	targets.wind = 1;
	targets.solar = 1;
	const fixed =
		available.nuclear * targets.nuclear +
		available.hydro * targets.hydro +
		available.wind +
		available.solar;
	const rest = Math.max(0, demand - fixed);
	targets.coal = Math.round((0.55 * rest) / available.coal / 0.05) * 0.05;
	const gas = rest - available.coal * targets.coal;
	targets.gas = clamp(gas / available.gas, 0, 1);

	const outputs = perSource((id) => available[id] * targets[id]);
	const supply = SOURCE_IDS.reduce((sum, id) => sum + outputs[id], 0);
	const mix = mixFigures(outputs, demand, modifiers);
	return {
		hour: startHour,
		weather,
		drift,
		outputs,
		targets,
		online: perSource((id) => !isThermal(id) || targets[id] > 0),
		warmup: perSource(() => null),
		soc: BATTERY_ENERGY / 2,
		stress: 0,
		grace: OPENING_GRACE_HOURS,
		lives: STARTING_LIVES,
		score: 0,
		demand,
		supply,
		price: mix.price,
		intensity: mix.intensity,
		nuclearFlips: [],
		blackouts: 0,
		overloads: 0,
		priceHours: 0,
		intensityHours: 0,
		cleanHours: 0,
		grievance: { businessman: 0, woman: 0 },
		scheduler: createScheduler(),
		over: false
	};
}

/** The lowest and highest target a source accepts */
export function targetRange(id: SourceId): readonly [number, number] {
	return id === 'batteries' ? [-1, 1] : [0, 1];
}

/**
 * The player moves a slider. Switching the nuclear plant on or off is remembered, because the
 * critics are watching.
 */
export function setTarget(state: GridState, id: SourceId, value: number): void {
	const [min, max] = targetRange(id);
	const next = clamp(Number.isFinite(value) ? value : 0, min, max);
	const previous = state.targets[id];
	if (id === 'nuclear' && previous > 0 !== next > 0) state.nuclearFlips.push(state.hour);
	state.targets[id] = next;
}

/** Number of nuclear switch-overs in the last hours */
export function recentNuclearFlips(state: GridState, withinHours: number): number {
	return state.nuclearFlips.filter((hour) => state.hour - hour <= withinHours).length;
}

// --- the step ----------------------------------------------------------------------------------

function moveToward(current: number, desired: number, maxDelta: number): number {
	return current + clamp(desired - current, -maxDelta, maxDelta);
}

/** Share of the demand that the imbalance is: negative when supply falls short */
export function imbalanceShare(supply: number, demand: number): number {
	return demand > 0 ? (supply - demand) / demand : 0;
}

/**
 * Points per game hour: a steady grid earns up to 10, less when the power is expensive or dirty,
 * and nothing while supply and demand are further apart than the tolerance.
 */
export function pointsPerHour(price: number, intensity: number, imbalance: number): number {
	if (Math.abs(imbalance) > TOLERANCE) return 0;
	const priceFactor = clamp((160 - price) / 100, 0.3, 1);
	const cleanFactor = clamp((600 - intensity) / 500, 0.3, 1);
	return 10 * priceFactor * cleanFactor;
}

/** Runs the grid for dtHours game hours; returns what happened worth telling the player */
export function stepGrid(state: GridState, dtHours: number, random: Random): GridEventReport[] {
	const reports: GridEventReport[] = [];
	if (state.over || dtHours <= 0) return reports;

	state.hour += dtHours;
	const scheduled = stepScheduler(state.scheduler, state.hour, random);
	for (const event of scheduled.announced) reports.push({ type: 'announced', event });
	for (const event of scheduled.started) reports.push({ type: 'started', event });
	for (const event of scheduled.ended) reports.push({ type: 'ended', event });
	const modifiers = eventModifiers(state.scheduler.active, state.hour);

	stepWeather(state, dtHours, random);
	state.demand = demandAt(state.hour, state.drift, modifiers);

	let supply = 0;

	for (const id of SOURCE_IDS) {
		const spec = SOURCES[id];
		const available = availableOutput(id, state.hour, state.weather, modifiers);
		let output = state.outputs[id];

		if (id === 'batteries') {
			const desired = state.targets.batteries * available;
			output = moveToward(output, desired, spec.ramp * spec.capacity * dtHours);
			if (output > 0) {
				// Discharging draws more energy from the cells than it delivers
				output = Math.min(output, (state.soc * BATTERY_EFFICIENCY) / dtHours);
				state.soc -= (output * dtHours) / BATTERY_EFFICIENCY;
			} else if (output < 0) {
				const room = (BATTERY_ENERGY - state.soc) / (BATTERY_EFFICIENCY * dtHours);
				output = Math.max(output, -room);
				state.soc -= output * dtHours * BATTERY_EFFICIENCY;
			}
			state.soc = clamp(state.soc, 0, BATTERY_ENERGY);
		} else {
			const target = state.targets[id];
			if (isThermal(id)) {
				if (available <= 0) {
					// A tripped plant goes cold and has to be started again once it is back
					if (state.online[id] && state.outputs[id] > 0)
						reports.push({ type: 'tripped', source: id });
					state.online[id] = false;
					state.warmup[id] = null;
				} else if (!state.online[id]) {
					if (target > 0) {
						const left = (state.warmup[id] ?? spec.startupHours) - dtHours;
						if (left <= 0) {
							state.online[id] = true;
							state.warmup[id] = null;
							reports.push({ type: 'online', source: id });
						} else {
							state.warmup[id] = left;
						}
					} else {
						state.warmup[id] = null;
					}
				}
			}
			const running = !isThermal(id) || state.online[id];
			const desired = running ? target * available : 0;
			output = moveToward(output, desired, spec.ramp * spec.capacity * dtHours);
			output = Math.min(output, available);
			if (isThermal(id) && target <= 0 && output <= 1e-6 && state.online[id]) {
				state.online[id] = false;
				state.warmup[id] = null;
			}
		}

		state.outputs[id] = output;
		supply += output;
	}

	state.supply = supply;
	const imbalance = imbalanceShare(supply, state.demand);

	// Price and emissions are smoothed so the cameos do not twitch with every step
	const mix = mixFigures(state.outputs, state.demand, modifiers);
	const blend = 1 - Math.exp(-dtHours / AVERAGING_HOURS);
	state.price += (mix.price - state.price) * blend;
	state.intensity += (mix.intensity - state.intensity) * blend;

	state.priceHours += state.price * dtHours;
	state.intensityHours += state.intensity * dtHours;
	state.cleanHours += mix.clean * dtHours;
	const reactions = reactionsOf(state);
	state.grievance.businessman += severity(reactions.businessman) * dtHours;
	state.grievance.woman += severity(reactions.woman) * dtHours;

	state.score += pointsPerHour(state.price, state.intensity, imbalance) * dtHours;

	// Stability: the further off the balance, the faster the grid heads for a trip
	if (state.grace > 0) {
		state.grace = Math.max(0, state.grace - dtHours);
		state.stress = Math.max(0, state.stress - STRESS_RECOVERY * dtHours);
	} else if (Math.abs(imbalance) > TOLERANCE) {
		state.stress += (Math.abs(imbalance) - TOLERANCE) * STRESS_RATE * dtHours;
	} else {
		state.stress = Math.max(0, state.stress - STRESS_RECOVERY * dtHours);
	}

	if (state.stress >= 1) {
		state.stress = STRESS_AFTER_TRIP;
		state.grace = GRACE_HOURS;
		state.lives -= 1;
		if (imbalance < 0) {
			state.blackouts += 1;
			reports.push({ type: 'blackout' });
		} else {
			state.overloads += 1;
			reports.push({ type: 'overload' });
		}
		if (state.lives <= 0) {
			state.lives = 0;
			state.over = true;
			reports.push({ type: 'game-over' });
		}
	}
	return reports;
}

/** How the two cameos feel about the grid right now */
export function reactionsOf(state: GridState): Reactions {
	return reactionsFor(
		state.price,
		state.intensity,
		recentNuclearFlips(state, FLIP_ANNOYED_HOURS),
		recentNuclearFlips(state, FLIP_OUTRAGED_HOURS)
	);
}

/** Demand a few hours ahead under the events that are active now, to show which way it is heading */
export function demandForecast(state: GridState, hoursAhead: number): number {
	const modifiers = eventModifiers(state.scheduler.active, state.hour + hoursAhead);
	return demandAt(state.hour + hoursAhead, state.drift, modifiers);
}

export function dayNumber(state: GridState): number {
	return Math.floor(state.hour / HOURS_PER_DAY) + 1;
}

/** Hour of the day as 0..24 */
export function hourOfDay(state: GridState): number {
	return state.hour % HOURS_PER_DAY;
}

/** Share of the power that comes from low-emission sources, 0..1, over the whole run */
export function averageCleanShare(state: GridState): number {
	const hours = state.hour - START_HOUR;
	return hours > 0 ? state.cleanHours / hours : 0;
}

export function averagePrice(state: GridState): number {
	const hours = state.hour - START_HOUR;
	return hours > 0 ? state.priceHours / hours : state.price;
}

export function averageIntensity(state: GridState): number {
	const hours = state.hour - START_HOUR;
	return hours > 0 ? state.intensityHours / hours : state.intensity;
}

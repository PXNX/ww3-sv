/*
 * The nine power sources of Energiewende Panic. Everything the simulation needs to know about a
 * source is data here: how much it can deliver, how fast its output may change (ramp), what a
 * megawatt-hour costs, how dirty it is and what the weather has to do with it.
 *
 * Units: power in GW, energy in GWh, cost in euro per MWh, emissions in grams CO2 per kWh, time in
 * game hours. A ramp is a share of the capacity per hour, so 0.12 means "from 0 to full in a bit
 * over eight hours".
 */

export const SOURCE_IDS = [
	'coal',
	'gas',
	'nuclear',
	'wind',
	'solar',
	'hydro',
	'biomass',
	'batteries',
	'imports'
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** What limits how much a source can deliver right now */
export type Dependence = 'fuel' | 'wind' | 'sun' | 'water' | 'neighbors';

export interface SourceSpec {
	id: SourceId;
	/** Largest output in GW */
	capacity: number;
	/** Share of the capacity the output may move per game hour, up or down */
	ramp: number;
	/** Euro per MWh produced */
	cost: number;
	/** Grams of CO2 per kWh produced */
	co2: number;
	dependence: Dependence;
	/** Hours a cold plant needs before it delivers anything after it is switched on; 0 for none */
	startupHours: number;
}

export const SOURCES: Record<SourceId, SourceSpec> = {
	coal: {
		id: 'coal',
		capacity: 20,
		ramp: 0.3,
		cost: 70,
		co2: 1000,
		dependence: 'fuel',
		startupHours: 3
	},
	gas: {
		id: 'gas',
		capacity: 16,
		ramp: 1.5,
		cost: 120,
		co2: 400,
		dependence: 'fuel',
		startupHours: 0.5
	},
	nuclear: {
		id: 'nuclear',
		capacity: 10,
		ramp: 0.12,
		cost: 35,
		co2: 12,
		dependence: 'fuel',
		startupHours: 8
	},
	wind: {
		id: 'wind',
		capacity: 28,
		ramp: 1.5,
		cost: 5,
		co2: 11,
		dependence: 'wind',
		startupHours: 0
	},
	solar: {
		id: 'solar',
		capacity: 24,
		ramp: 1.5,
		cost: 6,
		co2: 40,
		dependence: 'sun',
		startupHours: 0
	},
	hydro: {
		id: 'hydro',
		capacity: 6,
		ramp: 2,
		cost: 15,
		co2: 24,
		dependence: 'water',
		startupHours: 0
	},
	biomass: {
		id: 'biomass',
		capacity: 6,
		ramp: 0.4,
		cost: 95,
		co2: 230,
		dependence: 'fuel',
		startupHours: 2
	},
	batteries: {
		id: 'batteries',
		capacity: 10,
		ramp: 6,
		cost: 20,
		co2: 0,
		dependence: 'fuel',
		startupHours: 0
	},
	imports: {
		id: 'imports',
		capacity: 12,
		ramp: 6,
		cost: 130,
		co2: 450,
		dependence: 'neighbors',
		startupHours: 0
	}
};

/** Sources whose output the weather decides; the player can only throttle them */
export function isWeatherSource(id: SourceId): boolean {
	const { dependence } = SOURCES[id];
	return dependence === 'wind' || dependence === 'sun' || dependence === 'water';
}

/** Plants that need a warm-up after a cold start */
export function isThermal(id: SourceId): boolean {
	return SOURCES[id].startupHours > 0;
}

/** Energy the battery bank holds when full, in GWh (three hours at full power) */
export const BATTERY_ENERGY = 30;
/** Share of the energy that survives each way into and out of the battery */
export const BATTERY_EFFICIENCY = 0.92;

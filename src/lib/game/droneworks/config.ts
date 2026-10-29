/*
 * Drone Works tuning. The plant is a row of build slots, and every building turns one resource into
 * the next: ore into steel, steel into chips and airframes, chips and steel into engines, and the
 * assembly hall turns engines and airframes into a drone. Rates are per second and continuous, so
 * the chain runs on its own once it is built — the game is about building it in the right order,
 * with the steel that is actually there.
 *
 * The contract changes the recipe: the Flamingo needs airframes and engines, the Freyja leans on
 * engines and chips, the Pelikan needs a bit of everything. Every contract pays for the drones and
 * for the time left on the clock.
 */

/** Build slots on the shop floor, laid out in rows of four */
export const SLOT_COUNT = 12;
export const SLOT_COLUMNS = 4;

export type ResourceId = 'ore' | 'steel' | 'chips' | 'engines' | 'airframes';

/** Display order of the resource strip */
export const RESOURCES: readonly ResourceId[] = ['ore', 'steel', 'chips', 'engines', 'airframes'];

/** Ore and steel are the bulk goods; the rest are parts that go into a drone */
export type BuildingId =
	'mine' | 'smelter' | 'chipfab' | 'engine' | 'airframe' | 'assembly' | 'flak';

/** Display order of the build menu */
export const BUILDING_IDS: readonly BuildingId[] = [
	'mine',
	'smelter',
	'chipfab',
	'engine',
	'airframe',
	'assembly',
	'flak'
];

export interface BuildingSpec {
	/** Budget it takes to put the building on the floor */
	cost: number;
	/** Input per second at full output */
	input: Partial<Record<ResourceId, number>>;
	/** Output per second at full output */
	output: Partial<Record<ResourceId, number>>;
}

export const BUILDINGS: Record<BuildingId, BuildingSpec> = {
	mine: { cost: 12, input: {}, output: { ore: 1.5 } },
	smelter: { cost: 16, input: { ore: 1.5 }, output: { steel: 0.8 } },
	chipfab: { cost: 24, input: { steel: 0.4 }, output: { chips: 0.3 } },
	engine: { cost: 30, input: { steel: 0.8, chips: 0.3 }, output: { engines: 0.2 } },
	airframe: { cost: 22, input: { steel: 0.6 }, output: { airframes: 0.3 } },
	assembly: { cost: 34, input: {}, output: {} },
	flak: { cost: 28, input: {}, output: {} }
};

export type DroneId = 'flamingo' | 'freyja' | 'pelikan';

export interface DroneSpec {
	recipe: Partial<Record<ResourceId, number>>;
	/** Time on the assembly line for one drone */
	buildMs: number;
	/** What delivering one pays, before the time bonus */
	points: number;
}

export const DRONES: Record<DroneId, DroneSpec> = {
	flamingo: { recipe: { airframes: 2, engines: 1 }, buildMs: 6000, points: 120 },
	freyja: { recipe: { airframes: 1, engines: 2, chips: 2 }, buildMs: 9000, points: 200 },
	pelikan: { recipe: { airframes: 2, engines: 2, chips: 2 }, buildMs: 10000, points: 320 }
};

export interface ContractSpec {
	drone: DroneId;
	quota: number;
	timeMs: number;
}

/** Ordered contracts; finishing the last one wins the run */
export const CONTRACTS: readonly ContractSpec[] = [
	{ drone: 'flamingo', quota: 6, timeMs: 150_000 },
	{ drone: 'freyja', quota: 6, timeMs: 160_000 },
	{ drone: 'pelikan', quota: 5, timeMs: 180_000 }
];

/** Points per second left on the clock when a contract is signed off */
export const TIME_BONUS_PER_SECOND = 2;

/** Steel in the yard when the shift starts, and the buildings already standing */
export const STARTING_STEEL = 20;
export const STARTING_BUILDINGS: readonly BuildingId[] = ['mine', 'mine', 'smelter'];

// ---------------------------------------------------------------------------------------------
// Strikes and breakdowns

/** The first strike wave, and how the interval tightens as the night goes on */
export const FIRST_STRIKE_MS = 40_000;
export const STRIKE_BASE_MS = 26_000;
export const STRIKE_MIN_MS = 11_000;
export const STRIKE_STEP_MS = 1_500;

/** Share of hits that only damages a building; the rest destroy it */
export const DAMAGE_SHARE = 0.7;
/** Output of a damaged building until it is repaired */
export const DAMAGED_OUTPUT = 0.5;

/** Chance a strike is shot down per flak battery, and the cap */
export const INTERCEPT_PER_FLAK = 0.4;
export const INTERCEPT_MAX = 0.8;

export const REPAIR_COST_DAMAGED = 10;
export const REPAIR_COST_DESTROYED = 18;
export const REPAIR_MS_DAMAGED = 6000;
export const REPAIR_MS_DESTROYED = 10_000;

/** Share of the build cost back when a building is demolished */
export const REFUND_SHARE = 0.5;

/** The ministry's procurement budget: a slow drip, plus a bonus for every drone handed over */
export const BUDGET_PER_SECOND = 1.4;
export const BUDGET_PER_DRONE = 20;
export const STARTING_CREDITS = 60;

/** A supplier can fall behind for a while, halving one building's output */
export const FIRST_SLOWDOWN_MS = 24_000;
export const SLOWDOWN_EVERY_MS = 26_000;
export const SLOWDOWN_MS = 10_000;
export const SLOWED_OUTPUT = 0.5;

export const MAX_RESOURCE_DIGITS = 1;

/*
 * Oil Tycoon Idle Clicker: the numbers. Everything the economy and the events are built from lives
 * here, so balancing never means hunting through the rules.
 */

export const PRODUCER_IDS = [
	'pumpjack',
	'tanker',
	'refinery',
	'lobbyist',
	'shadowfleet',
	'paperwork',
	'summit',
	'offshore',
	'cartel',
	'arctic',
	'driller',
	'pipeline',
	'wellhead',
	'valve',
	'drillbit',
	'rig',
	'platform',
	'platform2',
	'platform3',
	'platform4',
	'platform5',
	'platform6',
	'platform7',
	'platform8',
	'platform9',
	'platform10',
	'platform11',
	'platform12',
	'platform13',
	'platform14',
	'platform15',
	'platform16',
	'platform17',
	'platform18',
	'platform19',
	'platform20',
	'platform21',
	'platform22',
	'platform23'
] as const;

export type ProducerId = (typeof PRODUCER_IDS)[number];

export interface ProducerDef {
	id: ProducerId;
	/** Price of the first unit, in barrels */
	baseCost: number;
	/** Barrels per second one unit makes before any multiplier, on average over a cycle */
	baseCps: number;
	/**
	 * How long one production cycle lasts before any speed bonus. What a producer pumps during a
	 * cycle is paid out in one go at its end, so the bigger producers pay rarer but larger sums.
	 */
	cycleMs: number;
}

export const PRODUCERS: readonly ProducerDef[] = [
	{ id: 'pumpjack', baseCost: 15, baseCps: 0.1, cycleMs: 1_000 },
	{ id: 'tanker', baseCost: 100, baseCps: 1, cycleMs: 2_000 },
	{ id: 'refinery', baseCost: 1_100, baseCps: 8, cycleMs: 3_000 },
	{ id: 'lobbyist', baseCost: 12_000, baseCps: 47, cycleMs: 5_000 },
	{ id: 'shadowfleet', baseCost: 130_000, baseCps: 260, cycleMs: 8_000 },
	{ id: 'paperwork', baseCost: 1_400_000, baseCps: 1_400, cycleMs: 12_000 },
	{ id: 'summit', baseCost: 20_000_000, baseCps: 7_800, cycleMs: 18_000 },
	{ id: 'offshore', baseCost: 330_000_000, baseCps: 44_000, cycleMs: 25_000 },
	{ id: 'cartel', baseCost: 5_100_000_000, baseCps: 260_000, cycleMs: 35_000 },
	{ id: 'arctic', baseCost: 75_000_000_000, baseCps: 1_600_000, cycleMs: 50_000 },
	{ id: 'driller', baseCost: 1_100_000_000_000, baseCps: 9_000_000, cycleMs: 60_000 },
	{ id: 'pipeline', baseCost: 16_000_000_000_000, baseCps: 50_000_000, cycleMs: 70_000 },
	{ id: 'wellhead', baseCost: 230_000_000_000_000, baseCps: 280_000_000, cycleMs: 80_000 },
	{ id: 'valve', baseCost: 3_300_000_000_000_000, baseCps: 1_500_000_000, cycleMs: 90_000 },
	{ id: 'drillbit', baseCost: 47_000_000_000_000_000, baseCps: 8_000_000_000, cycleMs: 100_000 },
	{ id: 'rig', baseCost: 670_000_000_000_000_000, baseCps: 45_000_000_000, cycleMs: 110_000 },
	{ id: 'platform', baseCost: 9_500_000_000_000_000_000, baseCps: 250_000_000_000, cycleMs: 120_000 },
	{ id: 'platform2', baseCost: 135_000_000_000_000_000_000, baseCps: 1_400_000_000_000, cycleMs: 130_000 },
	{ id: 'platform3', baseCost: 1_900_000_000_000_000_000_000, baseCps: 7_800_000_000_000, cycleMs: 140_000 },
	{ id: 'platform4', baseCost: 27_000_000_000_000_000_000_000, baseCps: 43_000_000_000_000, cycleMs: 150_000 },
	{ id: 'platform5', baseCost: 380_000_000_000_000_000_000_000, baseCps: 240_000_000_000_000, cycleMs: 160_000 },
	{ id: 'platform6', baseCost: 5_400_000_000_000_000_000_000_000, baseCps: 1_300_000_000_000_000, cycleMs: 170_000 },
	{ id: 'platform7', baseCost: 76_000_000_000_000_000_000_000_000, baseCps: 7_200_000_000_000_000, cycleMs: 180_000 },
	{ id: 'platform8', baseCost: 1_100_000_000_000_000_000_000_000_000, baseCps: 40_000_000_000_000_000, cycleMs: 190_000 },
	{ id: 'platform9', baseCost: 15_000_000_000_000_000_000_000_000_000, baseCps: 220_000_000_000_000_000, cycleMs: 200_000 },
	{ id: 'platform10', baseCost: 210_000_000_000_000_000_000_000_000_000, baseCps: 1_200_000_000_000_000_000, cycleMs: 210_000 },
	{ id: 'platform11', baseCost: 3_000_000_000_000_000_000_000_000_000_000, baseCps: 6_800_000_000_000_000_000, cycleMs: 220_000 },
	{ id: 'platform12', baseCost: 42_000_000_000_000_000_000_000_000_000_000, baseCps: 38_000_000_000_000_000_000, cycleMs: 230_000 },
	{ id: 'platform13', baseCost: 600_000_000_000_000_000_000_000_000_000_000, baseCps: 210_000_000_000_000_000_000, cycleMs: 240_000 },
	{ id: 'platform14', baseCost: 8_500_000_000_000_000_000_000_000_000_000_000, baseCps: 1_200_000_000_000_000_000_000, cycleMs: 250_000 },
	{ id: 'platform15', baseCost: 120_000_000_000_000_000_000_000_000_000_000_000, baseCps: 6_500_000_000_000_000_000_000, cycleMs: 260_000 },
	{ id: 'platform16', baseCost: 1_700_000_000_000_000_000_000_000_000_000_000, baseCps: 3_500_000_000_000_000_000, cycleMs: 270_000 },
	{ id: 'platform17', baseCost: 2_700_000_000_000_000_000_000_000_000_000_000, baseCps: 19_000_000_000_000_000_000, cycleMs: 280_000 },
	{ id: 'platform18', baseCost: 4_000_000_000_000_000_000_000_000_000_000_000, baseCps: 11_000_000_000_000_000_000, cycleMs: 290_000 },
	{ id: 'platform19', baseCost: 5_800_000_000_000_000_000_000_000_000_000_000, baseCps: 6_000_000_000_000_000_000, cycleMs: 300_000 },
	{ id: 'platform20', baseCost: 8_300_000_000_000_000_000_000_000_000_000_000, baseCps: 33_000_000_000_000_000_000, cycleMs: 310_000 },
	{ id: 'platform21', baseCost: 12_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 1_700_000_000_000_000_000, cycleMs: 320_000 },
	{ id: 'platform22', baseCost: 18_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 9_200_000_000_000_000_000, cycleMs: 330_000 },
	{ id: 'platform23', baseCost: 27_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 5_100_000_000_000_000_000, cycleMs: 340_000 },
	{ id: 'superplatform', baseCost: 40_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 28_000_000_000_000_000_000, cycleMs: 350_000 },
	{ id: 'megaplatform', baseCost: 60_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 150_000_000_000_000_000_000, cycleMs: 360_000 },
	{ id: 'gigaplatform', baseCost: 90_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 820_000_000_000_000_000_000, cycleMs: 370_000 },
	{ id: 'teraplatform', baseCost: 135_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 4_500_000_000_000_000_000_000, cycleMs: 380_000 },
	{ id: 'exaplatform', baseCost: 200_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 25_000_000_000_000_000_000_000, cycleMs: 390_000 },
	{ id: 'zetaplatform', baseCost: 300_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 140_000_000_000_000_000_000_000, cycleMs: 400_000 },
	{ id: 'yottaplatform', baseCost: 450_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 770_000_000_000_000_000_000_000, cycleMs: 410_000 },
	{ id: 'ultraplatform', baseCost: 675_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 4_200_000_000_000_000_000_000_000, cycleMs: 420_000 },
	{ id: 'infinityplatform', baseCost: 1_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 23_000_000_000_000_000_000_000_000, cycleMs: 430_000 },
	{ id: 'eternityplatform', baseCost: 1_500_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000_000, baseCps: 125_000_000_000_000_000_000_000_000, cycleMs: 440_000 }
];

/** No speed bonus makes a cycle shorter than this */
export const MIN_CYCLE_MS = 200;

/** Every unit bought makes the next one this much dearer */
export const COST_GROWTH = 1.15;

/** More than this of one producer is never accepted from a save file */
export const MAX_OWNED = 1000;

/** Barrels one tap pumps before any multiplier */
export const BASE_TAP = 1;
/** Chance for a critical tap */
export const CRIT_CHANCE = 0.05;
/** Critical tap multiplier */
export const CRIT_MULT = 2;

/** The game logic advances in steps of this many milliseconds */
export const STEP_MS = 100;

// Prestige ("nationalize and restart")
/** A run has to pump this many barrels before nationalizing pays a single point */
export const PRESTIGE_UNIT = 1_000_000;
/** Every prestige point adds this much to the permanent multiplier */
export const PRESTIGE_BONUS = 0.05;

/** Discounts from achievements never make producers cheaper than this share of their price */
export const MIN_PRICE_FACTOR = 0.5;

// The nationalization shop: permanent investments bought with prestige points
export const PERK_IDS = ['growth', 'output', 'speed', 'tap', 'seed', 'offline', 'fake_news', 'invest_boost'] as const;

export type PerkId = (typeof PERK_IDS)[number];

export interface PerkDef {
	id: PerkId;
	maxLevel: number;
	/** Points the first level costs; every further level costs costGrowth times as much */
	baseCost: number;
	costGrowth: number;
	/**
	 * What one level does. growth: taken off the price rise per unit; output, speed and tap: a
	 * bonus share; offline: added to the offline rate; seed: the barrels a run starts with at the
	 * first level, ten times as many per further level
	 */
	value: number;
}

export const PERKS: readonly PerkDef[] = [
	{ id: 'growth', maxLevel: 5, baseCost: 3, costGrowth: 2.5, value: 0.008 },
	{ id: 'output', maxLevel: 25, baseCost: 2, costGrowth: 1.6, value: 0.08 },
	{ id: 'speed', maxLevel: 10, baseCost: 3, costGrowth: 1.8, value: 0.08 },
	{ id: 'tap', maxLevel: 10, baseCost: 2, costGrowth: 1.7, value: 0.4 },
	{ id: 'seed', maxLevel: 6, baseCost: 2, costGrowth: 2.8, value: 80 },
	{ id: 'offline', maxLevel: 5, baseCost: 3, costGrowth: 2.0, value: 0.08 },
	{ id: 'fake_news', maxLevel: 3, baseCost: 2000, costGrowth: 20, value: 2.5 },
	{ id: 'invest_boost', maxLevel: 10, baseCost: 50, costGrowth: 3, value: 0.01 }
];

// Offline progress
/** Away time beyond this is not credited */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
/** Share of the normal output that is credited for away time */
export const OFFLINE_EFFICIENCY = 0.5;
/** Shorter absences are not worth a welcome-back report */
export const WELCOME_MIN_MS = 30_000;

// Random events
export const EVENT_FIRST_MIN_MS = 30_000;
export const EVENT_FIRST_MAX_MS = 60_000;
export const EVENT_GAP_MIN_MS = 40_000;
export const EVENT_GAP_MAX_MS = 90_000;
/** Retry delay when no event fits the current situation */
export const EVENT_RETRY_MS = 10_000;
/** Quiet time after coming back from an absence, so a crisis never greets the player */
export const EVENT_AFTER_RETURN_MS = 20_000;
/** How long the player has to decide */
export const EVENT_DECISION_MS = 12_000;

/** Price spike: selling now pays this many seconds of output; holding gambles */
export const SPIKE_SELL_SECONDS = 30;
export const SPIKE_BOOM_CHANCE = 0.5;
export const SPIKE_BOOM_MULT = 4;
export const SPIKE_CRASH_MULT = 0.5;
export const SPIKE_EFFECT_MS = 30_000;

/** Sanctions: a producer is cut for a while; reflagging costs a share of its output */
export const SANCTION_CUT_MS = 45_000;
export const SANCTION_REFLAG_SECONDS = 15;

/** Pipeline maintenance: fix it now (slow for a short while) or postpone (maybe a leak) */
export const PIPELINE_FIX_MULT = 0.5;
export const PIPELINE_FIX_MS = 20_000;
export const PIPELINE_LEAK_CHANCE = 0.25;
export const PIPELINE_LEAK_MULT = 0.2;
export const PIPELINE_LEAK_MS = 45_000;

/** Environmental protest: greenwash it (pay) or wait it out (taps blocked, output down) */
export const PROTEST_GREENWASH_SECONDS = 8;
export const PROTEST_MULT = 0.7;
export const PROTEST_MS = 25_000;

// Upgrades
export type UpgradeKind = 'click' | 'clickCps' | 'producer' | 'global';

export type UpgradeRequirement =
	| { type: 'none' }
	| { type: 'owned'; producer: ProducerId; count: number }
	| { type: 'total'; count: number };

export interface UpgradeDef {
	id: string;
	kind: UpgradeKind;
	cost: number;
	requires: UpgradeRequirement;
	/** click and global: a multiplier; clickCps: the share of output a tap adds; producer: a multiplier */
	value: number;
	producer?: ProducerId;
	/** Position among the producer's tiers, 1 to 3 (producer upgrades only) */
	tier?: number;
}

/** [owned units needed, cost in units of the producer's base price] */
const TIERS: readonly (readonly [number, number])[] = [
	[5, 10],
	[25, 250],
	[50, 2_500],
	[100, 25_000],
	[250, 250_000],
	[500, 2_500_000]
];

const CLICK_UPGRADES: readonly UpgradeDef[] = [
	{ id: 'click_bucket', kind: 'click', cost: 100, requires: { type: 'none' }, value: 2 },
	{ id: 'click_valve', kind: 'click', cost: 1_000, requires: { type: 'none' }, value: 2 },
	{ id: 'click_hammer', kind: 'click', cost: 50_000, requires: { type: 'none' }, value: 2 },
	{ id: 'click_wrench', kind: 'click', cost: 5_000_000, requires: { type: 'none' }, value: 2 },
	{
		id: 'clickcps_hands',
		kind: 'clickCps',
		cost: 25_000,
		requires: { type: 'total', count: 10 },
		value: 0.01
	},
	{
		id: 'clickcps_ribbon',
		kind: 'clickCps',
		cost: 5_000_000,
		requires: { type: 'total', count: 50 },
		value: 0.02
	},
	{
		id: 'crit_chance',
		kind: 'click',
		cost: 10_000,
		requires: { type: 'none' },
		value: 1.5
	},
	{
		id: 'crit_mult',
		kind: 'click',
		cost: 250_000,
		requires: { type: 'owned', producer: 'pumpjack', count: 5 },
		value: 2
	}
];

const GLOBAL_UPGRADES: readonly UpgradeDef[] = [
	{
		id: 'global_regulator',
		kind: 'global',
		cost: 250_000,
		requires: { type: 'total', count: 25 },
		value: 1.25
	},
	{
		id: 'global_agency',
		kind: 'global',
		cost: 25_000_000,
		requires: { type: 'total', count: 100 },
		value: 1.5
	},
	{
		id: 'global_amendment',
		kind: 'global',
		cost: 2_500_000_000,
		requires: { type: 'total', count: 250 },
		value: 2
	}
];

const PRODUCER_UPGRADES: readonly UpgradeDef[] = PRODUCERS.flatMap((producer) =>
	TIERS.map(([count, costUnits], index) => ({
		id: `${producer.id}_${index + 1}`,
		kind: 'producer' as const,
		cost: producer.baseCost * costUnits,
		requires: { type: 'owned' as const, producer: producer.id, count },
		value: 2,
		producer: producer.id,
		tier: index + 1
	}))
);

export const UPGRADES: readonly UpgradeDef[] = [
	...CLICK_UPGRADES,
	...PRODUCER_UPGRADES,
	...GLOBAL_UPGRADES
];

// Achievements
export type AchievementKind =
	| 'taps'
	| 'lifetime'
	| 'owned'
	| 'producers'
	| 'cps'
	| 'upgrades'
	| 'events'
	| 'evaded'
	| 'prestige'
	| 'perks';

/**
 * The small permanent boost an achievement unlocks. tap, output and speed: a bonus share;
 * discount: a share off producer prices; producer: a bonus share for one producer's output.
 * Boosts of the same kind add up.
 */
export type AchievementReward =
	| { kind: 'tap' | 'output' | 'speed' | 'discount'; value: number }
	| { kind: 'producer'; value: number; producer: ProducerId };

export interface AchievementDef {
	id: string;
	kind: AchievementKind;
	threshold: number;
	reward: AchievementReward;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
	{ id: 'first_tap', kind: 'taps', threshold: 1, reward: { kind: 'tap', value: 0.05 } },
	{ id: 'tapper', kind: 'taps', threshold: 100, reward: { kind: 'tap', value: 0.1 } },
	{ id: 'tap_master', kind: 'taps', threshold: 1_000, reward: { kind: 'tap', value: 0.15 } },
	{ id: 'tap_legend', kind: 'taps', threshold: 10_000, reward: { kind: 'tap', value: 0.25 } },
	{ id: 'kilo', kind: 'lifetime', threshold: 1e3, reward: { kind: 'output', value: 0.02 } },
	{ id: 'mega', kind: 'lifetime', threshold: 1e6, reward: { kind: 'output', value: 0.03 } },
	{ id: 'giga', kind: 'lifetime', threshold: 1e9, reward: { kind: 'output', value: 0.05 } },
	{ id: 'tera', kind: 'lifetime', threshold: 1e12, reward: { kind: 'output', value: 0.05 } },
	{ id: 'peta', kind: 'lifetime', threshold: 1e15, reward: { kind: 'output', value: 0.1 } },
	{ id: 'stack', kind: 'owned', threshold: 10, reward: { kind: 'discount', value: 0.02 } },
	{ id: 'hoard', kind: 'owned', threshold: 50, reward: { kind: 'discount', value: 0.03 } },
	{ id: 'centurion', kind: 'owned', threshold: 100, reward: { kind: 'discount', value: 0.05 } },
	{
		id: 'diversified',
		kind: 'producers',
		threshold: PRODUCER_IDS.length,
		reward: { kind: 'output', value: 0.1 }
	},
	{ id: 'flow', kind: 'cps', threshold: 1e3, reward: { kind: 'speed', value: 0.05 } },
	{ id: 'torrent', kind: 'cps', threshold: 1e6, reward: { kind: 'speed', value: 0.05 } },
	{ id: 'gusher', kind: 'cps', threshold: 1e9, reward: { kind: 'speed', value: 0.1 } },
	{
		id: 'paper_trail',
		kind: 'upgrades',
		threshold: 10,
		reward: { kind: 'producer', value: 0.25, producer: 'paperwork' }
	},
	{ id: 'crisis_manager', kind: 'events', threshold: 10, reward: { kind: 'output', value: 0.05 } },
	{
		id: 'loophole',
		kind: 'evaded',
		threshold: 3,
		reward: { kind: 'producer', value: 0.25, producer: 'shadowfleet' }
	},
	{ id: 'nationalised', kind: 'prestige', threshold: 1, reward: { kind: 'output', value: 0.05 } },
	{
		id: 'serial_nationaliser',
		kind: 'prestige',
		threshold: 5,
		reward: { kind: 'speed', value: 0.05 }
	},
	{ id: 'state_owned', kind: 'prestige', threshold: 10, reward: { kind: 'speed', value: 0.1 } },
	{ id: 'investor', kind: 'perks', threshold: 10, reward: { kind: 'tap', value: 0.25 } },
	{ id: 'magnate', kind: 'perks', threshold: 30, reward: { kind: 'output', value: 0.1 } },
	{ id: 'tycoon_king', kind: 'prestige', threshold: 25, reward: { kind: 'speed', value: 0.15 } },
	{ id: 'oil_barbarian', kind: 'taps', threshold: 100_000, reward: { kind: 'tap', value: 0.3 } },
	{ id: 'drill_master', kind: 'owned', threshold: 500, reward: { kind: 'discount', value: 0.08 } },
	{ id: 'global_dominator', kind: 'upgrades', threshold: 50, reward: { kind: 'output', value: 0.2 } },
	{ id: 'crisis_legend', kind: 'events', threshold: 50, reward: { kind: 'speed', value: 0.1 } },
	{ id: 'fake_warrior', kind: 'perks', threshold: 5, reward: { kind: 'tap', value: 0.15 } },
	{ id: 'platform_king', kind: 'producers', threshold: 15, reward: { kind: 'producer', value: 0.2, producer: 'platform' } },
	{ id: 'pipeline_king', kind: 'producers', threshold: 5, reward: { kind: 'producer', value: 0.15, producer: 'pipeline' } },
	{ id: 'well_king', kind: 'producers', threshold: 5, reward: { kind: 'producer', value: 0.15, producer: 'wellhead' } },
	{ id: 'rig_king', kind: 'producers', threshold: 5, reward: { kind: 'producer', value: 0.15, producer: 'rig' } },
	{ id: 'monocle_king', kind: 'perks', threshold: 5, reward: { kind: 'tap', value: 0.2 } }
];

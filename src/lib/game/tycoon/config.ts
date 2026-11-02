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
	'platform23',
	'superplatform',
	'megaplatform',
	'gigaplatform',
	'teraplatform',
	'exaplatform',
	'zetaplatform',
	'yottaplatform',
	'ultraplatform',
	'infinityplatform',
	'eternityplatform'
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
	{ id: 'pumpjack', baseCost: 15, baseCps: 0.1, cycleMs: 1_000 }, // pays for itself in 150s
	{ id: 'tanker', baseCost: 180, baseCps: 1.12, cycleMs: 2_000 }, // pays for itself in 161s
	{ id: 'refinery', baseCost: 2_160, baseCps: 12.6, cycleMs: 3_000 }, // pays for itself in 172s
	{ id: 'lobbyist', baseCost: 25_900, baseCps: 141, cycleMs: 5_000 }, // pays for itself in 184s
	{ id: 'shadowfleet', baseCost: 311_000, baseCps: 1_580, cycleMs: 8_000 }, // pays for itself in 197s
	{ id: 'paperwork', baseCost: 3_730_000, baseCps: 17_700, cycleMs: 12_000 }, // pays for itself in 210s
	{ id: 'summit', baseCost: 44_800_000, baseCps: 199_000, cycleMs: 18_000 }, // pays for itself in 225s
	{ id: 'offshore', baseCost: 537_000_000, baseCps: 2_230_000, cycleMs: 25_000 }, // pays for itself in 241s
	{ id: 'cartel', baseCost: 6_450_000_000, baseCps: 25_000_000, cycleMs: 35_000 }, // pays for itself in 258s
	{ id: 'arctic', baseCost: 77_400_000_000, baseCps: 281_000_000, cycleMs: 50_000 }, // pays for itself in 276s
	{ id: 'driller', baseCost: 929_000_000_000, baseCps: 3_150_000_000, cycleMs: 60_000 }, // pays for itself in 295s
	{ id: 'pipeline', baseCost: 11_100_000_000_000, baseCps: 35_300_000_000, cycleMs: 70_000 }, // pays for itself in 316s
	{ id: 'wellhead', baseCost: 134_000_000_000_000, baseCps: 396_000_000_000, cycleMs: 80_000 }, // pays for itself in 338s
	{ id: 'valve', baseCost: 1.6e15, baseCps: 4_440_000_000_000, cycleMs: 90_000 }, // pays for itself in 361s
	{ id: 'drillbit', baseCost: 1.93e16, baseCps: 49_800_000_000_000, cycleMs: 100_000 }, // pays for itself in 387s
	{ id: 'rig', baseCost: 2.31e17, baseCps: 558_000_000_000_000, cycleMs: 110_000 }, // pays for itself in 414s
	{ id: 'platform', baseCost: 2.77e18, baseCps: 6.26e15, cycleMs: 120_000 }, // pays for itself in 443s
	{ id: 'platform2', baseCost: 3.33e19, baseCps: 7.02e16, cycleMs: 130_000 }, // pays for itself in 474s
	{ id: 'platform3', baseCost: 3.99e20, baseCps: 7.88e17, cycleMs: 140_000 }, // pays for itself in 507s
	{ id: 'platform4', baseCost: 4.79e21, baseCps: 8.83e18, cycleMs: 150_000 }, // pays for itself in 542s
	{ id: 'platform5', baseCost: 5.75e22, baseCps: 9.91e19, cycleMs: 160_000 }, // pays for itself in 580s
	{ id: 'platform6', baseCost: 6.9e23, baseCps: 1.11e21, cycleMs: 170_000 }, // pays for itself in 621s
	{ id: 'platform7', baseCost: 8.28e24, baseCps: 1.25e22, cycleMs: 180_000 }, // pays for itself in 665s
	{ id: 'platform8', baseCost: 9.94e25, baseCps: 1.4e23, cycleMs: 190_000 }, // pays for itself in 711s
	{ id: 'platform9', baseCost: 1.19e27, baseCps: 1.57e24, cycleMs: 200_000 }, // pays for itself in 761s
	{ id: 'platform10', baseCost: 1.43e28, baseCps: 1.76e25, cycleMs: 210_000 }, // pays for itself in 814s
	{ id: 'platform11', baseCost: 1.72e29, baseCps: 1.97e26, cycleMs: 220_000 }, // pays for itself in 871s
	{ id: 'platform12', baseCost: 2.06e30, baseCps: 2.21e27, cycleMs: 230_000 }, // pays for itself in 932s
	{ id: 'platform13', baseCost: 2.47e31, baseCps: 2.48e28, cycleMs: 240_000 }, // pays for itself in 997s
	{ id: 'platform14', baseCost: 2.97e32, baseCps: 2.78e29, cycleMs: 250_000 }, // pays for itself in 1067s
	{ id: 'platform15', baseCost: 3.56e33, baseCps: 3.12e30, cycleMs: 260_000 }, // pays for itself in 1142s
	{ id: 'platform16', baseCost: 4.27e34, baseCps: 3.5e31, cycleMs: 270_000 }, // pays for itself in 1222s
	{ id: 'platform17', baseCost: 5.13e35, baseCps: 3.92e32, cycleMs: 280_000 }, // pays for itself in 1307s
	{ id: 'platform18', baseCost: 6.15e36, baseCps: 4.4e33, cycleMs: 290_000 }, // pays for itself in 1399s
	{ id: 'platform19', baseCost: 7.38e37, baseCps: 4.93e34, cycleMs: 300_000 }, // pays for itself in 1497s
	{ id: 'platform20', baseCost: 8.86e38, baseCps: 5.53e35, cycleMs: 310_000 }, // pays for itself in 1601s
	{ id: 'platform21', baseCost: 1.06e40, baseCps: 6.2e36, cycleMs: 320_000 }, // pays for itself in 1714s
	{ id: 'platform22', baseCost: 1.28e41, baseCps: 6.96e37, cycleMs: 330_000 }, // pays for itself in 1834s
	{ id: 'platform23', baseCost: 1.53e42, baseCps: 7.8e38, cycleMs: 340_000 }, // pays for itself in 1962s
	{ id: 'superplatform', baseCost: 1.84e43, baseCps: 8.75e39, cycleMs: 350_000 }, // pays for itself in 2099s
	{ id: 'megaplatform', baseCost: 2.2e44, baseCps: 9.82e40, cycleMs: 360_000 }, // pays for itself in 2246s
	{ id: 'gigaplatform', baseCost: 2.65e45, baseCps: 1.1e42, cycleMs: 370_000 }, // pays for itself in 2403s
	{ id: 'teraplatform', baseCost: 3.17e46, baseCps: 1.23e43, cycleMs: 380_000 }, // pays for itself in 2572s
	{ id: 'exaplatform', baseCost: 3.81e47, baseCps: 1.38e44, cycleMs: 390_000 }, // pays for itself in 2752s
	{ id: 'zetaplatform', baseCost: 4.57e48, baseCps: 1.55e45, cycleMs: 400_000 }, // pays for itself in 2944s
	{ id: 'yottaplatform', baseCost: 5.49e49, baseCps: 1.74e46, cycleMs: 410_000 }, // pays for itself in 3150s
	{ id: 'ultraplatform', baseCost: 6.58e50, baseCps: 1.95e47, cycleMs: 420_000 }, // pays for itself in 3371s
	{ id: 'infinityplatform', baseCost: 7.9e51, baseCps: 2.19e48, cycleMs: 430_000 }, // pays for itself in 3607s
	{ id: 'eternityplatform', baseCost: 9.48e52, baseCps: 2.46e49, cycleMs: 440_000 }, // pays for itself in 3859s
];

/** No speed bonus makes a cycle shorter than this */
export const MIN_CYCLE_MS = 200;

/** Every unit bought makes the next one this much dearer */
export const COST_GROWTH = 1.12;

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
export const PERK_IDS = [
	'growth',
	'output',
	'speed',
	'tap',
	'seed',
	'offline',
	'fake_news',
	'invest_boost',
	'crit_chance',
	'crit_mult',
	'turbo'
] as const;

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
	 * first level, ten times as many per further level; fake_news: the Fake News coins one level
	 * pays when it is bought, within the daily coin cap; crit_chance: added to the chance of a
	 * critical tap; crit_mult: added to the multiplier of a critical tap
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
	{ id: 'fake_news', maxLevel: 3, baseCost: 2000, costGrowth: 20, value: 50 },
	{ id: 'invest_boost', maxLevel: 10, baseCost: 50, costGrowth: 3, value: 0.01 },
	{ id: 'crit_chance', maxLevel: 10, baseCost: 4, costGrowth: 1.7, value: 0.02 },
	{ id: 'crit_mult', maxLevel: 10, baseCost: 4, costGrowth: 1.7, value: 0.25 },
	{ id: 'turbo', maxLevel: 3, baseCost: 100, costGrowth: 3, value: 1.0 }
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
export type UpgradeKind = 'click' | 'clickCps' | 'producer' | 'global' | 'speed' | 'events';

export type UpgradeRequirement =
	| { type: 'none' }
	| { type: 'owned'; producer: ProducerId; count: number }
	| { type: 'total'; count: number };

export interface UpgradeDef {
	id: string;
	kind: UpgradeKind;
	cost: number;
	requires: UpgradeRequirement;
	/**
	 * click and global: a multiplier; clickCps: the share of output a tap adds; producer: a
	 * multiplier; speed: a multiplier on the cycle speed; events: a multiplier on crisis payouts
	 */
	value: number;
	producer?: ProducerId;
	/** Position among the producer's tiers, counting from 1 (producer upgrades only) */
	tier?: number;
}

/** [owned units needed, cost in units of the producer's base price] */
const TIERS: readonly (readonly [number, number])[] = [
	[5, 1],
	[10, 2],
	[25, 5],
	[50, 10],
	[100, 250],
	[200, 2500],
	[300, 25_000],
	[400, 250_000],
	[500, 2_500_000],
	[600, 25_000_000],
	[700, 250_000_000],
	[800, 2_500_000_000],
	[900, 25_000_000_000],
	[1000, 250_000_000_000]
];

const CLICK_UPGRADES: readonly UpgradeDef[] = [
	{ id: 'click_bucket', kind: 'click', cost: 100, requires: { type: 'none' }, value: 2 },
	{ id: 'click_valve', kind: 'click', cost: 1_000, requires: { type: 'none' }, value: 2 },
	{ id: 'click_hammer', kind: 'click', cost: 50_000, requires: { type: 'none' }, value: 2 },
	{ id: 'click_wrench', kind: 'click', cost: 5_000_000, requires: { type: 'none' }, value: 2 },
	{ id: 'click_fist', kind: 'click', cost: 25_000_000, requires: { type: 'none' }, value: 3 },
	{ id: 'click_crane', kind: 'click', cost: 250_000_000, requires: { type: 'none' }, value: 4 },
	{ id: 'click_titan', kind: 'click', cost: 2_500_000_000, requires: { type: 'none' }, value: 5 },
	{ id: 'click_nitro', kind: 'click', cost: 100_000_000_000, requires: { type: 'none' }, value: 3 },
	{ id: 'click_megatap', kind: 'click', cost: 500_000_000_000, requires: { type: 'total', count: 500 }, value: 6 },
	{ id: 'click_god', kind: 'click', cost: 5_000_000_000_000, requires: { type: 'total', count: 2000 }, value: 10 },
	{ id: 'click_ultimate', kind: 'click', cost: 500_000_000_000_000, requires: { type: 'total', count: 5000 }, value: 20 },
	{ id: 'event_boost', kind: 'events', cost: 500_000, requires: { type: 'none' }, value: 1.25 },
	{ id: 'event_master', kind: 'events', cost: 50_000_000, requires: { type: 'none' }, value: 1.5 },
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
	},
	{
		id: 'global_mega',
		kind: 'global',
		cost: 500_000_000_000,
		requires: { type: 'total', count: 500 },
		value: 3
	},
	{
		id: 'global_titan',
		kind: 'global',
		cost: 2_500_000_000_000,
		requires: { type: 'total', count: 1000 },
		value: 4
	},
	{
		id: 'global_immortal',
		kind: 'global',
		cost: 25_000_000_000_000,
		requires: { type: 'total', count: 2000 },
		value: 6
	}
];

/**
 * The three dearest shop upgrades: each makes every production cycle 2% faster. They are bought
 * late, after most of the producers are already heavily invested in.
 */
const SPEED_UPGRADES: readonly UpgradeDef[] = [
	{
		id: 'speed_compressor',
		kind: 'speed',
		cost: 10_000_000_000_000,
		requires: { type: 'total', count: 1200 },
		value: 1.02
	},
	{
		id: 'speed_overdrive',
		kind: 'speed',
		cost: 1_000_000_000_000_000,
		requires: { type: 'total', count: 1600 },
		value: 1.02
	},
	{
		id: 'speed_singularity',
		kind: 'speed',
		cost: 100_000_000_000_000_000,
		requires: { type: 'total', count: 2000 },
		value: 1.02
	}
];

const PRODUCER_UPGRADES: readonly UpgradeDef[] = PRODUCERS.flatMap((producer) =>
	TIERS.map(([count, costUnits], index) => ({
		id: `${producer.id}_${index + 1}`,
		kind: 'producer' as const,
		cost: producer.baseCost * costUnits,
		requires: { type: 'owned' as const, producer: producer.id, count },
		value: 2, // doubles producer output per tier
		producer: producer.id,
		tier: index + 1
	}))
);

const EXTRA_UPGRADES: readonly UpgradeDef[] = [
	{ id: 'click_augment', kind: 'click', cost: 500_000, requires: { type: 'none' }, value: 3 },
	{ id: 'click_telegraph', kind: 'click', cost: 5_000_000, requires: { type: 'none' }, value: 4 },
	{ id: 'click_neural', kind: 'click', cost: 50_000_000, requires: { type: 'total', count: 50 }, value: 6 },
	{ id: 'click_rocket', kind: 'click', cost: 1_000_000_000, requires: { type: 'total', count: 500 }, value: 8 },
	{ id: 'global_solo', kind: 'global', cost: 10_000_000, requires: { type: 'total', count: 30 }, value: 2.25 },
	{ id: 'global_legislature', kind: 'global', cost: 100_000_000, requires: { type: 'total', count: 150 }, value: 3 },
	{ id: 'global_pivot', kind: 'global', cost: 2_500_000_000, requires: { type: 'total', count: 400 }, value: 4.5 },
	{ id: 'global_reinforcement', kind: 'global', cost: 5_000_000_000, requires: { type: 'total', count: 800 }, value: 6 },
	{ id: 'event_backing', kind: 'events', cost: 2_000_000, requires: { type: 'none' }, value: 1.4 },
	{ id: 'clickcps_share', kind: 'clickCps', cost: 5_000_000, requires: { type: 'total', count: 50 }, value: 0.03 },
];

export const UPGRADES: readonly UpgradeDef[] = [
	...CLICK_UPGRADES,
	...PRODUCER_UPGRADES,
	...GLOBAL_UPGRADES,
	...SPEED_UPGRADES,
	...EXTRA_UPGRADES
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
	| 'perks'
	/** Producers owned at the most that can be owned */
	| 'maxed';

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
	reward?: AchievementReward;
	/** Unlocks clothing instead of a game bonus */
	clothing?: { part: string; value: string };
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
	{ id: 'tycoon_king', kind: 'prestige', threshold: 25, clothing: { part: 'hat', value: 'cylinder' } },
	{ id: 'oil_barbarian', kind: 'taps', threshold: 100_000, reward: { kind: 'tap', value: 0.3 } },
	{ id: 'drill_master', kind: 'owned', threshold: 500, reward: { kind: 'discount', value: 0.08 } },
	{
		id: 'global_dominator',
		kind: 'upgrades',
		threshold: 50,
		reward: { kind: 'output', value: 0.2 }
	},
	{ id: 'crisis_legend', kind: 'events', threshold: 50, reward: { kind: 'speed', value: 0.1 } },
	{ id: 'fake_warrior', kind: 'perks', threshold: 5, reward: { kind: 'tap', value: 0.15 } },
	{
		id: 'platform_king',
		kind: 'producers',
		threshold: 15,
		reward: { kind: 'producer', value: 0.2, producer: 'platform' }
	},
	{
		id: 'pipeline_king',
		kind: 'producers',
		threshold: 5,
		reward: { kind: 'producer', value: 0.15, producer: 'pipeline' }
	},
	{
		id: 'well_king',
		kind: 'producers',
		threshold: 5,
		reward: { kind: 'producer', value: 0.15, producer: 'wellhead' }
	},
	{
		id: 'rig_king',
		kind: 'producers',
		threshold: 5,
		reward: { kind: 'producer', value: 0.15, producer: 'rig' }
	},
	{ id: 'monocle_king', kind: 'perks', threshold: 5, reward: { kind: 'tap', value: 0.2 } },
	{ id: 'max_200', kind: 'owned', threshold: 200, reward: { kind: 'discount', value: 0.05 } },
	{ id: 'max_400', kind: 'owned', threshold: 400, reward: { kind: 'discount', value: 0.08 } },
	{ id: 'max_600', kind: 'owned', threshold: 600, reward: { kind: 'discount', value: 0.1 } },
	{ id: 'max_800', kind: 'owned', threshold: 800, reward: { kind: 'discount', value: 0.12 } },
	{ id: 'max_1000', kind: 'owned', threshold: 1000, reward: { kind: 'discount', value: 0.15 } },
	{ id: 'maxed_5', kind: 'maxed', threshold: 5, reward: { kind: 'output', value: 0.05 } },
	{ id: 'maxed_10', kind: 'maxed', threshold: 10, reward: { kind: 'output', value: 0.1 } },
	{ id: 'maxed_25', kind: 'maxed', threshold: 25, reward: { kind: 'output', value: 0.15 } },
	{
		id: 'maxed_all',
		kind: 'maxed',
		threshold: PRODUCER_IDS.length,
		clothing: { part: 'hat', value: 'monocle' }
	}
];

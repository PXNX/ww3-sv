/*
 * War Room: the numbers behind the campaign. The map, the resources, the factories, the division
 * templates and the combat tuning all live here, so balancing never means hunting through the
 * rules. The campaign is turn-based: one day is one production step and one round of orders.
 */

export const RESOURCE_IDS = ['steel', 'oil', 'rare', 'grain'] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export const EQUIPMENT_IDS = ['rifles', 'armour', 'guns', 'trucks'] as const;

export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const FACTORY_IDS = ['arms', 'tanks', 'guns', 'trucks'] as const;

export type FactoryId = (typeof FACTORY_IDS)[number];

export const TEMPLATE_IDS = ['infantry', 'armour', 'artillery', 'mech'] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const REGION_IDS = [
	'capital',
	'rustbelt',
	'ridge',
	'grain',
	'tar',
	'marsh',
	'plains',
	'foundry',
	'wells',
	'redcapital'
] as const;

export type RegionId = (typeof REGION_IDS)[number];

export type Owner = 'player' | 'enemy';

export type Terrain = 'plains' | 'urban' | 'mountains' | 'marsh' | 'desert';

/** How much tougher the defender is in each terrain */
export const TERRAIN_DEFENCE: Record<Terrain, number> = {
	plains: 1,
	urban: 1.3,
	mountains: 1.5,
	marsh: 1.2,
	desert: 1
};

export interface RegionDef {
	id: RegionId;
	/** Position on the map in percent of its width and height */
	x: number;
	y: number;
	terrain: Terrain;
	/** How many supply points the region can carry before every division is cut short */
	supplyCap: number;
	/** Factory slots a region offers */
	slots: number;
	/** What the region pays its owner every day */
	income: { resource: ResourceId; amount: number };
	neighbors: readonly RegionId[];
}

export const REGIONS: readonly RegionDef[] = [
	{
		id: 'capital',
		x: 12,
		y: 46,
		terrain: 'urban',
		supplyCap: 8,
		slots: 1,
		income: { resource: 'steel', amount: 4 },
		neighbors: ['tar', 'rustbelt', 'grain']
	},
	{
		id: 'rustbelt',
		x: 34,
		y: 40,
		terrain: 'urban',
		supplyCap: 8,
		slots: 2,
		income: { resource: 'steel', amount: 6 },
		neighbors: ['capital', 'ridge', 'marsh', 'grain']
	},
	{
		id: 'ridge',
		x: 45,
		y: 12,
		terrain: 'mountains',
		supplyCap: 4,
		slots: 1,
		income: { resource: 'rare', amount: 6 },
		neighbors: ['tar', 'rustbelt', 'marsh', 'wells']
	},
	{
		id: 'grain',
		x: 24,
		y: 74,
		terrain: 'plains',
		supplyCap: 6,
		slots: 1,
		income: { resource: 'grain', amount: 8 },
		neighbors: ['capital', 'rustbelt', 'plains']
	},
	{
		id: 'tar',
		x: 15,
		y: 17,
		terrain: 'desert',
		supplyCap: 5,
		slots: 1,
		income: { resource: 'oil', amount: 8 },
		neighbors: ['capital', 'ridge']
	},
	{
		id: 'marsh',
		x: 55,
		y: 52,
		terrain: 'marsh',
		supplyCap: 4,
		slots: 0,
		income: { resource: 'grain', amount: 2 },
		neighbors: ['ridge', 'rustbelt', 'plains', 'redcapital']
	},
	{
		id: 'plains',
		x: 72,
		y: 47,
		terrain: 'plains',
		supplyCap: 6,
		slots: 0,
		income: { resource: 'grain', amount: 4 },
		neighbors: ['marsh', 'grain', 'foundry', 'redcapital']
	},
	{
		id: 'foundry',
		x: 86,
		y: 32,
		terrain: 'urban',
		supplyCap: 8,
		slots: 2,
		income: { resource: 'steel', amount: 6 },
		neighbors: ['plains', 'wells', 'redcapital']
	},
	{
		id: 'wells',
		x: 85,
		y: 14,
		terrain: 'desert',
		supplyCap: 5,
		slots: 1,
		income: { resource: 'oil', amount: 8 },
		neighbors: ['ridge', 'foundry', 'redcapital']
	},
	{
		id: 'redcapital',
		x: 75,
		y: 76,
		terrain: 'urban',
		supplyCap: 8,
		slots: 2,
		income: { resource: 'steel', amount: 4 },
		neighbors: ['marsh', 'plains', 'foundry', 'wells']
	}
];

export function regionDef(id: RegionId): RegionDef {
	const def = REGIONS.find((region) => region.id === id);
	if (!def) throw new Error(`Unknown region: ${id}`);
	return def;
}

export function neighborIds(id: RegionId): readonly RegionId[] {
	return regionDef(id).neighbors;
}

export function areNeighbors(a: RegionId, b: RegionId): boolean {
	return regionDef(a).neighbors.includes(b);
}

export interface FactoryDef {
	id: FactoryId;
	/** One-time build cost, in resources */
	cost: Partial<Record<ResourceId, number>>;
	/** What one production step consumes */
	input: Partial<Record<ResourceId, number>>;
	output: { equipment: EquipmentId; amount: number };
}

export const FACTORIES: readonly FactoryDef[] = [
	{
		id: 'arms',
		cost: { steel: 30, rare: 5 },
		input: { steel: 4, rare: 1 },
		output: { equipment: 'rifles', amount: 10 }
	},
	{
		id: 'tanks',
		cost: { steel: 40, oil: 10 },
		input: { steel: 6, oil: 3 },
		output: { equipment: 'armour', amount: 4 }
	},
	{
		id: 'guns',
		cost: { steel: 30, rare: 10 },
		input: { steel: 4, rare: 2 },
		output: { equipment: 'guns', amount: 4 }
	},
	{
		id: 'trucks',
		cost: { steel: 20, oil: 10 },
		input: { steel: 3, oil: 3 },
		output: { equipment: 'trucks', amount: 5 }
	}
];

export function factoryDef(id: FactoryId): FactoryDef {
	const def = FACTORIES.find((factory) => factory.id === id);
	if (!def) throw new Error(`Unknown factory: ${id}`);
	return def;
}

export interface TemplateDef {
	id: TemplateId;
	attack: number;
	defence: number;
	/** Morale a freshly trained division starts with */
	morale: number;
	/** Supply points the division needs in its region */
	supplyUse: number;
	trainDays: number;
	cost: Partial<Record<EquipmentId, number>>;
}

export const TEMPLATES: readonly TemplateDef[] = [
	{
		id: 'infantry',
		attack: 5,
		defence: 9,
		morale: 70,
		supplyUse: 2,
		trainDays: 1,
		cost: { rifles: 12, trucks: 2 }
	},
	{
		id: 'armour',
		attack: 14,
		defence: 5,
		morale: 55,
		supplyUse: 4,
		trainDays: 2,
		cost: { armour: 8, trucks: 4 }
	},
	{
		id: 'artillery',
		attack: 11,
		defence: 3,
		morale: 50,
		supplyUse: 3,
		trainDays: 1,
		cost: { guns: 8, trucks: 4 }
	},
	{
		id: 'mech',
		attack: 9,
		defence: 11,
		morale: 65,
		supplyUse: 3,
		trainDays: 2,
		cost: { rifles: 10, trucks: 6 }
	}
];

export function templateDef(id: TemplateId): TemplateDef {
	const def = TEMPLATES.find((template) => template.id === id);
	if (!def) throw new Error(`Unknown template: ${id}`);
	return def;
}

/** A campaign lasts this many days; the day after it ends in an armistice */
export const MAX_DAYS = 30;

/** The Pact trains one new division every this many days, up to its cap */
export const ENEMY_REINFORCE_EVERY = 2;
export const ENEMY_MAX_DIVISIONS = 10;

/** The Pact only attacks when its stack is this much stronger than the defender */
export const AI_ATTACK_RATIO = 1.15;

/** Both sides roll a strength multiplier of 1 ± this */
export const COMBAT_LUCK = 0.1;

// Supply
/** Every region further from the capital costs this many supply points */
export const SUPPLY_DISTANCE_PENALTY = 10;
/** Supply in a region cut off from the capital */
export const SUPPLY_CUT = 35;
/** No region ever has less supply than this */
export const SUPPLY_FLOOR = 40;
/** A division regenerates this much morale per day at full supply, less when cut short */
export const MORALE_REGEN = 12;
export const MORALE_REGEN_LOW = 4;

// Experience
/** Experience grows by this much per day when well supplied */
export const EXP_GAIN_PER_DAY = 1;
/** Each experience level improves combat by this factor */
export const EXP_COMBAT_BONUS = 0.08;
/** Exercising a division costs this much grain (supplies) */
export const EXERCISE_SUPPLY_COST = 2;
/** Exercising lowers morale by this much (organization) */
export const EXERCISE_MORALE_LOSS = 20;
/** Exercise gives this much experience */
export const EXERCISE_EXP_GAIN = 1;
/** Highest experience level a division can reach */
export const EXP_MAX = 10;

// Starting position
export const START_RESOURCES: Record<ResourceId, number> = {
	steel: 45,
	oil: 35,
	rare: 20,
	grain: 40
};

export const START_EQUIPMENT: Record<EquipmentId, number> = {
	rifles: 24,
	armour: 6,
	guns: 6,
	trucks: 8
};

export const START_OWNER: Record<RegionId, Owner> = {
	capital: 'player',
	rustbelt: 'player',
	ridge: 'player',
	grain: 'player',
	tar: 'player',
	marsh: 'player',
	plains: 'enemy',
	foundry: 'enemy',
	wells: 'enemy',
	redcapital: 'enemy'
};

export const START_DIVISIONS: readonly { region: RegionId; template: TemplateId }[] = [
	{ region: 'capital', template: 'infantry' },
	{ region: 'marsh', template: 'infantry' },
	{ region: 'marsh', template: 'infantry' },
	{ region: 'rustbelt', template: 'infantry' },
	{ region: 'tar', template: 'infantry' },
	{ region: 'plains', template: 'infantry' },
	{ region: 'foundry', template: 'infantry' },
	{ region: 'foundry', template: 'armour' },
	{ region: 'wells', template: 'infantry' },
	{ region: 'redcapital', template: 'infantry' }
];

// Score
export const SCORE_PER_REGION = 90;
export const SCORE_PER_KILL = 40;
export const SCORE_LOSS_PENALTY = 30;
export const SCORE_WIN_BONUS = 800;
export const SCORE_DAY_BONUS = 25;

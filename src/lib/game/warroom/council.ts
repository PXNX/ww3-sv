/*
 * The War Room council: crises that land on the desk and the daily directives. Both are data,
 * a list of declarative effects with an optional price, so the rules, the interface and the tests
 * read them the same way. Choices set flags, and flags unlock follow-up crises: a crackdown today
 * is a scandal in a few days.
 */
import type { Random } from '#lib/game/random.js';
import {
	CRISIS_EVERY,
	CRISIS_FIRST_DAY,
	EXP_MAX,
	REGION_IDS,
	type EquipmentId,
	type ResourceId
} from './config.js';
import type { WarRoomState } from './types.js';

export type Effect =
	| { kind: 'resource'; id: ResourceId; amount: number }
	| { kind: 'equipment'; id: EquipmentId; amount: number }
	| { kind: 'stability'; amount: number }
	/** Morale of every division of ours */
	| { kind: 'morale'; amount: number }
	| { kind: 'experience'; amount: number }
	/** Extra divisions the Pact trains at once (provocation) */
	| { kind: 'enemyReinforce'; amount: number }
	/** Morale of every Pact division */
	| { kind: 'enemyMorale'; amount: number }
	/** Counter-intelligence for this many days */
	| { kind: 'intel'; days: number }
	| { kind: 'flag'; id: string };

export type Cost = Partial<Record<ResourceId, number>>;

export interface CouncilOption {
	id: string;
	cost?: Cost;
	effects: Effect[];
}

export const CRISIS_IDS = [
	'sabotage',
	'strike',
	'defector',
	'aid',
	'scandal',
	'debt',
	'mutiny',
	'rumour',
	'hero'
] as const;

export type CrisisId = (typeof CRISIS_IDS)[number];

export interface CrisisDef {
	id: CrisisId;
	/** Eligibility: the day-independent conditions; flags set by earlier choices chain crises */
	when?: (state: WarRoomState) => boolean;
	/** A crisis that follows from an earlier choice is drawn before the free ones */
	chained?: boolean;
	options: [CouncilOption, CouncilOption];
}

/** What happens when the day ends with a crisis still unanswered */
export const NEGLECT_EFFECTS: Effect[] = [
	{ kind: 'stability', amount: -8 },
	{ kind: 'morale', amount: -5 }
];

const hasFlag = (id: string) => (state: WarRoomState) => state.flags.includes(id);

export const CRISES: readonly CrisisDef[] = [
	{
		id: 'sabotage',
		options: [
			{
				id: 'counter',
				cost: { oil: 8 },
				effects: [
					{ kind: 'stability', amount: 3 },
					{ kind: 'flag', id: 'vigilant' }
				]
			},
			{
				id: 'ignore',
				effects: [
					{ kind: 'equipment', id: 'trucks', amount: -4 },
					{ kind: 'stability', amount: -5 }
				]
			}
		]
	},
	{
		id: 'strike',
		options: [
			{ id: 'negotiate', cost: { grain: 10 }, effects: [{ kind: 'stability', amount: 4 }] },
			{
				id: 'crackdown',
				effects: [
					{ kind: 'stability', amount: -8 },
					{ kind: 'resource', id: 'steel', amount: 12 },
					{ kind: 'flag', id: 'harsh' }
				]
			}
		]
	},
	{
		id: 'defector',
		options: [
			{
				id: 'debrief',
				effects: [
					{ kind: 'enemyMorale', amount: -20 },
					{ kind: 'intel', days: 2 }
				]
			},
			{
				id: 'publicise',
				effects: [
					{ kind: 'stability', amount: 8 },
					{ kind: 'enemyReinforce', amount: 1 }
				]
			}
		]
	},
	{
		id: 'aid',
		options: [
			{
				id: 'accept',
				effects: [
					{ kind: 'resource', id: 'oil', amount: 20 },
					{ kind: 'resource', id: 'steel', amount: 15 },
					{ kind: 'stability', amount: -4 },
					{ kind: 'flag', id: 'indebted' }
				]
			},
			{ id: 'decline', effects: [{ kind: 'stability', amount: 3 }] }
		]
	},
	{
		id: 'scandal',
		chained: true,
		when: hasFlag('harsh'),
		options: [
			{
				id: 'deny',
				effects: [
					{ kind: 'stability', amount: -6 },
					{ kind: 'morale', amount: -5 }
				]
			},
			{ id: 'compensate', cost: { steel: 15 }, effects: [{ kind: 'stability', amount: 2 }] }
		]
	},
	{
		id: 'debt',
		chained: true,
		when: hasFlag('indebted'),
		options: [
			{ id: 'repay', cost: { steel: 20, oil: 10 }, effects: [{ kind: 'stability', amount: 2 }] },
			{
				id: 'refuse',
				effects: [
					{ kind: 'morale', amount: -10 },
					{ kind: 'stability', amount: -8 }
				]
			}
		]
	},
	{
		id: 'mutiny',
		chained: true,
		when: (state) => state.stability < 40,
		options: [
			{
				id: 'bonus',
				cost: { grain: 12, steel: 10 },
				effects: [{ kind: 'morale', amount: 15 }]
			},
			{
				id: 'purge',
				effects: [
					{ kind: 'morale', amount: -10 },
					{ kind: 'experience', amount: -1 },
					{ kind: 'stability', amount: 6 }
				]
			}
		]
	},
	{
		id: 'rumour',
		chained: true,
		when: hasFlag('vigilant'),
		options: [
			{
				id: 'preempt',
				effects: [
					{ kind: 'morale', amount: 8 },
					{ kind: 'enemyMorale', amount: -12 }
				]
			},
			{
				id: 'fortify',
				effects: [
					{ kind: 'equipment', id: 'guns', amount: 4 },
					{ kind: 'equipment', id: 'rifles', amount: 6 }
				]
			}
		]
	},
	{
		id: 'hero',
		when: (state) => state.kills >= 3,
		options: [
			{
				id: 'parade',
				effects: [
					{ kind: 'stability', amount: 10 },
					{ kind: 'morale', amount: -5 }
				]
			},
			{
				id: 'decorate',
				effects: [
					{ kind: 'experience', amount: 1 },
					{ kind: 'stability', amount: 3 }
				]
			}
		]
	}
];

export function crisisDef(id: CrisisId): CrisisDef {
	const def = CRISES.find((crisis) => crisis.id === id);
	if (!def) throw new Error(`Unknown crisis: ${id}`);
	return def;
}

export interface DirectiveDef {
	id: DirectiveId;
	cost: Cost;
	effects: Effect[];
}

export const DIRECTIVE_IDS = ['propaganda', 'mobilise', 'counterintel', 'austerity'] as const;

export type DirectiveId = (typeof DIRECTIVE_IDS)[number];

/** One directive a day; each one trades something away */
export const DIRECTIVES: readonly DirectiveDef[] = [
	{ id: 'propaganda', cost: { rare: 5 }, effects: [{ kind: 'stability', amount: 10 }] },
	{
		id: 'mobilise',
		cost: { grain: 8 },
		effects: [
			{ kind: 'morale', amount: 20 },
			{ kind: 'stability', amount: -4 }
		]
	},
	{ id: 'counterintel', cost: { oil: 8 }, effects: [{ kind: 'intel', days: 2 }] },
	{
		id: 'austerity',
		cost: {},
		effects: [
			{ kind: 'resource', id: 'steel', amount: 15 },
			{ kind: 'resource', id: 'oil', amount: 10 },
			{ kind: 'stability', amount: -6 }
		]
	}
];

export function directiveDef(id: DirectiveId): DirectiveDef {
	const def = DIRECTIVES.find((directive) => directive.id === id);
	if (!def) throw new Error(`Unknown directive: ${id}`);
	return def;
}

export function clampStability(value: number): number {
	return Math.max(0, Math.min(100, value));
}

export function canPay(state: WarRoomState, cost: Cost | undefined): boolean {
	if (!cost) return true;
	return (Object.entries(cost) as [ResourceId, number][]).every(
		([id, amount]) => state.resources[id] >= amount
	);
}

export function payCost(state: WarRoomState, cost: Cost | undefined) {
	if (!cost) return;
	for (const [id, amount] of Object.entries(cost) as [ResourceId, number][]) {
		state.resources[id] -= amount;
	}
}

export function applyEffects(state: WarRoomState, effects: readonly Effect[]) {
	for (const effect of effects) {
		switch (effect.kind) {
			case 'resource':
				state.resources[effect.id] = Math.max(0, state.resources[effect.id] + effect.amount);
				break;
			case 'equipment':
				state.equipment[effect.id] = Math.max(0, state.equipment[effect.id] + effect.amount);
				break;
			case 'stability':
				state.stability = clampStability(state.stability + effect.amount);
				break;
			case 'morale':
			case 'experience':
			case 'enemyMorale':
				for (const region of REGION_IDS) {
					const owner = effect.kind === 'enemyMorale' ? 'enemy' : 'player';
					if (state.owner[region] !== owner) continue;
					for (const division of state.divisions[region]) {
						if (effect.kind === 'experience') {
							division.experience = Math.max(
								1,
								Math.min(EXP_MAX, division.experience + effect.amount)
							);
						} else {
							division.morale = Math.max(10, Math.min(100, division.morale + effect.amount));
						}
					}
				}
				break;
			case 'enemyReinforce':
				if (state.owner.redcapital === 'enemy') {
					for (let index = 0; index < effect.amount; index++) {
						state.divisions.redcapital.push({
							id: state.nextId++,
							template: 'infantry',
							morale: 70,
							experience: 1
						});
					}
				}
				break;
			case 'intel':
				state.intelDays = Math.max(state.intelDays, effect.days);
				break;
			case 'flag':
				if (!state.flags.includes(effect.id)) state.flags.push(effect.id);
				break;
		}
	}
}

/** Whether a crisis is due on this day: the first one on day 3, then every third day */
export function crisisDue(day: number): boolean {
	return day >= CRISIS_FIRST_DAY && (day - CRISIS_FIRST_DAY) % CRISIS_EVERY === 0;
}

/** The crisis for a new day, if one is due; follow-ups of earlier choices come first */
export function drawCrisis(state: WarRoomState, random: Random): CrisisId | null {
	if (!crisisDue(state.day) || state.crisis) return null;
	const open = CRISES.filter(
		(def) => !state.crisesSeen.includes(def.id) && (def.when?.(state) ?? true)
	);
	if (open.length === 0) return null;
	const chained = open.filter((def) => def.chained);
	const pool = chained.length > 0 ? chained : open;
	return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id;
}

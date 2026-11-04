/* Shared shapes of the War Room campaign. The state is a plain object the rules mutate. */
import type { CrisisId, DirectiveId } from './council.js';
import type { EquipmentId, FactoryId, Owner, RegionId, ResourceId, TemplateId } from './config.js';

export interface Division {
	id: number;
	template: TemplateId;
	/** 0 to 100; combat strength scales with it */
	morale: number;
	/** Experience level; starts at 1, grows with combat and time */
	experience: number;
}

export interface Building {
	id: number;
	region: RegionId;
	factory: FactoryId;
}

export interface TrainingItem {
	id: number;
	template: TemplateId;
	daysLeft: number;
}

export type Outcome = 'won' | 'lost' | 'armistice' | 'coup';

/** One line of the campaign curve, taken at the start of each day */
export interface HistoryPoint {
	regions: number;
	stability: number;
	divisions: number;
}

export interface WarRoomState {
	/** Day 1 is the first day; it becomes 31 when the armistice falls */
	day: number;
	owner: Record<RegionId, Owner>;
	divisions: Record<RegionId, Division[]>;
	buildings: Building[];
	resources: Record<ResourceId, number>;
	equipment: Record<EquipmentId, number>;
	training: TrainingItem[];
	/** Regions whose stack has already marched or attacked today */
	moved: RegionId[];
	nextId: number;
	/** Pact divisions destroyed by the player, and player divisions destroyed by the Pact */
	kills: number;
	losses: number;
	outcome: Outcome | null;
	score: number;
	/** The home front, 0 to 100; at 0 the generals take over */
	stability: number;
	/** The crisis waiting for an answer, if any */
	crisis: CrisisId | null;
	crisesSeen: CrisisId[];
	crisesHandled: number;
	/** Marks left by earlier choices; they unlock follow-up crises */
	flags: string[];
	/** One directive per day */
	directiveUsed: DirectiveId | null;
	/** Days of counter-intelligence left: the Pact attacks more carefully */
	intelDays: number;
	history: HistoryPoint[];
}

export type WarRoomEvent =
	| { type: 'move'; count: number; to: RegionId }
	| { type: 'blocked' }
	| {
			type: 'battle';
			region: RegionId;
			attacker: Owner;
			won: boolean;
			attack: number;
			defence: number;
			attackerLosses: number;
			defenderLosses: number;
	  }
	| { type: 'captured'; region: RegionId; by: Owner }
	| { type: 'trained'; template: TemplateId }
	| { type: 'built'; region: RegionId; factory: FactoryId }
	| { type: 'starved'; factory: FactoryId }
	| { type: 'day'; day: number }
	| { type: 'crisis'; id: CrisisId }
	| { type: 'crisisResolved'; id: CrisisId; option: string; neglected: boolean }
	| { type: 'directive'; id: DirectiveId }
	| { type: 'escalation'; tier: number }
	| { type: 'stability'; value: number; delta: number }
	| { type: 'over'; outcome: Outcome; score: number };

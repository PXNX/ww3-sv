/* Shared shapes of the idle game's state. The state is a plain object the rules mutate. */
import type { PerkId, ProducerId } from './config.js';

export type EventKind = 'spike' | 'sanctions' | 'pipeline' | 'protest';

/** What a player can answer to a crisis; 'timeout' is what happens when nobody answers */
export type EventChoice = 'a' | 'b' | 'timeout';

export interface PendingEvent {
	kind: EventKind;
	/** The producer a sanctions announcement is aimed at */
	producer?: ProducerId;
	/** Time left to decide */
	remainingMs: number;
}

export type EffectId = 'boom' | 'crash' | 'sanctioned' | 'maintenance' | 'leak' | 'protest';

/** A temporary effect of a crisis */
export interface ActiveEffect {
	id: EffectId;
	remainingMs: number;
	durationMs: number;
	/** Multiplies all output */
	prodMult: number;
	/** Multiplies what a tap pumps */
	clickMult: number;
	/** A producer that makes nothing while the effect lasts */
	producer?: ProducerId;
}

export interface TycoonState {
	/** Barrels in the bank, the currency */
	barrels: number;
	/** Barrels pumped since the last nationalization (decides the prestige reward) */
	runTotal: number;
	/** Barrels pumped in all runs together */
	lifetime: number;
	taps: number;
	owned: Record<ProducerId, number>;
	/** Time into each producer's current cycle, in milliseconds */
	progress: Record<ProducerId, number>;
	/** Barrels each producer has pumped in its current cycle, paid out when the cycle ends */
	pending: Record<ProducerId, number>;
	upgrades: string[];
	/** Every prestige point ever earned (decides the permanent multiplier; spending never lowers it) */
	prestigePoints: number;
	/** Levels bought in the nationalization shop; they survive nationalizing */
	perks: Record<PerkId, number>;
	prestiges: number;
	achievements: string[];
	/** Crises the player has answered, and sanctions they dodged by reflagging */
	eventsHandled: number;
	sanctionsEvaded: number;
	// Transient: never saved
	event: PendingEvent | null;
	effects: ActiveEffect[];
	/** Quiet time until the next crisis, counted down only while nothing is going on */
	nextEventMs: number;
	lastEvent: EventKind | null;
	/** Which buy button the player uses (1, 10 or max) */
	buyMode: '1x' | '10x' | 'max';
}

export type TycoonEvent =
	| { type: 'achievement'; id: string }
	| { type: 'event-start'; kind: EventKind; producer?: ProducerId }
	| { type: 'event-resolved'; kind: EventKind; outcome: EventOutcome; choice: EventChoice }
	| { type: 'effect-end'; id: EffectId }
	| { type: 'prestige'; points: number };

export type EventOutcome =
	| 'sold'
	| 'boom'
	| 'crash'
	| 'ignored'
	| 'reflagged'
	| 'sanctioned'
	| 'fixed'
	| 'fine'
	| 'leak'
	| 'greenwashed'
	| 'protest';

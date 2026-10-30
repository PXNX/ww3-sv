/*
 * Chip Fab Rush contracts. Every level is an order from one of the two customers who keep the
 * fab alive: Novideo wants GPUs and checks what the wafer's memory can feed; OpenAI wants a huge
 * single module for the next datacenter, or a chained merge in one move. The order is set at the
 * start of a level and settled when Stage B ends: meeting it pays a bonus and eases the shortage,
 * missing it is only a small setback.
 */
import { randomInt, type Random } from '../random';

export type Customer = 'nvidia' | 'openai';
export type OrderKind = 'tier' | 'combo';

export interface Order {
	customer: Customer;
	kind: OrderKind;
	/** Tier to build, or merges in one move */
	target: number;
	/** Points paid when the order is met */
	reward: number;
}

/** Module tier of the first order, so level 1 asks for one 8 GB module and cannot fail at once */
export const FIRST_TIER_TARGET = 2;
const MAX_TIER_TARGET = 6;
const MAX_COMBO_TARGET = 4;
export const ORDER_BONUS = 150;
export const ORDER_STEP = 60;
/** Relief when an order is met, and the shortage added when one is missed */
export const ORDER_RELIEF = 12;
export const ORDER_PENALTY = 6;

/** Tier target for a level: 8 GB, then 16 GB, then up to 128 GB over the early levels */
export function tierTarget(level: number): number {
	if (level <= 1) return FIRST_TIER_TARGET;
	return Math.min(MAX_TIER_TARGET, FIRST_TIER_TARGET + Math.floor((level - 1) / 2));
}

/** Merges in one move the order asks for; two is a small combo, four is a full line */
export function comboTarget(level: number): number {
	return Math.min(MAX_COMBO_TARGET, 2 + Math.floor((level - 1) / 3));
}

export function orderFor(level: number, random: Random): Order {
	const customer: Customer = level % 2 === 0 ? 'openai' : 'nvidia';
	// Novideo buys memory for GPUs (a tier), OpenAI runs on one gigantic module or a chained merge
	const kind: OrderKind =
		customer === 'nvidia' ? 'tier' : randomInt(random, 0, 2) === 0 ? 'tier' : 'combo';
	return {
		customer,
		kind,
		target: kind === 'tier' ? tierTarget(level) : comboTarget(level),
		reward: ORDER_BONUS + ORDER_STEP * Math.max(0, level - 1)
	};
}

/** How far along the order is, from 0 to 1 */
export function orderProgress(order: Order, bestTier: number, bestCombo: number): number {
	const reached = order.kind === 'tier' ? bestTier : bestCombo;
	return Math.max(0, Math.min(1, reached / Math.max(1, order.target)));
}

export function orderMet(order: Order, bestTier: number, bestCombo: number): boolean {
	return orderProgress(order, bestTier, bestCombo) >= 1;
}

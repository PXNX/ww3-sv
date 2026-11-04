/*
 * The shuffle itself: a plan of steps (swaps, crossings, three-way rotations, flag repaints and
 * AIS blackouts) and the pure helpers for moving ships and drawing their arcs. Slots are the
 * positions along the row, `order[slot]` is the id of the ship sitting there.
 */
import type { Random } from '../random.js';
import type { RoundConfig } from './config.js';

export type MoveKind = 'swap' | 'cross' | 'cycle';

export type Step =
	| { type: 'move'; kind: MoveKind; slots: number[] }
	| { type: 'reflag'; slot: number }
	| { type: 'dark'; slot: number };

const pick = (random: Random, count: number) => Math.floor(random() * count);

function sameSet(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((slot) => b.includes(slot));
}

function randomSlots(random: Random, ships: number, count: number): number[] {
	const pool = Array.from({ length: ships }, (_, i) => i);
	const out: number[] = [];
	for (let i = 0; i < count; i++) out.push(pool.splice(pick(random, pool.length), 1)[0]);
	return out;
}

/** A pair of slots at least two apart, so the covers pass over the ones between */
function crossingSlots(random: Random, ships: number): number[] {
	const first = pick(random, ships);
	const far = Array.from({ length: ships }, (_, i) => i).filter((i) => Math.abs(i - first) >= 2);
	return [first, far[pick(random, far.length)]];
}

/** Builds the steps of one shuffle; never repeats the previous move, which would undo it */
export function planShuffle(config: RoundConfig, random: Random): Step[] {
	const { ships } = config;
	const moves: Step[] = [];
	let previous: number[] | null = null;
	for (let i = 0; i < config.moves; i++) {
		let step: Step;
		let attempts = 0;
		do {
			const roll = random();
			if (ships >= 3 && roll < config.cycleChance) {
				step = { type: 'move', kind: 'cycle', slots: randomSlots(random, ships, 3) };
			} else if (ships >= 3 && roll < config.cycleChance + config.crossChance) {
				step = { type: 'move', kind: 'cross', slots: crossingSlots(random, ships) };
			} else {
				step = { type: 'move', kind: 'swap', slots: randomSlots(random, ships, 2) };
			}
			attempts++;
		} while (
			step.type === 'move' &&
			previous &&
			step.slots.length === 2 &&
			sameSet(step.slots, previous) &&
			attempts < 20
		);
		moves.push(step);
		previous = step.type === 'move' && step.slots.length === 2 ? step.slots : null;
	}

	// Sprinkle the flag repaints and blackouts in between the moves, never before the first one
	const steps = [...moves];
	const inserts: Step[] = [
		...Array.from({ length: config.reflags }, () => ({
			type: 'reflag' as const,
			slot: pick(random, ships)
		})),
		...Array.from({ length: config.darkDecoys }, () => ({
			type: 'dark' as const,
			slot: pick(random, ships)
		}))
	];
	for (const step of inserts) {
		const at = 1 + pick(random, Math.max(1, steps.length));
		steps.splice(Math.min(at, steps.length), 0, step);
	}
	return steps;
}

/** Applies a move to an order: the ship at slots[i] goes to slots[i + 1], the last one wraps around */
export function applyMove(order: number[], slots: number[]): number[] {
	const next = [...order];
	for (let i = 0; i < slots.length; i++) next[slots[(i + 1) % slots.length]] = order[slots[i]];
	return next;
}

/** Slot a ship sitting at `slot` ends up in when the move runs (unchanged when it is not part of it) */
export function destinationSlot(slots: number[], slot: number): number {
	const index = slots.indexOf(slot);
	return index < 0 ? slot : slots[(index + 1) % slots.length];
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Vertical arc of one ship during a move, as a fraction of the arc height (negative = up). The
 * ships of a move pass on opposite sides, so they never overlap; a crossing arcs higher.
 */
export function arcOffset(kind: MoveKind, index: number, t: number): number {
	const height = kind === 'cross' ? 1.5 : 1;
	const side = index % 2 === 0 ? -1 : 1;
	return side * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * height;
}

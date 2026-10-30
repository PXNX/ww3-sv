/*
 * Stage A, the wafer stacker: a layer slides back and forth above the tower and is dropped with
 * a tap. Only the part that overlaps the layer below stays, so edges always line up and the
 * tower narrows with every sloppy drop. A drop that lands almost exactly on the layer below is
 * "perfect": it snaps into line and loses nothing. Everything here is pure and seeded.
 */
import type { Random } from '../random';
import {
	FIELD_WIDTH,
	GOLD_BONUS,
	MIN_OVERLAP,
	MIN_SUPPLY,
	REGROW_AFTER,
	REGROW_BY,
	START_WIDTH,
	SUPPLY_PER_GOLD,
	SUPPLY_PER_LAYER,
	SUPPLY_PER_PERFECT,
	stackerParams
} from './config';

export interface Layer {
	left: number;
	width: number;
}

export interface Slab {
	/** Left edge */
	x: number;
	width: number;
	/** 1 moves right, -1 moves left */
	dir: 1 | -1;
	/** A golden HBM layer: worth extra points and relief if it lands perfectly */
	gold?: boolean;
}

export type DropKind = 'perfect' | 'trim' | 'miss';

export interface TrimResult {
	kind: DropKind;
	/** The layer that stays on the tower; null on a miss */
	layer: Layer | null;
	/** The overhanging piece that falls off (the whole slab on a miss); null on a perfect drop */
	cut: Layer | null;
}

export interface StackerState {
	/** layers[0] is the base; the rest were dropped by the player */
	layers: Layer[];
	slab: Slab;
	speed: number;
	tolerance: number;
	/** Dropped layers needed to finish the wafer */
	target: number;
	perfects: number;
	streak: number;
	/** Chance that a new sliding layer is golden */
	goldChance: number;
	/** Golden layers landed perfectly this wafer */
	goldPerfects: number;
	status: 'running' | 'complete' | 'failed';
}

const right = (layer: Layer) => layer.left + layer.width;

/**
 * Drops a layer onto the one below: keeps the overlap and cuts the rest off. Within `tolerance`
 * of the layer below on both edges it is perfect and takes exactly the layer below's shape.
 */
export function trimLayer(top: Layer, dropped: Layer, tolerance: number): TrimResult {
	const left = Math.max(top.left, dropped.left);
	const edge = Math.min(right(top), right(dropped));
	const overlap = edge - left;
	if (overlap < MIN_OVERLAP) return { kind: 'miss', layer: null, cut: { ...dropped } };

	if (
		Math.abs(dropped.left - top.left) <= tolerance &&
		Math.abs(right(dropped) - right(top)) <= tolerance
	) {
		return { kind: 'perfect', layer: { ...top }, cut: null };
	}

	// The overhang on each side; the larger one is the piece that visibly falls
	const overhangLeft = left - dropped.left;
	const overhangRight = right(dropped) - edge;
	const cut: Layer =
		overhangLeft >= overhangRight
			? { left: dropped.left, width: overhangLeft }
			: { left: edge, width: overhangRight };
	return { kind: 'trim', layer: { left, width: overlap }, cut };
}

/** Moves a sliding layer along its track, bouncing off both ends of the field */
export function advanceSlab(slab: Slab, dtMs: number, speed: number): Slab {
	const range = FIELD_WIDTH - slab.width;
	if (range <= 0 || dtMs <= 0) return { ...slab, x: Math.max(0, Math.min(slab.x, range)) };
	// Unfold the bounce into a straight track of length 2 * range, move along it, fold back
	const period = 2 * range;
	const along = slab.dir === 1 ? slab.x : period - slab.x;
	const next = (((along + (speed * dtMs) / 1000) % period) + period) % period;
	return next <= range ? { ...slab, x: next, dir: 1 } : { ...slab, x: period - next, dir: -1 };
}

/** A fresh sliding layer of the given width, entering from a random side */
export function newSlab(random: Random, width: number, goldChance = 0): Slab {
	const dir: 1 | -1 = random() < 0.5 ? 1 : -1;
	const gold = goldChance > 0 && random() < goldChance;
	return { x: dir === 1 ? 0 : FIELD_WIDTH - width, width, dir, gold };
}

export interface StackerExtras {
	/** Chance per layer that it is a golden HBM layer */
	goldChance?: number;
	/** Multiplies the perfect window */
	toleranceScale?: number;
	/** Multiplies the sliding speed */
	speedScale?: number;
	/** Widens or narrows the base layer */
	widthBonus?: number;
}

export function createStacker(
	random: Random,
	level: number,
	extras: StackerExtras = {}
): StackerState {
	const params = stackerParams(level);
	const width = Math.max(10, Math.min(FIELD_WIDTH, START_WIDTH + (extras.widthBonus ?? 0)));
	const base: Layer = { left: (FIELD_WIDTH - width) / 2, width };
	const goldChance = Math.max(0, Math.min(0.9, extras.goldChance ?? 0));
	return {
		layers: [base],
		slab: newSlab(random, base.width, goldChance),
		speed: params.speed * (extras.speedScale ?? 1),
		tolerance: params.tolerance * (extras.toleranceScale ?? 1),
		target: params.layers,
		perfects: 0,
		streak: 0,
		goldChance,
		goldPerfects: 0,
		status: 'running'
	};
}

export function stepStacker(state: StackerState, dtMs: number): StackerState {
	if (state.status !== 'running') return state;
	return { ...state, slab: advanceSlab(state.slab, dtMs, state.speed) };
}

export function topLayer(state: StackerState): Layer {
	return state.layers[state.layers.length - 1];
}

/** Layers dropped by the player so far (the base does not count) */
export function stackedLayers(state: StackerState): number {
	return state.layers.length - 1;
}

/** Points for a drop; a perfect streak is worth more and more */
export function dropPoints(kind: DropKind, streak: number): number {
	if (kind === 'miss') return 0;
	if (kind === 'trim') return 10;
	return 25 + 5 * Math.min(streak, 8);
}

export interface DropResult {
	state: StackerState;
	kind: DropKind;
	cut: Layer | null;
	points: number;
	/** The wafer reached its target height with this drop */
	complete: boolean;
	/** The dropped layer was golden */
	gold: boolean;
}

/** Points for a golden layer that does not land perfectly */
export const GOLD_TRIM_POINTS = 40;

/** Drops the sliding layer. Does nothing unless the stacker is running. */
export function dropSlab(state: StackerState, random: Random): DropResult {
	if (state.status !== 'running') {
		return { state, kind: 'miss', cut: null, points: 0, complete: false, gold: false };
	}
	const dropped: Layer = { left: state.slab.x, width: state.slab.width };
	const gold = state.slab.gold === true;
	const result = trimLayer(topLayer(state), dropped, state.tolerance);

	if (result.layer === null) {
		return {
			state: { ...state, status: 'failed', streak: 0 },
			kind: 'miss',
			cut: result.cut,
			points: 0,
			complete: false,
			gold
		};
	}

	const perfect = result.kind === 'perfect';
	const streak = perfect ? state.streak + 1 : 0;
	let layer = result.layer;
	if (perfect && streak >= REGROW_AFTER && layer.width < START_WIDTH) {
		// A long streak of perfect drops lets the layers grow back toward the starting width
		const width = Math.min(START_WIDTH, layer.width + REGROW_BY);
		const left = Math.min(Math.max(0, layer.left - (width - layer.width) / 2), FIELD_WIDTH - width);
		layer = { left, width };
	}

	const layers = [...state.layers, layer];
	const complete = layers.length - 1 >= state.target;
	let points = dropPoints(result.kind, streak);
	if (gold) points += perfect ? GOLD_BONUS : GOLD_TRIM_POINTS;
	return {
		state: {
			...state,
			layers,
			slab: newSlab(random, layer.width, state.goldChance),
			perfects: state.perfects + (perfect ? 1 : 0),
			streak,
			goldPerfects: state.goldPerfects + (gold && perfect ? 1 : 0),
			status: complete ? 'complete' : 'running'
		},
		kind: result.kind,
		cut: result.cut,
		points,
		complete,
		gold
	};
}

export interface WaferOutput {
	/** Memory modules Stage B will be supplied with */
	supply: number;
	/** 0 to 1: how many of the layers were perfect, which makes bigger modules more likely */
	quality: number;
}

/** What a finished or fallen wafer yields for Stage B */
export function waferOutput(state: StackerState): WaferOutput {
	const layers = stackedLayers(state);
	return {
		supply: Math.max(
			MIN_SUPPLY,
			layers * SUPPLY_PER_LAYER +
				state.perfects * SUPPLY_PER_PERFECT +
				state.goldPerfects * SUPPLY_PER_GOLD
		),
		quality: layers > 0 ? Math.min(1, state.perfects / layers) : 0
	};
}

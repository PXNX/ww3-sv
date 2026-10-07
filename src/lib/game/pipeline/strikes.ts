/*
 * Strike scheduling for Pipeline Panic: how often strikes come, how many arrive at once, and which
 * tiles they aim at. Every strike announces itself with a warning marker before it breaks a tile.
 */
import { pickWeighted, type Random } from '#lib/game/random.js';
import type { Flow, PipeGrid } from './pipeGrid';

export type StrikeKind = 'drone' | 'rocket';

export interface Strike {
	id: number;
	cell: number;
	kind: StrikeKind;
	/** Length of the warning phase, for drawing the countdown */
	warningMs: number;
	/** Time left until impact */
	remainingMs: number;
}

export interface StrikeConfig {
	/** Quiet time after pumping starts, before the first strike */
	firstDelayMs: number;
	/** Time between strike waves at the start */
	startIntervalMs: number;
	/** Shortest time between strike waves, reached after rampMs of pumping */
	minIntervalMs: number;
	rampMs: number;
	/** How long the warning marker shows before impact */
	warningMs: number;
	/** Cap on strikes in the air at the same time */
	maxSimultaneous: number;
	/** Every this many milliseconds of pumping, waves grow by one strike (up to the cap) */
	extraStrikeEveryMs: number;
}

/** Time until the next wave; shrinks linearly from the start interval to the minimum */
export function strikeInterval(config: StrikeConfig, elapsedMs: number): number {
	const progress = Math.min(1, Math.max(0, elapsedMs) / config.rampMs);
	return config.startIntervalMs - (config.startIntervalMs - config.minIntervalMs) * progress;
}

/** Number of strikes in a wave; grows over time up to the simultaneous cap */
export function waveSize(config: StrikeConfig, elapsedMs: number): number {
	const extra = Math.floor(Math.max(0, elapsedMs) / config.extraStrikeEveryMs);
	return Math.min(config.maxSimultaneous, 1 + extra);
}

/** Tiles carrying oil are more likely targets than dry ones */
const FLOWING_WEIGHT = 4;
const DRY_WEIGHT = 1;

/**
 * Picks up to count distinct target cells. Broken tiles and tiles that are already targeted are
 * never picked, so a tile is never hit twice and every broken tile stays repairable.
 */
export function pickTargets(
	random: Random,
	grid: PipeGrid,
	flow: Flow,
	count: number,
	excluded: ReadonlySet<number>
): number[] {
	const candidates = grid.tiles.flatMap((tile, cell) =>
		tile.broken || excluded.has(cell)
			? []
			: [{ item: cell, weight: flow.filled[cell] ? FLOWING_WEIGHT : DRY_WEIGHT }]
	);
	const targets: number[] = [];
	while (targets.length < count && candidates.length > 0) {
		const cell = pickWeighted(random, candidates);
		targets.push(cell);
		candidates.splice(
			candidates.findIndex((candidate) => candidate.item === cell),
			1
		);
	}
	return targets;
}

export function pickStrikeKind(random: Random): StrikeKind {
	return random() < 0.6 ? 'drone' : 'rocket';
}

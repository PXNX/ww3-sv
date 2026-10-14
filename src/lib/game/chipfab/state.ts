/*
 * Chip Fab Rush rules: one run is a series of levels, each with Stage A (wafer stacker) followed
 * by Stage B (RAM merge). The wafer's quality decides how many modules Stage B gets. The shortage
 * meter runs throughout; when it fills up a heart is lost, and with no hearts left the run ends.
 * The state is a plain mutable object that the view reads; stepping it returns events.
 */
import type { Direction } from '../merge/mergeBoard';
import type { Random } from '../random';
import { LEVEL_BONUS, LOCK_MS, STARTING_LIVES, WAFER_BONUS } from './config';
import { createRam, isRamDone, moveRam, type MergeEvent, type RamState } from './ram';
import {
	HEART_RESET,
	PERFECT_RELIEF,
	WAFER_RELIEF,
	applyRelief,
	isShortageFull,
	reliefForTier,
	tickShortage
} from './shortage';
import {
	createStacker,
	dropSlab,
	stackedLayers,
	stepStacker,
	waferOutput,
	type DropKind,
	type Layer,
	type StackerState
} from './stacker';

export type Stage = 'stack' | 'merge';

export interface ChipFabState {
	level: number;
	stage: Stage;
	lives: number;
	score: number;
	/** The shortage meter, 0 to 100 */
	shortage: number;
	/** Milliseconds spent in this level, which makes the shortage rise a little faster */
	levelMs: number;
	/** Input and the clock are frozen while this is above zero (right after a stage change) */
	lockMs: number;
	stacker: StackerState;
	/** The module board; only meaningful in the merge stage */
	ram: RamState;
	levelsCleared: number;
	/** The biggest module tier made in the whole run */
	highestTier: number;
	over: boolean;
}

export type ChipFabEvent =
	| {
			type: 'drop';
			kind: DropKind;
			points: number;
			cut: Layer | null;
			streak: number;
			layer: number;
	  }
	| { type: 'wafer'; layers: number; perfects: number; supply: number; finished: boolean }
	| {
			type: 'merge';
			/** The biggest module made by this move */
			tier: number;
			relief: number;
			count: number;
			points: number;
			merges: MergeEvent[];
	  }
	| { type: 'slide' }
	| { type: 'stage'; stage: Stage }
	| { type: 'level'; level: number }
	| { type: 'shortage-hit'; lives: number }
	| { type: 'game-over' };

export function createGame(random: Random): ChipFabState {
	return {
		level: 1,
		stage: 'stack',
		lives: STARTING_LIVES,
		score: 0,
		shortage: 0,
		levelMs: 0,
		lockMs: 0,
		stacker: createStacker(random, 1),
		ram: createRam(random, 0, 0),
		levelsCleared: 0,
		highestTier: 0,
		over: false
	};
}

/** Shortage as a whole percentage, for the HUD */
export function shortagePercent(state: ChipFabState): number {
	return Math.round(state.shortage);
}

function relieve(state: ChipFabState, amount: number) {
	state.shortage = applyRelief(state.shortage, amount);
}

/** When the meter is full a heart is lost and it falls back; the last heart ends the run */
function resolveShortage(state: ChipFabState, events: ChipFabEvent[]) {
	if (state.over || !isShortageFull(state.shortage)) return;
	state.lives -= 1;
	events.push({ type: 'shortage-hit', lives: state.lives });
	if (state.lives <= 0) {
		state.lives = 0;
		state.over = true;
		events.push({ type: 'game-over' });
	} else {
		state.shortage = HEART_RESET;
	}
}

/** Advances the clock by one fixed step: the shortage rises and the layer in Stage A slides */
export function stepGame(state: ChipFabState, dtMs: number): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over) return events;
	if (state.lockMs > 0) {
		state.lockMs = Math.max(0, state.lockMs - dtMs);
		return events;
	}
	state.levelMs += dtMs;
	state.shortage = tickShortage(state.shortage, dtMs, state.level, state.levelMs / 1000);
	if (state.stage === 'stack') state.stacker = stepStacker(state.stacker, dtMs);
	resolveShortage(state, events);
	return events;
}

function startMerge(state: ChipFabState, random: Random, events: ChipFabEvent[]) {
	const output = waferOutput(state.stacker);
	state.ram = createRam(random, output.supply, output.quality);
	state.stage = 'merge';
	state.lockMs = LOCK_MS;
	events.push({ type: 'stage', stage: 'merge' });
}

function startNextLevel(state: ChipFabState, random: Random, events: ChipFabEvent[]) {
	state.levelsCleared += 1;
	state.score += LEVEL_BONUS * state.level;
	state.level += 1;
	state.levelMs = 0;
	state.stacker = createStacker(random, state.level);
	state.stage = 'stack';
	state.lockMs = LOCK_MS;
	events.push({ type: 'level', level: state.level }, { type: 'stage', stage: 'stack' });
}

/** Drops the sliding layer in Stage A; ignored in any other situation */
export function dropLayer(state: ChipFabState, random: Random): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over || state.lockMs > 0 || state.stage !== 'stack') return events;
	if (state.stacker.status !== 'running') return events;

	const result = dropSlab(state.stacker, random);
	state.stacker = result.state;
	state.score += result.points;
	if (result.kind === 'perfect') relieve(state, PERFECT_RELIEF);
	events.push({
		type: 'drop',
		kind: result.kind,
		points: result.points,
		cut: result.cut,
		streak: state.stacker.streak,
		layer: stackedLayers(state.stacker)
	});

	if (result.complete || state.stacker.status === 'failed') {
		const finished = result.complete;
		if (finished) {
			state.score += WAFER_BONUS;
			relieve(state, WAFER_RELIEF);
		}
		const output = waferOutput(state.stacker);
		events.push({
			type: 'wafer',
			layers: stackedLayers(state.stacker),
			perfects: state.stacker.perfects,
			supply: output.supply,
			finished
		});
		startMerge(state, random, events);
	}
	return events;
}

/** Slides the memory modules in Stage B; ignored in any other situation */
export function moveModules(
	state: ChipFabState,
	direction: Direction,
	random: Random
): ChipFabEvent[] {
	const events: ChipFabEvent[] = [];
	if (state.over || state.lockMs > 0 || state.stage !== 'merge') return events;

	const outcome = moveRam(state.ram, direction, random);
	if (!outcome.changed) return events;
	state.ram = outcome.state;
	state.score += outcome.points;
	state.highestTier = Math.max(state.highestTier, state.ram.highestTier);

	if (outcome.merges.length === 0) events.push({ type: 'slide' });
	let relief = 0;
	for (const merge of outcome.merges) relief += reliefForTier(merge.tier);
	relieve(state, relief);
	if (outcome.merges.length > 0) {
		events.push({
			type: 'merge',
			tier: bestMerge(outcome.merges),
			relief,
			count: outcome.merges.length,
			points: outcome.points,
			merges: outcome.merges
		});
	}

	if (isRamDone(state.ram)) startNextLevel(state, random, events);
	return events;
}

function bestMerge(merges: readonly MergeEvent[]): number {
	return merges.reduce((best, merge) => Math.max(best, merge.tier), 0);
}

/*
 * Pipeline Panic game state, advanced in fixed time steps (requirements Section 7).
 * The game starts in a setup phase: nothing happens until the player first connects the pumping
 * station to the export terminal. From then on strikes arrive, oil is delivered while the route is
 * connected, and a flow cut lasting shutdownMs shuts the station down (game over).
 */
import type { Random } from '$lib/game/random';
import { computeFlow, generateLayout, type Flow, type PipeGrid } from './pipeGrid';
import {
	pickStrikeKind,
	pickTargets,
	strikeInterval,
	waveSize,
	type Strike,
	type StrikeConfig
} from './strikes';
import { rotateOnce, type Rotation } from './tiles';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export function isDifficulty(value: unknown): value is Difficulty {
	return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

export interface PipelineConfig {
	size: number;
	strikes: StrikeConfig;
	/** How long the wrench must be held on a broken tile */
	repairMs: number;
	/** A continuous flow cut this long shuts the station down */
	shutdownMs: number;
	/** Barrels per second = barrelsBase + barrelsPerTile × flowing path length */
	barrelsBase: number;
	barrelsPerTile: number;
	tankerCapacity: number;
	tankerBonus: number;
	/** Delivered barrels needed to earn one interceptor charge */
	barrelsPerCharge: number;
	startCharges: number;
	maxCharges: number;
}

const SHARED = {
	shutdownMs: 10_000,
	barrelsBase: 1,
	barrelsPerTile: 0.35,
	startCharges: 1,
	maxCharges: 3
};

export const DIFFICULTY_CONFIG: Record<Difficulty, PipelineConfig> = {
	easy: {
		...SHARED,
		size: 5,
		repairMs: 800,
		tankerCapacity: 120,
		tankerBonus: 100,
		barrelsPerCharge: 70,
		strikes: {
			firstDelayMs: 8000,
			startIntervalMs: 9000,
			minIntervalMs: 4500,
			rampMs: 180_000,
			warningMs: 2800,
			maxSimultaneous: 2,
			extraStrikeEveryMs: 60_000
		}
	},
	normal: {
		...SHARED,
		size: 6,
		repairMs: 1000,
		tankerCapacity: 150,
		tankerBonus: 120,
		barrelsPerCharge: 80,
		strikes: {
			firstDelayMs: 6000,
			startIntervalMs: 7000,
			minIntervalMs: 3000,
			rampMs: 150_000,
			warningMs: 2200,
			maxSimultaneous: 3,
			extraStrikeEveryMs: 45_000
		}
	},
	hard: {
		...SHARED,
		size: 7,
		repairMs: 1200,
		tankerCapacity: 180,
		tankerBonus: 150,
		barrelsPerCharge: 90,
		strikes: {
			firstDelayMs: 5000,
			startIntervalMs: 6000,
			minIntervalMs: 2400,
			rampMs: 120_000,
			warningMs: 1800,
			maxSimultaneous: 4,
			extraStrikeEveryMs: 35_000
		}
	}
};

export type Phase = 'setup' | 'running' | 'over';

export type EffectKind = 'impact' | 'intercept';

/** Short-lived visual effects; they age with the game clock so pausing freezes them too */
export interface Effect {
	id: number;
	kind: EffectKind;
	cell: number;
	ageMs: number;
}

export const EFFECT_MS = 700;
export const TANKER_DEPART_MS = 2500;

export interface PipelineState {
	difficulty: Difficulty;
	config: PipelineConfig;
	grid: PipeGrid;
	route: number[];
	solution: Rotation[];
	flow: Flow;
	phase: Phase;
	/** Pumping time since the first connection */
	elapsedMs: number;
	barrels: number;
	score: number;
	/** How long the flow has been cut without a break */
	cutMs: number;
	nextWaveMs: number;
	strikes: Strike[];
	nextId: number;
	effects: Effect[];
	charges: number;
	/** Barrels delivered towards the next interceptor charge */
	chargeProgress: number;
	/** Consecutive interceptions without a strike landing */
	streak: number;
	bestStreak: number;
	intercepted: number;
	hits: number;
	repairs: number;
	tankerFill: number;
	tankersFilled: number;
	/** Counts down while a full tanker sails away */
	tankerDepartMs: number;
	/** The broken tile the wrench is working on */
	repairing: number | null;
}

export function createGame(
	random: Random,
	difficulty: Difficulty,
	overrides: Partial<PipelineConfig> = {}
): PipelineState {
	const config = { ...DIFFICULTY_CONFIG[difficulty], ...overrides };
	const { grid, route, solution } = generateLayout(random, config.size, config.size);
	return {
		difficulty,
		config,
		grid,
		route,
		solution,
		flow: computeFlow(grid),
		phase: 'setup',
		elapsedMs: 0,
		barrels: 0,
		score: 0,
		cutMs: 0,
		nextWaveMs: config.strikes.firstDelayMs,
		strikes: [],
		nextId: 1,
		effects: [],
		charges: config.startCharges,
		chargeProgress: 0,
		streak: 0,
		bestStreak: 0,
		intercepted: 0,
		hits: 0,
		repairs: 0,
		tankerFill: 0,
		tankersFilled: 0,
		tankerDepartMs: 0,
		repairing: null
	};
}

/** Score multiplier from the interceptor "perfect save" streak: ×1, ×1.5, ×2, ×2.5, capped at ×3 */
export function streakMultiplier(streak: number): number {
	return 1 + 0.5 * Math.min(Math.max(0, streak), 4);
}

export function barrelsPerSecond(config: PipelineConfig, pathLength: number): number {
	return pathLength > 0 ? config.barrelsBase + config.barrelsPerTile * pathLength : 0;
}

export function finalScore(state: PipelineState): number {
	return Math.floor(state.score);
}

/** Seconds left before the station shuts down, while the flow is cut */
export function shutdownSecondsLeft(state: PipelineState): number {
	return Math.max(0, Math.ceil((state.config.shutdownMs - state.cutMs) / 1000));
}

function refreshFlow(state: PipelineState) {
	state.flow = computeFlow(state.grid);
	if (state.phase === 'setup' && state.flow.reachesTerminal) state.phase = 'running';
}

/** Rotates an intact tile a quarter turn clockwise; broken tiles must be repaired first */
export function rotateTile(state: PipelineState, cell: number): boolean {
	const tile = state.grid.tiles[cell];
	if (state.phase === 'over' || !tile || tile.broken) return false;
	tile.rotation = rotateOnce(tile.rotation);
	refreshFlow(state);
	return true;
}

/** Puts the wrench on a broken tile; progress continues each step until stopRepair */
export function startRepair(state: PipelineState, cell: number): boolean {
	const tile = state.grid.tiles[cell];
	if (state.phase === 'over' || !tile || !tile.broken) return false;
	state.repairing = cell;
	return true;
}

/** Lifts the wrench; the progress already made on the tile is kept */
export function stopRepair(state: PipelineState) {
	state.repairing = null;
}

/** Spends an interceptor charge to destroy a strike during its warning phase */
export function intercept(state: PipelineState, strikeId: number): boolean {
	if (state.phase === 'over' || state.charges <= 0) return false;
	const index = state.strikes.findIndex((strike) => strike.id === strikeId);
	if (index === -1) return false;
	const [strike] = state.strikes.splice(index, 1);
	state.charges--;
	state.intercepted++;
	state.streak++;
	state.bestStreak = Math.max(state.bestStreak, state.streak);
	addEffect(state, 'intercept', strike.cell);
	return true;
}

function addEffect(state: PipelineState, kind: EffectKind, cell: number) {
	state.effects.push({ id: state.nextId++, kind, cell, ageMs: 0 });
}

function advanceRepair(state: PipelineState, dtMs: number) {
	if (state.repairing === null) return;
	const tile = state.grid.tiles[state.repairing];
	if (!tile.broken) {
		state.repairing = null;
		return;
	}
	tile.repair = Math.min(1, tile.repair + dtMs / state.config.repairMs);
	// A tiny tolerance so steps that add up to the repair time always complete it
	if (tile.repair >= 1 - 1e-9) {
		tile.broken = false;
		tile.repair = 0;
		state.repairs++;
		state.repairing = null;
		refreshFlow(state);
	}
}

function advanceStrikes(state: PipelineState, dtMs: number, random: Random) {
	for (const strike of state.strikes) strike.remainingMs -= dtMs;
	const landed = state.strikes.filter((strike) => strike.remainingMs <= 0);
	if (landed.length > 0) {
		state.strikes = state.strikes.filter((strike) => strike.remainingMs > 0);
		for (const strike of landed) {
			const tile = state.grid.tiles[strike.cell];
			tile.broken = true;
			tile.repair = 0;
			state.hits++;
			state.streak = 0;
			addEffect(state, 'impact', strike.cell);
		}
		refreshFlow(state);
	}

	const strikes = state.config.strikes;
	state.nextWaveMs -= dtMs;
	if (state.nextWaveMs > 0) return;
	state.nextWaveMs += strikeInterval(strikes, state.elapsedMs);
	const room = strikes.maxSimultaneous - state.strikes.length;
	const count = Math.min(room, waveSize(strikes, state.elapsedMs));
	if (count <= 0) return;
	const targeted = new Set(state.strikes.map((strike) => strike.cell));
	for (const cell of pickTargets(random, state.grid, state.flow, count, targeted)) {
		state.strikes.push({
			id: state.nextId++,
			cell,
			kind: pickStrikeKind(random),
			warningMs: strikes.warningMs,
			remainingMs: strikes.warningMs
		});
	}
}

function deliver(state: PipelineState, dtMs: number) {
	const { config } = state;
	const barrels = (barrelsPerSecond(config, state.flow.pathLength) * dtMs) / 1000;
	const multiplier = streakMultiplier(state.streak);
	state.barrels += barrels;
	state.score += barrels * multiplier;

	state.tankerFill += barrels;
	while (state.tankerFill >= config.tankerCapacity) {
		state.tankerFill -= config.tankerCapacity;
		state.tankersFilled++;
		state.score += config.tankerBonus * multiplier;
		state.tankerDepartMs = TANKER_DEPART_MS;
	}

	if (state.charges >= config.maxCharges) {
		state.chargeProgress = 0;
		return;
	}
	state.chargeProgress += barrels;
	while (state.chargeProgress >= config.barrelsPerCharge && state.charges < config.maxCharges) {
		state.chargeProgress -= config.barrelsPerCharge;
		state.charges++;
	}
	if (state.charges >= config.maxCharges) state.chargeProgress = 0;
}

/** Advances the game by one fixed step */
export function stepGame(state: PipelineState, dtMs: number, random: Random) {
	if (state.phase === 'over') return;

	for (const effect of state.effects) effect.ageMs += dtMs;
	state.effects = state.effects.filter((effect) => effect.ageMs < EFFECT_MS);
	state.tankerDepartMs = Math.max(0, state.tankerDepartMs - dtMs);

	advanceRepair(state, dtMs);
	if (state.phase === 'setup') return;

	state.elapsedMs += dtMs;
	advanceStrikes(state, dtMs, random);

	if (state.flow.reachesTerminal) {
		state.cutMs = 0;
		deliver(state, dtMs);
	} else {
		state.cutMs += dtMs;
		if (state.cutMs >= state.config.shutdownMs) {
			state.phase = 'over';
			state.strikes = [];
			state.repairing = null;
		}
	}
}

/*
 * Falklands rules as a plain turn-based state machine. Every move or round of talks is one day:
 * the task force sails one, two or three zones for a fuel cost, the weather decides whether
 * sprinting is allowed, and the other fleet advances one zone. Arriving first is a military win;
 * seven days of talks make a deal available, which wins later and scores lower. Running out of
 * fuel or losing the race ends the run.
 */
import type { Random } from '../random.js';
import {
	DIPLOMACY_TARGET,
	DISTANCE,
	ENEMY_START,
	ENEMY_STEP,
	FLANK_ZONES,
	FUEL_CRUISE,
	FUEL_FLANK,
	FUEL_SLOW,
	GAP_POINTS,
	MILITARY_BASE,
	MILITARY_FUEL_POINTS,
	PEACE_BASE,
	PEACE_FUEL_POINTS,
	PEACE_TALK_POINTS,
	PROGRESS_POINTS,
	PROGRESS_TALK_POINTS,
	START_FUEL,
	CRUISE_ZONES,
	SLOW_ZONES
} from './config.js';
import { allowsSpeed, createWeather, moveCost, weatherAt, type Weather } from './weather.js';

export type FalklandsPhase = 'sail' | 'over';

export type Speed = 'slow' | 'cruise' | 'flank';

export type FalklandsOutcome = 'military' | 'peace' | 'enemy' | 'stranded';

export const SPEEDS: Record<Speed, { zones: number; fuel: number }> = {
	slow: { zones: SLOW_ZONES, fuel: FUEL_SLOW },
	cruise: { zones: CRUISE_ZONES, fuel: FUEL_CRUISE },
	flank: { zones: FLANK_ZONES, fuel: FUEL_FLANK }
};

export interface FalklandsState {
	phase: FalklandsPhase;
	/** Days spent so far; also the index into the forecast */
	day: number;
	/** Zones the task force has covered */
	playerAt: number;
	/** Zones the other fleet has covered */
	enemyAt: number;
	fuel: number;
	talks: number;
	weather: Weather[];
	outcome: FalklandsOutcome | null;
	score: number;
}

export type FalklandsEvent =
	| { type: 'move'; speed: Speed; zones: number; fuel: number; day: number; weather: Weather }
	| { type: 'blocked'; speed: Speed; weather: Weather }
	| { type: 'shortfuel'; need: number }
	| { type: 'talk'; talks: number; day: number }
	| { type: 'no-deal'; talks: number }
	| { type: 'win'; outcome: 'military'; score: number }
	| { type: 'peace'; score: number }
	| { type: 'lose'; outcome: 'enemy' | 'stranded'; score: number };

export function createGame(random: Random): FalklandsState {
	return {
		phase: 'sail',
		day: 0,
		playerAt: 0,
		enemyAt: ENEMY_START,
		fuel: START_FUEL,
		talks: 0,
		weather: createWeather(random),
		outcome: null,
		score: 0
	};
}

export function zonesLeft(state: FalklandsState): number {
	return Math.max(0, DISTANCE - state.playerAt);
}

export function enemyLeft(state: FalklandsState): number {
	return Math.max(0, DISTANCE - state.enemyAt);
}

export function weatherNow(state: FalklandsState): Weather {
	return weatherAt(state.weather, state.day);
}

export function canDeal(state: FalklandsState): boolean {
	return state.phase === 'sail' && state.talks >= DIPLOMACY_TARGET;
}

/** What the scoreboard shows while the race is still on */
export function progressScore(state: FalklandsState): number {
	return state.playerAt * PROGRESS_POINTS + state.talks * PROGRESS_TALK_POINTS;
}

export function finalScore(state: FalklandsState, outcome: FalklandsOutcome): number {
	if (outcome === 'military') {
		return (
			MILITARY_BASE +
			state.fuel * MILITARY_FUEL_POINTS +
			Math.max(0, DISTANCE - state.enemyAt) * GAP_POINTS
		);
	}
	if (outcome === 'peace') {
		return PEACE_BASE + state.fuel * PEACE_FUEL_POINTS + state.talks * PEACE_TALK_POINTS;
	}
	return progressScore(state);
}

function end(state: FalklandsState, outcome: FalklandsOutcome) {
	state.outcome = outcome;
	state.score = finalScore(state, outcome);
	state.phase = 'over';
}

/** Steam one, two or three zones, spending fuel and letting the other fleet move */
export function move(state: FalklandsState, speed: Speed): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	const weather = weatherNow(state);
	if (!allowsSpeed(weather, speed)) return [{ type: 'blocked', speed, weather }];

	const cost = moveCost(SPEEDS[speed].fuel, weather);
	if (state.fuel < cost) return [{ type: 'shortfuel', need: cost }];

	state.fuel -= cost;
	state.playerAt = Math.min(DISTANCE, state.playerAt + SPEEDS[speed].zones);
	state.day += 1;
	state.enemyAt += ENEMY_STEP;
	state.score = progressScore(state);

	const events: FalklandsEvent[] = [
		{ type: 'move', speed, zones: SPEEDS[speed].zones, fuel: cost, day: state.day, weather }
	];
	if (state.playerAt >= DISTANCE) {
		end(state, 'military');
		events.push({ type: 'win', outcome: 'military', score: state.score });
	} else if (state.enemyAt >= DISTANCE) {
		end(state, 'enemy');
		events.push({ type: 'lose', outcome: 'enemy', score: state.score });
	} else if (state.fuel < FUEL_SLOW) {
		end(state, 'stranded');
		events.push({ type: 'lose', outcome: 'stranded', score: state.score });
	}
	return events;
}

/** Spend the day in talks instead of sailing; the other fleet does not wait */
export function talk(state: FalklandsState): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	state.talks += 1;
	state.day += 1;
	state.enemyAt += ENEMY_STEP;
	state.score = progressScore(state);

	const events: FalklandsEvent[] = [{ type: 'talk', talks: state.talks, day: state.day }];
	if (state.enemyAt >= DISTANCE) {
		end(state, 'enemy');
		events.push({ type: 'lose', outcome: 'enemy', score: state.score });
	}
	return events;
}

/** Sign the deal once the talks have gone on long enough */
export function deal(state: FalklandsState): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	if (!canDeal(state)) return [{ type: 'no-deal', talks: state.talks }];
	end(state, 'peace');
	return [{ type: 'peace', score: state.score }];
}

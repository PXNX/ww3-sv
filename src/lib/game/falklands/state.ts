/*
 * Falklands rules as a plain turn-based state machine. Every move or round of talks is one day:
 * the task force sails one, two or three zones for a fuel cost, the weather decides whether
 * sprinting is allowed, and the other fleet advances one zone. Arriving first is a military win;
 * seven days of talks make a deal available, which wins later and scores lower. Running out of
 * fuel or losing the race ends the run.
 */
import type { Random } from '../random.js';
import {
	CRATE_REPAIR,
	DAMAGE_MINE,
	DAMAGE_RAID,
	DAMAGE_SUB,
	FLANK_DAMAGE_FACTOR,
	HULL_POINTS,
	INTEL_ZONES,
	MAX_FUEL,
	MAX_HULL,
	PEACE_HULL_POINTS,
	PEACE_STAR_HULL,
	PICKUP_POINTS,
	REPAIR_HULL,
	SLOW_DAMAGE_FACTOR,
	STAR_FUEL,
	STAR_HULL,
	START_HULL,
	STREAK_CAP_POINTS,
	STREAK_MIN,
	STREAK_POINTS,
	TANKER_FUEL,
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
import { createZones, isHazard, legAt, type Hazard, type Pickup, type Zones } from './zones.js';
import { allowsSpeed, createWeather, moveCost, weatherAt, type Weather } from './weather.js';

export type FalklandsPhase = 'sail' | 'over';

export type Speed = 'slow' | 'cruise' | 'flank';

export type FalklandsOutcome = 'military' | 'peace' | 'enemy' | 'stranded' | 'sunk';

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
	/** What lies in each zone; cleared as hazards go off and pickups are taken */
	zones: Zones;
	hull: number;
	/** Chaff canisters on hand; each one soaks up a hit */
	chaff: number;
	/** Clean zones in a row */
	streak: number;
	bestStreak: number;
	/** Points from streaks and pickups */
	bonus: number;
	outcome: FalklandsOutcome | null;
	score: number;
}

export type FalklandsEvent =
	| { type: 'move'; speed: Speed; zones: number; fuel: number; day: number; weather: Weather }
	| { type: 'blocked'; speed: Speed; weather: Weather }
	| { type: 'shortfuel'; need: number }
	| { type: 'talk'; talks: number; day: number }
	| { type: 'no-deal'; talks: number }
	| { type: 'hit'; hazard: Hazard; zone: number; damage: number; hull: number }
	| { type: 'chaff'; hazard: Hazard; zone: number }
	| { type: 'swept'; zone: number }
	| { type: 'pickup'; kind: Pickup; zone: number; amount: number }
	| { type: 'combo'; streak: number; points: number }
	| { type: 'leg'; leg: 2 | 3 }
	| { type: 'repair'; gain: number; hull: number; day: number }
	| { type: 'repair-none' }
	| { type: 'win'; outcome: 'military'; score: number }
	| { type: 'peace'; score: number }
	| { type: 'lose'; outcome: 'enemy' | 'stranded' | 'sunk'; score: number };

export function createGame(random: Random): FalklandsState {
	return {
		phase: 'sail',
		day: 0,
		playerAt: 0,
		enemyAt: ENEMY_START,
		fuel: START_FUEL,
		talks: 0,
		weather: createWeather(random),
		zones: createZones(random),
		hull: START_HULL,
		chaff: 0,
		streak: 0,
		bestStreak: 0,
		bonus: 0,
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
	return state.playerAt * PROGRESS_POINTS + state.talks * PROGRESS_TALK_POINTS + state.bonus;
}

export function finalScore(state: FalklandsState, outcome: FalklandsOutcome): number {
	if (outcome === 'military') {
		return (
			MILITARY_BASE +
			state.fuel * MILITARY_FUEL_POINTS +
			Math.max(0, DISTANCE - state.enemyAt) * GAP_POINTS +
			state.hull * HULL_POINTS +
			state.bonus
		);
	}
	if (outcome === 'peace') {
		return (
			PEACE_BASE +
			state.fuel * PEACE_FUEL_POINTS +
			state.talks * PEACE_TALK_POINTS +
			state.hull * PEACE_HULL_POINTS +
			state.bonus
		);
	}
	return progressScore(state);
}

function end(state: FalklandsState, outcome: FalklandsOutcome) {
	state.outcome = outcome;
	state.score = finalScore(state, outcome);
	state.phase = 'over';
}

/** Hull lost to a hazard at a speed: slow softens it, a sprint makes it worse */
export function hazardDamage(hazard: Hazard, speed: Speed): number {
	const base = hazard === 'mine' ? DAMAGE_MINE : hazard === 'sub' ? DAMAGE_SUB : DAMAGE_RAID;
	const factor =
		speed === 'slow' ? SLOW_DAMAGE_FACTOR : speed === 'flank' ? FLANK_DAMAGE_FACTOR : 1;
	return Math.round(base * factor);
}

/** Runs into or picks up everything in the zones just crossed; true if the hull took a hit */
function passZones(
	state: FalklandsState,
	from: number,
	speed: Speed,
	events: FalklandsEvent[]
): boolean {
	let damaged = false;
	for (let zone = from + 1; zone <= Math.min(state.playerAt, DISTANCE - 1); zone++) {
		const kind = state.zones[zone];
		if (!kind) continue;
		state.zones[zone] = null;
		if (isHazard(kind)) {
			if (kind === 'mine' && speed === 'slow') {
				events.push({ type: 'swept', zone });
			} else if (state.chaff > 0) {
				state.chaff -= 1;
				events.push({ type: 'chaff', hazard: kind, zone });
			} else {
				const damage = hazardDamage(kind, speed);
				state.hull = Math.max(0, state.hull - damage);
				damaged = true;
				events.push({ type: 'hit', hazard: kind, zone, damage, hull: state.hull });
			}
			continue;
		}
		let amount = 1;
		if (kind === 'tanker') {
			amount = Math.min(TANKER_FUEL, MAX_FUEL - state.fuel);
			state.fuel += amount;
		} else if (kind === 'repair') {
			amount = Math.min(CRATE_REPAIR, MAX_HULL - state.hull);
			state.hull += amount;
		} else if (kind === 'chaff') {
			state.chaff += 1;
		} else {
			state.enemyAt = Math.max(0, state.enemyAt - INTEL_ZONES);
		}
		state.bonus += PICKUP_POINTS;
		events.push({ type: 'pickup', kind, zone, amount });
	}
	return damaged;
}

/** Steam one, two or three zones, spending fuel and letting the other fleet move */
export function move(state: FalklandsState, speed: Speed): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	const weather = weatherNow(state);
	if (!allowsSpeed(weather, speed)) return [{ type: 'blocked', speed, weather }];

	const cost = moveCost(SPEEDS[speed].fuel, weather);
	if (state.fuel < cost) return [{ type: 'shortfuel', need: cost }];

	const from = state.playerAt;
	state.fuel -= cost;
	state.playerAt = Math.min(DISTANCE, state.playerAt + SPEEDS[speed].zones);
	state.day += 1;
	state.enemyAt += ENEMY_STEP;

	const events: FalklandsEvent[] = [
		{ type: 'move', speed, zones: SPEEDS[speed].zones, fuel: cost, day: state.day, weather }
	];
	const damaged = passZones(state, from, speed, events);
	if (damaged) state.streak = 0;
	else {
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		if (state.streak >= STREAK_MIN) {
			const points = Math.min(STREAK_CAP_POINTS, (state.streak - 1) * STREAK_POINTS);
			state.bonus += points;
			events.push({ type: 'combo', streak: state.streak, points });
		}
	}
	state.score = progressScore(state);
	const leg = legAt(state.playerAt);
	if (leg > legAt(from) && state.hull > 0 && state.playerAt < DISTANCE) {
		events.push({ type: 'leg', leg: leg as 2 | 3 });
	}
	if (state.hull <= 0) {
		end(state, 'sunk');
		events.push({ type: 'lose', outcome: 'sunk', score: state.score });
	} else if (state.playerAt >= DISTANCE) {
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

/** Patch the hull at sea: a whole day, the other fleet keeps coming */
export function repair(state: FalklandsState): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	if (state.hull >= MAX_HULL) return [{ type: 'repair-none' }];
	const gain = Math.min(REPAIR_HULL, MAX_HULL - state.hull);
	state.hull += gain;
	state.day += 1;
	state.enemyAt += ENEMY_STEP;
	state.score = progressScore(state);
	const events: FalklandsEvent[] = [{ type: 'repair', gain, hull: state.hull, day: state.day }];
	if (state.enemyAt >= DISTANCE) {
		end(state, 'enemy');
		events.push({ type: 'lose', outcome: 'enemy', score: state.score });
	}
	return events;
}

/** Stars for the result: a fast, healthy, fuelled arrival earns three; the deal tops out at two */
export function starsFor(state: FalklandsState): number {
	if (state.outcome === 'military') {
		return 1 + (state.hull >= STAR_HULL ? 1 : 0) + (state.fuel >= STAR_FUEL ? 1 : 0);
	}
	if (state.outcome === 'peace') return 1 + (state.hull >= PEACE_STAR_HULL ? 1 : 0);
	return 0;
}

/** Sign the deal once the talks have gone on long enough */
export function deal(state: FalklandsState): FalklandsEvent[] {
	if (state.phase !== 'sail') return [];
	if (!canDeal(state)) return [{ type: 'no-deal', talks: state.talks }];
	end(state, 'peace');
	return [{ type: 'peace', score: state.score }];
}

/*
 * Iron Dome Juggler rules as plain data and pure functions: createGame builds a seeded run, step
 * advances it by a fixed time step and returns the events that happened (for sounds and popups),
 * and tap is the single input: tapping a rocket launches an interceptor at it.
 *
 * Rockets fly fixed arcs, so each one's landing point is known the moment it appears. A rocket
 * bound for a standing building costs hearts if it lands and pays that building's value if it is
 * shot down; one bound for the sea, a field or a building already in ruins is harmless, and an
 * interceptor spent on it costs points.
 */
import { createAmmo, fire, tickAmmo, canFire, type Ammo } from './ammo.js';
import { standingValue } from './city.js';
import {
	BLACKOUT_MS,
	FIRST_SPAWN_MS,
	STARTING_LIVES,
	TARGETS,
	INTERCEPTOR_LIFETIME_MS,
	WAVE_BONUS,
	WAVE_PAUSE_MS,
	type TargetKind
} from './config.js';
import { launchInterceptor, stepInterceptor, type Interceptor } from './intercept.js';
import { interceptScore, pickRocket, rankThreats } from './priority.js';
import { flightPoint, timeToImpact, type Flight, type Point } from './trajectory.js';
import { planWave, type RocketKind, type Spawn } from './waves.js';
import type { Random } from '#lib/game/random.js';

export interface Rocket {
	id: number;
	kind: RocketKind;
	flight: Flight;
	elapsedMs: number;
	/** Index into TARGETS, or null when aimed at nothing valuable */
	targetIndex: number | null;
	/** The interceptor that is chasing it, so it is not shot at twice */
	interceptorId: number | null;
}

export type Phase = 'pause' | 'wave' | 'over';

export interface DomeState {
	phase: Phase;
	/** Current wave, 0 before the first one starts */
	wave: number;
	/** Counts down the pause before the next wave starts */
	pauseMs: number;
	/** Time since the wave began; negative during the short lead-in */
	waveElapsedMs: number;
	queue: Spawn[];
	rockets: Rocket[];
	interceptors: Interceptor[];
	/** One flag per building: true while it lies in ruins (until the wave is over) */
	ruined: boolean[];
	ammo: Ammo;
	/** Time left of the reloader outage after the power plant was hit */
	blackoutMs: number;
	score: number;
	lives: number;
	combo: number;
	bestCombo: number;
	/** Rockets shot down, interceptors spent on harmless rockets, and buildings lost, over the whole run */
	intercepts: number;
	wasted: number;
	hits: number;
	/** Whether a building was hit during the current wave (a clean wave earns a heart back) */
	waveHit: boolean;
	nextId: number;
}

export type DomeEvent =
	| { type: 'wave-start'; wave: number; count: number }
	| { type: 'launch'; x: number; y: number }
	| { type: 'no-ammo' }
	| {
			type: 'intercept';
			x: number;
			y: number;
			points: number;
			multiplier: number;
			combo: number;
			wasted: boolean;
	  }
	| { type: 'fizzle'; x: number; y: number }
	| {
			type: 'impact';
			x: number;
			y: number;
			target: TargetKind | null;
			cost: number;
	  }
	| { type: 'blackout' }
	| { type: 'wave-clear'; wave: number; bonus: number; perfect: boolean; heartBack: boolean }
	| { type: 'game-over' };

export function createGame(): DomeState {
	return {
		phase: 'pause',
		wave: 0,
		pauseMs: 600,
		waveElapsedMs: 0,
		queue: [],
		rockets: [],
		interceptors: [],
		ruined: TARGETS.map(() => false),
		ammo: createAmmo(),
		blackoutMs: 0,
		score: 0,
		lives: STARTING_LIVES,
		combo: 0,
		bestCombo: 0,
		intercepts: 0,
		wasted: 0,
		hits: 0,
		waveHit: false,
		nextId: 1
	};
}

export function rocketPosition(rocket: Rocket): Point {
	return flightPoint(rocket.flight, rocket.elapsedMs);
}

/** Points at risk if this rocket lands now: the building's value, or 0 for a harmless one */
export function rocketValue(state: DomeState, rocket: Rocket): number {
	return standingValue(rocket.targetIndex, state.ruined);
}

function startWave(state: DomeState, random: Random): DomeEvent {
	state.wave += 1;
	state.phase = 'wave';
	state.queue = planWave(state.wave, random);
	state.waveElapsedMs = -FIRST_SPAWN_MS;
	state.waveHit = false;
	return { type: 'wave-start', wave: state.wave, count: state.queue.length };
}

function spawnDue(state: DomeState) {
	while (state.queue.length > 0 && state.queue[0].atMs <= state.waveElapsedMs) {
		const spawn = state.queue.shift()!;
		state.rockets.push({
			id: state.nextId++,
			kind: spawn.kind,
			flight: spawn.flight,
			elapsedMs: 0,
			targetIndex: spawn.targetIndex,
			interceptorId: null
		});
	}
}

function endGame(state: DomeState, events: DomeEvent[]) {
	state.phase = 'over';
	state.rockets = [];
	state.interceptors = [];
	state.queue = [];
	events.push({ type: 'game-over' });
}

function resolveLanding(state: DomeState, rocket: Rocket, events: DomeEvent[]) {
	const x = rocket.flight.impactX;
	const y = rocket.flight.flightMs > 0 ? flightPoint(rocket.flight, rocket.flight.flightMs).y : 0;
	const index = rocket.targetIndex;
	if (index === null || state.ruined[index]) {
		events.push({ type: 'impact', x, y, target: null, cost: 0 });
		return;
	}
	const target = TARGETS[index];
	state.ruined[index] = true;
	state.lives = Math.max(0, state.lives - target.cost);
	state.hits += 1;
	state.waveHit = true;
	state.combo = 0;
	events.push({ type: 'impact', x, y, target: target.kind, cost: target.cost });
	if (target.kind === 'plant') {
		state.blackoutMs = BLACKOUT_MS;
		events.push({ type: 'blackout' });
	}
}

function resolveIntercept(state: DomeState, rocket: Rocket, events: DomeEvent[]) {
	const value = rocketValue(state, rocket);
	const comboAfter = value > 0 ? state.combo + 1 : 0;
	const result = interceptScore(value, comboAfter);
	state.score = Math.max(0, state.score + result.points);
	state.combo = comboAfter;
	state.bestCombo = Math.max(state.bestCombo, comboAfter);
	if (result.wasted) state.wasted += 1;
	else state.intercepts += 1;
	const at = rocketPosition(rocket);
	events.push({
		type: 'intercept',
		x: at.x,
		y: at.y,
		points: result.points,
		multiplier: result.multiplier,
		combo: comboAfter,
		wasted: result.wasted
	});
}

/** Advances the game by dtMs and returns what happened */
export function step(state: DomeState, dtMs: number, random: Random): DomeEvent[] {
	const events: DomeEvent[] = [];
	if (state.phase === 'over') return events;

	state.blackoutMs = Math.max(0, state.blackoutMs - dtMs);
	tickAmmo(state.ammo, dtMs, state.blackoutMs > 0);

	if (state.phase === 'pause') {
		state.pauseMs -= dtMs;
		if (state.pauseMs <= 0) events.push(startWave(state, random));
		return events;
	}

	state.waveElapsedMs += dtMs;
	spawnDue(state);
	for (const rocket of state.rockets) rocket.elapsedMs += dtMs;

	const gone = new Set<number>();
	const spent = new Set<number>();

	// Rockets that reach the ground land first: an interceptor still chasing one is lost
	for (const rocket of state.rockets) {
		if (rocket.elapsedMs < rocket.flight.flightMs) continue;
		gone.add(rocket.id);
		resolveLanding(state, rocket, events);
		if (state.lives <= 0) {
			endGame(state, events);
			return events;
		}
	}

	for (const interceptor of state.interceptors) {
		const rocket = state.rockets.find((candidate) => candidate.id === interceptor.rocketId);
		if (!rocket || gone.has(rocket.id)) {
			spent.add(interceptor.id);
			events.push({ type: 'fizzle', x: interceptor.x, y: interceptor.y });
			state.combo = 0;
			continue;
		}
		const hit = stepInterceptor(interceptor, dtMs, rocket.flight, rocket.elapsedMs);
		if (hit) {
			gone.add(rocket.id);
			spent.add(interceptor.id);
			resolveIntercept(state, rocket, events);
		} else if (interceptor.ageMs >= INTERCEPTOR_LIFETIME_MS) {
			spent.add(interceptor.id);
			rocket.interceptorId = null;
			events.push({ type: 'fizzle', x: interceptor.x, y: interceptor.y });
			state.combo = 0;
		}
	}

	state.rockets = state.rockets.filter((rocket) => !gone.has(rocket.id));
	state.interceptors = state.interceptors.filter((interceptor) => !spent.has(interceptor.id));

	if (state.queue.length === 0 && state.rockets.length === 0 && state.interceptors.length === 0) {
		const perfect = !state.waveHit;
		const bonus = WAVE_BONUS * state.wave;
		const heartBack = perfect && state.lives < STARTING_LIVES;
		if (heartBack) state.lives += 1;
		state.score += bonus;
		state.ruined = TARGETS.map(() => false);
		state.phase = 'pause';
		state.pauseMs = WAVE_PAUSE_MS;
		events.push({ type: 'wave-clear', wave: state.wave, bonus, perfect, heartBack });
	}
	return events;
}

/** The rockets a tap could mean: those that nobody is chasing yet */
function freeRockets(state: DomeState) {
	return state.rockets
		.filter((rocket) => rocket.interceptorId === null)
		.map((rocket) => ({
			rocket,
			...rocketPosition(rocket),
			id: rocket.id,
			value: rocketValue(state, rocket),
			timeToImpactMs: timeToImpact(rocket.flight, rocket.elapsedMs)
		}));
}

function launchAt(state: DomeState, rocket: Rocket): DomeEvent[] {
	if (!canFire(state.ammo)) {
		// A tap during the short cooldown between shots is simply ignored
		return state.ammo.loaded <= 0 ? [{ type: 'no-ammo' }] : [];
	}
	fire(state.ammo);
	const interceptor = launchInterceptor(state.nextId++, rocket.id, rocket.flight, rocket.elapsedMs);
	rocket.interceptorId = interceptor.id;
	state.interceptors.push(interceptor);
	return [{ type: 'launch', x: interceptor.x, y: interceptor.y }];
}

/** The input: a tap at a world point launches an interceptor at the rocket nearest to it */
export function tap(state: DomeState, point: Point): DomeEvent[] {
	if (state.phase !== 'wave') return [];
	const choice = pickRocket(freeRockets(state), point);
	return choice ? launchAt(state, choice.rocket) : [];
}

/** Keyboard fallback: launches at the most urgent rocket bound for a standing building */
export function tapMostUrgent(state: DomeState): DomeEvent[] {
	if (state.phase !== 'wave') return [];
	const threats = freeRockets(state).filter((entry) => entry.value > 0);
	const first = rankThreats(threats)[0];
	return first ? launchAt(state, first.rocket) : [];
}

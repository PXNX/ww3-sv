/*
 * One fixed step of Run Comrade, and the commands the player can give. Pure: the state is mutated,
 * the random comes from the caller, and everything that happened is returned as events for the
 * store to turn into sounds and effects.
 */
import type { Random } from '#lib/game/random.js';
import {
	COIN_SCORE,
	DUCK_MS,
	GENERATE_AHEAD,
	HIDE_TAIL,
	JUMP_MS,
	LANE_CHANGE_MS,
	LANE_OVERLAP,
	OBSTACLE_HALF_DEPTH,
	PICKUP_SCORE,
	REQUIRED_ACTION,
	REVIVE_CLEAR_AHEAD,
	REVIVE_GRACE_MS,
	SLOW_MS,
	STUMBLE_ANIM_MS,
	STUMBLE_GRACE_MS,
	STUMBLE_SPEED,
	type Lane,
	type ObstacleKind
} from './config';
import {
	closeIn,
	closeness,
	createDrone,
	followRunner,
	knockBack,
	stepDrone,
	stepMenace,
	swoopedThrough
} from './drone';
import { stepGlance } from './glance';
import { fogHidesDrone, weatherAt } from './weather';
import { extendField, inTallSunflowers, nearestLane, pruneField, speedAt } from './patterns';
import { absorbHit, applyPickup, isBoosted, reaches, speedFactor, tickPower } from './pickups';
import { stepSurge, surgeSpeedFactor } from './surge';
import { isAirborne, isDucking, type RunEvent, type RunState } from './state';

export type Command = 'left' | 'right' | 'jump' | 'duck';

/** How far behind the runner the course is kept before it is thrown away */
const KEEP_BEHIND = 12;

/** A command from the player: change lane, jump or duck */
export function command(state: RunState, action: Command): RunEvent[] {
	if (state.over) return [];
	const runner = state.runner;
	switch (action) {
		case 'left':
		case 'right': {
			const lane = Math.min(2, Math.max(0, runner.lane + (action === 'left' ? -1 : 1))) as Lane;
			if (lane === runner.lane) return [];
			runner.lane = lane;
			return [{ type: 'lane', lane }];
		}
		case 'jump':
			if (isAirborne(runner)) return [];
			runner.jumpMs = 0;
			runner.duckMs = 0;
			return [{ type: 'jump' }];
		case 'duck': {
			const events: RunEvent[] = [];
			// Ducking in the air drops the runner straight down
			if (isAirborne(runner)) {
				events.push({ type: 'land', airMs: runner.jumpMs });
				runner.jumpMs = -1;
			}
			if (!isDucking(runner)) events.push({ type: 'duck' });
			runner.duckMs = DUCK_MS;
			return events;
		}
	}
}

/**
 * A bought revival after the last heart is gone: the same run goes on with one heart. The drone is
 * pushed back to its starting gap and holds off for a moment, and the obstacles the runner is on or
 * about to reach are cleared so it does not stumble straight back into the drone's reach. Returns
 * false (and changes nothing) unless the run is over.
 */
export function revive(state: RunState): boolean {
	if (!state.over) return false;
	state.over = false;
	state.lives = 1;
	const runner = state.runner;
	runner.stumbleMs = 0;
	runner.slowMs = 0;
	const drone = createDrone();
	drone.lane = state.drone.lane;
	drone.x = state.drone.x;
	drone.graceMs = REVIVE_GRACE_MS;
	state.drone = drone;
	const from = state.distance - 1;
	const to = state.distance + REVIVE_CLEAR_AHEAD;
	state.field.rows = state.field.rows.filter((row) => row.z < from || row.z > to);
	return true;
}

/** Whether the runner's current move gets it past this kind of obstacle without a stumble */
export function clears(kind: ObstacleKind, state: RunState): boolean {
	const action = REQUIRED_ACTION[kind];
	if (action === 'jump') return isAirborne(state.runner);
	if (action === 'duck') return isDucking(state.runner);
	return false;
}

function slowFactor(slowMs: number): number {
	if (slowMs <= 0) return 1;
	return STUMBLE_SPEED + (1 - STUMBLE_SPEED) * (1 - slowMs / SLOW_MS);
}

export function stepGame(state: RunState, random: Random, dtMs: number): RunEvent[] {
	if (state.over) return [];
	const events: RunEvent[] = [];
	const runner = state.runner;
	const seconds = dtMs / 1000;
	state.timeMs += dtMs;

	// The runner's own timers and sideways slide
	if (runner.jumpMs >= 0) {
		runner.jumpMs += dtMs;
		if (runner.jumpMs >= JUMP_MS) {
			runner.jumpMs = -1;
			events.push({ type: 'land', airMs: JUMP_MS });
		}
	}
	runner.duckMs = Math.max(0, runner.duckMs - dtMs);
	runner.stumbleMs = Math.max(0, runner.stumbleMs - dtMs);
	runner.slowMs = Math.max(0, runner.slowMs - dtMs);
	runner.graceMs = Math.max(0, runner.graceMs - dtMs);
	const slide = dtMs / LANE_CHANGE_MS;
	runner.x =
		runner.x < runner.lane
			? Math.min(runner.lane, runner.x + slide)
			: Math.max(runner.lane, runner.x - slide);

	// Forward motion. A surge starts before the speed is worked out, so the step it starts is faster
	const surge = stepSurge(state.surge, dtMs, random);
	if (surge.started) events.push({ type: 'surge', factor: state.surge.factor });
	state.speed =
		speedAt(state.distance) *
		surgeSpeedFactor(state.surge) *
		speedFactor(state.power) *
		slowFactor(runner.slowMs);
	state.distance += state.speed * seconds;
	if (tickPower(state.power, dtMs).boostEnded) events.push({ type: 'boost-end' });

	// The course ahead
	extendField(state.field, state.generator, random, state.distance + GENERATE_AHEAD);
	pruneField(state.field, state.distance - KEEP_BEHIND);

	collideWithObstacles(state, events);
	collectPickups(state, events);

	// The drone
	const lane = nearestLane(runner.x);
	state.covered = inTallSunflowers(state.field, state.distance, lane, HIDE_TAIL);
	state.weather = weatherAt(state.weatherPlan, state.distance);
	state.hidden = state.covered || fogHidesDrone(state.weather, state.drone.gap);
	if (
		stepDrone(state.drone, dtMs, isBoosted(state.power), surgeSpeedFactor(state.surge) > 1).contact
	) {
		if (absorbHit(state.power)) {
			state.shieldBlocks += 1;
			events.push({ type: 'shield-block', source: 'drone' });
		} else {
			state.lives = Math.max(0, state.lives - 1);
			state.contacts += 1;
			events.push({ type: 'contact', lives: state.lives });
		}
		knockBack(state.drone);
	}

	if (followRunner(state.drone, lane, dtMs)) {
		events.push({ type: 'drone-maneuver', kind: 'lane', gap: state.drone.gap, x: state.drone.x });
	}
	if (stepMenace(state.drone, dtMs)) {
		events.push({ type: 'drone-maneuver', kind: 'swoop', gap: state.drone.gap, x: state.drone.x });
	}
	stepGlance(state.glance, dtMs, closeness(state.drone.gap), state.hidden);

	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
	return events;
}

function collideWithObstacles(state: RunState, events: RunEvent[]) {
	const runner = state.runner;
	for (const row of state.field.rows) {
		for (const lane of [0, 1, 2] as const) {
			const kind = row.cells[lane];
			if (kind === null || row.spent[lane]) continue;
			if (Math.abs(row.z - state.distance) > OBSTACLE_HALF_DEPTH[kind]) continue;
			if (Math.abs(runner.x - lane) >= LANE_OVERLAP) continue;
			// Anything that touches the runner is dealt with once
			row.spent[lane] = true;
			if (clears(kind, state)) continue;
			if (isBoosted(state.power)) {
				state.smashes += 1;
				events.push({ type: 'smash', kind, lane });
			} else if (runner.graceMs > 0) {
				continue;
			} else if (absorbHit(state.power)) {
				state.shieldBlocks += 1;
				runner.graceMs = STUMBLE_GRACE_MS;
				events.push({ type: 'shield-block', source: 'obstacle' });
			} else {
				stumble(state, kind, lane, events);
			}
		}
	}
}

function stumble(state: RunState, kind: ObstacleKind, lane: Lane, events: RunEvent[]) {
	const runner = state.runner;
	const before = state.drone.gap;
	closeIn(state.drone, kind);
	runner.stumbleMs = STUMBLE_ANIM_MS;
	runner.slowMs = SLOW_MS;
	runner.graceMs = STUMBLE_GRACE_MS;
	state.stumbles += 1;
	events.push({ type: 'stumble', kind, lane, gap: state.drone.gap });
	// The drone dives at the runner; a stumble that brings it through a swoop distance is a swoop
	events.push({
		type: 'drone-maneuver',
		kind: swoopedThrough(before, state.drone.gap) ? 'swoop' : 'close-in',
		gap: state.drone.gap,
		x: state.drone.x
	});
}

function collectPickups(state: RunState, events: RunEvent[]) {
	for (const pickup of state.field.pickups) {
		if (!reaches(pickup, state.distance, state.runner.x)) continue;
		pickup.taken = true;
		if (pickup.kind === 'coin') {
			state.pickups.coin += 1;
			state.bonus += COIN_SCORE;
		} else {
			applyPickup(state.power, pickup.kind);
			state.pickups[pickup.kind] += 1;
			state.bonus += PICKUP_SCORE;
		}
		events.push({ type: 'pickup', kind: pickup.kind, lane: pickup.lane });
	}
}

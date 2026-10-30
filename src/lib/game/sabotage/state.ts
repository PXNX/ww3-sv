/*
 * Gig Saboteur simulation: a plain object stepped at a fixed rate. The player sneaks across a tile
 * map, guards and dogs patrol and investigate, cameras sweep and floodlights blink. Anything that
 * can see the player fills one shared suspicion meter; full means busted. Sabotage every target,
 * then reach the exit. step() returns the events of that step for sounds and effects.
 */
import {
	BASE_RATE,
	BUSH_REVEAL,
	CLOSE_IN,
	CLOSE_RATE,
	DOG,
	GUARD,
	NOISE_INTERVAL,
	NOISE_RADIUS,
	PHONE,
	PLAYER_RADIUS,
	REACH,
	SABOTAGE_SECONDS,
	SEARCH_SECONDS,
	SHADOW_VISIBILITY,
	SNEAK_STICK,
	SPEED,
	STANCE_VISIBILITY,
	SUSPICION_DECAY,
	SUSPICION_DECAY_DELAY,
	TURN_RATE
} from './config.js';
import type { GuardDef, Level, SensorDef } from './levels.js';
import {
	angleDiff,
	findPath,
	hasLineOfSight,
	isWalkable,
	moveCircle,
	tileAt,
	tileUnder,
	walkClear,
	type Vec
} from './map.js';
import { earnedStars, payoutFor, starCount, type Stars } from './scoring.js';

export type Stance = 'idle' | 'sneak' | 'walk' | 'sprint';
export type GuardMode = 'patrol' | 'wait' | 'look' | 'investigate' | 'search' | 'return';
export type Phase = 'playing' | 'busted' | 'cleared';

export interface Input {
	/** Movement direction, each axis -1 to 1; the length says how hard the stick is pushed */
	x: number;
	y: number;
	sprint: boolean;
	sneak: boolean;
	/** The sabotage button is held */
	hold: boolean;
}

export const NO_INPUT: Input = { x: 0, y: 0, sprint: false, sneak: false, hold: false };

export interface Player {
	x: number;
	y: number;
	facing: number;
	stance: Stance;
	hidden: boolean;
	inShadow: boolean;
}

export interface Guard {
	kind: 'guard' | 'dog';
	x: number;
	y: number;
	facing: number;
	mode: GuardMode;
	route: Vec[];
	wait: number;
	/** Index of the waypoint being walked to */
	at: number;
	direction: 1 | -1;
	waitLeft: number;
	searchLeft: number;
	/** Where an investigating guard is heading, and the path it follows there */
	goal: Vec | null;
	path: Vec[];
	lastSeen: Vec | null;
	patrolSpeed: number;
	chaseSpeed: number;
	range: number;
	halfFov: number;
	seeing: boolean;
	/** 0 to 1, smoothed: how alarmed the cone looks */
	heat: number;
	/** Hears sprinting within this many tiles */
	hearing: number;
}

export interface Sensor {
	kind: 'camera' | 'floodlight';
	x: number;
	y: number;
	baseAngle: number;
	sweep: number;
	period: number;
	phase: number;
	range: number;
	halfFov: number;
	onSeconds: number;
	offSeconds: number;
	angle: number;
	active: boolean;
	seeing: boolean;
	heat: number;
}

export interface Target {
	x: number;
	y: number;
	done: boolean;
	/** 0 to 1 while being worked on */
	progress: number;
}

export interface Phone {
	x: number;
	y: number;
	ttl: number;
}

export interface SabotageState {
	level: Level;
	time: number;
	phase: Phase;
	player: Player;
	guards: Guard[];
	sensors: Sensor[];
	targets: Target[];
	exitOpen: boolean;
	suspicion: number;
	peakSuspicion: number;
	/** Seconds since anything last saw the player */
	unseenFor: number;
	noiseAlarms: number;
	noiseTimer: number;
	phone: Phone | null;
	phoneLeft: number;
	/** Index of the target being sabotaged, or -1 */
	working: number;
}

export type SabotageEvent =
	| { type: 'alert'; x: number; y: number; kind: 'guard' | 'dog' }
	| { type: 'investigate'; x: number; y: number; kind: 'guard' | 'dog' }
	| { type: 'noise'; x: number; y: number; radius: number }
	| { type: 'phone'; x: number; y: number }
	| { type: 'sabotage-cancel' }
	| { type: 'target-done'; x: number; y: number; remaining: number }
	| { type: 'exit-open' }
	| { type: 'busted' }
	| { type: 'cleared' };

const DEGREES = Math.PI / 180;
const centre = (tile: [number, number]): Vec => ({ x: tile[0] + 0.5, y: tile[1] + 0.5 });

function createGuard(def: GuardDef): Guard {
	const route = def.route.map(centre);
	const startAt = Math.min(route.length - 1, def.startAt ?? 0);
	const dog = def.kind === 'dog';
	const spec = dog ? DOG : GUARD;
	const next = route[(startAt + 1) % route.length];
	return {
		kind: def.kind,
		x: route[startAt].x,
		y: route[startAt].y,
		facing: Math.atan2(next.y - route[startAt].y, next.x - route[startAt].x),
		mode: 'wait',
		route,
		wait: def.wait,
		at: startAt,
		direction: startAt === route.length - 1 ? -1 : 1,
		waitLeft: 0.8,
		searchLeft: 0,
		goal: null,
		path: [],
		lastSeen: null,
		patrolSpeed: spec.speed,
		chaseSpeed: spec.chase,
		range: spec.range,
		halfFov: spec.halfFov,
		seeing: false,
		heat: 0,
		hearing: dog ? NOISE_RADIUS.dog : NOISE_RADIUS.guard
	};
}

function createSensor(def: SensorDef): Sensor {
	const at = centre(def.at);
	return {
		kind: def.kind,
		x: at.x,
		y: at.y,
		baseAngle: def.angle * DEGREES,
		sweep: def.sweep * DEGREES,
		period: def.period,
		phase: def.phase,
		range: def.range,
		halfFov: (def.fov * DEGREES) / 2,
		onSeconds: def.onSeconds,
		offSeconds: def.offSeconds,
		angle: def.angle * DEGREES,
		active: true,
		seeing: false,
		heat: 0
	};
}

export function createSabotage(level: Level): SabotageState {
	const state: SabotageState = {
		level,
		time: 0,
		phase: 'playing',
		player: {
			x: level.start.x,
			y: level.start.y,
			facing: -Math.PI / 2,
			stance: 'idle',
			hidden: false,
			inShadow: false
		},
		guards: level.guards.map(createGuard),
		sensors: level.sensors.map(createSensor),
		targets: level.targets.map((t) => ({ x: t.x, y: t.y, done: false, progress: 0 })),
		exitOpen: false,
		suspicion: 0,
		peakSuspicion: 0,
		unseenFor: 99,
		noiseAlarms: 0,
		noiseTimer: 0,
		phone: null,
		phoneLeft: 1,
		working: -1
	};
	updateSensors(state);
	return state;
}

/** Remaining targets still to sabotage */
export const targetsLeft = (state: SabotageState): number =>
	state.targets.filter((target) => !target.done).length;

/** Index of the nearest unfinished target within reach, or -1 */
export function targetInReach(state: SabotageState): number {
	let best = -1;
	let bestDist = REACH;
	state.targets.forEach((target, index) => {
		if (target.done) return;
		const dist = Math.hypot(target.x - state.player.x, target.y - state.player.y);
		if (dist <= bestDist) {
			bestDist = dist;
			best = index;
		}
	});
	return best;
}

function updateSensors(state: SabotageState) {
	for (const sensor of state.sensors) {
		if (sensor.kind === 'camera') {
			sensor.angle =
				sensor.baseAngle +
				sensor.sweep * Math.sin(((state.time / sensor.period) * 2 + sensor.phase) * Math.PI);
			sensor.active = true;
		} else {
			const cycle = sensor.onSeconds + sensor.offSeconds;
			sensor.active = (state.time + sensor.phase) % cycle < sensor.onSeconds;
		}
	}
}

/**
 * How fast an observer at (x, y) facing `facing` fills suspicion while it sees the player, or 0 when
 * it does not: out of range, outside the cone, hidden in a bush, or behind a wall.
 */
export function exposure(
	state: SabotageState,
	observer: { x: number; y: number; facing: number; range: number; halfFov: number; lit?: boolean }
): number {
	const { player, level } = state;
	const dist = Math.hypot(player.x - observer.x, player.y - observer.y);
	if (dist > observer.range) return 0;
	if (player.hidden && dist > BUSH_REVEAL) return 0;
	if (observer.halfFov < Math.PI) {
		const toPlayer = Math.atan2(player.y - observer.y, player.x - observer.x);
		if (Math.abs(angleDiff(toPlayer, observer.facing)) > observer.halfFov) return 0;
	}
	if (!hasLineOfSight(level.grid, observer, player)) return 0;
	let rate =
		(BASE_RATE + CLOSE_RATE * (1 - dist / observer.range)) * STANCE_VISIBILITY[player.stance];
	if (player.inShadow && !observer.lit) rate *= SHADOW_VISIBILITY;
	return rate;
}

function turnToward(guard: Guard, angle: number, dt: number, rate = TURN_RATE) {
	const diff = angleDiff(angle, guard.facing);
	const max = rate * dt;
	guard.facing += Math.abs(diff) <= max ? diff : Math.sign(diff) * max;
}

/** Walks the guard toward a goal along a path, taking shortcuts where the way is clear; true on arrival */
function advance(
	state: SabotageState,
	guard: Guard,
	goal: Vec,
	speed: number,
	dt: number
): boolean {
	const grid = state.level.grid;
	if (!guard.goal || Math.hypot(guard.goal.x - goal.x, guard.goal.y - goal.y) > 0.2) {
		guard.goal = { x: goal.x, y: goal.y };
		guard.path = findPath(grid, guard, goal) ?? [];
		guard.path.push({ x: goal.x, y: goal.y });
	}
	// Cut corners: skip ahead to the furthest path point in a clear line
	while (guard.path.length > 1 && walkClear(grid, guard, guard.path[1])) guard.path.shift();
	const next = guard.path[0] ?? goal;
	const dx = next.x - guard.x;
	const dy = next.y - guard.y;
	const dist = Math.hypot(dx, dy);
	const stepLength = speed * dt;
	if (dist <= stepLength) {
		guard.x = next.x;
		guard.y = next.y;
		guard.path.shift();
		if (guard.path.length === 0) {
			guard.goal = null;
			return true;
		}
		return false;
	}
	guard.x += (dx / dist) * stepLength;
	guard.y += (dy / dist) * stepLength;
	turnToward(guard, Math.atan2(dy, dx), dt);
	return false;
}

function nextWaypoint(guard: Guard) {
	const last = guard.route.length - 1;
	if (last === 0) return;
	if (guard.direction === 1 && guard.at >= last) guard.direction = -1;
	else if (guard.direction === -1 && guard.at <= 0) guard.direction = 1;
	guard.at += guard.direction;
}

function nearestWaypoint(guard: Guard): number {
	let best = 0;
	let bestDist = Infinity;
	guard.route.forEach((point, index) => {
		const dist = Math.hypot(point.x - guard.x, point.y - guard.y);
		if (dist < bestDist) {
			bestDist = dist;
			best = index;
		}
	});
	return best;
}

/** Sends a guard to a spot; `counts` marks it as drawn over by the player's noise */
function sendToCheck(
	state: SabotageState,
	guard: Guard,
	spot: Vec,
	counts: boolean,
	events: SabotageEvent[]
) {
	if (guard.mode === 'look') return;
	const fresh = guard.mode === 'patrol' || guard.mode === 'wait' || guard.mode === 'return';
	if (fresh && counts) state.noiseAlarms += 1;
	if (fresh || guard.mode === 'search') {
		events.push({ type: 'investigate', x: guard.x, y: guard.y, kind: guard.kind });
	}
	guard.mode = 'investigate';
	guard.goal = null;
	guard.lastSeen = { x: spot.x, y: spot.y };
}

function updateGuard(
	state: SabotageState,
	guard: Guard,
	rate: number,
	dt: number,
	events: SabotageEvent[]
) {
	const { player } = state;
	const sees = rate > 0;
	const wasLooking = guard.mode === 'look';
	guard.seeing = sees;
	const heatTarget = sees ? Math.max(0.3, state.suspicion) : 0;
	guard.heat += (heatTarget - guard.heat) * Math.min(1, (heatTarget > guard.heat ? 6 : 2.5) * dt);

	if (sees) {
		if (!wasLooking) {
			guard.mode = 'look';
			guard.goal = null;
			events.push({ type: 'alert', x: guard.x, y: guard.y, kind: guard.kind });
		}
		guard.lastSeen = { x: player.x, y: player.y };
		turnToward(guard, Math.atan2(player.y - guard.y, player.x - guard.x), dt, 9);
		// Once properly suspicious it walks over to take a closer look
		if (state.suspicion > CLOSE_IN) advance(state, guard, player, guard.patrolSpeed * 0.8, dt);
		return;
	}
	if (wasLooking) {
		guard.mode = 'investigate';
		guard.goal = null;
	}

	switch (guard.mode) {
		case 'patrol': {
			const arrived = advance(state, guard, guard.route[guard.at], guard.patrolSpeed, dt);
			if (arrived) {
				guard.mode = 'wait';
				guard.waitLeft = guard.wait;
			}
			break;
		}
		case 'wait': {
			guard.waitLeft -= dt;
			// Looks about while standing at a waypoint
			guard.facing += Math.sin(state.time * 1.6) * dt * 0.9;
			if (guard.waitLeft <= 0) {
				nextWaypoint(guard);
				guard.mode = 'patrol';
			}
			break;
		}
		case 'investigate': {
			const spot = guard.lastSeen ?? guard.route[guard.at];
			if (advance(state, guard, spot, guard.chaseSpeed, dt)) {
				guard.mode = 'search';
				const ringing = state.phone ? state.phone.ttl : 0;
				guard.searchLeft = SEARCH_SECONDS + (ringing > 0 ? ringing : 0);
			}
			break;
		}
		case 'search': {
			guard.searchLeft -= dt;
			guard.facing += Math.sin(state.time * 2.4) * dt * 2.2;
			if (guard.searchLeft <= 0) {
				guard.mode = 'return';
				guard.goal = null;
				guard.at = nearestWaypoint(guard);
			}
			break;
		}
		case 'return': {
			if (advance(state, guard, guard.route[guard.at], guard.patrolSpeed, dt)) {
				guard.mode = 'wait';
				guard.waitLeft = 0.4;
			}
			break;
		}
		default:
			break;
	}
}

/** Sprinting makes noise: guards and dogs in earshot come to look where it came from */
function makeNoise(state: SabotageState, events: SabotageEvent[]) {
	const { player } = state;
	events.push({ type: 'noise', x: player.x, y: player.y, radius: NOISE_RADIUS.guard });
	for (const guard of state.guards) {
		const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
		if (dist <= guard.hearing) sendToCheck(state, guard, player, true, events);
	}
}

/** Throws the phone to a spot within range: it rings and nearby guards go to check */
export function throwPhone(state: SabotageState, x: number, y: number): SabotageEvent[] {
	const events: SabotageEvent[] = [];
	if (state.phase !== 'playing' || state.phoneLeft <= 0) return events;
	const { player, level } = state;
	let dx = x - player.x;
	let dy = y - player.y;
	const reach = Math.hypot(dx, dy);
	if (reach > PHONE.range) {
		dx = (dx / reach) * PHONE.range;
		dy = (dy / reach) * PHONE.range;
	}
	// It lands on the last open spot along the throw
	let spot: Vec = { x: player.x, y: player.y };
	const length = Math.hypot(dx, dy);
	for (let d = 0.25; d <= length + 1e-6; d += 0.25) {
		const probe = { x: player.x + (dx / length) * d, y: player.y + (dy / length) * d };
		if (!isWalkable(tileAt(level.grid, Math.floor(probe.x), Math.floor(probe.y)))) break;
		spot = probe;
	}
	state.phone = { x: spot.x, y: spot.y, ttl: PHONE.ringSeconds };
	state.phoneLeft -= 1;
	events.push({ type: 'phone', x: spot.x, y: spot.y });
	for (const guard of state.guards) {
		if (Math.hypot(guard.x - spot.x, guard.y - spot.y) <= PHONE.hearing) {
			sendToCheck(state, guard, spot, false, events);
		}
	}
	return events;
}

export function step(state: SabotageState, dt: number, input: Input = NO_INPUT): SabotageEvent[] {
	const events: SabotageEvent[] = [];
	if (state.phase !== 'playing') return events;
	const { player, level } = state;
	state.time += dt;

	// Moving
	const stick = Math.hypot(input.x, input.y);
	const moving = stick > 0.08;
	if (moving) {
		const dirX = input.x / stick;
		const dirY = input.y / stick;
		player.stance = input.sprint ? 'sprint' : input.sneak || stick < SNEAK_STICK ? 'sneak' : 'walk';
		const speed =
			SPEED[player.stance === 'sprint' ? 'sprint' : player.stance === 'sneak' ? 'sneak' : 'walk'];
		const moved = moveCircle(
			level.grid,
			player,
			dirX * speed * dt,
			dirY * speed * dt,
			PLAYER_RADIUS
		);
		player.x = moved.x;
		player.y = moved.y;
		player.facing = Math.atan2(dirY, dirX);
	} else {
		player.stance = 'idle';
	}
	const under = tileUnder(level.grid, player);
	player.hidden = under === 'bush';
	player.inShadow = under === 'shadow';

	// Sprinting is loud
	if (player.stance === 'sprint') {
		state.noiseTimer -= dt;
		if (state.noiseTimer <= 0) {
			state.noiseTimer = NOISE_INTERVAL;
			makeNoise(state, events);
		}
	} else {
		state.noiseTimer = 0;
	}

	// Sabotage: hold the button within reach of a target
	const near = targetInReach(state);
	if (input.hold && near >= 0) {
		state.working = near;
		const target = state.targets[near];
		target.progress = Math.min(1, target.progress + dt / SABOTAGE_SECONDS);
		if (target.progress >= 1) {
			target.done = true;
			state.working = -1;
			events.push({ type: 'target-done', x: target.x, y: target.y, remaining: targetsLeft(state) });
			if (targetsLeft(state) === 0) {
				state.exitOpen = true;
				events.push({ type: 'exit-open' });
			}
		}
	} else if (state.working >= 0) {
		state.targets[state.working].progress = 0;
		state.working = -1;
		events.push({ type: 'sabotage-cancel' });
	}

	// The phone rings down
	if (state.phone) {
		state.phone.ttl -= dt;
		if (state.phone.ttl <= 0) state.phone = null;
	}

	// Watchers
	updateSensors(state);
	let total = 0;
	for (const sensor of state.sensors) {
		const rate = sensor.active
			? exposure(state, {
					x: sensor.x,
					y: sensor.y,
					facing: sensor.angle,
					range: sensor.range,
					halfFov: sensor.halfFov,
					lit: sensor.kind === 'floodlight'
				})
			: 0;
		sensor.seeing = rate > 0;
		const heatTarget = rate > 0 ? Math.max(0.3, state.suspicion) : 0;
		sensor.heat +=
			(heatTarget - sensor.heat) * Math.min(1, (heatTarget > sensor.heat ? 6 : 2.5) * dt);
		total += rate;
	}
	for (const guard of state.guards) {
		const rate = exposure(state, guard);
		total += rate;
		updateGuard(state, guard, rate, dt, events);
	}

	if (total > 0) {
		state.suspicion = Math.min(1, state.suspicion + total * dt);
		state.unseenFor = 0;
	} else {
		state.unseenFor += dt;
		if (state.unseenFor > SUSPICION_DECAY_DELAY) {
			state.suspicion = Math.max(0, state.suspicion - SUSPICION_DECAY * dt);
		}
	}
	state.peakSuspicion = Math.max(state.peakSuspicion, state.suspicion);

	if (state.suspicion >= 1) {
		state.phase = 'busted';
		if (state.working >= 0) state.targets[state.working].progress = 0;
		state.working = -1;
		events.push({ type: 'busted' });
		return events;
	}

	// Out through the exit
	if (
		state.exitOpen &&
		Math.floor(player.x) === Math.floor(level.exit.x) &&
		Math.floor(player.y) === Math.floor(level.exit.y)
	) {
		state.phase = 'cleared';
		events.push({ type: 'cleared' });
	}
	return events;
}

export interface JobResult {
	stars: Stars;
	count: number;
	payout: number;
	seconds: number;
}

export function jobResult(state: SabotageState): JobResult {
	const stars = earnedStars({
		peakSuspicion: state.peakSuspicion,
		seconds: state.time,
		par: state.level.par,
		noiseAlarms: state.noiseAlarms
	});
	const count = starCount(stars);
	return { stars, count, payout: payoutFor(count), seconds: state.time };
}

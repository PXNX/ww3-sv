/*
 * GPS Liar rules as plain data and pure functions: createGame builds a run of one level, step
 * advances it by a fixed time step and returns the events that happened (for sounds and popups),
 * setSteer and crossCheck are the inputs. The boat is where it really is (pos); the chart only
 * ever shows the lie (claimedPosition) except for the few seconds of a cross-check.
 */
import {
	ANCHOR_RADIUS,
	BOAT_ACCEL,
	BOAT_DRAG,
	BOAT_MAX_SPEED,
	BOAT_RADIUS,
	BUMP_SPEED,
	CROSS_CHECK_S,
	INVULNERABLE_S,
	PORT_RADIUS,
	POINTS_NO_CROSS_CHECK,
	POINTS_PER_HEART,
	POINTS_PER_SECOND_UNDER_PAR,
	POINTS_PER_STOP,
	SHALLOWS_SPEED_FACTOR,
	STARTING_HEARTS,
	TANKER_RADIUS
} from './config.js';
import { LIGHTHOUSE_RADIUS, seaBounds, type Cargo, type Circle, type Level } from './level.js';
import { createLie, falsePosition, stepLie, type Lie, type Vec } from './lie.js';
import { tankerPose } from './tanker.js';

export type Phase = 'play' | 'won' | 'over';
export type HitCause = 'rock' | 'lighthouse' | 'tanker' | 'anchor';

export interface GameState {
	level: Level;
	lie: Lie;
	phase: Phase;
	/** Seconds since the level began */
	time: number;
	/** The true position of the boat, in sea units */
	pos: Vec;
	vel: Vec;
	/** Direction the bow points in, radians (0 is east, so -PI/2 is north); kept while the boat is still */
	facing: number;
	/** Steering input, each axis from -1 to 1 and no longer than 1 overall */
	steer: Vec;
	hearts: number;
	/** Seconds of grace left after a hit */
	invulnerable: number;
	/** Submarine is on attack: it will reach the tanker within ATTACK_TIME seconds unless diverted */
	subAttack: boolean;
	subTimer: number;     // seconds until submarine attacks if not diverted
	subDiverted: boolean;
	/** Harbours unloaded so far; the next one to visit is level.stops[delivered] */
	delivered: number;
	crossChecksLeft: number;
	crossChecksUsed: number;
	/** Seconds the chart still shows the true position */
	reveal: number;
	/** Whether the keel is dragging through shallows right now */
	inShallows: boolean;
	score: number;
	/** Stars of the finished level, 0 until it is won */
	stars: number;
}

export type GpsLiarEvent =
	| { type: 'hit'; cause: HitCause; x: number; y: number }
	| { type: 'bump'; x: number; y: number }
	| { type: 'deliver'; cargo: Cargo; index: number; points: number; x: number; y: number }
	| { type: 'cross-check' }
	| { type: 'cross-check-empty' }
	| { type: 'lie-jump' }
	| { type: 'win'; stars: number }
	| { type: 'game-over' };

export function createGame(level: Level): GameState {
	return {
		level,
		lie: createLie(level.lie, { x: level.width / 2, y: level.height / 2 }, level.lieSeed),
		phase: 'play',
		time: 0,
		pos: { ...level.start },
		vel: { x: 0, y: 0 },
		facing: -Math.PI / 2,
		steer: { x: 0, y: 0 },
		hearts: STARTING_HEARTS,
		invulnerable: 0,
		subAttack: false,
		subTimer: 0,
		subDiverted: false,
		delivered: 0,
		crossChecksLeft: level.crossChecks,
		crossChecksUsed: 0,
		reveal: 0,
		inShallows: false,
		score: 0,
		stars: 0
	};
}

/** The one steering input; the vector is cut down to length 1 so diagonals are not faster */
export function setSteer(state: GameState, x: number, y: number) {
	const length = Math.hypot(x, y);
	const scale = length > 1 ? 1 / length : 1;
	state.steer = { x: x * scale, y: y * scale };
}

/** Uses up one cross-check: the chart shows the true position for a few seconds */
export function crossCheck(state: GameState): GpsLiarEvent[] {
	if (state.phase !== 'play' || state.reveal > 0) return [];
	if (state.crossChecksLeft <= 0) return [{ type: 'cross-check-empty' }];
	state.crossChecksLeft -= 1;
	state.crossChecksUsed += 1;
	state.reveal = CROSS_CHECK_S;
	return [{ type: 'cross-check' }];
}

/** Where the GPS says the boat is */
export function claimedPosition(state: GameState): Vec {
	return falsePosition(state.lie, state.pos);
}

/** The harbour to deliver to next, or null when everything is unloaded */
export function nextStop(state: GameState) {
	return state.level.stops[state.delivered] ?? null;
}

/** Heading of the boat in degrees clockwise from north (0 to 359), or null when it is not moving */
export function heading(state: GameState): number | null {
	if (Math.hypot(state.vel.x, state.vel.y) < 0.05) return null;
	const degrees = (Math.atan2(state.vel.x, -state.vel.y) * 180) / Math.PI;
	return Math.round((degrees + 360) % 360) % 360;
}

/** Everything solid at a time: the boat bounces off these (the tanker moves, so it depends on time) */
export function solids(level: Level, time: number): (Circle & { cause: HitCause })[] {
	const list: (Circle & { cause: HitCause })[] = [
		...level.rocks.map((rock) => ({ ...rock, cause: 'rock' as const })),
		...level.lighthouses.map((lighthouse) => ({
			x: lighthouse.x,
			y: lighthouse.y,
			r: LIGHTHOUSE_RADIUS,
			cause: 'lighthouse' as const
		}))
	];
	if (level.tanker) {
		const pose = tankerPose(level.tanker, time);
		list.push({ ...pose.hull, r: TANKER_RADIUS, cause: 'tanker' });
		list.push({ ...pose.anchor, r: ANCHOR_RADIUS, cause: 'anchor' });
	}
	return list;
}

/** Stars: one for delivering everything, one for beating the par time, one for no cross-checks */
export function starsFor(state: GameState): number {
	return 1 + (state.time <= state.level.par ? 1 : 0) + (state.crossChecksUsed === 0 ? 1 : 0);
}

function inShallows(level: Level, pos: Vec): boolean {
	return level.shallows.some(
		(shallow) => Math.hypot(pos.x - shallow.x, pos.y - shallow.y) < shallow.r
	);
}

/** Accelerates toward the steered velocity, or glides to a stop when there is no steering */
function sail(state: GameState, dt: number) {
	const top = BOAT_MAX_SPEED * (state.inShallows ? SHALLOWS_SPEED_FACTOR : 1);
	const { steer, vel } = state;
	if (Math.hypot(steer.x, steer.y) > 0.01) {
		const wantX = steer.x * top;
		const wantY = steer.y * top;
		const dx = wantX - vel.x;
		const dy = wantY - vel.y;
		const gap = Math.hypot(dx, dy);
		const push = Math.min(gap, BOAT_ACCEL * dt);
		if (gap > 0) {
			vel.x += (dx / gap) * push;
			vel.y += (dy / gap) * push;
		}
	} else {
		const keep = Math.max(0, 1 - BOAT_DRAG * dt);
		vel.x *= keep;
		vel.y *= keep;
	}
	// Shallows slow a boat that is already going fast, too
	const speed = Math.hypot(vel.x, vel.y);
	if (speed > top) {
		const slow = Math.max(top / speed, 1 - BOAT_DRAG * 2 * dt);
		vel.x *= slow;
		vel.y *= slow;
	}
}

/** Keeps the boat inside the sea and off the coast; it stops dead against the edge */
function stayAfloat(state: GameState) {
	const bounds = seaBounds(state.level, BOAT_RADIUS);
	const { pos, vel } = state;
	if (pos.x < bounds.minX) [pos.x, vel.x] = [bounds.minX, Math.max(0, vel.x)];
	if (pos.x > bounds.maxX) [pos.x, vel.x] = [bounds.maxX, Math.min(0, vel.x)];
	if (pos.y < bounds.minY) [pos.y, vel.y] = [bounds.minY, Math.max(0, vel.y)];
	if (pos.y > bounds.maxY) [pos.y, vel.y] = [bounds.maxY, Math.min(0, vel.y)];
}

/** Shoves the boat out of whatever it overlaps; the first overlap costs a heart unless grace is left */
function collide(state: GameState, events: GpsLiarEvent[]) {
	for (const solid of solids(state.level, state.time)) {
		const dx = state.pos.x - solid.x;
		const dy = state.pos.y - solid.y;
		const reach = solid.r + BOAT_RADIUS;
		const distance = Math.hypot(dx, dy);
		if (distance >= reach) continue;
		// Dead centre is impossible in practice, but a direction is still needed
		const nx = distance > 0 ? dx / distance : 0;
		const ny = distance > 0 ? dy / distance : -1;
		state.pos.x = solid.x + nx * reach;
		state.pos.y = solid.y + ny * reach;
		state.vel = { x: nx * BUMP_SPEED, y: ny * BUMP_SPEED };
		if (state.invulnerable > 0) {
			events.push({ type: 'bump', x: state.pos.x, y: state.pos.y });
			continue;
		}
		state.hearts -= 1;
		state.invulnerable = INVULNERABLE_S;
		events.push({ type: 'hit', cause: solid.cause, x: state.pos.x, y: state.pos.y });
		if (state.hearts <= 0) {
			state.phase = 'over';
			state.vel = { x: 0, y: 0 };
			events.push({ type: 'game-over' });
			return;
		}
	}
}

function deliver(state: GameState, events: GpsLiarEvent[]) {
	const stop = nextStop(state);
	if (!stop || Math.hypot(state.pos.x - stop.x, state.pos.y - stop.y) > PORT_RADIUS) return;
	state.delivered += 1;
	state.score += POINTS_PER_STOP;
	events.push({
		type: 'deliver',
		cargo: stop.cargo,
		index: state.delivered,
		points: POINTS_PER_STOP,
		x: stop.x,
		y: stop.y
	});
	if (state.delivered < state.level.stops.length) return;
	// The last harbour: time under par, hearts and a clean no-cross-check record all pay out
	const underPar = Math.max(0, Math.floor(state.level.par - state.time));
	state.score += underPar * POINTS_PER_SECOND_UNDER_PAR + state.hearts * POINTS_PER_HEART;
	if (state.crossChecksUsed === 0) state.score += POINTS_NO_CROSS_CHECK;
	state.stars = starsFor(state);
	state.phase = 'won';
	state.vel = { x: 0, y: 0 };
	events.push({ type: 'win', stars: state.stars });
}

export function step(state: GameState, dt: number): GpsLiarEvent[] {
	const events: GpsLiarEvent[] = [];
	if (state.phase !== 'play') return events;
	state.time += dt;
	state.invulnerable = Math.max(0, state.invulnerable - dt);
	state.reveal = Math.max(0, state.reveal - dt);
	if (stepLie(state.lie, dt)) events.push({ type: 'lie-jump' });

	state.inShallows = inShallows(state.level, state.pos);
	sail(state, dt);
	if (Math.hypot(state.vel.x, state.vel.y) > 0.15)
		state.facing = Math.atan2(state.vel.y, state.vel.x);
	state.pos.x += state.vel.x * dt;
	state.pos.y += state.vel.y * dt;
	stayAfloat(state);
	collide(state, events);
	stayAfloat(state);
	if (state.phase === 'play') deliver(state, events);
	return events;
}

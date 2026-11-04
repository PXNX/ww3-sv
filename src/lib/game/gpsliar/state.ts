/*
 * GPS Liar rules as plain data and pure functions: createGame builds a run of one level, step
 * advances it by a fixed time step and returns the events that happened (for sounds and popups),
 * setSteer, crossCheck and toggleSpoof are the inputs. The boat is where it really is (pos); the
 * chart only ever shows the lie (claimedPosition) except for the few seconds of a cross-check.
 *
 * Around the boat there is pressure: a tank that runs dry, coast guard patrols whose radar locks on
 * unless the spoofer hides the boat (which makes the chart worse and the helm wander), sanction
 * checks that only a spoofing boat passes, and storms that shove the boat about and thicken the fog.
 */
import {
	ANCHOR_RADIUS,
	BOAT_ACCEL,
	BOAT_DRAG,
	BOAT_MAX_SPEED,
	BOAT_RADIUS,
	BUMP_SPEED,
	CROSS_CHECK_S,
	EMPTY_TANK_SPEED_FACTOR,
	FINE_COOLDOWN_S,
	FUEL_LOW,
	HORN_EVERY_S,
	INVULNERABLE_S,
	PATROL_FORGET_RATE,
	PATROL_LOCK_RATE,
	PORT_RADIUS,
	POINTS_FINE,
	POINTS_NO_CROSS_CHECK,
	POINTS_PER_FUEL,
	POINTS_PER_HEART,
	POINTS_PER_SECOND_UNDER_PAR,
	POINTS_PER_STOP,
	POINTS_SANCTION_PASS,
	REFUEL_AMOUNT,
	SANCTION_WARN_S,
	SHALLOWS_FUEL_FACTOR,
	SHALLOWS_SPEED_FACTOR,
	SIDE_THRUST,
	SPOOF_BLEND_RATE,
	SPOOF_CHART_ERROR,
	SPOOF_DRAIN,
	SPOOF_HELM_DRIFT,
	SPOOF_MIN_ENERGY,
	SPOOF_REGEN,
	STARTING_HEARTS,
	TANKER_RADIUS,
	TURN_RATE
} from './config.js';
import {
	LIGHTHOUSE_RADIUS,
	landVector,
	seaBounds,
	type Cargo,
	type Circle,
	type Level
} from './level.js';
import { createLie, falsePosition, stepLie, type Lie, type Vec } from './lie.js';
import { inBeam } from './patrol.js';
import { tankerPose } from './tanker.js';
import { seaDrift, stormAt, stormSoon } from './weather.js';

/** Seconds of notice before a storm */
const STORM_NOTICE_S = 5;

export type Phase = 'play' | 'won' | 'over';
export type HitCause = 'rock' | 'lighthouse' | 'tanker' | 'anchor';

/** The points of a won level, line by line, so the result can show where the score came from */
export interface Breakdown {
	stops: number;
	time: number;
	hearts: number;
	clean: number;
	fuel: number;
	sanctions: number;
	/** Zero or negative */
	fines: number;
}

export interface GameState {
	level: Level;
	lie: Lie;
	phase: Phase;
	/** Seconds since the level began */
	time: number;
	/** The true position of the boat, in sea units */
	pos: Vec;
	vel: Vec;
	/** Direction the bow points in, radians (0 is east, so -PI/2 is north); it swings round at a limited rate */
	facing: number;
	/** Steering input, each axis from -1 to 1 and no longer than 1 overall */
	steer: Vec;
	hearts: number;
	/** Seconds of grace left after a hit */
	invulnerable: number;
	/** Submarine is on attack: it will reach the tanker within ATTACK_TIME seconds unless diverted */
	subAttack: boolean;
	subTimer: number; // seconds until submarine attacks if not diverted
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
	/** Fuel in the tank, 1 down to 0; stays full on a level without a fuel range */
	fuel: number;
	fuelLowWarned: boolean;
	fuelEmptyWarned: boolean;
	/** The spoofer: whether it is on, its energy, and how far its effect has faded in (0 to 1) */
	spoof: boolean;
	spoofEnergy: number;
	spoofBlend: number;
	/** The angle the scrambled autopilot pulls the helm off by while spoofing, radians */
	helmDrift: number;
	/** Per patrol: how far it has locked on (0 to 1) and whether its beam is on the boat right now */
	locks: number[];
	beamOn: boolean[];
	/** The highest lock of any patrol, for the gauge */
	alert: number;
	/** Seconds in which the patrols look away after a fine */
	fineCooldown: number;
	fines: number;
	/** Seconds until the next sanction check, and whether its warning went out */
	sanctionIn: number;
	sanctionWarned: boolean;
	sanctionsPassed: number;
	/** Storm strength right now (0 to 1), how many storms were announced and whether one is raging */
	storm: number;
	stormsWarned: number;
	stormActive: boolean;
	/** What the sea pushes the boat with right now (current and wind), units per second */
	drift: Vec;
	/** Seconds until the next foghorn */
	hornIn: number;
	/** Points paid out or docked on the way, for the result */
	sanctionPoints: number;
	finePoints: number;
	/** The points of the won level, line by line; null until it is won */
	breakdown: Breakdown | null;
}

export type GpsLiarEvent =
	| { type: 'hit'; cause: HitCause; x: number; y: number }
	| { type: 'bump'; x: number; y: number }
	| { type: 'deliver'; cargo: Cargo; index: number; points: number; x: number; y: number }
	| { type: 'cross-check' }
	| { type: 'cross-check-empty' }
	| { type: 'lie-jump' }
	| { type: 'spoof-on' }
	| { type: 'spoof-off'; empty: boolean }
	| { type: 'spoof-empty' }
	| { type: 'spotted'; patrol: number }
	| { type: 'fined'; cause: 'patrol' | 'sanction'; points: number; x: number; y: number }
	| { type: 'sanction-warning' }
	| { type: 'sanction-pass'; points: number }
	| { type: 'storm-warning' }
	| { type: 'storm-start' }
	| { type: 'storm-end' }
	| { type: 'fuel-low' }
	| { type: 'fuel-empty' }
	| { type: 'refuel'; x: number; y: number }
	| { type: 'horn'; pan: number }
	| { type: 'win'; stars: number }
	| { type: 'game-over' };

export function createGame(level: Level): GameState {
	const patrols = level.patrols ?? [];
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
		stars: 0,
		fuel: 1,
		fuelLowWarned: false,
		fuelEmptyWarned: false,
		spoof: false,
		spoofEnergy: 1,
		spoofBlend: 0,
		helmDrift: 0,
		locks: patrols.map(() => 0),
		beamOn: patrols.map(() => false),
		alert: 0,
		fineCooldown: 0,
		fines: 0,
		sanctionIn: level.sanctionEvery ?? 0,
		sanctionWarned: false,
		sanctionsPassed: 0,
		storm: 0,
		stormsWarned: 0,
		stormActive: false,
		drift: { x: 0, y: 0 },
		hornIn: 5,
		sanctionPoints: 0,
		finePoints: 0,
		breakdown: null
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

/** Switches the spoofer on or off: it hides the boat from radar and sanction checks, at a price */
export function toggleSpoof(state: GameState): GpsLiarEvent[] {
	if (state.phase !== 'play') return [];
	if (state.spoof) {
		state.spoof = false;
		return [{ type: 'spoof-off', empty: false }];
	}
	if (state.spoofEnergy < SPOOF_MIN_ENERGY) return [{ type: 'spoof-empty' }];
	state.spoof = true;
	return [{ type: 'spoof-on' }];
}

/** Where the GPS says the boat is; the spoofer makes the chart worse while it runs */
export function claimedPosition(state: GameState): Vec {
	const base = falsePosition(state.lie, state.pos);
	if (state.spoofBlend <= 0) return base;
	const push = SPOOF_CHART_ERROR * state.spoofBlend;
	return {
		x: base.x + Math.cos(state.lie.angle + 1.3) * push,
		y: base.y + Math.sin(state.lie.angle + 1.3) * push
	};
}

/** Whether the boat is hidden from radar and inspectors right now */
export function isHidden(state: GameState): boolean {
	return state.spoofBlend >= 0.6;
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

/** The signed shortest turn from one direction to another, -PI to PI */
function turnBetween(from: number, to: number): number {
	return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Turns the bow toward a direction, at most TURN_RATE per second: the turning radius of the boat */
function swing(state: GameState, toward: number, dt: number) {
	const diff = turnBetween(state.facing, toward);
	state.facing += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
}

/**
 * Accelerates toward the steered velocity, or glides to a stop when there is no steering. The bow
 * swings round at a fixed rate and the engine only really bites along the bow, so a hard turn
 * costs speed and a boat does not turn on a coin. The helm is scrambled while spoofing.
 */
function sail(state: GameState, dt: number) {
	const outOfFuel = state.fuel <= 0 && (state.level.fuelRange ?? 0) > 0;
	const top =
		BOAT_MAX_SPEED *
		(state.inShallows ? SHALLOWS_SPEED_FACTOR : 1) *
		(outOfFuel ? EMPTY_TANK_SPEED_FACTOR : 1);
	const cos = Math.cos(state.helmDrift);
	const sin = Math.sin(state.helmDrift);
	const steer = {
		x: state.steer.x * cos - state.steer.y * sin,
		y: state.steer.x * sin + state.steer.y * cos
	};
	const { vel } = state;
	if (Math.hypot(steer.x, steer.y) > 0.01) {
		const want = Math.atan2(steer.y, steer.x);
		swing(state, want, dt);
		const alignment = Math.max(0, Math.cos(turnBetween(state.facing, want)));
		const thrust = BOAT_ACCEL * (SIDE_THRUST + (1 - SIDE_THRUST) * alignment);
		const dx = steer.x * top - vel.x;
		const dy = steer.y * top - vel.y;
		const gap = Math.hypot(dx, dy);
		const push = Math.min(gap, thrust * dt);
		if (gap > 1e-6) {
			vel.x += (dx / gap) * push;
			vel.y += (dy / gap) * push;
		}
	} else {
		const keep = Math.max(0, 1 - BOAT_DRAG * dt);
		vel.x *= keep;
		vel.y *= keep;
		// With no steering the bow slowly lines up with the way the boat is still gliding
		if (Math.hypot(vel.x, vel.y) > 0.15) swing(state, Math.atan2(vel.y, vel.x), dt);
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
	if ((state.level.fuelRange ?? 0) > 0 && state.fuel < 1) {
		state.fuel = Math.min(1, state.fuel + REFUEL_AMOUNT);
		state.fuelLowWarned = state.fuel < FUEL_LOW;
		state.fuelEmptyWarned = state.fuel <= 0;
		events.push({ type: 'refuel', x: stop.x, y: stop.y });
	}
	events.push({
		type: 'deliver',
		cargo: stop.cargo,
		index: state.delivered,
		points: POINTS_PER_STOP,
		x: stop.x,
		y: stop.y
	});
	if (state.delivered < state.level.stops.length) return;
	// The last harbour: time under par, hearts, fuel and a clean no-cross-check record all pay out
	const underPar = Math.max(0, Math.floor(state.level.par - state.time));
	const time = underPar * POINTS_PER_SECOND_UNDER_PAR;
	const hearts = state.hearts * POINTS_PER_HEART;
	const clean = state.crossChecksUsed === 0 ? POINTS_NO_CROSS_CHECK : 0;
	const fuel = (state.level.fuelRange ?? 0) > 0 ? Math.round(state.fuel * POINTS_PER_FUEL) : 0;
	state.score += time + hearts + clean + fuel;
	state.breakdown = {
		stops: state.delivered * POINTS_PER_STOP,
		time,
		hearts,
		clean,
		fuel,
		sanctions: state.sanctionPoints,
		fines: -state.finePoints
	};
	state.stars = starsFor(state);
	state.phase = 'won';
	state.vel = { x: 0, y: 0 };
	events.push({ type: 'win', stars: state.stars });
}

/** Docks points for a fine (never below zero) and starts the cool-down in which patrols look away */
function fine(state: GameState, cause: 'patrol' | 'sanction', events: GpsLiarEvent[]) {
	const paid = Math.min(state.score, POINTS_FINE);
	state.score -= paid;
	state.finePoints += paid;
	state.fines += 1;
	state.fineCooldown = FINE_COOLDOWN_S;
	state.locks = state.locks.map(() => 0);
	state.alert = 0;
	events.push({ type: 'fined', cause, points: POINTS_FINE, x: state.pos.x, y: state.pos.y });
}

/** The spoofer's energy and how far its effect has faded in */
function stepSpoof(state: GameState, dt: number, events: GpsLiarEvent[]) {
	if (state.spoof) {
		state.spoofEnergy = Math.max(0, state.spoofEnergy - SPOOF_DRAIN * dt);
		if (state.spoofEnergy <= 0) {
			state.spoof = false;
			events.push({ type: 'spoof-off', empty: true });
		}
	} else {
		state.spoofEnergy = Math.min(1, state.spoofEnergy + SPOOF_REGEN * dt);
	}
	const fade = SPOOF_BLEND_RATE * dt;
	state.spoofBlend = state.spoof
		? Math.min(1, state.spoofBlend + fade)
		: Math.max(0, state.spoofBlend - fade);
	// The scrambled autopilot wanders: that is the real drift the fake position costs
	state.helmDrift =
		(Math.sin(state.time * 0.8) * 0.8 + Math.sin(state.time * 2.3) * 0.2) *
		SPOOF_HELM_DRIFT *
		state.spoofBlend;
}

/** Radar beams, lock-on and fines, then the sanction checks */
function stepOfficials(state: GameState, dt: number, events: GpsLiarEvent[]) {
	const patrols = state.level.patrols ?? [];
	state.fineCooldown = Math.max(0, state.fineCooldown - dt);
	const hidden = isHidden(state);
	let caught = false;
	patrols.forEach((route, index) => {
		const sees = !hidden && state.fineCooldown <= 0 && inBeam(route, state.time, state.pos);
		if (sees && !state.beamOn[index]) events.push({ type: 'spotted', patrol: index });
		state.beamOn[index] = sees;
		const lock = state.locks[index] + (sees ? PATROL_LOCK_RATE : -PATROL_FORGET_RATE) * dt;
		state.locks[index] = Math.min(1, Math.max(0, lock));
		if (state.locks[index] >= 1) caught = true;
	});
	state.alert = Math.max(0, ...state.locks);
	if (caught) fine(state, 'patrol', events);

	const every = state.level.sanctionEvery ?? 0;
	if (every <= 0) return;
	state.sanctionIn -= dt;
	if (!state.sanctionWarned && state.sanctionIn <= SANCTION_WARN_S) {
		state.sanctionWarned = true;
		events.push({ type: 'sanction-warning' });
	}
	if (state.sanctionIn > 0) return;
	state.sanctionIn += every;
	state.sanctionWarned = false;
	if (hidden) {
		state.sanctionsPassed += 1;
		state.score += POINTS_SANCTION_PASS;
		state.sanctionPoints += POINTS_SANCTION_PASS;
		events.push({ type: 'sanction-pass', points: POINTS_SANCTION_PASS });
	} else {
		fine(state, 'sanction', events);
	}
}

/** Storms, the foghorn and the push of the sea */
function stepSea(state: GameState, dt: number, events: GpsLiarEvent[]) {
	const storms = state.level.storms ?? [];
	state.storm = stormAt(storms, state.time);
	const soon = stormSoon(storms, state.time, STORM_NOTICE_S);
	if (soon && storms.indexOf(soon) >= state.stormsWarned) {
		state.stormsWarned = storms.indexOf(soon) + 1;
		events.push({ type: 'storm-warning' });
	}
	if (!state.stormActive && state.storm > 0.5) {
		state.stormActive = true;
		events.push({ type: 'storm-start' });
	} else if (state.stormActive && state.storm < 0.2) {
		state.stormActive = false;
		events.push({ type: 'storm-end' });
	}
	state.hornIn -= dt;
	if (state.hornIn <= 0) {
		state.hornIn += HORN_EVERY_S;
		events.push({ type: 'horn', pan: landVector(state.level.land).x * 0.7 });
	}
	state.drift = seaDrift(state.level, state.time);
}

/** Burns fuel for the distance sailed and warns when the tank runs low or dry */
function burnFuel(state: GameState, distance: number, events: GpsLiarEvent[]) {
	const range = state.level.fuelRange ?? 0;
	if (range <= 0) return;
	state.fuel = Math.max(
		0,
		state.fuel - (distance / range) * (state.inShallows ? SHALLOWS_FUEL_FACTOR : 1)
	);
	if (state.fuel <= 0 && !state.fuelEmptyWarned) {
		state.fuelEmptyWarned = true;
		events.push({ type: 'fuel-empty' });
	} else if (state.fuel > 0 && state.fuel < FUEL_LOW && !state.fuelLowWarned) {
		state.fuelLowWarned = true;
		events.push({ type: 'fuel-low' });
	}
}

export function step(state: GameState, dt: number): GpsLiarEvent[] {
	const events: GpsLiarEvent[] = [];
	if (state.phase !== 'play') return events;
	state.time += dt;
	state.invulnerable = Math.max(0, state.invulnerable - dt);
	state.reveal = Math.max(0, state.reveal - dt);
	if (stepLie(state.lie, dt)) events.push({ type: 'lie-jump' });
	stepSpoof(state, dt, events);
	stepSea(state, dt, events);

	state.inShallows = inShallows(state.level, state.pos);
	sail(state, dt);
	burnFuel(state, Math.hypot(state.vel.x, state.vel.y) * dt, events);
	state.pos.x += (state.vel.x + state.drift.x) * dt;
	state.pos.y += (state.vel.y + state.drift.y) * dt;
	stayAfloat(state);
	collide(state, events);
	stayAfloat(state);
	if (state.phase === 'play') deliver(state, events);
	if (state.phase === 'play') stepOfficials(state, dt, events);
	return events;
}

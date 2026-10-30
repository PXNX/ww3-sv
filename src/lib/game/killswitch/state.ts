/*
 * Starlink Kill Switch rules, pure and seeded so they can be tested without a browser.
 * You are Elon at the big red console. Drones fly in from the left towards the refinery on the
 * right, and every one carries a Starlink link: tap a drone to cut it and it tumbles into the lake.
 * Delivery vans, tractors, buses and fishing boats carry links too: cutting one costs a heart.
 * A streak of clean cuts raises the multiplier, cuts charge the geofence (drag a line, every drone
 * that crosses it is cut), and Elon's own posts shake things up: purge, rush and boost.
 * Endless: the stream only gets thicker and faster until three hearts are gone.
 */
import { pickOne, type Random } from '#lib/game/random.js';

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 420;
export const STARTING_LIVES = 3;

/** A drone that flies past this x hits the refinery */
export const REFINERY_X = 548;
export const SKY_TOP = 54;
export const SKY_BOTTOM = 240;
export const ROAD_Y = 316;
export const LAKE_Y = 352;
export const BOAT_Y = 394;

/** Cuts that fill the geofence */
export const FENCE_CHARGE = 6;
export const FENCE_MS = 6000;
export const FENCE_MIN_LENGTH = 70;

/** How long a civilian link stays offline after a purge before the vehicle crashes */
export const OFFLINE_MS = 2600;
export const STALLED_MS = 1300;
export const FIRST_POST_MS = 12000;
export const RUSH_MS = 7000;
export const BOOST_MS = 8000;

export const POINTS_CUT = 10;
export const POINTS_RESTORE = 30;
/** What a drone is worth when a purge cuts it for you */
export const POINTS_FREE = 5;
export const MAX_MULTIPLIER = 5;

const GRAVITY = 520;
const DRONE_RADIUS = 30;
const CIVILIAN_RADIUS = 38;

export type DroneKind = 'drone' | 'fast';
export type CivilianKind = 'van' | 'tractor' | 'bus' | 'boat';
export type TargetKind = DroneKind | CivilianKind;
export type PostKind = 'purge' | 'rush' | 'boost';
export type TargetState = 'flying' | 'falling' | 'offline' | 'stalled';

export const CIVILIAN_KINDS: readonly CivilianKind[] = ['van', 'tractor', 'bus', 'boat'];
const POST_KINDS: readonly PostKind[] = ['purge', 'rush', 'boost'];

/** Units per second at the start; boats are the slowest */
const CIVILIAN_SPEED: Record<CivilianKind, number> = { van: 70, tractor: 42, bus: 56, boat: 36 };

export interface Target {
	id: number;
	civilian: boolean;
	kind: TargetKind;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	/** Units per second */
	vx: number;
	vy: number;
	state: TargetState;
	/** Time spent in the current state */
	stateMs: number;
	/** Tumble angle of a falling drone */
	spin: number;
}

export interface Fence {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	leftMs: number;
}

export interface KillState {
	timeMs: number;
	targets: Target[];
	score: number;
	lives: number;
	streak: number;
	bestStreak: number;
	cuts: number;
	/** Cuts that went wrong: civilians cut or crashed */
	blunders: number;
	/** Fence charge, 0 to FENCE_CHARGE */
	charge: number;
	fence: Fence | null;
	spawnMs: number;
	postMs: number;
	rushMs: number;
	boostMs: number;
	nextId: number;
	/** A purge costs at most one heart, however many vehicles it cuts off */
	purgeHeartLost: boolean;
	over: boolean;
}

export type KillEvent =
	| { type: 'cut'; x: number; y: number; points: number; multiplier: number; fenced: boolean }
	| { type: 'splash'; x: number }
	| { type: 'refinery-hit'; x: number; y: number }
	| { type: 'civilian-cut'; kind: CivilianKind; x: number; y: number }
	| { type: 'civilian-crash'; kind: CivilianKind; x: number; y: number }
	| { type: 'restored'; x: number; y: number; points: number }
	| { type: 'miss'; x: number; y: number }
	| { type: 'post'; kind: PostKind }
	| { type: 'fence-ready' }
	| { type: 'fence-placed' }
	| { type: 'fence-expired' }
	| { type: 'game-over' };

export function createGame(): KillState {
	return {
		timeMs: 0,
		targets: [],
		score: 0,
		lives: STARTING_LIVES,
		streak: 0,
		bestStreak: 0,
		cuts: 0,
		blunders: 0,
		charge: 0,
		fence: null,
		spawnMs: 900,
		postMs: FIRST_POST_MS,
		rushMs: 0,
		boostMs: 0,
		nextId: 1,
		purgeHeartLost: false,
		over: false
	};
}

/** 1 for a fresh streak, one more for every five clean cuts, up to MAX_MULTIPLIER */
export function multiplier(streak: number): number {
	return Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, streak) / 5));
}

/** Milliseconds between spawns: starts relaxed, tightens as the run goes on */
export function spawnInterval(timeMs: number): number {
	return Math.max(520, 1500 - (timeMs / 1000) * 9);
}

export function droneSpeed(timeMs: number, kind: DroneKind): number {
	const base = 80 + Math.min(60, (timeMs / 1000) * 0.8);
	return kind === 'fast' ? base * 1.55 : base;
}

function newTarget(
	state: KillState,
	init: Omit<Target, 'id' | 'prevX' | 'prevY' | 'stateMs' | 'spin' | 'state'>
): Target {
	const target: Target = {
		...init,
		id: state.nextId++,
		prevX: init.x,
		prevY: init.y,
		state: 'flying',
		stateMs: 0,
		spin: 0
	};
	state.targets.push(target);
	return target;
}

function spawnTarget(state: KillState, random: Random) {
	const seconds = state.timeMs / 1000;
	const civilianChance = state.rushMs > 0 ? 0.7 : seconds < 6 ? 0 : 0.2;
	if (random() < civilianChance) {
		const kind = pickOne(random, CIVILIAN_KINDS);
		const fromLeft = random() < 0.5;
		const speed = CIVILIAN_SPEED[kind] * (0.9 + random() * 0.2);
		const y = kind === 'boat' ? BOAT_Y : ROAD_Y + (random() < 0.5 ? 0 : 18);
		newTarget(state, {
			civilian: true,
			kind,
			x: fromLeft ? -40 : WORLD_WIDTH + 40,
			y,
			vx: fromLeft ? speed : -speed,
			vy: 0
		});
		return;
	}
	const kind: DroneKind = seconds > 25 && random() < 0.3 ? 'fast' : 'drone';
	const x = -30;
	const y = SKY_TOP + random() * (SKY_BOTTOM - SKY_TOP);
	const aimY = 150 + random() * 150;
	const vx = droneSpeed(state.timeMs, kind);
	newTarget(state, { civilian: false, kind, x, y, vx, vy: ((aimY - y) / (REFINERY_X - x)) * vx });
}

function loseHeart(state: KillState, events: KillEvent[]) {
	if (state.over) return;
	state.lives -= 1;
	state.streak = 0;
	state.blunders += 1;
	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

/** Sends a drone into the lake. `free` cuts (a purge) pay little and do not build the streak */
function cutDrone(
	state: KillState,
	target: Target,
	events: KillEvent[],
	how: { fenced?: boolean; free?: boolean } = {}
) {
	target.state = 'falling';
	target.stateMs = 0;
	target.vx *= 0.4;
	target.vy = -90;
	state.cuts += 1;
	let points = POINTS_FREE;
	let mult = 1;
	if (!how.free) {
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		mult = multiplier(state.streak);
		points = POINTS_CUT * mult * (state.boostMs > 0 ? 2 : 1);
		if (state.charge < FENCE_CHARGE) {
			state.charge += 1;
			if (state.charge === FENCE_CHARGE) events.push({ type: 'fence-ready' });
		}
	}
	state.score += points;
	events.push({
		type: 'cut',
		x: target.x,
		y: target.y,
		points,
		multiplier: mult,
		fenced: how.fenced ?? false
	});
}

/** Whether segment a to b crosses segment c to d */
export function segmentsIntersect(
	a: { x: number; y: number },
	b: { x: number; y: number },
	c: { x: number; y: number },
	d: { x: number; y: number }
): boolean {
	const cross = (
		o: { x: number; y: number },
		p: { x: number; y: number },
		q: { x: number; y: number }
	) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

/** The player taps the playfield at world position (x, y) */
export function tap(state: KillState, x: number, y: number): KillEvent[] {
	if (state.over) return [];
	const events: KillEvent[] = [];
	let best: Target | null = null;
	let bestDistance = Infinity;
	for (const target of state.targets) {
		if (target.state !== 'flying' && !(target.civilian && target.state === 'offline')) continue;
		const distance = Math.hypot(target.x - x, target.y - y);
		const radius = target.civilian ? CIVILIAN_RADIUS : DRONE_RADIUS;
		if (distance <= radius && distance < bestDistance) {
			best = target;
			bestDistance = distance;
		}
	}
	if (!best) return [{ type: 'miss', x, y }];

	if (!best.civilian) {
		cutDrone(state, best, events);
	} else if (best.state === 'offline') {
		best.state = 'flying';
		best.stateMs = 0;
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		const points = POINTS_RESTORE * multiplier(state.streak);
		state.score += points;
		events.push({ type: 'restored', x: best.x, y: best.y, points });
	} else {
		best.state = 'stalled';
		best.stateMs = 0;
		best.vx = 0;
		best.vy = 0;
		events.push({ type: 'civilian-cut', kind: best.kind as CivilianKind, x: best.x, y: best.y });
		loseHeart(state, events);
	}
	return events;
}

/** Drops a geofence line; every drone that crosses it while it stands is cut. Empty when refused */
export function placeFence(
	state: KillState,
	x1: number,
	y1: number,
	x2: number,
	y2: number
): KillEvent[] {
	if (state.over || state.fence || state.charge < FENCE_CHARGE) return [];
	if (Math.hypot(x2 - x1, y2 - y1) < FENCE_MIN_LENGTH) return [];
	state.fence = { x1, y1, x2, y2, leftMs: FENCE_MS };
	state.charge = 0;
	return [{ type: 'fence-placed' }];
}

function applyPost(state: KillState, kind: PostKind, events: KillEvent[]) {
	events.push({ type: 'post', kind });
	if (kind === 'rush') state.rushMs = RUSH_MS;
	else if (kind === 'boost') state.boostMs = BOOST_MS;
	else {
		// "Feature, not a bug": every link on screen goes down, the vehicles' ones need turning back on
		state.purgeHeartLost = false;
		for (const target of state.targets) {
			if (target.state !== 'flying') continue;
			if (target.civilian) {
				target.state = 'offline';
				target.stateMs = 0;
			} else {
				cutDrone(state, target, events, { free: true });
			}
		}
	}
}

/** Advances the game by dtMs */
export function step(state: KillState, dtMs: number, random: Random): KillEvent[] {
	if (state.over) return [];
	const events: KillEvent[] = [];
	const dt = dtMs / 1000;
	state.timeMs += dtMs;
	state.rushMs = Math.max(0, state.rushMs - dtMs);
	state.boostMs = Math.max(0, state.boostMs - dtMs);

	if (state.fence) {
		state.fence.leftMs -= dtMs;
		if (state.fence.leftMs <= 0) {
			state.fence = null;
			events.push({ type: 'fence-expired' });
		}
	}

	state.spawnMs -= dtMs;
	if (state.spawnMs <= 0) {
		spawnTarget(state, random);
		state.spawnMs += spawnInterval(state.timeMs) * (0.8 + random() * 0.4);
	}

	state.postMs -= dtMs;
	if (state.postMs <= 0) {
		applyPost(state, pickOne(random, POST_KINDS), events);
		state.postMs = Math.max(9000, 15000 - (state.timeMs / 1000) * 50);
	}

	const gone = new Set<number>();
	for (const target of state.targets) {
		target.prevX = target.x;
		target.prevY = target.y;
		target.stateMs += dtMs;
		switch (target.state) {
			case 'flying':
			case 'offline':
				target.x += target.vx * dt;
				target.y += target.vy * dt;
				break;
			case 'falling':
				target.vy += GRAVITY * dt;
				target.x += target.vx * dt;
				target.y += target.vy * dt;
				target.spin += 6 * dt;
				break;
			case 'stalled':
				break;
		}

		if (target.state === 'falling') {
			if (target.y >= LAKE_Y) {
				events.push({ type: 'splash', x: target.x });
				gone.add(target.id);
			}
		} else if (target.state === 'stalled') {
			if (target.stateMs >= STALLED_MS) gone.add(target.id);
		} else if (target.civilian) {
			if (target.state === 'offline' && target.stateMs >= OFFLINE_MS) {
				events.push({
					type: 'civilian-crash',
					kind: target.kind as CivilianKind,
					x: target.x,
					y: target.y
				});
				if (!state.purgeHeartLost) {
					state.purgeHeartLost = true;
					loseHeart(state, events);
				}
				gone.add(target.id);
			} else if (target.x > WORLD_WIDTH + 60 || target.x < -60) {
				gone.add(target.id);
			}
		} else {
			const fence = state.fence;
			if (
				fence &&
				segmentsIntersect(
					{ x: target.prevX, y: target.prevY },
					{ x: target.x, y: target.y },
					{ x: fence.x1, y: fence.y1 },
					{ x: fence.x2, y: fence.y2 }
				)
			) {
				cutDrone(state, target, events, { fenced: true });
			} else if (target.x >= REFINERY_X) {
				events.push({ type: 'refinery-hit', x: target.x, y: target.y });
				loseHeart(state, events);
				gone.add(target.id);
			}
		}
	}
	if (gone.size > 0) state.targets = state.targets.filter((target) => !gone.has(target.id));
	return events;
}

/*
 * Game state and rules of Suez Stuck: the wedged ship, the bank grid, the fingers holding the
 * ends, the excavator, the queue and the hearts. The functions are pure apart from mutating the
 * state object they are given, so they can be tested without a screen.
 */
import { grabOffset } from '../pointerDrag';
import type { Random } from '../random';
import { ENDS, angleDiff, createBody, endPoint, type Body, type End, type Point } from './body';
import {
	canalCenterX,
	createCanal,
	digTiles,
	isDiggable,
	isSolidAt,
	maxDepth,
	tileAt,
	type Canal
} from './canal';
import {
	DIG_ANIMATION_MS,
	DIG_LOOSEN,
	GRAB_MARGIN,
	GRAB_RADIUS,
	QUEUE_CAPACITY,
	SAIL_DONE_MS,
	STARTING_LIVES,
	TILE,
	WEDGE_Y,
	levelParams
} from './config';
import { isFree, jamDepth, stepBody, type Hold } from './physics';
import { createQueue, releaseQueue, stepQueue, type QueueState } from './queue';

export type SuezPhase = 'stuck' | 'sailing' | 'over';

export interface Excavator {
	/** Where it sits on the bank, in world units */
	x: number;
	y: number;
	/** Time left of the dig animation */
	digMs: number;
}

export interface SuezState {
	level: number;
	canal: Canal;
	body: Body;
	/** How deep the ship was wedged at the start of this canal: the full "stuck" meter */
	startDepth: number;
	/** How deep the ship may still sit in the banks (the mud's hold); only ever shrinks */
	allowed: number;
	holds: Hold[];
	phase: SuezPhase;
	sailMs: number;
	levelTimeMs: number;
	score: number;
	lives: number;
	canalsCleared: number;
	shipsReleased: number;
	queue: QueueState;
	cooldownMs: number;
	excavator: Excavator;
}

export type SuezEvent =
	| { type: 'arrived'; waiting: number }
	| { type: 'overflow'; left: number }
	| { type: 'bump'; impact: number }
	| { type: 'freed'; points: number; released: number; level: number }
	| { type: 'level-start'; level: number }
	| { type: 'game-over' };

export type PressResult =
	| { kind: 'grab'; end: End }
	| { kind: 'dig'; tiles: { col: number; row: number }[] }
	| { kind: 'cooldown' }
	| { kind: 'none' };

const EXCAVATOR_PARK: Point = { x: 30, y: 70 };

export function createGame(random: Random): SuezState {
	const state = {
		level: 1,
		holds: [],
		phase: 'stuck',
		sailMs: 0,
		levelTimeMs: 0,
		score: 0,
		lives: STARTING_LIVES,
		canalsCleared: 0,
		shipsReleased: 0,
		queue: createQueue(),
		cooldownMs: 0,
		excavator: { ...EXCAVATOR_PARK, digMs: 0 }
	} as unknown as SuezState;
	startLevel(state, random);
	return state;
}

/** Digs a fresh canal for state.level and wedges the ship across it */
export function startLevel(state: SuezState, random: Random) {
	const { widthTiles, bankBump } = levelParams(state.level);
	state.canal = createCanal(widthTiles, random, bankBump);
	const side = random() < 0.5 ? -1 : 1;
	const tilt = side * (0.3 + random() * 0.15);
	state.body = createBody(
		canalCenterX(widthTiles) + (random() - 0.5) * 12,
		WEDGE_Y + (random() - 0.5) * 40,
		tilt
	);
	state.startDepth = Math.max(
		1,
		maxDepth(state.canal, state.body),
		jamDepth(state.canal, state.body)
	);
	state.allowed = state.startDepth;
	state.holds = [];
	state.phase = 'stuck';
	state.sailMs = 0;
	state.levelTimeMs = 0;
	state.queue = createQueue();
	state.cooldownMs = 0;
	state.excavator = { ...EXCAVATOR_PARK, digMs: 0 };
}

/** The stuck meter: 1 while the mud holds the ship as it did at the start, 0 when it has let go */
export function stuckFraction(state: SuezState): number {
	if (state.phase !== 'stuck') return 0;
	return Math.min(1, Math.max(0, state.allowed / state.startDepth));
}

/** Seconds to go until the excavator can dig again (0 when ready) */
export function excavatorSeconds(state: SuezState): number {
	return Math.ceil(state.cooldownMs / 1000);
}

/** Distance from a point to the ship's centre line */
export function distanceToHull(body: Body, point: Point): number {
	const a = endPoint(body, 'stern');
	const b = endPoint(body, 'bow');
	const abx = b.x - a.x;
	const aby = b.y - a.y;
	const lengthSquared = abx * abx + aby * aby;
	const t =
		lengthSquared === 0
			? 0
			: Math.min(1, Math.max(0, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
	return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
}

function nearestFreeEnd(state: SuezState, point: Point): { end: End; distance: number } | null {
	let best: { end: End; distance: number } | null = null;
	for (const end of ENDS) {
		if (state.holds.some((hold) => hold.end === end)) continue;
		const at = endPoint(state.body, end);
		const distance = Math.hypot(point.x - at.x, point.y - at.y);
		if (!best || distance < best.distance) best = { end, distance };
	}
	return best;
}

function grab(state: SuezState, pointerId: number, point: Point, end: End): PressResult {
	const at = endPoint(state.body, end);
	state.holds.push({ pointerId, end, pointer: point, offset: grabOffset(at, point) });
	return { kind: 'grab', end };
}

/**
 * A press on the field. Near the hull it grabs the nearest free end (each finger holds one end;
 * a mouse holds one end at a time). On a bank tile away from the hull it calls the excavator. In
 * open water a touch grabs an end only when it is close, a mouse always grabs the nearest one.
 */
export function pressAt(
	state: SuezState,
	pointerId: number,
	point: Point,
	pointerType: string
): PressResult {
	if (state.phase !== 'stuck') return { kind: 'none' };
	if (state.holds.some((hold) => hold.pointerId === pointerId)) return { kind: 'none' };
	const nearest = nearestFreeEnd(state, point);
	if (distanceToHull(state.body, point) <= state.body.beam / 2 + GRAB_MARGIN) {
		return nearest ? grab(state, pointerId, point, nearest.end) : { kind: 'none' };
	}
	const { col, row } = tileAt(point);
	if (isSolidAt(state.canal, point) && isDiggable(state.canal, col, row)) {
		return dig(state, col, row);
	}
	if (nearest && (pointerType === 'mouse' || nearest.distance <= GRAB_RADIUS)) {
		return grab(state, pointerId, point, nearest.end);
	}
	return { kind: 'none' };
}

/** The excavator digs the tapped bank tile and its neighbours, then needs a rest */
export function dig(state: SuezState, col: number, row: number): PressResult {
	if (state.phase !== 'stuck') return { kind: 'none' };
	if (state.cooldownMs > 0) return { kind: 'cooldown' };
	const tiles = digTiles(state.canal, col, row);
	if (tiles.length === 0) return { kind: 'none' };
	state.cooldownMs = levelParams(state.level).excavatorCooldownMs;
	state.excavator = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE, digMs: DIG_ANIMATION_MS };
	// Clay out of the bank is clay that no longer holds the ship
	state.allowed = Math.max(0, state.allowed - DIG_LOOSEN * state.startDepth);
	return { kind: 'dig', tiles };
}

export function movePointer(state: SuezState, pointerId: number, point: Point) {
	const hold = state.holds.find((candidate) => candidate.pointerId === pointerId);
	if (hold) hold.pointer = point;
}

/** A finger lifted: that end is left where it is */
export function releasePointer(state: SuezState, pointerId: number) {
	state.holds = state.holds.filter((hold) => hold.pointerId !== pointerId);
}

/** Points for freeing the ship: more for later canals, for speed and for every ship in the queue */
export function freedPoints(level: number, levelTimeMs: number, released: number): number {
	const base = 100 + 25 * (level - 1);
	const speed = Math.max(0, 40 - Math.floor(levelTimeMs / 1000)) * 4;
	return base + speed + 15 * released;
}

function nearestVertical(angle: number): number {
	const up = -Math.PI / 2;
	const down = Math.PI / 2;
	return Math.abs(angleDiff(up, angle)) <= Math.abs(angleDiff(down, angle)) ? up : down;
}

function sail(state: SuezState, random: Random, dtMs: number): SuezEvent[] {
	state.sailMs += dtMs;
	const seconds = state.sailMs / 1000;
	state.body.y -= (140 + 360 * seconds * seconds) * (dtMs / 1000);
	const turn = angleDiff(nearestVertical(state.body.angle), state.body.angle);
	state.body.angle += turn * Math.min(1, dtMs / 250);
	if (state.body.y < -state.body.length / 2 - TILE || state.sailMs >= SAIL_DONE_MS) {
		state.level += 1;
		startLevel(state, random);
		return [{ type: 'level-start', level: state.level }];
	}
	return [];
}

/** Advances the game by one fixed step */
export function stepGame(state: SuezState, random: Random, dtMs: number): SuezEvent[] {
	if (state.phase === 'over') return [];
	state.cooldownMs = Math.max(0, state.cooldownMs - dtMs);
	state.excavator.digMs = Math.max(0, state.excavator.digMs - dtMs);
	if (state.phase === 'sailing') return sail(state, random, dtMs);

	const events: SuezEvent[] = [];
	state.levelTimeMs += dtMs;
	const result = stepBody(
		state.canal,
		state.body,
		state.holds,
		state.allowed,
		state.startDepth,
		dtMs
	);
	state.allowed = result.allowed;
	if (result.impact > 1.2) events.push({ type: 'bump', impact: result.impact });

	if (isFree(state.canal, state.body)) {
		const released = releaseQueue(state.queue);
		const points = freedPoints(state.level, state.levelTimeMs, released);
		state.score += points;
		state.canalsCleared += 1;
		state.shipsReleased += released;
		state.holds = [];
		state.allowed = 0;
		state.phase = 'sailing';
		state.sailMs = 0;
		events.push({ type: 'freed', points, released, level: state.level });
		return events;
	}

	for (const event of stepQueue(state.queue, dtMs, state.level, QUEUE_CAPACITY)) {
		if (event.type === 'arrived') {
			events.push({ type: 'arrived', waiting: event.waiting });
		} else {
			state.lives -= 1;
			events.push({ type: 'overflow', left: event.left });
			if (state.lives <= 0) {
				state.lives = 0;
				state.phase = 'over';
				state.holds = [];
				events.push({ type: 'game-over' });
				break;
			}
		}
	}
	return events;
}

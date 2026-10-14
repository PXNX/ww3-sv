/*
 * One physics step of the ship: the held ends pull it, the banks push back, and the mud lets go a
 * little more with every unit of wiggling. Pure logic on plain objects.
 *
 * The ship starts wedged: its ends are dug into the banks. That embedding is an "allowance": the
 * ship may sit at most that deep in the banks, and the mud also slows it down in proportion. The
 * allowance only ever shrinks, by pulling hard, wiggling, moving and by the excavator. Once it is
 * zero the banks are hard.
 */
import { followPointer } from '../pointerDrag';
import {
	applyDelta,
	cloneBody,
	endPoint,
	fitEnds,
	pullEnd,
	pushDelta,
	type Body,
	type End,
	type Point
} from './body';
import { contactsFor, maxDepth, type Canal, type Contact } from './canal';
import {
	FREE_PROBE,
	EFFORT_CAP,
	EFFORT_UNITS_PER_SECOND,
	LOOSEN_PER_UNIT,
	MAX_FREE_TILT,
	MAX_MOVE_PER_SUBSTEP,
	MUD_FLOOR,
	SUBSTEPS,
	TETHER,
	TOUCH_EPSILON,
	WIGGLE_MIN_GAP_MS,
	WIGGLE_UNITS
} from './config';

/** A finger (or the mouse) holding one end of the ship */
export interface Hold {
	pointerId: number;
	end: End;
	/** Where the pointer is, in world units */
	pointer: Point;
	/** end - pointer, measured at the press: the end stays exactly where it was grabbed */
	offset: Point;
	/** Which way the end is being pulled, to notice a wiggle (the pull changing direction) */
	pullDir?: Point;
	/** Time since the last change of direction */
	sinceFlipMs?: number;
}

export function holdTarget(hold: Hold): Point {
	return followPointer(hold.pointer, hold.offset);
}

const RESOLVE_ITERATIONS = 8;
const RESOLVE_TOLERANCE = 0.01;

/**
 * Pushes the hull out of any bank deeper than `allowed`. Each pass takes the deepest contact of
 * each of the four push directions and applies their corrections together, averaged: a bank on
 * either end of a ship that is too long for the canal then settles in the middle instead of
 * shoving the hull back and forth, and every push both slides and turns the hull. Returns the
 * largest excess seen, a measure of impact.
 */
export function resolveBanks(canal: Canal, body: Body, allowed: number): number {
	let largest = 0;
	for (let i = 0; i < RESOLVE_ITERATIONS; i++) {
		const worst = new Map<string, Contact>();
		for (const contact of contactsFor(canal, body)) {
			if (contact.depth - allowed <= RESOLVE_TOLERANCE) continue;
			const key = `${contact.normal.x},${contact.normal.y}`;
			const seen = worst.get(key);
			if (!seen || contact.depth > seen.depth) worst.set(key, contact);
		}
		if (worst.size === 0) break;
		const deltas = [...worst.values()].map((contact) => {
			const excess = contact.depth - allowed;
			largest = Math.max(largest, excess);
			return pushDelta(body, contact.point, contact.normal, excess);
		});
		for (const delta of deltas) applyDelta(body, delta, 1 / deltas.length);
	}
	return largest;
}

/** Deepest embedding of the hull at the current pose and when nudged north and south */
export function jamDepth(canal: Canal, body: Body): number {
	let deepest = maxDepth(canal, body);
	for (const dy of [-FREE_PROBE, FREE_PROBE]) {
		const probe = cloneBody(body);
		probe.y += dy;
		deepest = Math.max(deepest, maxDepth(canal, probe));
	}
	return deepest;
}

/** Angle between the ship and the canal axis, 0 (along the canal) to PI/2 (straight across) */
export function tiltFromCanal(body: Body): number {
	return Math.asin(Math.min(1, Math.abs(Math.cos(body.angle))));
}

/**
 * The free condition: the ship floats clear of both banks, would still be clear if it slid a tile
 * up or down the canal, and points roughly along it. Then it can simply sail away.
 */
export function isFree(canal: Canal, body: Body): boolean {
	return tiltFromCanal(body) <= MAX_FREE_TILT && jamDepth(canal, body) <= TOUCH_EPSILON;
}

export interface PhysicsResult {
	/** Biggest push a bank gave this step (for bump sounds and dust) */
	impact: number;
	/** How far the ship really moved this step, in world units of hull travel */
	moved: number;
	/** How hard the fingers pulled this step: 0 to 1 for each held end */
	effort: number;
	/** How many times a pull changed direction this step */
	wiggles: number;
}

/**
 * Advances the body by one step. `allowed` is the embedding the ship may still have: it is read
 * and returned updated. Held ends are tethered: an end chases a finger that is far ahead of it only
 * as far as the tether reaches, so pulling back is felt at once instead of after a dead stretch.
 */
export function stepBody(
	canal: Canal,
	body: Body,
	holds: Hold[],
	allowed: number,
	startDepth: number,
	dtMs: number = 1000 / 60
): PhysicsResult & { allowed: number } {
	const startX = body.x;
	const startY = body.y;
	const startAngle = body.angle;
	let impact = 0;
	let effort = 0;
	let wiggles = 0;
	const targets = new Map<Hold, Point>();

	for (const hold of holds) {
		const end = endPoint(body, hold.end);
		const wanted = holdTarget(hold);
		const dx = wanted.x - end.x;
		const dy = wanted.y - end.y;
		const lag = Math.hypot(dx, dy);
		effort += Math.min(lag, EFFORT_CAP) / EFFORT_CAP;
		hold.sinceFlipMs = (hold.sinceFlipMs ?? WIGGLE_MIN_GAP_MS) + dtMs;
		if (lag > 6) {
			const dir = { x: dx / lag, y: dy / lag };
			const before = hold.pullDir;
			if (before && before.x * dir.x + before.y * dir.y < -0.2) {
				// The pull swung back the other way: a wiggle, if it is not just jitter
				if (hold.sinceFlipMs >= WIGGLE_MIN_GAP_MS) wiggles += 1;
				hold.sinceFlipMs = 0;
			}
			hold.pullDir = dir;
		}
		// The end never chases a finger further away than the tether: pull back and it follows at once
		const scale = lag > TETHER ? TETHER / lag : 1;
		targets.set(hold, { x: end.x + dx * scale, y: end.y + dy * scale });
	}

	const bow = holds.find((hold) => hold.end === 'bow');
	const stern = holds.find((hold) => hold.end === 'stern');
	for (let i = 0; i < SUBSTEPS; i++) {
		// The deeper it is stuck, the slower the mud lets it move
		const loose = 1 - Math.min(1, allowed / startDepth);
		const reach = MAX_MOVE_PER_SUBSTEP * (MUD_FLOOR + (1 - MUD_FLOOR) * loose ** 3);
		if (bow && stern) {
			fitEnds(body, targets.get(bow)!, targets.get(stern)!, reach);
		} else if (bow || stern) {
			const hold = (bow ?? stern)!;
			pullEnd(body, hold.end, targets.get(hold)!, reach);
		}
		impact = Math.max(impact, resolveBanks(canal, body, allowed));
	}

	const swing = Math.abs(body.angle - startAngle) * (body.length / 2);
	const moved = Math.hypot(body.x - startX, body.y - startY) + swing;
	// Pulling hard and wiggling wear the mud away, and so does every unit the ship really moves
	const loosened =
		LOOSEN_PER_UNIT * moved +
		EFFORT_UNITS_PER_SECOND * effort * (dtMs / 1000) +
		WIGGLE_UNITS * wiggles;
	if (allowed > 0) allowed = Math.max(0, allowed - loosened);
	return { impact, moved, effort, wiggles, allowed };
}

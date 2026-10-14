/*
 * A tiny 2D rigid body: a long hull with a pointed bow. Position and heading are the state; there
 * is no velocity, because the player moves the ship directly. Moving a point of the ship (a held
 * end, or a bank pushing back) is solved as a position constraint: the displacement is shared out
 * between sliding and turning according to mass and moment of inertia, like pulling a plank by one
 * end. Pure maths, no Svelte.
 */
import { NOSE_LENGTH, SHIP_BEAM, SHIP_LENGTH } from './config';

export interface Point {
	x: number;
	y: number;
}

export interface Body {
	/** Centre of the hull */
	x: number;
	y: number;
	/** Heading in radians; the bow is at +x of the body, so angle 0 points east, -PI/2 north */
	angle: number;
	length: number;
	beam: number;
}

export type End = 'bow' | 'stern';
export const ENDS: readonly End[] = ['bow', 'stern'];

export const INV_MASS = 1;

export function createBody(x: number, y: number, angle: number): Body {
	return { x, y, angle, length: SHIP_LENGTH, beam: SHIP_BEAM };
}

export function cloneBody(body: Body): Body {
	return { ...body };
}

/** Inverse moment of inertia of a rectangle of mass 1 */
export function invInertia(body: Body): number {
	return 12 / (body.length * body.length + body.beam * body.beam);
}

/** Smallest signed difference a - b of two angles, in (-PI, PI] */
export function angleDiff(a: number, b: number): number {
	let d = (a - b) % (2 * Math.PI);
	if (d > Math.PI) d -= 2 * Math.PI;
	if (d <= -Math.PI) d += 2 * Math.PI;
	return d;
}

export function localToWorld(body: Body, lx: number, ly: number): Point {
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	return { x: body.x + lx * cos - ly * sin, y: body.y + lx * sin + ly * cos };
}

export function endPoint(body: Body, end: End): Point {
	return localToWorld(body, end === 'bow' ? body.length / 2 : -body.length / 2, 0);
}

/** Corners of the hull in world coordinates, stern first */
export function hullPolygon(body: Body): Point[] {
	const half = body.length / 2;
	const side = body.beam / 2;
	return [
		localToWorld(body, -half, -side),
		localToWorld(body, half - NOSE_LENGTH, -side),
		localToWorld(body, half, 0),
		localToWorld(body, half - NOSE_LENGTH, side),
		localToWorld(body, -half, side)
	];
}

const SAMPLE_SPACING = 10;
const sampleCache = new Map<string, Point[]>();

/** Points covering the hull, in body coordinates: what the banks are tested against */
export function hullSamples(length: number, beam: number): Point[] {
	const key = `${length}:${beam}`;
	const cached = sampleCache.get(key);
	if (cached) return cached;
	const half = length / 2;
	const side = beam / 2;
	const samples: Point[] = [];
	const rows = [-side, -side / 2, 0, side / 2, side];
	for (let x = -half; x <= half - NOSE_LENGTH + 1e-9; x += SAMPLE_SPACING) {
		for (const y of rows) samples.push({ x, y });
	}
	// The tapering nose: fewer points as it narrows, down to the tip
	for (let x = half - NOSE_LENGTH + SAMPLE_SPACING; x < half; x += SAMPLE_SPACING) {
		const reach = (side * (half - x)) / NOSE_LENGTH;
		for (const y of [-reach, 0, reach]) samples.push({ x, y });
	}
	samples.push({ x: half, y: 0 });
	sampleCache.set(key, samples);
	return samples;
}

export function worldSamples(body: Body): Point[] {
	return hullSamples(body.length, body.beam).map((s) => localToWorld(body, s.x, s.y));
}

/** One linearised move of a point of the body, shared between sliding and turning */
function nudgeAt(body: Body, point: Point, delta: Point) {
	const rx = point.x - body.x;
	const ry = point.y - body.y;
	const rl = Math.hypot(rx, ry);
	if (rl < 1e-9) {
		body.x += delta.x;
		body.y += delta.y;
		return;
	}
	const ux = rx / rl;
	const uy = ry / rl;
	// Components of the wanted move along the lever arm and across it
	const along = delta.x * ux + delta.y * uy;
	const across = -delta.x * uy + delta.y * ux;
	const invI = invInertia(body);
	const impulseAlong = along / INV_MASS;
	const impulseAcross = across / (INV_MASS + invI * rl * rl);
	const lx = impulseAlong * ux - impulseAcross * uy;
	const ly = impulseAlong * uy + impulseAcross * ux;
	body.x += INV_MASS * lx;
	body.y += INV_MASS * ly;
	body.angle += invI * (rx * ly - ry * lx);
}

/**
 * Moves the world point `point` of the body by `delta`, sharing the move between sliding the whole
 * body and turning it. Pulling at the end of a plank sideways mostly turns it; pulling along its
 * length only slides it. A few corrections make up for the turn being an arc, so the point ends
 * up exactly `delta` further along: the end stays under the finger.
 */
export function moveAt(body: Body, point: Point, delta: Point) {
	const rx = point.x - body.x;
	const ry = point.y - body.y;
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	// The point in body coordinates, so it can be found again after the body has turned
	const lx = rx * cos + ry * sin;
	const ly = -rx * sin + ry * cos;
	const goal = { x: point.x + delta.x, y: point.y + delta.y };
	let at = point;
	for (let i = 0; i < 4; i++) {
		nudgeAt(body, at, { x: goal.x - at.x, y: goal.y - at.y });
		at = localToWorld(body, lx, ly);
	}
}

export interface PoseDelta {
	dx: number;
	dy: number;
	dAngle: number;
}

/**
 * How the body would move if the world point `point` were pushed by `distance` along the unit
 * `normal` (a bank pushing the hull back out): only the normal component is corrected, so the
 * hull may keep sliding along the bank.
 */
export function pushDelta(body: Body, point: Point, normal: Point, distance: number): PoseDelta {
	const rx = point.x - body.x;
	const ry = point.y - body.y;
	const cross = rx * normal.y - ry * normal.x;
	const invI = invInertia(body);
	const weight = INV_MASS + cross * cross * invI;
	const impulse = distance / weight;
	return {
		dx: INV_MASS * impulse * normal.x,
		dy: INV_MASS * impulse * normal.y,
		dAngle: invI * cross * impulse
	};
}

export function applyDelta(body: Body, delta: PoseDelta, scale = 1) {
	body.x += delta.dx * scale;
	body.y += delta.dy * scale;
	body.angle += delta.dAngle * scale;
}

export function pushAlong(body: Body, point: Point, normal: Point, distance: number) {
	applyDelta(body, pushDelta(body, point, normal, distance));
}

function clampLength(dx: number, dy: number, max: number): Point {
	const length = Math.hypot(dx, dy);
	if (length <= max || length === 0) return { x: dx, y: dy };
	return { x: (dx * max) / length, y: (dy * max) / length };
}

/** Pulls one end towards a target, at most `maxMove` units; returns how far the end wanted to go */
export function pullEnd(body: Body, end: End, target: Point, maxMove: number): number {
	const from = endPoint(body, end);
	const wanted = Math.hypot(target.x - from.x, target.y - from.y);
	const step = clampLength(target.x - from.x, target.y - from.y, maxMove);
	moveAt(body, from, step);
	return wanted;
}

/**
 * Moves the body towards the pose that puts the bow on one target and the stern on the other
 * (the best rigid fit: centred between the targets, along the line through them), at most
 * `maxMove` units per end.
 */
export function fitEnds(body: Body, bowTarget: Point, sternTarget: Point, maxMove: number) {
	const wantedX = (bowTarget.x + sternTarget.x) / 2;
	const wantedY = (bowTarget.y + sternTarget.y) / 2;
	const wantedAngle = Math.atan2(bowTarget.y - sternTarget.y, bowTarget.x - sternTarget.x);
	const dAngle = angleDiff(wantedAngle, body.angle);
	const slide = Math.hypot(wantedX - body.x, wantedY - body.y);
	const swing = Math.abs(dAngle) * (body.length / 2);
	const largest = Math.max(slide, swing);
	const scale = largest > maxMove ? maxMove / largest : 1;
	body.x += (wantedX - body.x) * scale;
	body.y += (wantedY - body.y) * scale;
	body.angle += dAngle * scale;
}

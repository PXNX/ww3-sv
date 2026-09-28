/*
 * Fixed-timestep simulation for Flamingo Flight (requirements Section 8). A run is a series of
 * segments: a row of obstacle gaps, then a refinery approach where the player stops flapping to
 * dive onto a storage tank. A strike bounces the flamingo up into the next, slightly harder
 * segment; any other contact sends it tumbling into the ground and ends the run.
 * Everything here is deterministic for a given seed and sequence of flaps.
 */
import { createRandom } from '../random';
import {
	COLUMN_WIDTH,
	bottomRect,
	generateGapSequence,
	topRect,
	type ColumnKind,
	type GapColumn
} from './gapSequence';
import {
	FLAMINGO_RADIUS,
	GROUND_Y,
	SCROLL_SPEED,
	STEP_SECONDS,
	circleHitsRect,
	integrate
} from './physics';
import {
	flareRect,
	generateRefinery,
	strikeTank,
	tankRect,
	type Refinery,
	type StrikeResult
} from './refinery';

export const GAP_POINTS = 10;
/** Left edge of the very first column; the flamingo starts at x = 0 */
export const FIRST_COLUMN_X = 420;
/** Open sky between the last column of a segment and its refinery */
export const REFINERY_LEAD = 240;
/** After a strike, the next segment's first column is at least this far ahead */
export const NEXT_SEGMENT_LEAD = 380;
/** ...and at least this far past the end of the refinery that was just struck */
export const NEXT_SEGMENT_CLEARANCE = 160;
/** Flying this far past the last tank counts as a miss */
export const OVERSHOOT_MARGIN = 30;
export const READY_Y = 250;
export const STRIKE_BOUNCE_VELOCITY = -560;
export const CRASH_HOP_VELOCITY = -240;
/** How long the flamingo lies on the ground before the run is over */
export const OVER_DELAY_SECONDS = 0.8;

export type Phase = 'ready' | 'flying' | 'tumbling' | 'over';
export type Stage = 'gaps' | 'approach';
export type CrashCause = 'balloon' | ColumnKind | 'ground' | 'flare' | 'missed' | 'overshoot';

export interface Segment {
	index: number;
	columns: GapColumn[];
	refinery: Refinery;
	/** How many of the columns the flamingo has cleared */
	passed: number;
	strike: StrikeResult | null;
}

export type FlamingoEvent =
	| { type: 'flap' }
	| { type: 'gap'; points: number }
	| { type: 'approach' }
	| { type: 'strike'; result: StrikeResult; segment: Segment; x: number; y: number }
	| { type: 'crash'; cause: CrashCause }
	| { type: 'landed' }
	| { type: 'over' };

export interface FlamingoState {
	seed: number;
	phase: Phase;
	stage: Stage;
	x: number;
	y: number;
	vy: number;
	/** Seconds since the state was created */
	time: number;
	lastFlapTime: number;
	/** The current segment is the last one; earlier ones stay while they are still on screen */
	segments: Segment[];
	score: number;
	gapsPassed: number;
	refineriesStruck: number;
	tanksDestroyed: number;
	crash: CrashCause | null;
	/** Seconds spent lying on the ground after a crash */
	landedSeconds: number | null;
	/** What happened during the most recent step, for effects and sounds */
	events: FlamingoEvent[];
}

export type Contact =
	| { kind: 'column'; cause: 'balloon' | ColumnKind }
	| { kind: 'tank'; index: number }
	| { kind: 'flare' }
	| { kind: 'ground' }
	| { kind: 'overshoot' };

/** Every segment gets its own seed, so its layout does not depend on how the run went */
export function segmentSeed(seed: number, index: number): number {
	return (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

export function createSegment(seed: number, index: number, firstColumnX: number): Segment {
	const random = createRandom(segmentSeed(seed, index));
	const columns = generateGapSequence(random, index, firstColumnX);
	const last = columns[columns.length - 1];
	const refinery = generateRefinery(random, index, last.x + COLUMN_WIDTH + REFINERY_LEAD);
	return { index, columns, refinery, passed: 0, strike: null };
}

export function createFlamingoState(seed: number): FlamingoState {
	return {
		seed,
		phase: 'ready',
		stage: 'gaps',
		x: 0,
		y: READY_Y,
		vy: 0,
		time: 0,
		lastFlapTime: -Infinity,
		segments: [createSegment(seed, 0, FIRST_COLUMN_X)],
		score: 0,
		gapsPassed: 0,
		refineriesStruck: 0,
		tanksDestroyed: 0,
		crash: null,
		landedSeconds: null,
		events: []
	};
}

export function currentSegment(state: FlamingoState): Segment {
	return state.segments[state.segments.length - 1];
}

/** What a flamingo at (x, y) touches in the given segment, if anything */
export function findContact(segment: Segment, x: number, y: number): Contact | null {
	const r = FLAMINGO_RADIUS;
	for (const column of segment.columns) {
		if (column.x > x + r || column.x + COLUMN_WIDTH < x - r) continue;
		if (circleHitsRect(x, y, r, topRect(column))) return { kind: 'column', cause: 'balloon' };
		if (circleHitsRect(x, y, r, bottomRect(column))) return { kind: 'column', cause: column.kind };
	}
	if (!segment.strike) {
		const { tanks, flare } = segment.refinery;
		for (let index = 0; index < tanks.length; index++) {
			if (circleHitsRect(x, y, r, tankRect(tanks[index]))) return { kind: 'tank', index };
		}
		if (circleHitsRect(x, y, r, flareRect(flare))) return { kind: 'flare' };
	}
	if (y + r >= GROUND_Y) return { kind: 'ground' };
	if (segment.passed === segment.columns.length && !segment.strike) {
		if (x - r > segment.refinery.endX + OVERSHOOT_MARGIN) return { kind: 'overshoot' };
	}
	return null;
}

/**
 * Where a dive that starts right now would end: the flamingo keeps its current motion and stops
 * flapping. Used to highlight the tank under the dive path.
 */
export function predictDive(state: FlamingoState, maxSeconds = 3): Contact | null {
	if (state.phase !== 'flying') return null;
	const segment = currentSegment(state);
	let body = { y: state.y, vy: state.vy };
	let x = state.x;
	for (let t = 0; t < maxSeconds; t += STEP_SECONDS) {
		x += SCROLL_SPEED * STEP_SECONDS;
		body = integrate(body, false);
		const contact = findContact(segment, x, Math.max(FLAMINGO_RADIUS, body.y));
		if (contact) return contact;
	}
	return null;
}

function crashCause(contact: Contact, stage: Stage): CrashCause {
	switch (contact.kind) {
		case 'column':
			return contact.cause;
		case 'ground':
			return stage === 'approach' ? 'missed' : 'ground';
		case 'flare':
			return 'flare';
		default:
			return 'overshoot';
	}
}

function crash(state: FlamingoState, cause: CrashCause): void {
	state.phase = 'tumbling';
	state.crash = cause;
	state.vy = CRASH_HOP_VELOCITY;
	state.y = Math.min(state.y, GROUND_Y - FLAMINGO_RADIUS);
	state.events.push({ type: 'crash', cause });
}

function strike(state: FlamingoState, segment: Segment, hitIndex: number): void {
	const result = strikeTank(segment.refinery, hitIndex);
	const tank = segment.refinery.tanks[hitIndex];
	segment.strike = result;
	state.score += result.points;
	state.refineriesStruck += 1;
	state.tanksDestroyed += result.destroyed.length;
	state.events.push({ type: 'strike', result, segment, x: tank.x, y: GROUND_Y - tank.height });

	// The flamingo bounces off, slightly toasted, and flies on into the next segment
	state.y = Math.min(state.y, GROUND_Y - tank.height - FLAMINGO_RADIUS);
	state.vy = STRIKE_BOUNCE_VELOCITY;
	state.stage = 'gaps';
	const firstColumnX = Math.max(
		state.x + NEXT_SEGMENT_LEAD,
		segment.refinery.endX + NEXT_SEGMENT_CLEARANCE
	);
	state.segments = [
		...state.segments.slice(-1),
		createSegment(state.seed, segment.index + 1, firstColumnX)
	];
}

function fly(state: FlamingoState, flap: boolean, dt: number): void {
	state.x += SCROLL_SPEED * dt;
	const body = integrate(state, flap, dt);
	state.y = body.y;
	state.vy = body.vy;
	if (flap) {
		state.lastFlapTime = state.time;
		state.events.push({ type: 'flap' });
	}
	// The top of the sky is a soft ceiling
	if (state.y < FLAMINGO_RADIUS) {
		state.y = FLAMINGO_RADIUS;
		state.vy = Math.max(0, state.vy);
	}

	const segment = currentSegment(state);
	while (
		segment.passed < segment.columns.length &&
		state.x - FLAMINGO_RADIUS > segment.columns[segment.passed].x + COLUMN_WIDTH
	) {
		segment.passed += 1;
		state.gapsPassed += 1;
		state.score += GAP_POINTS;
		state.events.push({ type: 'gap', points: GAP_POINTS });
	}
	if (state.stage === 'gaps' && segment.passed === segment.columns.length) {
		state.stage = 'approach';
		state.events.push({ type: 'approach' });
	}

	const contact = findContact(segment, state.x, state.y);
	if (!contact) return;
	if (contact.kind === 'tank') strike(state, segment, contact.index);
	else crash(state, crashCause(contact, state.stage));
}

function tumble(state: FlamingoState, dt: number): void {
	// Ground crashes skid forward a little; obstacle crashes drop straight down
	const skids = state.crash === 'ground' || state.crash === 'missed' || state.crash === 'overshoot';
	if (skids && state.landedSeconds === null) state.x += SCROLL_SPEED * 0.35 * dt;

	if (state.landedSeconds === null) {
		const body = integrate(state, false, dt);
		state.y = body.y;
		state.vy = body.vy;
		if (state.y + FLAMINGO_RADIUS >= GROUND_Y) {
			state.y = GROUND_Y - FLAMINGO_RADIUS;
			state.vy = 0;
			state.landedSeconds = 0;
			state.events.push({ type: 'landed' });
		}
		return;
	}

	state.landedSeconds += dt;
	if (state.landedSeconds >= OVER_DELAY_SECONDS) {
		state.phase = 'over';
		state.events.push({ type: 'over' });
	}
}

/** Advances the game by one fixed step; flap is whether the player flapped since the last step */
export function stepFlamingo(state: FlamingoState, flap: boolean, dt = STEP_SECONDS): void {
	state.events = [];
	if (state.phase === 'over') return;
	state.time += dt;

	switch (state.phase) {
		case 'ready':
			if (flap) {
				state.phase = 'flying';
				fly(state, true, dt);
			} else {
				// Hover in place with a gentle bob until the first tap
				state.y = READY_Y + Math.sin(state.time * 4) * 6;
			}
			break;
		case 'flying':
			fly(state, flap, dt);
			break;
		case 'tumbling':
			tumble(state, dt);
			break;
	}
}

/** Gaps still to clear before the current segment's refinery */
export function gapsLeft(state: FlamingoState): number {
	const segment = currentSegment(state);
	return segment.columns.length - segment.passed;
}

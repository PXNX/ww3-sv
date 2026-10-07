/*
 * One fixed step of Radar Slice: launches, flight, the trail test, slicing and scoring. Pure
 * apart from the state it mutates, so tests drive it with a seeded Random.
 */
import {
	HALF_LIFE_MS,
	HALF_SEPARATION_SPEED,
	HALF_SPIN,
	TRAIL_REACH,
	WORLD_HEIGHT,
	isDecoy,
	specOf
} from './config';
import { breakCombo, registerSlice, sliceScore } from './scoring';
import { stepSpawner } from './spawner';
import type { Flyer, SliceEvent, SliceState } from './state';
import { pruneTrail, trailHits, trailSegments } from './trail';
import type { Random } from '#lib/game/random.js';

/** Where the nose points: along the flight for missiles, a gentle rock for decoys */
export function orientation(flyer: Flyer, timeMs: number): number {
	const spec = specOf(flyer.kind);
	if (spec.pointsForward) return Math.atan2(flyer.vy, flyer.vx);
	return Math.sin((timeMs / 1000) * spec.swayRate + flyer.phase) * spec.sway;
}

function loseLife(state: SliceState, events: SliceEvent[]) {
	state.lives = Math.max(0, state.lives - 1);
	if (state.lives === 0 && !state.over) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

/** Cuts a flyer in two at the given swipe angle and settles the score or the heart */
function cut(state: SliceState, flyer: Flyer, swipeAngle: number, events: SliceEvent[]) {
	state.flyers = state.flyers.filter((other) => other !== flyer);
	const spec = specOf(flyer.kind);

	// The halves part sideways to the swipe, each keeping the flyer's own motion
	const normalX = -Math.sin(swipeAngle);
	const normalY = Math.cos(swipeAngle);
	const turn = HALF_SPIN + (flyer.phase / (Math.PI * 2)) * 2;
	for (const side of [1, -1] as const) {
		state.halves.push({
			id: state.nextId++,
			kind: flyer.kind,
			x: flyer.x,
			y: flyer.y,
			vx: flyer.vx + normalX * HALF_SEPARATION_SPEED * side,
			vy: flyer.vy + normalY * HALF_SEPARATION_SPEED * side,
			gravity: flyer.gravity,
			angle: flyer.angle,
			spin: turn * side,
			cut: swipeAngle - flyer.angle,
			side,
			facing: flyer.vx < 0 ? -1 : 1,
			ageMs: 0
		});
	}

	if (isDecoy(flyer.kind)) {
		state.decoysHit += 1;
		breakCombo(state.combo);
		events.push({ type: 'decoy-hit', kind: flyer.kind, x: flyer.x, y: flyer.y });
		loseLife(state, events);
		return;
	}

	const chain = registerSlice(state.combo, state.timeMs, state.trail.swipe);
	const points = sliceScore(spec.points, chain);
	state.score += points;
	state.sliced += 1;
	state.bestCombo = Math.max(state.bestCombo, chain);
	events.push({ type: 'sliced', kind: flyer.kind, x: flyer.x, y: flyer.y, points, chain });
}

/**
 * Tests the whole trail against every flyer and cuts each one it crosses, in swipe order. Called
 * every step and again right after each pointer move, so a fast swipe cannot skip past a flyer
 * by pushing its early points out of the short trail.
 */
export function sliceWithTrail(state: SliceState): SliceEvent[] {
	if (state.over) return [];
	const events: SliceEvent[] = [];
	const hits = trailHits(trailSegments(state.trail), state.flyers, (flyer) => ({
		x: flyer.x,
		y: flyer.y,
		r: specOf(flyer.kind).radius + TRAIL_REACH
	}));
	for (const hit of hits) {
		if (state.over) break;
		cut(state, hit.target, hit.angle, events);
	}
	return events;
}

function flyStep(state: SliceState, dtMs: number, events: SliceEvent[]) {
	const dt = dtMs / 1000;
	const remaining: Flyer[] = [];
	for (const flyer of state.flyers) {
		flyer.ageMs += dtMs;
		flyer.vy += flyer.gravity * dt;
		flyer.x += flyer.vx * dt;
		flyer.y += flyer.vy * dt;
		flyer.angle = orientation(flyer, state.timeMs);

		// Fully below the bottom edge on the way down: it got away
		const fell = flyer.vy > 0 && flyer.y - specOf(flyer.kind).radius > WORLD_HEIGHT;
		if (!fell) {
			remaining.push(flyer);
		} else if (!isDecoy(flyer.kind)) {
			state.missed += 1;
			events.push({ type: 'missed', kind: flyer.kind, x: flyer.x, y: WORLD_HEIGHT });
			if (!state.over) loseLife(state, events);
		}
	}
	state.flyers = remaining;
}

function halvesStep(state: SliceState, dtMs: number) {
	const dt = dtMs / 1000;
	for (const half of state.halves) {
		half.ageMs += dtMs;
		half.vy += half.gravity * dt;
		half.x += half.vx * dt;
		half.y += half.vy * dt;
		half.angle += half.spin * dt;
	}
	state.halves = state.halves.filter(
		(half) => half.ageMs < HALF_LIFE_MS && half.y < WORLD_HEIGHT + 80
	);
}

export function stepGame(state: SliceState, random: Random, dtMs: number): SliceEvent[] {
	if (state.over) return [];
	const events: SliceEvent[] = [];
	state.timeMs += dtMs;

	for (const launch of stepSpawner(state.spawner, random, dtMs, state.timeMs)) {
		const flyer: Flyer = { ...launch, id: state.nextId++, ageMs: 0 };
		flyer.angle = orientation(flyer, state.timeMs);
		state.flyers.push(flyer);
		events.push({ type: 'launched', kind: flyer.kind, x: flyer.x });
	}

	flyStep(state, dtMs, events);
	halvesStep(state, dtMs);
	pruneTrail(state.trail, state.timeMs);
	if (!state.over) events.push(...sliceWithTrail(state));
	return events;
}

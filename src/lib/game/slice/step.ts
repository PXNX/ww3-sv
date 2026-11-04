/*
 * One fixed step of Radar Slice: waves and launches, flight, the trail test, slicing and
 * scoring. Pure apart from the state it mutates, so tests drive it with a seeded Random.
 */
import {
	ARMOR_KNOCK,
	BLAST_IMPULSE,
	BLAST_RADIUS,
	FLAWLESS_BONUS,
	FOCUS_MS,
	FOCUS_SCALE,
	GRAVITY,
	HALF_LIFE_MS,
	HALF_SEPARATION_SPEED,
	HALF_SPIN,
	SEA_HEIGHT,
	SEA_SKIM_RESTITUTION,
	SPLIT_SIDE_SPEED,
	SPLIT_UP_SPEED,
	STARTING_LIVES,
	TRAIL_REACH,
	WALL_RESTITUTION,
	WAVE_BONUS,
	WAVE_COUNT,
	WAVE_LULL_MS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	isDecoy,
	isPickup,
	specOf
} from './config';
import { breakCombo, registerSlice, sliceScore, streakMultiplier } from './scoring';
import { FIRST_VOLLEY_MS, beginWave, stepSpawner, type Launch } from './spawner';
import type { Flyer, SliceEvent, SliceState } from './state';
import { clearTrail, pruneTrail, trailHits, trailSegments } from './trail';
import type { Random } from '#lib/game/random.js';

/** How fast the world runs: 1 normally, slower during focus (easing back out at its end) */
export function timeScale(focusMs: number): number {
	if (focusMs <= 0) return 1;
	const EASE_MS = 500;
	if (focusMs >= EASE_MS) return FOCUS_SCALE;
	return FOCUS_SCALE + (1 - FOCUS_SCALE) * (1 - focusMs / EASE_MS);
}

/** Where the nose points: along the flight for missiles, a gentle rock or a tumble otherwise */
export function orientation(flyer: Flyer, timeMs: number): number {
	const spec = specOf(flyer.kind);
	if (spec.pointsForward) return Math.atan2(flyer.vy, flyer.vx);
	if (spec.tumble !== 0) return flyer.phase + (flyer.ageMs / 1000) * spec.tumble;
	return Math.sin((timeMs / 1000) * spec.swayRate + flyer.phase) * spec.sway;
}

/** A launch (or a fragment) becomes a flyer in the air */
export function makeFlyer(state: SliceState, launch: Launch): Flyer {
	const flyer: Flyer = {
		...launch,
		id: state.nextId++,
		ageMs: 0,
		hp: specOf(launch.kind).hp,
		hitSwipe: -1,
		hitMs: 0
	};
	flyer.angle = orientation(flyer, state.timeMs);
	return flyer;
}

function loseLife(state: SliceState, events: SliceEvent[]) {
	state.lives = Math.max(0, state.lives - 1);
	state.waveFlawless = false;
	if (state.lives === 0 && !state.over) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

function breakStreak(state: SliceState) {
	state.streak = 0;
	breakCombo(state.combo);
}

function spawnHalves(state: SliceState, flyer: Flyer, swipeAngle: number) {
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
			ageMs: 0,
			skimmed: false
		});
	}
}

/** A mine going off: everything around it is shoved away, harder the closer it is */
function blast(state: SliceState, x: number, y: number) {
	const bodies: { x: number; y: number; vx: number; vy: number }[] = [
		...state.flyers,
		...state.halves
	];
	for (const body of bodies) {
		const dx = body.x - x;
		const dy = body.y - y;
		const distance = Math.hypot(dx, dy);
		if (distance > BLAST_RADIUS) continue;
		const push = (1 - distance / BLAST_RADIUS) * BLAST_IMPULSE;
		const norm = distance < 1 ? 1 : distance;
		body.vx += (dx / norm) * push;
		body.vy += (dy / norm) * push - push * 0.3;
	}
}

/** Two bomblets fly out of a cluster, parting sideways and up */
function splitFlyer(state: SliceState, flyer: Flyer, events: SliceEvent[]) {
	const spec = specOf(flyer.kind);
	const spread = SPLIT_SIDE_SPEED + (flyer.phase / (Math.PI * 2)) * 50;
	for (let i = 0; i < spec.splits; i++) {
		const side = spec.splits === 1 ? 0 : (i / (spec.splits - 1)) * 2 - 1;
		const child = specOf('bomblet');
		const bomblet = makeFlyer(state, {
			kind: 'bomblet',
			x: flyer.x,
			y: flyer.y,
			vx: flyer.vx * 0.4 + side * spread,
			vy: Math.min(flyer.vy * 0.3, 0) - SPLIT_UP_SPEED,
			gravity: GRAVITY * child.gravityScale,
			angle: 0,
			phase: flyer.phase + i
		});
		// The swipe that broke the cluster does not cut its bomblets too
		bomblet.hitSwipe = state.trail.swipe;
		state.flyers.push(bomblet);
	}
	events.push({ type: 'split', kind: flyer.kind, x: flyer.x, y: flyer.y });
}

/** Cuts a flyer at the given swipe angle and settles the score, the heart or the reward */
function cut(state: SliceState, flyer: Flyer, swipeAngle: number, events: SliceEvent[]) {
	const spec = specOf(flyer.kind);

	// Armour: dented, not broken. It takes another swipe.
	if (flyer.hp > 1) {
		flyer.hp -= 1;
		flyer.hitSwipe = state.trail.swipe;
		flyer.hitMs = state.timeMs;
		flyer.vx += -Math.sin(swipeAngle) * ARMOR_KNOCK;
		flyer.vy += Math.cos(swipeAngle) * ARMOR_KNOCK - ARMOR_KNOCK * 0.4;
		events.push({
			type: 'armor-hit',
			kind: flyer.kind,
			x: flyer.x,
			y: flyer.y,
			left: flyer.hp
		});
		return;
	}

	state.flyers = state.flyers.filter((other) => other !== flyer);

	if (isPickup(flyer.kind)) {
		if (flyer.kind === 'focus') state.focusMs = FOCUS_MS;
		else state.lives = Math.min(STARTING_LIVES, state.lives + 1);
		events.push({ type: 'pickup', kind: flyer.kind, x: flyer.x, y: flyer.y });
		return;
	}

	if (isDecoy(flyer.kind)) {
		const isMine = flyer.kind === 'mine';
		if (isMine) blast(state, flyer.x, flyer.y);
		else spawnHalves(state, flyer, swipeAngle);
		state.decoysHit += 1;
		breakStreak(state);
		events.push({
			type: 'decoy-hit',
			kind: flyer.kind,
			x: flyer.x,
			y: flyer.y,
			blast: isMine
		});
		loseLife(state, events);
		return;
	}

	spawnHalves(state, flyer, swipeAngle);
	const chain = registerSlice(state.combo, state.timeMs, state.trail.swipe);
	const multiplier = streakMultiplier(state.streak);
	const points = sliceScore(spec.points, chain) * multiplier;
	state.score += points;
	state.sliced += 1;
	state.streak += 1;
	state.bestStreak = Math.max(state.bestStreak, state.streak);
	state.bestCombo = Math.max(state.bestCombo, chain);
	events.push({
		type: 'sliced',
		kind: flyer.kind,
		x: flyer.x,
		y: flyer.y,
		angle: swipeAngle,
		points,
		chain,
		multiplier
	});
	if (spec.splits > 0) splitFlyer(state, flyer, events);
}

/**
 * Tests the whole trail against every flyer and cuts each one it crosses, in swipe order. Called
 * every step and again right after each pointer move, so a fast swipe cannot skip past a flyer
 * by pushing its early points out of the short trail. An armoured flyer dented by this swipe
 * is left alone until the next one.
 */
export function sliceWithTrail(state: SliceState): SliceEvent[] {
	if (state.over) return [];
	const events: SliceEvent[] = [];
	const swipe = state.trail.swipe;
	const targets = state.flyers.filter((flyer) => flyer.hitSwipe !== swipe);
	const hits = trailHits(trailSegments(state.trail), targets, (flyer) => ({
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

/** Turns a body around at the side walls, losing a little speed */
function bounceOffWalls(body: { x: number; vx: number }, radius: number): boolean {
	if (body.x - radius < 0 && body.vx < 0) {
		body.x = radius;
		body.vx = -body.vx * WALL_RESTITUTION;
		return true;
	}
	if (body.x + radius > WORLD_WIDTH && body.vx > 0) {
		body.x = WORLD_WIDTH - radius;
		body.vx = -body.vx * WALL_RESTITUTION;
		return true;
	}
	return false;
}

function flyStep(state: SliceState, worldMs: number, events: SliceEvent[]) {
	const dt = worldMs / 1000;
	const remaining: Flyer[] = [];
	for (const flyer of state.flyers) {
		const { radius, minor } = specOf(flyer.kind);
		flyer.ageMs += worldMs;
		flyer.vy += flyer.gravity * dt;
		flyer.x += flyer.vx * dt;
		flyer.y += flyer.vy * dt;
		if (bounceOffWalls(flyer, radius) && flyer.y > 0 && flyer.y < WORLD_HEIGHT) {
			events.push({ type: 'bounce', x: flyer.x, y: flyer.y, speed: Math.abs(flyer.vx) });
		}
		flyer.angle = orientation(flyer, state.timeMs);

		// Fully below the bottom edge on the way down: it got away
		const fell = flyer.vy > 0 && flyer.y - radius > WORLD_HEIGHT;
		if (!fell) {
			remaining.push(flyer);
		} else if (!isDecoy(flyer.kind) && !isPickup(flyer.kind)) {
			state.missed += 1;
			breakStreak(state);
			events.push({ type: 'missed', kind: flyer.kind, x: flyer.x, y: WORLD_HEIGHT, minor });
			if (!minor && !state.over) loseLife(state, events);
		}
	}
	state.flyers = remaining;
}

function halvesStep(state: SliceState, worldMs: number, dtMs: number, events: SliceEvent[]) {
	const dt = worldMs / 1000;
	for (const half of state.halves) {
		half.ageMs += dtMs;
		half.vy += half.gravity * dt;
		half.x += half.vx * dt;
		half.y += half.vy * dt;
		half.angle += half.spin * dt;
		bounceOffWalls(half, specOf(half.kind).radius * 0.6);
		// Skim off the water once before sinking
		if (!half.skimmed && half.vy > 60 && half.y > WORLD_HEIGHT - SEA_HEIGHT + 2) {
			half.skimmed = true;
			half.vy = -half.vy * SEA_SKIM_RESTITUTION;
			half.spin *= 0.5;
			events.push({ type: 'skim', x: half.x, y: WORLD_HEIGHT - SEA_HEIGHT + 2 });
		}
	}
	state.halves = state.halves.filter(
		(half) => half.ageMs < HALF_LIFE_MS && half.y < WORLD_HEIGHT + 80
	);
}

/** Closes a wave once its volleys are out and the sky is empty: bonus, then lull or victory */
function waveStep(state: SliceState, events: SliceEvent[]) {
	const spawner = state.spawner;
	if (spawner.volleysLeft > 0 || spawner.lullMs > 0 || state.flyers.length > 0) return;
	const flawless = state.waveFlawless;
	const bonus = WAVE_BONUS * spawner.wave + (flawless ? FLAWLESS_BONUS : 0);
	state.score += bonus;
	if (flawless) state.flawlessWaves += 1;
	events.push({ type: 'wave-clear', wave: spawner.wave, bonus, flawless });
	if (spawner.wave >= WAVE_COUNT) {
		state.won = true;
		state.over = true;
		events.push({ type: 'victory' });
		return;
	}
	spawner.lullMs = WAVE_LULL_MS;
}

/**
 * Brings a finished run back with one heart: score, counts and wave are kept, while every
 * flyer still in the air is cleared and the next volley waits at least as long as the first
 * one of a run, so the player is not hit again straight away.
 */
export function reviveGame(state: SliceState) {
	if (!state.over || state.won) return;
	state.over = false;
	state.lives = 1;
	state.flyers = [];
	clearTrail(state.trail);
	breakStreak(state);
	state.spawner.nextMs = Math.max(state.spawner.nextMs, FIRST_VOLLEY_MS);
}

export function stepGame(state: SliceState, random: Random, dtMs: number): SliceEvent[] {
	if (state.over) return [];
	const events: SliceEvent[] = [];
	state.timeMs += dtMs;

	const worldMs = dtMs * timeScale(state.focusMs);
	if (state.focusMs > 0) {
		state.focusMs = Math.max(0, state.focusMs - dtMs);
		if (state.focusMs === 0) events.push({ type: 'focus-end' });
	}

	const spawner = state.spawner;
	if (spawner.announce) {
		spawner.announce = false;
		state.waveFlawless = true;
		events.push({ type: 'wave-start', wave: spawner.wave });
	}
	if (spawner.lullMs > 0) {
		spawner.lullMs -= dtMs;
		if (spawner.lullMs <= 0) beginWave(spawner, spawner.wave + 1);
	} else {
		for (const launch of stepSpawner(spawner, random, worldMs, state.lives)) {
			const flyer = makeFlyer(state, launch);
			state.flyers.push(flyer);
			events.push({ type: 'launched', kind: flyer.kind, x: flyer.x });
		}
	}

	flyStep(state, worldMs, events);
	halvesStep(state, worldMs, dtMs, events);
	pruneTrail(state.trail, state.timeMs);
	if (!state.over) events.push(...sliceWithTrail(state));
	if (!state.over) waveStep(state, events);
	return events;
}

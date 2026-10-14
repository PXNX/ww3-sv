/*
 * Wandering Balloon rules as plain data and pure functions: createGame builds a seeded run, step
 * advances it by a fixed time step and returns the events that happened (for sounds and popups),
 * and setBurner is the single input. The balloon rises while the burner burns, sinks otherwise,
 * and the wind of the layer it floats in carries it along the track to the missile at the coast.
 */
import type { Random } from '#lib/game/random.js';
import {
	ACTIVATE_DISTANCE,
	BALLOON_RADIUS,
	BALLOON_X,
	CEILING_Y,
	CROW_BOB,
	CROW_SPEED,
	DISTANCE_PER_POINT,
	FINALE_MS,
	FLOOR_Y,
	FUEL_BURN_PER_SECOND,
	HEART_BONUS,
	INVULNERABLE_MS,
	JET_FIRST_MS,
	JET_GAP_END_MS,
	JET_GAP_START_MS,
	JET_HALF_HEIGHT,
	JET_HALF_LENGTH,
	JET_SPEED,
	JET_WARN_MS,
	KITE_SWAY,
	LAYER_COUNT,
	MAX_RISE,
	MAX_SINK,
	PHOTO_DWELL_MS,
	PHOTO_POINTS,
	PHOTO_RANGE,
	PUFF_RADIUS,
	PUFF_REFILL,
	RISE_ACCEL,
	SINK_ACCEL,
	STARTING_LIVES,
	TRACK_LENGTH,
	WORLD_WIDTH
} from './config.js';
import { generateCourse, type Course, type HazardKind, type PoiKind } from './course.js';
import { layerCentre, runFraction, windAt } from './wind.js';

export type BalloonPhase = 'fly' | 'finale' | 'over';

export interface Jet {
	layer: number;
	/** Time since the warning appeared */
	ageMs: number;
	/** Screen position of the jet's tail; it is parked off screen during the warning */
	x: number;
	/** Already hit the balloon, so it can only hurt once */
	spent: boolean;
}

export interface BalloonState {
	phase: BalloonPhase;
	/** Run seed: the wind patterns are derived from it */
	seed: number;
	timeMs: number;
	/** Position along the track (never below zero; a headwind pushes it back) */
	progress: number;
	/** Furthest position reached, the run's distance */
	distance: number;
	y: number;
	vy: number;
	/** Wind speed the balloon is drifting with right now */
	wind: number;
	burning: boolean;
	fuel: number;
	lives: number;
	invulnerableMs: number;
	photos: number;
	/** Points added at the east coast for the hearts left */
	finishBonus: number;
	score: number;
	course: Course;
	jets: Jet[];
	nextJetMs: number;
	/** Time since the missile launched, during the finale */
	finaleMs: number;
	finished: boolean;
}

export type BalloonEvent =
	| { type: 'hit'; kind: HazardKind | 'jet' }
	| { type: 'puff' }
	| { type: 'photo'; poi: PoiKind; points: number }
	| { type: 'jet-warning'; layer: number }
	| { type: 'finish' }
	| { type: 'popped'; bonus: number }
	| { type: 'game-over'; finished: boolean };

export function createGame(random: Random, seed = Math.floor(random() * 4294967296)): BalloonState {
	return {
		phase: 'fly',
		seed,
		timeMs: 0,
		progress: 0,
		distance: 0,
		y: layerCentre(2),
		vy: 0,
		wind: windAt(seed, 0, layerCentre(2)),
		burning: false,
		fuel: 1,
		lives: STARTING_LIVES,
		invulnerableMs: 0,
		photos: 0,
		finishBonus: 0,
		score: 0,
		course: generateCourse(random),
		jets: [],
		nextJetMs: JET_FIRST_MS,
		finaleMs: 0,
		finished: false
	};
}

/** The one input: hold the burner to rise, let go to sink */
export function setBurner(state: BalloonState, on: boolean) {
	state.burning = on && state.phase === 'fly';
}

/** Whether the burner is actually firing: it needs fuel */
export function isBurning(state: BalloonState): boolean {
	return state.burning && state.fuel > 0;
}

/** Score so far: distance, photos and the finish bonus */
export function scoreOf(state: BalloonState): number {
	return (
		Math.floor(state.distance / DISTANCE_PER_POINT) +
		state.photos * PHOTO_POINTS +
		state.finishBonus
	);
}

/** Where the missile is during the finale, as a screen position: it climbs in from the east coast */
export function missilePosition(state: BalloonState): { x: number; y: number } {
	const t = Math.min(1, state.finaleMs / FINALE_MS);
	return {
		x: WORLD_WIDTH + 30 + (BALLOON_X - WORLD_WIDTH - 30) * t,
		y: FLOOR_Y + 40 + (state.y - FLOOR_Y - 40) * t
	};
}

/** Screen column of something at a track position */
export function screenX(state: BalloonState, trackX: number): number {
	return trackX - state.progress + BALLOON_X;
}

function jetGap(progress: number): number {
	return JET_GAP_START_MS + (JET_GAP_END_MS - JET_GAP_START_MS) * runFraction(progress);
}

/** Screen position of a jet's tail: parked off screen during the warning, then flying west */
function jetX(ageMs: number): number {
	return WORLD_WIDTH + JET_HALF_LENGTH * 2 - Math.max(0, ageMs - JET_WARN_MS) * (JET_SPEED / 1000);
}

function overlaps(ax: number, ay: number, bx: number, by: number, radius: number): boolean {
	return (ax - bx) ** 2 + (ay - by) ** 2 <= radius * radius;
}

function hurt(state: BalloonState, kind: HazardKind | 'jet', events: BalloonEvent[]) {
	state.lives -= 1;
	state.invulnerableMs = INVULNERABLE_MS;
	events.push({ type: 'hit', kind });
	if (state.lives <= 0) {
		state.phase = 'over';
		state.burning = false;
		events.push({ type: 'game-over', finished: false });
	}
}

export function step(state: BalloonState, dtMs: number, random: Random): BalloonEvent[] {
	const events: BalloonEvent[] = [];
	if (state.phase === 'over') return events;
	const dt = dtMs / 1000;
	state.timeMs += dtMs;

	if (state.phase === 'finale') {
		stepFinale(state, dtMs, events);
		return events;
	}

	// Vertical flight: the burner lifts while there is fuel, gravity-like sinking otherwise
	const burning = isBurning(state);
	if (burning) state.fuel = Math.max(0, state.fuel - FUEL_BURN_PER_SECOND * dt);
	state.vy += (burning ? -RISE_ACCEL : SINK_ACCEL) * dt;
	state.vy = Math.min(MAX_SINK, Math.max(-MAX_RISE, state.vy));
	state.y += state.vy * dt;
	if (state.y < CEILING_Y) {
		state.y = CEILING_Y;
		state.vy = Math.max(0, state.vy);
	} else if (state.y > FLOOR_Y) {
		state.y = FLOOR_Y;
		state.vy = Math.min(0, state.vy);
	}

	// Horizontal flight: whatever the wind of this layer and this stretch of track does
	state.wind = windAt(state.seed, state.progress, state.y);
	state.progress = Math.max(0, state.progress + state.wind * dt);
	state.distance = Math.max(state.distance, Math.min(TRACK_LENGTH, state.progress));

	state.invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);
	stepHazards(state, dt, events);
	if (state.phase === 'fly') stepJets(state, dtMs, random, events);
	if (state.phase !== 'fly') {
		state.score = scoreOf(state);
		return events;
	}
	stepPuffs(state, events);
	stepPhotos(state, dtMs, events);

	if (state.progress >= TRACK_LENGTH) {
		state.phase = 'finale';
		state.finished = true;
		state.burning = false;
		state.progress = TRACK_LENGTH;
		state.finaleMs = 0;
		events.push({ type: 'finish' });
	}
	state.score = scoreOf(state);
	return events;
}

function stepHazards(state: BalloonState, dt: number, events: BalloonEvent[]) {
	const t = state.timeMs / 1000;
	for (const hazard of state.course.hazards) {
		if (!hazard.active) {
			if (hazard.x - state.progress > ACTIVATE_DISTANCE) continue;
			hazard.active = true;
		}
		if (hazard.kind === 'crow') {
			hazard.x -= CROW_SPEED * dt;
			hazard.y = hazard.baseY + Math.sin(t * 3 + hazard.phase) * CROW_BOB;
		} else if (hazard.kind === 'kite') {
			hazard.y = hazard.baseY + Math.sin(t * 1.4 + hazard.phase) * KITE_SWAY;
		}
		if (hazard.spent || state.invulnerableMs > 0) continue;
		const reach = hazard.radius + BALLOON_RADIUS * 0.85;
		if (overlaps(screenX(state, hazard.x), hazard.y, BALLOON_X, state.y, reach)) {
			hazard.spent = true;
			hurt(state, hazard.kind, events);
			if (state.phase !== 'fly') return;
		}
	}
}

function stepJets(state: BalloonState, dtMs: number, random: Random, events: BalloonEvent[]) {
	state.nextJetMs -= dtMs;
	if (state.nextJetMs <= 0) {
		const layer = Math.floor(random() * LAYER_COUNT);
		state.jets.push({ layer, ageMs: 0, x: jetX(0), spent: false });
		state.nextJetMs = jetGap(state.progress);
		events.push({ type: 'jet-warning', layer });
	}
	for (const jet of state.jets) {
		jet.ageMs += dtMs;
		jet.x = jetX(jet.ageMs);
		if (jet.spent || state.invulnerableMs > 0 || jet.ageMs < JET_WARN_MS) continue;
		const nearX =
			jet.x >= BALLOON_X - BALLOON_RADIUS &&
			jet.x - JET_HALF_LENGTH * 2 <= BALLOON_X + BALLOON_RADIUS;
		const nearY = Math.abs(layerCentre(jet.layer) - state.y) <= JET_HALF_HEIGHT + BALLOON_RADIUS;
		if (nearX && nearY) {
			jet.spent = true;
			hurt(state, 'jet', events);
			if (state.phase !== 'fly') return;
		}
	}
	state.jets = state.jets.filter((jet) => jet.x > -JET_HALF_LENGTH * 3);
}

function stepPuffs(state: BalloonState, events: BalloonEvent[]) {
	for (const puff of state.course.puffs) {
		if (puff.taken) continue;
		const reach = PUFF_RADIUS + BALLOON_RADIUS;
		if (overlaps(screenX(state, puff.x), puff.y, BALLOON_X, state.y, reach)) {
			puff.taken = true;
			state.fuel = Math.min(1, state.fuel + PUFF_REFILL);
			events.push({ type: 'puff' });
		}
	}
}

function stepPhotos(state: BalloonState, dtMs: number, events: BalloonEvent[]) {
	for (const poi of state.course.pois) {
		if (poi.photographed) continue;
		if (Math.abs(poi.x - state.progress) > PHOTO_RANGE) {
			poi.dwellMs = 0;
			continue;
		}
		poi.dwellMs += dtMs;
		if (poi.dwellMs >= PHOTO_DWELL_MS) {
			poi.photographed = true;
			state.photos += 1;
			events.push({ type: 'photo', poi: poi.kind, points: PHOTO_POINTS });
		}
	}
}

function stepFinale(state: BalloonState, dtMs: number, events: BalloonEvent[]) {
	state.finaleMs += dtMs;
	state.vy = 0;
	if (state.finaleMs < FINALE_MS) return;
	state.phase = 'over';
	state.finishBonus = state.lives * HEART_BONUS;
	state.score = scoreOf(state);
	events.push({ type: 'popped', bonus: state.finishBonus });
	events.push({ type: 'game-over', finished: true });
}

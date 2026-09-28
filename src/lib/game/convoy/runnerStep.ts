/*
 * Convoy Runner rules (requirements Section 4), stepped by a fixed time delta so the game
 * behaves identically on every device. All functions are pure: they return a new state.
 */
import type { Random } from '$lib/game/random';
import {
	BARREL_POINTS,
	DRONE_ARRIVE_END,
	DRONE_ARRIVE_START,
	ESCORT_BONUS_POINTS,
	ESCORT_INVULNERABLE_MS,
	FIRST_PATTERN_AT,
	GUNBOAT_DRIFT_END,
	GUNBOAT_DRIFT_START,
	INVULNERABLE_MS,
	ITEM_SIZE,
	LANE_CHANGE_MS,
	LANE_COUNT,
	MAX_HULL,
	MAX_NEAR_MISS_STREAK,
	MAX_SPEED,
	MULTIPLIER_STEP,
	NAUTICAL_MILES_PER_UNIT,
	NEAR_MISS_DISTANCE,
	PATTERN_GAP,
	POINTS_PER_UNIT,
	REDUCED_MOTION_RAMP_FACTOR,
	SLICK_SLIDE_MS,
	SLIDE_OVERSHOOT,
	SPAWN_AHEAD,
	SPEED_RAMP,
	START_SPEED,
	TANKER_HALF_LENGTH,
	TANKER_HALF_WIDTH,
	TANKER_OFFSET,
	isHazard,
	type ItemKind,
	type Lane
} from './constants';
import {
	mirrorPattern,
	patternLength,
	pickPattern,
	type ObstaclePattern
} from './obstaclePatterns';

export interface Obstacle {
	id: number;
	kind: ItemKind;
	/** Lane the obstacle appears in */
	lane: Lane;
	/** Lane it ends up in (differs only for drifting gunboats) */
	targetLane: Lane;
	/** Current sideways position, in lanes (0 is the center of the first lane) */
	x: number;
	/** Position along the strait, in world units */
	y: number;
	/** Oil slicks: the direction they push the tanker */
	push: -1 | 1;
	/** Already passed the tanker (and checked for a near miss) */
	passed: boolean;
}

export type RunnerEventType =
	'hit' | 'shield' | 'barrel' | 'escort' | 'escortBonus' | 'slick' | 'nearMiss' | 'sunk';

export interface RunnerEvent {
	type: RunnerEventType;
	/** Where it happened, in lanes and world units */
	x: number;
	y: number;
}

export interface RunnerState {
	elapsedMs: number;
	/** Distance travelled, in world units; also the tanker's position along the strait */
	distance: number;
	speed: number;
	/** Lane the tanker is in or sliding towards */
	lane: Lane;
	/** Current sideways position, in lanes */
	x: number;
	slideFrom: number;
	slideElapsedMs: number;
	slideDurationMs: number;
	/** Sliding on an oil slick: steering is locked until the slide ends */
	slipping: boolean;
	hull: number;
	invulnerableMs: number;
	escort: boolean;
	nearMissStreak: number;
	nearMisses: number;
	barrels: number;
	/** Unrounded score */
	points: number;
	obstacles: Obstacle[];
	/** Where the next pattern starts, in world units */
	nextSpawnAt: number;
	lastPatternId: string | null;
	nextId: number;
	over: boolean;
	/** What happened during the last step, for sounds and effects */
	events: RunnerEvent[];
}

export interface RunnerOptions {
	reducedMotion?: boolean;
}

export function createRunner(): RunnerState {
	return {
		elapsedMs: 0,
		distance: 0,
		speed: START_SPEED,
		lane: 1,
		x: 1,
		slideFrom: 1,
		slideElapsedMs: 0,
		slideDurationMs: LANE_CHANGE_MS,
		slipping: false,
		hull: MAX_HULL,
		invulnerableMs: 0,
		escort: false,
		nearMissStreak: 0,
		nearMisses: 0,
		barrels: 0,
		points: 0,
		obstacles: [],
		nextSpawnAt: FIRST_PATTERN_AT,
		lastPatternId: null,
		nextId: 1,
		over: false,
		events: []
	};
}

/** Scroll speed at a given distance; the ramp is gentler with reduced motion */
export function speedAt(distance: number, reducedMotion = false): number {
	const ramp = SPEED_RAMP * (reducedMotion ? REDUCED_MOTION_RAMP_FACTOR : 1);
	return Math.min(MAX_SPEED, START_SPEED + Math.max(0, distance) * ramp);
}

export function multiplierFor(streak: number): number {
	const capped = Math.min(Math.max(0, streak), MAX_NEAR_MISS_STREAK);
	return Math.round((1 + capped * MULTIPLIER_STEP) * 10) / 10;
}

/** Springy ease-out that overshoots slightly before settling (t from 0 to 1) */
export function springSlide(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	const u = t - 1;
	return 1 + (SLIDE_OVERSHOOT + 1) * u * u * u + SLIDE_OVERSHOOT * u * u;
}

function clampLane(lane: number): Lane {
	return Math.min(LANE_COUNT - 1, Math.max(0, lane)) as Lane;
}

/** Starts a lane change of one lane to the left (-1) or right (1) */
export function steer(state: RunnerState, direction: -1 | 1): RunnerState {
	if (state.over || state.slipping) return state;
	const lane = clampLane(state.lane + direction);
	if (lane === state.lane) return state;
	return {
		...state,
		lane,
		slideFrom: state.x,
		slideElapsedMs: 0,
		slideDurationMs: LANE_CHANGE_MS
	};
}

export function makeObstacle(
	id: number,
	kind: ItemKind,
	lane: Lane,
	y: number,
	{ targetLane = lane, push = 1 }: { targetLane?: Lane; push?: -1 | 1 } = {}
): Obstacle {
	return { id, kind, lane, targetLane, x: lane, y, push, passed: false };
}

/** Places a pattern starting at distance start; mutates the given draft state */
function spawnPattern(draft: RunnerState, source: ObstaclePattern, start: number, random: Random) {
	for (const item of source.items) {
		// Only one escort at a time; a second one becomes a barrel
		const kind = item.kind === 'escort' && draft.escort ? 'barrel' : item.kind;
		draft.obstacles.push(
			makeObstacle(draft.nextId++, kind, item.lane, start + item.at, {
				targetLane: item.driftTo,
				push: random() < 0.5 ? -1 : 1
			})
		);
	}
}

/** Fraction of a gunboat's sideways drift completed at a distance ahead of the tanker */
export function driftProgress(ahead: number): number {
	const t = (GUNBOAT_DRIFT_START - ahead) / (GUNBOAT_DRIFT_START - GUNBOAT_DRIFT_END);
	const clamped = Math.min(1, Math.max(0, t));
	return clamped * clamped * (3 - 2 * clamped);
}

/** How far a drone has arrived (0 still only a warning marker, 1 hovering on the water) */
export function droneArrival(ahead: number): number {
	const t = (DRONE_ARRIVE_START - ahead) / (DRONE_ARRIVE_START - DRONE_ARRIVE_END);
	return Math.min(1, Math.max(0, t));
}

function overlaps(state: RunnerState, obstacle: Obstacle): boolean {
	const size = ITEM_SIZE[obstacle.kind];
	return (
		Math.abs(obstacle.y - state.distance) < TANKER_HALF_LENGTH + size.halfLength &&
		Math.abs(obstacle.x - state.x) < TANKER_HALF_WIDTH + size.halfWidth
	);
}

/** Advances the run by dtMs milliseconds */
export function stepRunner(
	state: RunnerState,
	dtMs: number,
	random: Random,
	{ reducedMotion = false }: RunnerOptions = {}
): RunnerState {
	if (state.over) return state.events.length > 0 ? { ...state, events: [] } : state;

	const draft: RunnerState = {
		...state,
		obstacles: state.obstacles.map((obstacle) => ({ ...obstacle })),
		events: []
	};
	const event = (type: RunnerEventType, x: number, y: number) => draft.events.push({ type, x, y });

	// Scroll
	draft.elapsedMs += dtMs;
	draft.speed = speedAt(draft.distance, reducedMotion);
	const travelled = (draft.speed * dtMs) / 1000;
	draft.distance += travelled;

	// Lane slide
	draft.slideElapsedMs = Math.min(draft.slideDurationMs, draft.slideElapsedMs + dtMs);
	const progress = springSlide(draft.slideElapsedMs / draft.slideDurationMs);
	draft.x = draft.slideFrom + (draft.lane - draft.slideFrom) * progress;
	if (draft.slideElapsedMs >= draft.slideDurationMs) {
		draft.x = draft.lane;
		draft.slipping = false;
	}

	draft.invulnerableMs = Math.max(0, draft.invulnerableMs - dtMs);

	// Spawn patterns before they scroll into view
	while (draft.nextSpawnAt < draft.distance + SPAWN_AHEAD) {
		const picked = pickPattern(random, draft.nextSpawnAt, draft.lastPatternId);
		const placed = random() < 0.5 ? mirrorPattern(picked) : picked;
		spawnPattern(draft, placed, draft.nextSpawnAt, random);
		draft.lastPatternId = picked.id;
		draft.nextSpawnAt += patternLength(picked) + PATTERN_GAP;
	}

	// Gunboats drift sideways while approaching
	for (const obstacle of draft.obstacles) {
		if (obstacle.kind === 'gunboat' && obstacle.targetLane !== obstacle.lane) {
			const ahead = obstacle.y - draft.distance;
			obstacle.x = obstacle.lane + (obstacle.targetLane - obstacle.lane) * driftProgress(ahead);
		}
	}

	// Collisions, pickups and near misses
	let multiplier = multiplierFor(draft.nearMissStreak);
	const removed = new Set<number>();
	for (const obstacle of draft.obstacles) {
		if (obstacle.passed || removed.has(obstacle.id)) continue;

		if (overlaps(draft, obstacle)) {
			switch (obstacle.kind) {
				case 'barrel':
					draft.barrels++;
					draft.points += BARREL_POINTS * multiplier;
					event('barrel', obstacle.x, obstacle.y);
					removed.add(obstacle.id);
					break;
				case 'escort':
					if (draft.escort) {
						draft.points += ESCORT_BONUS_POINTS * multiplier;
						event('escortBonus', obstacle.x, obstacle.y);
					} else {
						draft.escort = true;
						event('escort', obstacle.x, obstacle.y);
					}
					removed.add(obstacle.id);
					break;
				case 'slick': {
					obstacle.passed = true;
					if (draft.slipping) break;
					const direction =
						draft.lane === 0 ? 1 : draft.lane === LANE_COUNT - 1 ? -1 : obstacle.push;
					draft.slideFrom = draft.x;
					draft.lane = clampLane(draft.lane + direction);
					draft.slideElapsedMs = 0;
					draft.slideDurationMs = SLICK_SLIDE_MS;
					draft.slipping = true;
					event('slick', obstacle.x, obstacle.y);
					break;
				}
				default:
					// A hazard: ignored while invulnerable, otherwise the escort or the hull takes it
					if (draft.invulnerableMs > 0) {
						obstacle.passed = true;
						break;
					}
					removed.add(obstacle.id);
					if (draft.escort) {
						draft.escort = false;
						draft.invulnerableMs = ESCORT_INVULNERABLE_MS;
						event('shield', obstacle.x, obstacle.y);
						break;
					}
					draft.hull--;
					draft.invulnerableMs = INVULNERABLE_MS;
					draft.nearMissStreak = 0;
					multiplier = 1;
					event('hit', obstacle.x, obstacle.y);
					if (draft.hull <= 0) {
						draft.hull = 0;
						draft.over = true;
						event('sunk', draft.x, draft.distance);
					}
			}
			continue;
		}

		const behind = draft.distance - obstacle.y;
		if (behind > TANKER_HALF_LENGTH + ITEM_SIZE[obstacle.kind].halfLength) {
			obstacle.passed = true;
			if (isHazard(obstacle.kind) && Math.abs(obstacle.x - draft.x) <= NEAR_MISS_DISTANCE) {
				draft.nearMissStreak++;
				draft.nearMisses++;
				multiplier = multiplierFor(draft.nearMissStreak);
				event('nearMiss', obstacle.x, obstacle.y);
			}
		}
	}

	draft.points += travelled * POINTS_PER_UNIT * multiplier;

	// Forget everything that has scrolled off the bottom of the field
	draft.obstacles = draft.obstacles.filter(
		(obstacle) => !removed.has(obstacle.id) && obstacle.y > draft.distance - TANKER_OFFSET - 1
	);
	return draft;
}

export function runnerScore(state: RunnerState): number {
	return Math.floor(state.points);
}

/** Distance in nautical miles */
export function runnerNauticalMiles(state: RunnerState): number {
	return state.distance * NAUTICAL_MILES_PER_UNIT;
}

/*
 * Grain Corridor rules, pure and seeded so they can be tested without a browser.
 * You captain a grain ship up the Black Sea corridor at night. The sea scrolls towards you,
 * mines and sea drones come down the channel, and crates of grain float by: collect them to
 * build a cargo chain, dodge everything else and keep three hearts. The channel narrows as the
 * run goes on, every kilometre is a port with a bonus, and repair buoys give a heart back.
 */
import type { Random } from '#lib/game/random.js';
import {
	BUOY_RADIUS,
	CHAIN_MS,
	CHAIN_STEP,
	CORRIDOR_MARGIN,
	CORRIDOR_SQUEEZE,
	CORRIDOR_SQUEEZE_PER_M,
	CRATE_RADIUS,
	DRONE_RADIUS,
	INVULN_MS,
	MAX_MULTIPLIER,
	MAX_SPEED,
	MILESTONE_M,
	MINE_RADIUS,
	NEAR_MISS,
	NUDGE_STEP,
	POINTS_BUOY,
	POINTS_CRATE,
	POINTS_MILESTONE,
	POINTS_NEAR,
	SHIP_RADIUS,
	SHIP_Y,
	SPAWN_MIN_MS,
	SPAWN_PER_M,
	SPAWN_START_MS,
	SPEED_PER_M,
	STARTING_LIVES,
	START_SPEED,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from './config.js';

export type HazardKind = 'mine' | 'drone';
export type EntityKind = HazardKind | 'crate' | 'buoy';

export interface Entity {
	id: number;
	kind: EntityKind;
	/** Centre of the weave; `x` follows it for drones */
	baseX: number;
	x: number;
	y: number;
	/** Where the entity was at the start of the step, for crossing tests */
	prevY: number;
	/** Downward speed, world units per second */
	vy: number;
	/** Horizontal weave amplitude around baseX, world units (0 for everything but drones) */
	weave: number;
	/** Weave phase offset in milliseconds */
	phase: number;
	/** A near miss has already been paid out */
	grazed: boolean;
}

export interface GrainState {
	timeMs: number;
	/** Metres sailed */
	distance: number;
	/** Current scroll speed, metres per second */
	speed: number;
	score: number;
	lives: number;
	shipX: number;
	targetX: number;
	invulnMs: number;
	/** Crates collected without a break */
	chain: number;
	chainMs: number;
	crates: number;
	bestChain: number;
	nearMisses: number;
	/** Distance of the next port */
	nextMilestone: number;
	entities: Entity[];
	spawnMs: number;
	nextId: number;
	over: boolean;
}

export type GrainEvent =
	| { type: 'crate'; x: number; y: number; points: number; multiplier: number }
	| { type: 'near-miss'; x: number; y: number; points: number }
	| { type: 'hit'; hazard: HazardKind; x: number; y: number; lives: number }
	| { type: 'buoy'; x: number; y: number; healed: boolean; points: number }
	| { type: 'milestone'; distance: number; points: number }
	| { type: 'game-over' };

/** 1 for a fresh chain, one more for every CHAIN_STEP crates, up to MAX_MULTIPLIER */
export function multiplier(chain: number): number {
	return Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, chain) / CHAIN_STEP));
}

/** Scroll speed at a given distance: starts relaxed and tightens, then stops at MAX_SPEED */
export function speedAt(distance: number): number {
	return Math.min(MAX_SPEED, START_SPEED + Math.max(0, distance) * SPEED_PER_M);
}

/** Milliseconds between spawns at a given distance */
export function spawnInterval(distance: number): number {
	return Math.max(SPAWN_MIN_MS, SPAWN_START_MS - Math.max(0, distance) * SPAWN_PER_M);
}

/** The safe channel at a given distance: the two walls close in over the run */
export function corridor(distance: number): { left: number; right: number } {
	const squeeze = Math.min(
		CORRIDOR_SQUEEZE,
		Math.max(0, distance) * CORRIDOR_SQUEEZE_PER_M
	);
	return {
		left: CORRIDOR_MARGIN + squeeze,
		right: WORLD_WIDTH - CORRIDOR_MARGIN - squeeze
	};
}

export function radiusOf(kind: EntityKind): number {
	switch (kind) {
		case 'mine':
			return MINE_RADIUS;
		case 'drone':
			return DRONE_RADIUS;
		case 'crate':
			return CRATE_RADIUS;
		case 'buoy':
			return BUOY_RADIUS;
	}
}

export function createGame(): GrainState {
	return {
		timeMs: 0,
		distance: 0,
		speed: START_SPEED,
		score: 0,
		lives: STARTING_LIVES,
		shipX: WORLD_WIDTH / 2,
		targetX: WORLD_WIDTH / 2,
		invulnMs: 0,
		chain: 0,
		chainMs: 0,
		crates: 0,
		bestChain: 0,
		nearMisses: 0,
		nextMilestone: MILESTONE_M,
		entities: [],
		spawnMs: 900,
		nextId: 1,
		over: false
	};
}

/** Keeps a ship position inside the channel, a hull's width from either wall */
export function clampShipX(state: GrainState, x: number): number {
	const { left, right } = corridor(state.distance);
	return Math.min(right - SHIP_RADIUS, Math.max(left + SHIP_RADIUS, x));
}

/** The player drags the ship towards a world x */
export function steerTo(state: GrainState, x: number) {
	if (state.over) return;
	state.targetX = clampShipX(state, x);
}

/** Keyboard steering: one nudge left or right from the current target */
export function nudge(state: GrainState, direction: number) {
	if (state.over) return;
	state.targetX = clampShipX(state, state.targetX + Math.sign(direction) * NUDGE_STEP);
}

function spawnX(state: GrainState, random: Random, radius: number): number {
	const { left, right } = corridor(state.distance);
	const margin = radius + 14;
	return left + margin + random() * Math.max(1, right - left - margin * 2);
}

function addEntity(state: GrainState, kind: EntityKind, x: number, y: number, random: Random) {
	const entity: Entity = {
		id: state.nextId++,
		kind,
		baseX: x,
		x,
		y,
		prevY: y,
		vy: state.speed,
		weave: 0,
		phase: 0,
		grazed: false
	};
	if (kind === 'mine') {
		entity.vy = state.speed * (0.95 + random() * 0.2);
	} else if (kind === 'drone') {
		entity.vy = state.speed * (1.15 + random() * 0.2);
		entity.weave = 38 + random() * 34;
		entity.phase = random() * 1000;
	} else if (kind === 'crate') {
		entity.vy = state.speed * 0.85;
	} else {
		entity.vy = state.speed * 0.9;
	}
	state.entities.push(entity);
	return entity;
}

/** One spawn event: a crate, a repair buoy, or one or two hazards with a gap between them */
function spawnWave(state: GrainState, random: Random) {
	const { left, right } = corridor(state.distance);
	const radius = MINE_RADIUS + 14;
	const buoyChance = state.lives < STARTING_LIVES ? 0.08 : 0.015;
	const roll = random();

	if (roll < buoyChance) {
		addEntity(state, 'buoy', spawnX(state, random, BUOY_RADIUS), -30, random);
		return;
	}
	if (roll < buoyChance + 0.3) {
		addEntity(state, 'crate', spawnX(state, random, CRATE_RADIUS), -30, random);
		return;
	}

	const kind: HazardKind =
		state.distance > 350 && random() < 0.32 ? 'drone' : 'mine';
	const first = spawnX(state, random, radius);
	addEntity(state, kind, first, -30, random);

	// Later in the run a second hazard joins, always leaving a passable gap
	const usable = right - left;
	if (state.distance > 450 && usable > 320 && random() < 0.32) {
		const gap = 140 + random() * 80;
		const direction = random() < 0.5 ? -1 : 1;
		const margin = radius + 12;
		let second = first + direction * gap;
		if (second < left + margin || second > right - margin) second = first - direction * gap;
		if (second >= left + margin && second <= right - margin) {
			addEntity(state, random() < 0.5 ? 'mine' : kind, second, -30, random);
		}
	}
}

/** Advances the game by dtMs */
export function step(state: GrainState, dtMs: number, random: Random): GrainEvent[] {
	if (state.over) return [];
	const events: GrainEvent[] = [];
	const dt = dtMs / 1000;

	state.timeMs += dtMs;
	state.speed = speedAt(state.distance);
	state.distance += state.speed * dt;
	state.score += state.speed * dt;
	state.invulnMs = Math.max(0, state.invulnMs - dtMs);

	if (state.chainMs > 0) {
		state.chainMs = Math.max(0, state.chainMs - dtMs);
		if (state.chainMs === 0) state.chain = 0;
	}

	// The ship eases towards where the player pointed it, never through a wall
	state.targetX = clampShipX(state, state.targetX);
	state.shipX += (state.targetX - state.shipX) * Math.min(1, dt * 14);
	state.shipX = clampShipX(state, state.shipX);

	state.spawnMs -= dtMs;
	if (state.spawnMs <= 0) {
		spawnWave(state, random);
		state.spawnMs += spawnInterval(state.distance) * (0.75 + random() * 0.5);
	}

	const gone = new Set<number>();
	for (const entity of state.entities) {
		entity.prevY = entity.y;
		entity.y += entity.vy * dt;
		if (entity.weave > 0) {
			entity.x = entity.baseX + Math.sin((state.timeMs + entity.phase) / 650) * entity.weave;
		}

		const dx = entity.x - state.shipX;
		const dy = entity.y - SHIP_Y;
		const touching = Math.hypot(dx, dy) <= radiusOf(entity.kind) + SHIP_RADIUS;

		if (touching) {
			if (entity.kind === 'crate') {
				state.crates += 1;
				state.chain += 1;
				state.chainMs = CHAIN_MS;
				state.bestChain = Math.max(state.bestChain, state.chain);
				const mult = multiplier(state.chain);
				const points = POINTS_CRATE * mult;
				state.score += points;
				events.push({ type: 'crate', x: entity.x, y: entity.y, points, multiplier: mult });
				gone.add(entity.id);
				continue;
			}
			if (entity.kind === 'buoy') {
				const healed = state.lives < STARTING_LIVES;
				if (healed) state.lives += 1;
				else state.score += POINTS_BUOY;
				events.push({
					type: 'buoy',
					x: entity.x,
					y: entity.y,
					healed,
					points: healed ? 0 : POINTS_BUOY
				});
				gone.add(entity.id);
				continue;
			}
			// A hit while still flashing does nothing; the hazard passes through
			if (state.invulnMs > 0) continue;

			state.lives -= 1;
			state.invulnMs = INVULN_MS;
			state.chain = 0;
			state.chainMs = 0;
			events.push({
				type: 'hit',
				hazard: entity.kind,
				x: entity.x,
				y: entity.y,
				lives: state.lives
			});
			gone.add(entity.id);
			if (state.lives <= 0) {
				state.over = true;
				events.push({ type: 'game-over' });
				break;
			}
			continue;
		}

		// A hazard that slips past the hull without touching it is worth a little nerve
		if ((entity.kind === 'mine' || entity.kind === 'drone') && !entity.grazed) {
			const crossed = entity.prevY < SHIP_Y && entity.y >= SHIP_Y;
			if (crossed && Math.abs(dx) < NEAR_MISS) {
				entity.grazed = true;
				state.nearMisses += 1;
				state.score += POINTS_NEAR;
				events.push({ type: 'near-miss', x: entity.x, y: SHIP_Y, points: POINTS_NEAR });
			}
		}

		if (entity.y > WORLD_HEIGHT + 50) gone.add(entity.id);
	}

	if (gone.size > 0) state.entities = state.entities.filter((entity) => !gone.has(entity.id));

	while (state.distance >= state.nextMilestone) {
		state.score += POINTS_MILESTONE;
		events.push({
			type: 'milestone',
			distance: state.nextMilestone,
			points: POINTS_MILESTONE
		});
		state.nextMilestone += MILESTONE_M;
	}

	return events;
}

/** Puts a hazard or pickup straight into the game, bypassing the spawner (tests and effects) */
export function addAt(
	state: GrainState,
	kind: EntityKind,
	x: number,
	y: number
): Entity {
	const entity: Entity = {
		id: state.nextId++,
		kind,
		baseX: x,
		x,
		y,
		prevY: y,
		vy: 0,
		weave: 0,
		phase: 0,
		grazed: false
	};
	state.entities.push(entity);
	return entity;
}

/** Integer score for display and the personal best */
export function finalScore(state: GrainState): number {
	return Math.max(0, Math.floor(state.score));
}

/*
 * Grain Corridor rules, pure and seeded so they can be tested without a browser.
 * You captain a grain ship up the Black Sea corridor at night. The sea scrolls towards you,
 * mines, sea drones and patrol boats come down the channel, and crates of grain float by:
 * collect them to build a cargo chain and fill the hold, dodge everything else and keep your
 * hearts. The channel narrows as the run goes on. Every leg (2 km) ends at a port that takes the
 * hold for a bonus and starts the next wave, with new threats. Repair buoys give a heart back,
 * and minesweeper charges clear the mines ahead of the hull when the lane gets too thick.
 */
import type { Random } from '#lib/game/random.js';
import {
	BUOY_RADIUS,
	CACHE_FROM_WAVE,
	CHAIN_MS,
	CHAIN_STEP,
	CORRIDOR_MARGIN,
	CORRIDOR_SQUEEZE,
	CORRIDOR_SQUEEZE_PER_M,
	CRATE_RADIUS,
	DEFAULT_SHIP,
	DRIFT_FROM_WAVE,
	DRONE_RADIUS,
	FIELD_FROM_WAVE,
	INVULN_MS,
	MAX_MULTIPLIER,
	MAX_SPEED,
	MAX_SWEEPERS,
	MILESTONE_M,
	MINE_RADIUS,
	NEAR_MISS,
	NUDGE_STEP,
	PATROL_FROM_WAVE,
	PATROL_RADIUS,
	PATROL_SPEED,
	PATROL_WARN_MS,
	POINTS_BUOY,
	POINTS_CRATE,
	POINTS_DELIVERY,
	POINTS_MILESTONE,
	POINTS_NEAR,
	POINTS_SWEEP,
	SHIPS,
	SHIP_Y,
	SPAWN_MIN_MS,
	SPAWN_PER_M,
	SPAWN_START_MS,
	SPEED_PER_M,
	STAR_PORTS,
	START_SPEED,
	SWEEPER_RADIUS,
	SWEEP_HALF_WIDTH,
	SWEEP_RANGE,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	type ShipId,
	type ShipSpec
} from './config.js';

export type HazardKind = 'mine' | 'drone' | 'patrol';
export type EntityKind = HazardKind | 'crate' | 'buoy' | 'sweeper';

/** What a wave adds to the sea, for the banner and the tutorial */
export type WaveThreat = 'mines' | 'drift' | 'patrol' | 'fields' | 'storm';

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
	/** Sideways speed: drifting mines and sweeping patrol boats, world units per second */
	vx: number;
	/** Horizontal weave amplitude around baseX, world units (0 for everything but drones) */
	weave: number;
	/** Weave phase offset in milliseconds */
	phase: number;
	/** A patrol boat is harmless and only points at its bank for this long before it sweeps in */
	warnMs: number;
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
	/** Hearts the ship started with, and the most a buoy restores */
	maxLives: number;
	shipId: ShipId;
	shipX: number;
	targetX: number;
	invulnMs: number;
	/** Crates collected without a break */
	chain: number;
	chainMs: number;
	crates: number;
	bestChain: number;
	nearMisses: number;
	/** Crates in the hold, waiting for the next port */
	hold: number;
	/** Crates delivered to ports over the run */
	delivered: number;
	/** Ports reached: one per finished leg */
	ports: number;
	/** Minesweeper charges in hand */
	sweepers: number;
	/** Sweeps used, and mines cleared by them */
	sweeps: number;
	swept: number;
	/** Distance of the next port */
	nextMilestone: number;
	entities: Entity[];
	spawnMs: number;
	nextId: number;
	over: boolean;
}

export type GrainEvent =
	| { type: 'crate'; x: number; y: number; points: number; multiplier: number; full: boolean }
	| { type: 'near-miss'; x: number; y: number; points: number }
	| { type: 'hit'; hazard: HazardKind; x: number; y: number; lives: number; spilled: number }
	| { type: 'buoy'; x: number; y: number; healed: boolean; points: number }
	| { type: 'escort'; x: number; y: number; sweepers: number; fromPort: boolean }
	| {
			type: 'sweep';
			x: number;
			y: number;
			cleared: { x: number; y: number }[];
			points: number;
	  }
	| { type: 'delivery'; crates: number; points: number }
	| { type: 'patrol-warning'; x: number; y: number; side: -1 | 1 }
	| { type: 'milestone'; distance: number; points: number; port: number }
	| { type: 'wave'; wave: number; threat: WaveThreat }
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

/** The wave (leg between ports) a distance belongs to, from 1 */
export function waveAt(distance: number): number {
	return 1 + Math.floor(Math.max(0, distance) / MILESTONE_M);
}

/** The newest threat a wave brings: waves keep every earlier threat and add one */
export function waveThreat(wave: number): WaveThreat {
	if (wave >= 5) return 'storm';
	if (wave >= FIELD_FROM_WAVE) return 'fields';
	if (wave >= PATROL_FROM_WAVE) return 'patrol';
	if (wave >= DRIFT_FROM_WAVE) return 'drift';
	return 'mines';
}

/** Stars for a finished run, by ports reached: 0 to 3 */
export function starsFor(ports: number): 0 | 1 | 2 | 3 {
	let stars = 0;
	for (const needed of STAR_PORTS) if (ports >= needed) stars++;
	return stars as 0 | 1 | 2 | 3;
}

/** The safe channel at a given distance: the two walls close in over the run */
export function corridor(distance: number): { left: number; right: number } {
	const squeeze = Math.min(CORRIDOR_SQUEEZE, Math.max(0, distance) * CORRIDOR_SQUEEZE_PER_M);
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
		case 'patrol':
			return PATROL_RADIUS;
		case 'sweeper':
			return SWEEPER_RADIUS;
	}
}

export function isHazard(kind: EntityKind): kind is HazardKind {
	return kind === 'mine' || kind === 'drone' || kind === 'patrol';
}

export function shipOf(state: GrainState): ShipSpec {
	return SHIPS[state.shipId];
}

export function createGame(shipId: ShipId = DEFAULT_SHIP): GrainState {
	const ship = SHIPS[shipId];
	return {
		timeMs: 0,
		distance: 0,
		speed: START_SPEED * ship.speedMul,
		score: 0,
		lives: ship.lives,
		maxLives: ship.lives,
		shipId,
		shipX: WORLD_WIDTH / 2,
		targetX: WORLD_WIDTH / 2,
		invulnMs: 0,
		chain: 0,
		chainMs: 0,
		crates: 0,
		bestChain: 0,
		nearMisses: 0,
		hold: 0,
		delivered: 0,
		ports: 0,
		sweepers: ship.sweepers,
		sweeps: 0,
		swept: 0,
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
	const radius = shipOf(state).radius;
	return Math.min(right - radius, Math.max(left + radius, x));
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

function blank(state: GrainState, kind: EntityKind, x: number, y: number): Entity {
	const entity: Entity = {
		id: state.nextId++,
		kind,
		baseX: x,
		x,
		y,
		prevY: y,
		vy: 0,
		vx: 0,
		weave: 0,
		phase: 0,
		warnMs: 0,
		grazed: false
	};
	state.entities.push(entity);
	return entity;
}

function addEntity(state: GrainState, kind: EntityKind, x: number, y: number, random: Random) {
	const entity = blank(state, kind, x, y);
	entity.vy = state.speed;
	if (kind === 'mine') {
		entity.vy = state.speed * (0.95 + random() * 0.2);
		// From the second wave some mines drift sideways with the current
		if (waveAt(state.distance) >= DRIFT_FROM_WAVE && random() < 0.4) {
			entity.vx = (random() < 0.5 ? -1 : 1) * (22 + random() * 28);
		}
	} else if (kind === 'drone') {
		entity.vy = state.speed * (1.15 + random() * 0.2);
		entity.weave = 38 + random() * 34;
		entity.phase = random() * 1000;
	} else if (kind === 'crate') {
		entity.vy = state.speed * 0.85;
	} else {
		entity.vy = state.speed * 0.9;
	}
	return entity;
}

/** A line of crates between two mines: grain for those who dare to hold a narrow lane */
function spawnCache(state: GrainState, random: Random) {
	const x = spawnX(state, random, 62 + 14);
	for (const dy of [0, 46, 92]) {
		const crate = blank(state, 'crate', x, -30 - dy);
		crate.vy = state.speed;
	}
	for (const side of [-1, 1]) {
		const mine = blank(state, 'mine', x + side * 62, -76);
		mine.vy = state.speed;
	}
}

/** A wall of mines across the channel with one gap, and a crate waiting in it */
function spawnField(state: GrainState, random: Random) {
	const { left, right } = corridor(state.distance);
	const margin = MINE_RADIUS + 14;
	const count = Math.max(4, Math.floor((right - left - margin * 2) / 84) + 1);
	const step = (right - left - margin * 2) / (count - 1);
	const gap = 1 + Math.floor(random() * (count - 2));
	for (let i = 0; i < count; i++) {
		const x = left + margin + i * step;
		if (i === gap) {
			const crate = blank(state, 'crate', x, -30);
			crate.vy = state.speed;
			continue;
		}
		const mine = blank(state, 'mine', x, -30);
		mine.vy = state.speed;
	}
}

/** A patrol boat that points at its bank, then sweeps across the channel */
function spawnPatrol(state: GrainState, random: Random): GrainEvent {
	const side: -1 | 1 = random() < 0.5 ? -1 : 1;
	const x = side < 0 ? -26 : WORLD_WIDTH + 26;
	const boat = blank(state, 'patrol', x, -30);
	boat.vy = state.speed * 0.8;
	boat.vx = -side * (PATROL_SPEED + state.speed * 0.3);
	boat.warnMs = PATROL_WARN_MS;
	return { type: 'patrol-warning', x, y: -30, side };
}

/** One spawn event: a crate, a pickup, a formation, or one or two hazards with a gap between them */
function spawnWave(state: GrainState, random: Random): GrainEvent[] {
	const { left, right } = corridor(state.distance);
	const radius = MINE_RADIUS + 14;
	const wave = waveAt(state.distance);
	const buoyChance = state.lives < state.maxLives ? 0.08 : 0.015;
	const roll = random();

	if (roll < buoyChance) {
		addEntity(state, 'buoy', spawnX(state, random, BUOY_RADIUS), -30, random);
		return [];
	}

	// Later waves mix in formations. Nothing here draws a random number in wave one.
	if (wave >= DRIFT_FROM_WAVE) {
		const extra = random();
		if (state.sweepers < MAX_SWEEPERS && extra < 0.025) {
			addEntity(state, 'sweeper', spawnX(state, random, SWEEPER_RADIUS), -30, random);
			return [];
		}
		if (wave >= CACHE_FROM_WAVE && extra < 0.095) {
			spawnCache(state, random);
			return [];
		}
		if (wave >= PATROL_FROM_WAVE && extra < 0.225) {
			return [spawnPatrol(state, random)];
		}
		if (wave >= FIELD_FROM_WAVE && extra < 0.315) {
			spawnField(state, random);
			return [];
		}
	}

	if (roll < buoyChance + 0.3) {
		addEntity(state, 'crate', spawnX(state, random, CRATE_RADIUS), -30, random);
		return [];
	}

	const kind: HazardKind = state.distance > 350 && random() < 0.32 ? 'drone' : 'mine';
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
	return [];
}

/**
 * Calls up a minesweeper: clears the mines in the lane ahead of the hull and pays for each.
 * Costs a charge only when there was something to clear, so a stray tap is free.
 */
export function sweep(state: GrainState): GrainEvent[] {
	if (state.over || state.sweepers <= 0) return [];
	const cleared = state.entities.filter(
		(entity) =>
			entity.kind === 'mine' &&
			entity.y >= SHIP_Y - SWEEP_RANGE &&
			entity.y <= SHIP_Y + 24 &&
			Math.abs(entity.x - state.shipX) <= SWEEP_HALF_WIDTH
	);
	if (cleared.length === 0) return [];
	const gone = new Set(cleared.map((entity) => entity.id));
	state.entities = state.entities.filter((entity) => !gone.has(entity.id));
	state.sweepers -= 1;
	state.sweeps += 1;
	state.swept += cleared.length;
	const points = cleared.length * POINTS_SWEEP;
	state.score += points;
	return [
		{
			type: 'sweep',
			x: state.shipX,
			y: SHIP_Y,
			cleared: cleared.map((entity) => ({ x: entity.x, y: entity.y })),
			points
		}
	];
}

/** Advances the game by dtMs */
export function step(state: GrainState, dtMs: number, random: Random): GrainEvent[] {
	if (state.over) return [];
	const events: GrainEvent[] = [];
	const dt = dtMs / 1000;
	const ship = shipOf(state);

	state.timeMs += dtMs;
	state.speed = speedAt(state.distance) * ship.speedMul;
	state.distance += state.speed * dt;
	state.score += state.speed * dt;
	state.invulnMs = Math.max(0, state.invulnMs - dtMs);

	if (state.chainMs > 0) {
		state.chainMs = Math.max(0, state.chainMs - dtMs);
		if (state.chainMs === 0) state.chain = 0;
	}

	// The ship eases towards where the player pointed it, never through a wall
	state.targetX = clampShipX(state, state.targetX);
	state.shipX += (state.targetX - state.shipX) * Math.min(1, dt * ship.steer);
	state.shipX = clampShipX(state, state.shipX);

	state.spawnMs -= dtMs;
	if (state.spawnMs <= 0) {
		events.push(...spawnWave(state, random));
		state.spawnMs += spawnInterval(state.distance) * (0.75 + random() * 0.5);
	}

	const { left, right } = corridor(state.distance);
	const gone = new Set<number>();
	for (const entity of state.entities) {
		entity.prevY = entity.y;
		entity.y += entity.vy * dt;
		if (entity.weave > 0) {
			entity.x = entity.baseX + Math.sin((state.timeMs + entity.phase) / 650) * entity.weave;
		}
		if (entity.kind === 'mine' && entity.vx !== 0) {
			// Drifting mines turn at the banks
			entity.x += entity.vx * dt;
			if (entity.x < left + MINE_RADIUS) entity.vx = Math.abs(entity.vx);
			if (entity.x > right - MINE_RADIUS) entity.vx = -Math.abs(entity.vx);
			entity.baseX = entity.x;
		}
		if (entity.kind === 'patrol') {
			if (entity.warnMs > 0) entity.warnMs = Math.max(0, entity.warnMs - dtMs);
			else entity.x += entity.vx * dt;
			if (entity.warnMs === 0 && (entity.x < -80 || entity.x > WORLD_WIDTH + 80)) {
				gone.add(entity.id);
				continue;
			}
		}
		// A patrol boat waiting at its bank is only a warning
		if (entity.warnMs > 0) continue;

		const dx = entity.x - state.shipX;
		const dy = entity.y - SHIP_Y;
		const touching = Math.hypot(dx, dy) <= radiusOf(entity.kind) + ship.radius;

		if (touching) {
			if (entity.kind === 'crate') {
				state.crates += 1;
				state.chain += 1;
				state.chainMs = CHAIN_MS;
				state.bestChain = Math.max(state.bestChain, state.chain);
				const full = state.hold >= ship.hold;
				if (!full) state.hold += 1;
				const mult = multiplier(state.chain);
				const points = POINTS_CRATE * mult;
				state.score += points;
				events.push({
					type: 'crate',
					x: entity.x,
					y: entity.y,
					points,
					multiplier: mult,
					full: full || state.hold >= ship.hold
				});
				gone.add(entity.id);
				continue;
			}
			if (entity.kind === 'buoy') {
				const healed = state.lives < state.maxLives;
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
			if (entity.kind === 'sweeper') {
				state.sweepers = Math.min(MAX_SWEEPERS, state.sweepers + 1);
				events.push({
					type: 'escort',
					x: entity.x,
					y: entity.y,
					sweepers: state.sweepers,
					fromPort: false
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
			// A hull breach spills half the hold into the sea
			const spilled = Math.ceil(state.hold / 2);
			state.hold -= spilled;
			events.push({
				type: 'hit',
				hazard: entity.kind,
				x: entity.x,
				y: entity.y,
				lives: state.lives,
				spilled
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
		if (isHazard(entity.kind) && !entity.grazed) {
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
		state.ports += 1;
		events.push({
			type: 'milestone',
			distance: state.nextMilestone,
			points: POINTS_MILESTONE,
			port: state.ports
		});
		// The port takes the hold, resupplies a minesweeper and the next wave starts
		if (state.hold > 0) {
			const points = Math.round(state.hold * POINTS_DELIVERY * ship.cargoMul);
			state.score += points;
			state.delivered += state.hold;
			events.push({ type: 'delivery', crates: state.hold, points });
			state.hold = 0;
		}
		if (state.sweepers < MAX_SWEEPERS) {
			state.sweepers += 1;
			events.push({
				type: 'escort',
				x: state.shipX,
				y: SHIP_Y,
				sweepers: state.sweepers,
				fromPort: true
			});
		}
		state.nextMilestone += MILESTONE_M;
		const wave = waveAt(state.nextMilestone - MILESTONE_M);
		events.push({ type: 'wave', wave, threat: waveThreat(wave) });
	}

	return events;
}

/** Puts a hazard or pickup straight into the game, bypassing the spawner (tests and effects) */
export function addAt(state: GrainState, kind: EntityKind, x: number, y: number): Entity {
	return blank(state, kind, x, y);
}

/** Integer score for display and the personal best */
export function finalScore(state: GrainState): number {
	return Math.max(0, Math.floor(state.score));
}

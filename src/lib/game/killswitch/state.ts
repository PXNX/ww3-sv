/*
 * Starlink Kill Switch rules, pure and seeded so they can be tested without a browser.
 * You are Elon at the big red console. Drones fly in from the left towards the refinery on the
 * right, and every one carries a Starlink link: tap a drone to cut it and it tumbles into the lake.
 * Delivery vans, tractors, buses, fishing boats and news helicopters carry links too: cutting one
 * costs a heart. Every cut drains link energy that slowly refills, so you cannot just spam taps.
 * Eight waves bring new drones (fast, swarms, hardened ones that need two cuts), a streak of clean
 * cuts raises the multiplier, cuts charge the geofence (drag a line, every drone that crosses it is
 * cut), and Elon's own posts flip the rules mid-wave: purge, rush, boost and unlimited plan.
 * Clear all waves to win, with up to three stars; lose all hearts and the refinery burns.
 */
import { pickOne, type Random } from '#lib/game/random.js';

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 420;
export const STARTING_LIVES = 3;
export const WAVE_COUNT = 8;

/** A drone that flies past this x hits the refinery */
export const REFINERY_X = 548;
export const SKY_TOP = 54;
export const SKY_BOTTOM = 240;
export const ROAD_Y = 316;
export const LAKE_Y = 352;
export const BOAT_Y = 394;

/** Cuts that fill the geofence */
export const FENCE_CHARGE = 6;
export const FENCE_MS = 6000;
export const FENCE_MIN_LENGTH = 70;

/** Link energy: every cut spends some, it refills on its own */
export const ENERGY_MAX = 100;
export const ENERGY_COST = 18;
export const ENERGY_REGEN_PER_SECOND = 26;
/** A tap this close to the centre (as a share of the target's size) is a precise cut */
export const PRECISE_RATIO = 0.35;

/** How long a civilian link stays offline after a purge before the vehicle crashes */
export const OFFLINE_MS = 2600;
export const STALLED_MS = 1300;
export const FIRST_POST_MS = 7000;
export const RUSH_MS = 7000;
export const BOOST_MS = 8000;
export const UNLIMITED_MS = 6000;
export const SHIELD_FLASH_MS = 320;
/** Pause before the first wave and between waves */
export const BREAK_MS = 2600;
export const FIRST_BREAK_MS = 1400;

export const POINTS_RESTORE = 30;
/** What a drone is worth when a purge cuts it for you */
export const POINTS_FREE = 5;
/** Extra points per multiplier step for a precise tap */
export const POINTS_PRECISE = 5;
export const MAX_MULTIPLIER = 5;

const GRAVITY = 520;

export type DroneKind = 'drone' | 'fast' | 'swarm' | 'hardened';
export type CivilianKind = 'van' | 'tractor' | 'bus' | 'boat' | 'heli';
export type TargetKind = DroneKind | CivilianKind;
export type PostKind = 'purge' | 'rush' | 'boost' | 'unlimited';
export type TargetState = 'flying' | 'falling' | 'offline' | 'stalled';

export const CIVILIAN_KINDS: readonly CivilianKind[] = ['van', 'tractor', 'bus', 'boat'];
const POSTS_EARLY: readonly PostKind[] = ['boost', 'unlimited'];
const POSTS_ALL: readonly PostKind[] = ['purge', 'rush', 'boost', 'unlimited'];

/** Units per second at the start; boats are the slowest */
const CIVILIAN_SPEED: Record<CivilianKind, number> = {
	van: 70,
	tractor: 42,
	bus: 56,
	boat: 36,
	heli: 58
};

interface DroneStats {
	/** Share of the wave's base speed */
	speed: number;
	/** Hit radius in world units, deliberately generous for fingers */
	radius: number;
	hp: number;
	points: number;
}

export const DRONE_STATS: Record<DroneKind, DroneStats> = {
	drone: { speed: 1, radius: 42, hp: 1, points: 10 },
	fast: { speed: 1.6, radius: 40, hp: 1, points: 15 },
	swarm: { speed: 0.95, radius: 34, hp: 1, points: 8 },
	hardened: { speed: 0.7, radius: 48, hp: 2, points: 25 }
};

/** Civilians are a little harder to hit than drones, so a rushed tap rarely hits the wrong one */
const CIVILIAN_RADIUS: Record<CivilianKind, number> = {
	van: 34,
	tractor: 34,
	bus: 36,
	boat: 34,
	heli: 36
};

/** The kind that shows up for the first time in a wave, announced with a hint */
export const INTRO_KINDS: Readonly<Record<number, TargetKind>> = {
	2: 'van',
	3: 'fast',
	4: 'swarm',
	5: 'heli',
	6: 'hardened'
};

export interface Target {
	id: number;
	civilian: boolean;
	kind: TargetKind;
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	/** Units per second */
	vx: number;
	vy: number;
	state: TargetState;
	/** Time spent in the current state */
	stateMs: number;
	/** Tumble angle of a falling drone */
	spin: number;
	/** Cuts it still takes: hardened drones need two */
	hp: number;
	/** Counts down after a hardened drone shrugged off a cut */
	flashMs: number;
}

export interface Fence {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	leftMs: number;
}

/** One thing a wave still has to send in, `atMs` after the wave started */
export interface Spawn {
	atMs: number;
	kind: TargetKind;
	/** Entry height for drones and helicopters */
	y: number;
	/** Height where a drone crosses the refinery line */
	aim: number;
	/** Vehicles: coming from the left */
	left: boolean;
}

export interface KillState {
	timeMs: number;
	targets: Target[];
	score: number;
	lives: number;
	streak: number;
	bestStreak: number;
	cuts: number;
	/** Cuts that went wrong: civilians cut or crashed */
	blunders: number;
	/** Taps, and how many of them found something */
	taps: number;
	tapHits: number;
	/** Precise cuts */
	perfects: number;
	/** Fence charge, 0 to FENCE_CHARGE */
	charge: number;
	fence: Fence | null;
	/** Link energy, 0 to ENERGY_MAX */
	energy: number;
	/** Wave number, 0 before the first one starts */
	wave: number;
	phase: 'break' | 'wave';
	/** Time left in a break */
	breakMs: number;
	/** Time since the wave started */
	waveMs: number;
	pending: Spawn[];
	/** Whether a heart went in the current wave */
	waveHeartLost: boolean;
	postMs: number;
	rushMs: number;
	boostMs: number;
	unlimitedMs: number;
	nextId: number;
	/** A purge costs at most one heart, however many vehicles it cuts off */
	purgeHeartLost: boolean;
	over: boolean;
	won: boolean;
}

export type KillEvent =
	| {
			type: 'cut';
			x: number;
			y: number;
			kind: DroneKind;
			points: number;
			multiplier: number;
			fenced: boolean;
			precise: boolean;
	  }
	| { type: 'shield'; x: number; y: number }
	| { type: 'combo'; x: number; y: number; multiplier: number }
	| { type: 'no-energy'; x: number; y: number }
	| { type: 'splash'; x: number }
	| { type: 'refinery-hit'; x: number; y: number }
	| { type: 'civilian-cut'; kind: CivilianKind; x: number; y: number }
	| { type: 'civilian-crash'; kind: CivilianKind; x: number; y: number }
	| { type: 'restored'; x: number; y: number; points: number }
	| { type: 'miss'; x: number; y: number }
	| { type: 'post'; kind: PostKind }
	| { type: 'wave-start'; wave: number; intro: TargetKind | null }
	| { type: 'wave-clear'; wave: number; bonus: number; flawless: boolean }
	| { type: 'victory' }
	| { type: 'fence-ready' }
	| { type: 'fence-placed' }
	| { type: 'fence-expired' }
	| { type: 'game-over' };

export function createGame(): KillState {
	return {
		timeMs: 0,
		targets: [],
		score: 0,
		lives: STARTING_LIVES,
		streak: 0,
		bestStreak: 0,
		cuts: 0,
		blunders: 0,
		taps: 0,
		tapHits: 0,
		perfects: 0,
		charge: 0,
		fence: null,
		energy: ENERGY_MAX,
		wave: 0,
		phase: 'break',
		breakMs: FIRST_BREAK_MS,
		waveMs: 0,
		pending: [],
		waveHeartLost: false,
		postMs: FIRST_POST_MS,
		rushMs: 0,
		boostMs: 0,
		unlimitedMs: 0,
		nextId: 1,
		purgeHeartLost: false,
		over: false,
		won: false
	};
}

/** 1 for a fresh streak, one more for every five clean cuts, up to MAX_MULTIPLIER */
export function multiplier(streak: number): number {
	return Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, streak) / 5));
}

/** Milliseconds between spawn groups in a wave: relaxed at first, tight at the end */
export function spawnInterval(wave: number): number {
	return Math.max(620, 1750 - wave * 125);
}

/** Units per second for a drone of the given kind in the given wave */
export function droneSpeed(wave: number, kind: DroneKind): number {
	return (72 + Math.min(8, Math.max(1, wave)) * 7) * DRONE_STATS[kind].speed;
}

/** How many threats (drones, counting every swarm member) a wave sends */
export function waveThreats(wave: number): number {
	return 6 + wave * 2;
}

export function isDroneKind(kind: TargetKind): kind is DroneKind {
	return kind in DRONE_STATS;
}

/** Hit radius of a target in world units, before any extra slack for touch */
export function targetRadius(target: Pick<Target, 'kind' | 'civilian'>): number {
	return target.civilian
		? CIVILIAN_RADIUS[target.kind as CivilianKind]
		: DRONE_STATS[target.kind as DroneKind].radius;
}

/** Which drone kinds may appear in a wave */
function droneKindsFor(wave: number): DroneKind[] {
	const kinds: DroneKind[] = ['drone', 'drone'];
	if (wave >= 3) kinds.push('fast');
	if (wave >= 4) kinds.push('swarm');
	if (wave >= 6) kinds.push('hardened');
	return kinds;
}

/** Plans a whole wave up front, so the pacing is a pure function of the wave number and the seed */
export function planWave(wave: number, random: Random): Spawn[] {
	const spawns: Spawn[] = [];
	const interval = spawnInterval(wave);
	const civilianChance = wave < 2 ? 0 : Math.min(0.3, 0.14 + wave * 0.02);
	const kinds = droneKindsFor(wave);
	const intro = INTRO_KINDS[wave] ?? null;
	let threats = 0;
	let at = 600;
	let index = 0;
	const goal = waveThreats(wave);
	while (threats < goal) {
		index += 1;
		const y = SKY_TOP + 10 + random() * (SKY_BOTTOM - SKY_TOP - 20);
		const aim = 150 + random() * 150;
		let kind: TargetKind;
		if (intro && index === 2) kind = intro;
		else if (random() < civilianChance) {
			const pool: CivilianKind[] =
				wave >= 5 ? [...CIVILIAN_KINDS, 'heli', 'heli'] : [...CIVILIAN_KINDS];
			kind = pickOne(random, pool);
		} else kind = pickOne(random, kinds);

		if (kind === 'swarm') {
			const size = Math.min(goal - threats, 4 + Math.floor(wave / 4));
			for (let i = 0; i < size; i++) {
				spawns.push({
					atMs: at + i * 170,
					kind,
					y: Math.min(SKY_BOTTOM, Math.max(SKY_TOP, y + (i - size / 2) * 18)),
					aim: aim + (i - size / 2) * 10,
					left: true
				});
			}
			threats += size;
			at += (size - 1) * 170;
		} else if (isDroneKind(kind)) {
			spawns.push({ atMs: at, kind, y, aim, left: true });
			threats += 1;
		} else {
			const lane =
				kind === 'heli' ? y : kind === 'boat' ? BOAT_Y : ROAD_Y + (random() < 0.5 ? 0 : 18);
			spawns.push({ atMs: at, kind, y: lane, aim: 0, left: random() < 0.5 });
		}
		at += interval * (0.8 + random() * 0.4);
	}
	return spawns.sort((a, b) => a.atMs - b.atMs);
}

function newTarget(state: KillState, spawn: Spawn): Target {
	const wave = Math.max(1, state.wave);
	let target: Target;
	if (isDroneKind(spawn.kind)) {
		const x = -30;
		const vx = droneSpeed(wave, spawn.kind);
		target = {
			id: state.nextId++,
			civilian: false,
			kind: spawn.kind,
			x,
			y: spawn.y,
			prevX: x,
			prevY: spawn.y,
			vx,
			vy: ((spawn.aim - spawn.y) / (REFINERY_X - x)) * vx,
			state: 'flying',
			stateMs: 0,
			spin: 0,
			hp: DRONE_STATS[spawn.kind].hp,
			flashMs: 0
		};
	} else {
		const speed = CIVILIAN_SPEED[spawn.kind as CivilianKind];
		const x = spawn.left ? -40 : WORLD_WIDTH + 40;
		target = {
			id: state.nextId++,
			civilian: true,
			kind: spawn.kind,
			x,
			y: spawn.y,
			prevX: x,
			prevY: spawn.y,
			vx: spawn.left ? speed : -speed,
			vy: 0,
			state: 'flying',
			stateMs: 0,
			spin: 0,
			hp: 1,
			flashMs: 0
		};
	}
	state.targets.push(target);
	return target;
}

function loseHeart(state: KillState, events: KillEvent[]) {
	if (state.over) return;
	state.lives -= 1;
	state.streak = 0;
	state.blunders += 1;
	state.waveHeartLost = true;
	if (state.lives <= 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

/** Sends a drone into the lake. `free` cuts (a purge) pay little and do not build the streak */
function cutDrone(
	state: KillState,
	target: Target,
	events: KillEvent[],
	how: { fenced?: boolean; free?: boolean; precise?: boolean } = {}
) {
	const kind = target.kind as DroneKind;
	target.state = 'falling';
	target.stateMs = 0;
	target.vx *= 0.4;
	target.vy = -90;
	state.cuts += 1;
	const precise = how.precise ?? false;
	let points = POINTS_FREE;
	let mult = 1;
	if (!how.free) {
		const before = multiplier(state.streak);
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		mult = multiplier(state.streak);
		const base = DRONE_STATS[kind].points * mult + (precise ? POINTS_PRECISE * mult : 0);
		points = base * (state.boostMs > 0 ? 2 : 1);
		if (state.charge < FENCE_CHARGE) {
			state.charge += 1;
			if (state.charge === FENCE_CHARGE) events.push({ type: 'fence-ready' });
		}
		state.score += points;
		events.push({
			type: 'cut',
			x: target.x,
			y: target.y,
			kind,
			points,
			multiplier: mult,
			fenced: how.fenced ?? false,
			precise
		});
		if (mult > before) events.push({ type: 'combo', x: target.x, y: target.y, multiplier: mult });
		return;
	}
	state.score += points;
	events.push({
		type: 'cut',
		x: target.x,
		y: target.y,
		kind,
		points,
		multiplier: mult,
		fenced: false,
		precise: false
	});
}

/** Whether segment a to b crosses segment c to d */
export function segmentsIntersect(
	a: { x: number; y: number },
	b: { x: number; y: number },
	c: { x: number; y: number },
	d: { x: number; y: number }
): boolean {
	const cross = (
		o: { x: number; y: number },
		p: { x: number; y: number },
		q: { x: number; y: number }
	) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * The player taps the playfield at world position (x, y). `slop` widens every hit radius, so a
 * finger (less exact than a mouse) can be given a little more room.
 */
export function tap(state: KillState, x: number, y: number, slop = 0): KillEvent[] {
	if (state.over) return [];
	state.taps += 1;
	const events: KillEvent[] = [];
	let best: Target | null = null;
	let bestRatio = Infinity;
	let bestDistance = 0;
	for (const target of state.targets) {
		if (target.state !== 'flying' && !(target.civilian && target.state === 'offline')) continue;
		const distance = Math.hypot(target.x - x, target.y - y);
		const radius = targetRadius(target) + slop;
		const ratio = distance / radius;
		if (ratio <= 1 && ratio < bestRatio) {
			best = target;
			bestRatio = ratio;
			bestDistance = distance;
		}
	}
	if (!best) return [{ type: 'miss', x, y }];
	state.tapHits += 1;

	if (best.state === 'offline') {
		best.state = 'flying';
		best.stateMs = 0;
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		const points = POINTS_RESTORE * multiplier(state.streak);
		state.score += points;
		events.push({ type: 'restored', x: best.x, y: best.y, points });
		return events;
	}

	// Cutting a link takes energy; with none to spare nothing happens, so no civilian is at risk
	const free = state.unlimitedMs > 0;
	if (!free && state.energy < ENERGY_COST) {
		return [{ type: 'no-energy', x: best.x, y: best.y }];
	}
	if (!free) state.energy -= ENERGY_COST;

	if (best.civilian) {
		best.state = 'stalled';
		best.stateMs = 0;
		best.vx = 0;
		best.vy = 0;
		events.push({ type: 'civilian-cut', kind: best.kind as CivilianKind, x: best.x, y: best.y });
		loseHeart(state, events);
		return events;
	}

	if (best.hp > 1) {
		best.hp -= 1;
		best.flashMs = SHIELD_FLASH_MS;
		events.push({ type: 'shield', x: best.x, y: best.y });
		return events;
	}
	const precise = bestDistance <= targetRadius(best) * PRECISE_RATIO;
	if (precise) {
		state.perfects += 1;
		state.energy = Math.min(ENERGY_MAX, state.energy + ENERGY_COST / 2);
	}
	cutDrone(state, best, events, { precise });
	return events;
}

/** Drops a geofence line; every drone that crosses it while it stands is cut. Empty when refused */
export function placeFence(
	state: KillState,
	x1: number,
	y1: number,
	x2: number,
	y2: number
): KillEvent[] {
	if (state.over || state.fence || state.charge < FENCE_CHARGE) return [];
	if (Math.hypot(x2 - x1, y2 - y1) < FENCE_MIN_LENGTH) return [];
	state.fence = { x1, y1, x2, y2, leftMs: FENCE_MS };
	state.charge = 0;
	return [{ type: 'fence-placed' }];
}

/** Which posts Elon may send in a wave: the early waves only ever hand out gifts */
export function availablePosts(wave: number): readonly PostKind[] {
	return wave < 3 ? POSTS_EARLY : POSTS_ALL;
}

function applyPost(state: KillState, kind: PostKind, events: KillEvent[], random: Random) {
	events.push({ type: 'post', kind });
	if (kind === 'rush') {
		state.rushMs = RUSH_MS;
		// A burst of civilians floods in on top of the wave
		for (let i = 0; i < 6; i++) {
			const pick = pickOne(random, wavePool(state.wave));
			const lane =
				pick === 'heli'
					? SKY_TOP + 20 + random() * 120
					: pick === 'boat'
						? BOAT_Y
						: ROAD_Y + (i % 2) * 18;
			state.pending.push({
				atMs: state.waveMs + 500 + i * 520,
				kind: pick,
				y: lane,
				aim: 0,
				left: random() < 0.5
			});
		}
		state.pending.sort((a, b) => a.atMs - b.atMs);
	} else if (kind === 'boost') state.boostMs = BOOST_MS;
	else if (kind === 'unlimited') {
		state.unlimitedMs = UNLIMITED_MS;
		state.energy = ENERGY_MAX;
	} else {
		// "Feature, not a bug": every link on screen goes down, the vehicles' ones need turning back on
		state.purgeHeartLost = false;
		for (const target of state.targets) {
			if (target.state !== 'flying') continue;
			if (target.civilian) {
				target.state = 'offline';
				target.stateMs = 0;
			} else {
				cutDrone(state, target, events, { free: true });
			}
		}
	}
}

function wavePool(wave: number): CivilianKind[] {
	return wave >= 5 ? [...CIVILIAN_KINDS, 'heli'] : [...CIVILIAN_KINDS];
}

/** The wave is over when everything is sent and no drone is still on its way */
function waveFinished(state: KillState): boolean {
	return (
		state.pending.length === 0 &&
		!state.targets.some((target) => !target.civilian && target.state === 'flying')
	);
}

function endWave(state: KillState, events: KillEvent[]) {
	const flawless = !state.waveHeartLost;
	const bonus = state.wave * 50 + (flawless ? 100 : 0);
	state.score += bonus;
	events.push({ type: 'wave-clear', wave: state.wave, bonus, flawless });
	if (state.wave >= WAVE_COUNT) {
		state.over = true;
		state.won = true;
		events.push({ type: 'victory' });
		return;
	}
	state.phase = 'break';
	state.breakMs = BREAK_MS;
}

/** Stars for a finished run: none unless every wave is cleared, then fewer for every heart lost */
export function starsFor(state: Pick<KillState, 'won' | 'lives'>): number {
	if (!state.won) return 0;
	if (state.lives >= STARTING_LIVES) return 3;
	return state.lives >= STARTING_LIVES - 1 ? 2 : 1;
}

/** Share of taps that found a target, 0 to 1 */
export function accuracy(state: Pick<KillState, 'taps' | 'tapHits'>): number {
	return state.taps === 0 ? 1 : state.tapHits / state.taps;
}

/** Advances the game by dtMs */
export function step(state: KillState, dtMs: number, random: Random): KillEvent[] {
	if (state.over) return [];
	const events: KillEvent[] = [];
	const dt = dtMs / 1000;
	state.timeMs += dtMs;
	state.rushMs = Math.max(0, state.rushMs - dtMs);
	state.boostMs = Math.max(0, state.boostMs - dtMs);
	state.unlimitedMs = Math.max(0, state.unlimitedMs - dtMs);
	state.energy = Math.min(ENERGY_MAX, state.energy + ENERGY_REGEN_PER_SECOND * dt);

	if (state.fence) {
		state.fence.leftMs -= dtMs;
		if (state.fence.leftMs <= 0) {
			state.fence = null;
			events.push({ type: 'fence-expired' });
		}
	}

	if (state.phase === 'break') {
		state.breakMs -= dtMs;
		if (state.breakMs <= 0) {
			state.wave += 1;
			state.phase = 'wave';
			state.waveMs = 0;
			state.waveHeartLost = false;
			state.pending = planWave(state.wave, random);
			events.push({ type: 'wave-start', wave: state.wave, intro: INTRO_KINDS[state.wave] ?? null });
		}
	} else {
		state.waveMs += dtMs;
		while (state.pending.length > 0 && state.pending[0].atMs <= state.waveMs) {
			newTarget(state, state.pending.shift()!);
		}
		// Posts start with the second wave
		if (state.wave >= 2) state.postMs -= dtMs;
		if (state.postMs <= 0) {
			applyPost(state, pickOne(random, availablePosts(state.wave)), events, random);
			state.postMs = Math.max(8000, 14000 - state.wave * 500);
		}
	}

	const gone = new Set<number>();
	for (const target of state.targets) {
		target.prevX = target.x;
		target.prevY = target.y;
		target.stateMs += dtMs;
		target.flashMs = Math.max(0, target.flashMs - dtMs);
		switch (target.state) {
			case 'flying':
			case 'offline':
				target.x += target.vx * dt;
				target.y += target.vy * dt;
				break;
			case 'falling':
				target.vy += GRAVITY * dt;
				target.x += target.vx * dt;
				target.y += target.vy * dt;
				target.spin += 6 * dt;
				break;
			case 'stalled':
				break;
		}

		if (target.state === 'falling') {
			if (target.y >= LAKE_Y) {
				events.push({ type: 'splash', x: target.x });
				gone.add(target.id);
			}
		} else if (target.state === 'stalled') {
			if (target.stateMs >= STALLED_MS) gone.add(target.id);
		} else if (target.civilian) {
			if (target.state === 'offline' && target.stateMs >= OFFLINE_MS) {
				events.push({
					type: 'civilian-crash',
					kind: target.kind as CivilianKind,
					x: target.x,
					y: target.y
				});
				if (!state.purgeHeartLost) {
					state.purgeHeartLost = true;
					loseHeart(state, events);
				}
				gone.add(target.id);
			} else if (target.x > WORLD_WIDTH + 60 || target.x < -60) {
				gone.add(target.id);
			}
		} else {
			const fence = state.fence;
			if (
				fence &&
				segmentsIntersect(
					{ x: target.prevX, y: target.prevY },
					{ x: target.x, y: target.y },
					{ x: fence.x1, y: fence.y1 },
					{ x: fence.x2, y: fence.y2 }
				)
			) {
				cutDrone(state, target, events, { fenced: true });
			} else if (target.x >= REFINERY_X) {
				events.push({ type: 'refinery-hit', x: target.x, y: target.y });
				loseHeart(state, events);
				gone.add(target.id);
			}
		}
	}
	if (gone.size > 0) state.targets = state.targets.filter((target) => !gone.has(target.id));

	if (!state.over && state.phase === 'wave' && waveFinished(state)) endWave(state, events);
	return events;
}

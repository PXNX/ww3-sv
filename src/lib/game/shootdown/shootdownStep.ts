/*
 * Fixed-timestep rules for Shahed Shootdown (requirements Section 6): formation movement with edge
 * reversal, step-down and speed-up, kamikaze dives with a warning, the one-missile-in-flight rule,
 * collisions, sandbag bunkers, lives, the blimp bonus target, scoring and wave progression.
 *
 * stepGame only changes the state object it is given and draws every random decision from the
 * Random it is passed, so a seeded Random makes a whole game reproducible in tests.
 */
import { pickOne, type Random } from '$lib/game/random';
import { waveDefinition, type WaveDefinition } from './waves';

// World units: the playfield is always drawn into this portrait rectangle, then scaled to fit
export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 600;
/** Top edge of the mustard ground band */
export const GROUND_Y = 540;

export const LAUNCHER_WIDTH = 60;
export const LAUNCHER_HEIGHT = 34;
export const LAUNCHER_TOP = GROUND_Y - 14;
/** Speed when steering with keys or the side zones, in world units per second */
export const LAUNCHER_SPEED = 230;
/** Faster follow speed when dragging, so the launcher keeps up with a finger */
export const LAUNCHER_DRAG_SPEED = 420;

export const MISSILE_WIDTH = 6;
export const MISSILE_HEIGHT = 16;
export const MISSILE_SPEED = 560;
export const MISSILE_RELOAD_MS = 250;
/** Classic rule: only one missile in flight at a time */
export const MAX_MISSILES_IN_FLIGHT = 1;

export const DRONE_WIDTH = 26;
export const DRONE_HEIGHT = 20;
export const CELL_WIDTH = 34;
export const CELL_HEIGHT = 28;
export const FORMATION_TOP = 76;
export const EDGE_MARGIN = 6;
/** With one drone left the formation moves this many times faster than at full strength */
export const FORMATION_SPEED_UP = 3;

export const BOSS_WIDTH = 76;
export const BOSS_HEIGHT = 46;
export const BOSS_TOP = 58;
/** On boss waves the escort formation starts below the Mega-Shahed */
export const BOSS_ESCORT_TOP = BOSS_TOP + BOSS_HEIGHT + 16;

export const BUNKER_COUNT = 3;
export const BUNKER_COLUMNS = 8;
export const BUNKER_ROWS = 3;
export const SANDBAG_WIDTH = 8;
export const SANDBAG_HEIGHT = 7;
export const SANDBAG_HIT_POINTS = 2;
export const BUNKER_TOP = 450;
export const BUNKER_WIDTH = BUNKER_COLUMNS * SANDBAG_WIDTH;
export const BUNKER_HEIGHT = BUNKER_ROWS * SANDBAG_HEIGHT;
/** Sandbags within this distance of a crashing drone are destroyed */
export const CRASH_RADIUS = 12;

export const BLIMP_WIDTH = 64;
export const BLIMP_HEIGHT = 26;
export const BLIMP_TOP = 22;
export const BLIMP_SPEED = 55;
export const BLIMP_INTERVAL_MS = [14_000, 22_000] as const;
export const BLIMP_FIRST_DELAY_MS = 9_000;
export const BLIMP_POINTS = [100, 150, 300] as const;

export const STARTING_LIVES = 3;
export const DIVE_WARNING_MS = 800;
/** After losing a life, further dive hits are ignored for this long */
export const INVULNERABLE_MS = 1600;
export const INTERMISSION_MS = 1800;
/** How long the commander stays worried after a life is lost */
export const WORRIED_MS = 1500;
/** Drones whose bottom edge is below this line make the commander worried */
export const DANGER_Y = BUNKER_TOP - 30;

export const DIVE_BONUS = 50;
export const BOSS_HIT_POINTS_SCORE = 10;
export const BOSS_DESTROYED_SCORE = 500;

export interface FormationDrone {
	id: number;
	column: number;
	row: number;
	alive: boolean;
	/** Counts down while the drone flashes before breaking formation; 0 when not warning */
	warningMs: number;
	/** Where the dive will aim: the launcher position when the warning started */
	targetX: number;
}

export interface Formation {
	/** Top-left corner of column 0, row 0 */
	x: number;
	y: number;
	startY: number;
	direction: 1 | -1;
	columns: number;
	rows: number;
	baseSpeed: number;
	stepDown: number;
	/** Drones the formation started the wave with, for the speed-up */
	total: number;
	drones: FormationDrone[];
}

export interface Diver {
	id: number;
	/** Center */
	x: number;
	y: number;
	vx: number;
	vy: number;
	row: number;
}

export interface Boss {
	/** Top-left corner */
	x: number;
	y: number;
	direction: 1 | -1;
	hitPoints: number;
	maxHitPoints: number;
	speed: number;
	stepDown: number;
}

export interface Missile {
	/** Center of the missile */
	x: number;
	/** Top of the missile */
	y: number;
}

export interface Bunker {
	/** Top-left corner */
	x: number;
	y: number;
	/** Remaining hit points per sandbag, row by row */
	sandbags: number[];
}

export interface Blimp {
	/** Left edge */
	x: number;
	direction: 1 | -1;
}

export type Phase = 'playing' | 'intermission' | 'over';

export interface ShootdownState {
	phase: Phase;
	wave: number;
	definition: WaveDefinition;
	score: number;
	lives: number;
	/** Consecutive hits without a miss */
	combo: number;
	/** Horizontal center of the launcher */
	launcherX: number;
	missiles: Missile[];
	reloadMs: number;
	formation: Formation;
	divers: Diver[];
	boss: Boss | null;
	bunkers: Bunker[];
	blimp: Blimp | null;
	blimpTimerMs: number;
	diveTimerMs: number;
	invulnerableMs: number;
	intermissionMs: number;
	sinceLifeLostMs: number;
	nextId: number;
}

export interface ShootdownInput {
	/** Key or side-zone steering: -1 left, 1 right, 0 none */
	move: -1 | 0 | 1;
	/** Drag target in world units, or null when not dragging */
	targetX: number | null;
	/** Fire whenever allowed during this step */
	fire: boolean;
}

export const NO_INPUT: ShootdownInput = { move: 0, targetX: null, fire: false };

export type LifeLossReason = 'dive-hit' | 'ground-reached';

export type ShootdownEvent =
	| { type: 'fire'; x: number; y: number }
	| { type: 'drone-destroyed'; x: number; y: number; points: number; diving: boolean }
	| { type: 'boss-hit'; x: number; y: number; points: number; hitPoints: number }
	| { type: 'boss-destroyed'; x: number; y: number; points: number }
	| { type: 'blimp-hit'; x: number; y: number; points: number }
	| { type: 'bunker-hit'; x: number; y: number }
	| { type: 'miss' }
	| { type: 'dive-warning'; id: number; targetX: number }
	| { type: 'diver-crashed'; x: number; y: number }
	| { type: 'life-lost'; reason: LifeLossReason; lives: number }
	| { type: 'wave-cleared'; wave: number; bonus: number }
	| { type: 'wave-started'; wave: number; boss: boolean }
	| { type: 'game-over' };

interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

const overlaps = (a: Rect, b: Rect) =>
	a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function randomBetween(random: Random, [min, max]: readonly [number, number]): number {
	return min + random() * (max - min);
}

// --- Scoring -------------------------------------------------------------------------------

/** Top rows are worth more, as in the classic */
export function dronePoints(row: number, rows: number, diving: boolean): number {
	const base = row === 0 ? 30 : row < rows / 2 ? 20 : 10;
	return diving ? base + DIVE_BONUS : base;
}

/** Extra points for the nth consecutive hit (the first hit of a combo earns nothing extra) */
export function comboBonus(combo: number): number {
	return Math.min(Math.max(combo - 1, 0), 10) * 5;
}

export function waveClearBonus(wave: number, lives: number): number {
	return 100 * wave + 25 * lives;
}

// --- Setup ---------------------------------------------------------------------------------

export function createBunkers(): Bunker[] {
	return Array.from({ length: BUNKER_COUNT }, (_, index) => ({
		x: Math.round((WORLD_WIDTH * (index + 1)) / (BUNKER_COUNT + 1) - BUNKER_WIDTH / 2),
		y: BUNKER_TOP,
		sandbags: Array.from({ length: BUNKER_COLUMNS * BUNKER_ROWS }, () => SANDBAG_HIT_POINTS)
	}));
}

export function createFormation(definition: WaveDefinition, firstId = 1): Formation {
	const { columns, rows } = definition;
	const width = (columns - 1) * CELL_WIDTH + DRONE_WIDTH;
	const startY = definition.boss ? BOSS_ESCORT_TOP : FORMATION_TOP;
	const drones: FormationDrone[] = [];
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			drones.push({
				id: firstId + drones.length,
				column,
				row,
				alive: true,
				warningMs: 0,
				targetX: 0
			});
		}
	}
	return {
		x: (WORLD_WIDTH - width) / 2,
		y: startY,
		startY,
		direction: 1,
		columns,
		rows,
		baseSpeed: definition.baseSpeed,
		stepDown: definition.stepDown,
		total: drones.length,
		drones
	};
}

function createBoss(definition: WaveDefinition): Boss | null {
	if (!definition.boss) return null;
	return {
		x: (WORLD_WIDTH - BOSS_WIDTH) / 2,
		y: BOSS_TOP,
		direction: -1,
		hitPoints: definition.boss.hitPoints,
		maxHitPoints: definition.boss.hitPoints,
		speed: definition.boss.speed,
		stepDown: definition.boss.stepDown
	};
}

/** Sets up the given wave: a fresh formation, the boss on boss waves, and restocked bunkers */
export function startWave(state: ShootdownState, wave: number, events: ShootdownEvent[] = []) {
	const definition = waveDefinition(wave);
	state.phase = 'playing';
	state.wave = definition.wave;
	state.definition = definition;
	state.formation = createFormation(definition, state.nextId);
	state.nextId += state.formation.total;
	state.boss = createBoss(definition);
	state.divers = [];
	state.bunkers = createBunkers();
	// Give the player a moment before the first dive of the wave
	state.diveTimerMs = definition.diveIntervalMs[1];
	events.push({ type: 'wave-started', wave: definition.wave, boss: state.boss !== null });
}

export function createGame(wave = 1): ShootdownState {
	const definition = waveDefinition(wave);
	const state: ShootdownState = {
		phase: 'playing',
		wave: definition.wave,
		definition,
		score: 0,
		lives: STARTING_LIVES,
		combo: 0,
		launcherX: WORLD_WIDTH / 2,
		missiles: [],
		reloadMs: 0,
		formation: createFormation(definition),
		divers: [],
		boss: null,
		bunkers: [],
		blimp: null,
		blimpTimerMs: BLIMP_FIRST_DELAY_MS,
		diveTimerMs: 0,
		invulnerableMs: 0,
		intermissionMs: 0,
		sinceLifeLostMs: Number.POSITIVE_INFINITY,
		nextId: 1
	};
	startWave(state, definition.wave);
	return state;
}

// --- Geometry ------------------------------------------------------------------------------

export function droneRect(formation: Formation, drone: FormationDrone): Rect {
	const left = formation.x + drone.column * CELL_WIDTH;
	const top = formation.y + drone.row * CELL_HEIGHT;
	return { left, top, right: left + DRONE_WIDTH, bottom: top + DRONE_HEIGHT };
}

function diverRect(diver: Diver): Rect {
	return {
		left: diver.x - DRONE_WIDTH / 2,
		top: diver.y - DRONE_HEIGHT / 2,
		right: diver.x + DRONE_WIDTH / 2,
		bottom: diver.y + DRONE_HEIGHT / 2
	};
}

function bossRect(boss: Boss): Rect {
	return { left: boss.x, top: boss.y, right: boss.x + BOSS_WIDTH, bottom: boss.y + BOSS_HEIGHT };
}

export function launcherRect(launcherX: number): Rect {
	return {
		left: launcherX - LAUNCHER_WIDTH / 2,
		top: LAUNCHER_TOP,
		right: launcherX + LAUNCHER_WIDTH / 2,
		bottom: LAUNCHER_TOP + LAUNCHER_HEIGHT
	};
}

function blimpRect(blimp: Blimp): Rect {
	return {
		left: blimp.x,
		top: BLIMP_TOP,
		right: blimp.x + BLIMP_WIDTH,
		bottom: BLIMP_TOP + BLIMP_HEIGHT
	};
}

function sandbagRect(bunker: Bunker, index: number): Rect {
	const left = bunker.x + (index % BUNKER_COLUMNS) * SANDBAG_WIDTH;
	const top = bunker.y + Math.floor(index / BUNKER_COLUMNS) * SANDBAG_HEIGHT;
	return { left, top, right: left + SANDBAG_WIDTH, bottom: top + SANDBAG_HEIGHT };
}

/** Bounding box of the drones still flying in formation, or null when none are left */
export function formationBounds(formation: Formation): Rect | null {
	let bounds: Rect | null = null;
	for (const drone of formation.drones) {
		if (!drone.alive) continue;
		const rect = droneRect(formation, drone);
		bounds = bounds
			? {
					left: Math.min(bounds.left, rect.left),
					top: Math.min(bounds.top, rect.top),
					right: Math.max(bounds.right, rect.right),
					bottom: Math.max(bounds.bottom, rect.bottom)
				}
			: rect;
	}
	return bounds;
}

export function aliveInFormation(formation: Formation): number {
	return formation.drones.reduce((count, drone) => count + (drone.alive ? 1 : 0), 0);
}

/** Lowest bottom edge of the formation and the boss (dives excluded), or null if the sky is clear */
export function lowestDroneBottom(state: ShootdownState): number | null {
	const bottoms = [
		formationBounds(state.formation)?.bottom,
		state.boss && state.boss.y + BOSS_HEIGHT
	];
	const present = bottoms.filter((value): value is number => typeof value === 'number');
	return present.length ? Math.max(...present) : null;
}

// --- Movement ------------------------------------------------------------------------------

/** The formation speeds up as fewer of its drones remain, exactly like the classic */
export function formationSpeed(formation: Formation): number {
	if (formation.total === 0) return formation.baseSpeed;
	const destroyedShare = 1 - aliveInFormation(formation) / formation.total;
	return formation.baseSpeed * (1 + FORMATION_SPEED_UP * destroyedShare);
}

/**
 * Moves the formation sideways; at a screen edge it reverses and steps down.
 * Returns whether it reversed during this step.
 */
export function moveFormation(formation: Formation, dtMs: number): boolean {
	const bounds = formationBounds(formation);
	if (!bounds) return false;
	const dx = (formation.direction * formationSpeed(formation) * dtMs) / 1000;
	formation.x += dx;
	const right = bounds.right + dx;
	const left = bounds.left + dx;
	if (formation.direction === 1 && right >= WORLD_WIDTH - EDGE_MARGIN) {
		formation.x -= right - (WORLD_WIDTH - EDGE_MARGIN);
	} else if (formation.direction === -1 && left <= EDGE_MARGIN) {
		formation.x += EDGE_MARGIN - left;
	} else {
		return false;
	}
	formation.direction = formation.direction === 1 ? -1 : 1;
	formation.y += formation.stepDown;
	return true;
}

/** The Mega-Shahed gets faster as it takes damage */
export function bossSpeed(boss: Boss): number {
	return boss.speed * (1 + 1.5 * (1 - boss.hitPoints / boss.maxHitPoints));
}

function moveBoss(boss: Boss, dtMs: number) {
	boss.x += (boss.direction * bossSpeed(boss) * dtMs) / 1000;
	const maxX = WORLD_WIDTH - EDGE_MARGIN - BOSS_WIDTH;
	if (boss.direction === 1 && boss.x >= maxX) {
		boss.x = maxX;
	} else if (boss.direction === -1 && boss.x <= EDGE_MARGIN) {
		boss.x = EDGE_MARGIN;
	} else {
		return;
	}
	boss.direction = boss.direction === 1 ? -1 : 1;
	boss.y += boss.stepDown;
}

function moveLauncher(state: ShootdownState, input: ShootdownInput, dtMs: number) {
	const seconds = dtMs / 1000;
	let x = state.launcherX;
	if (input.move !== 0) {
		x += input.move * LAUNCHER_SPEED * seconds;
	} else if (input.targetX !== null) {
		const maxStep = LAUNCHER_DRAG_SPEED * seconds;
		x += clamp(input.targetX - x, -maxStep, maxStep);
	}
	state.launcherX = clamp(x, LAUNCHER_WIDTH / 2, WORLD_WIDTH - LAUNCHER_WIDTH / 2);
}

// --- Firing and hits -----------------------------------------------------------------------

/** Whether a missile can be launched right now (one in flight at most, and reloaded) */
export function canFire(state: ShootdownState): boolean {
	return (
		state.phase === 'playing' &&
		state.missiles.length < MAX_MISSILES_IN_FLIGHT &&
		state.reloadMs <= 0
	);
}

function fire(state: ShootdownState, events: ShootdownEvent[]) {
	const missile = { x: state.launcherX, y: LAUNCHER_TOP - MISSILE_HEIGHT };
	state.missiles.push(missile);
	state.reloadMs = MISSILE_RELOAD_MS;
	events.push({ type: 'fire', x: missile.x, y: missile.y });
}

function registerHit(state: ShootdownState, basePoints: number): number {
	state.combo += 1;
	const points = basePoints + comboBonus(state.combo);
	state.score += points;
	return points;
}

function registerMiss(state: ShootdownState) {
	state.combo = 0;
}

interface HitCandidate {
	/** Bottom edge of the thing hit; the lowest one is reached first by a rising missile */
	bottom: number;
	apply: () => void;
}

/** Moves missiles up and resolves what each one hits first along its path this step */
function stepMissiles(
	state: ShootdownState,
	random: Random,
	dtMs: number,
	events: ShootdownEvent[]
) {
	const survivors: Missile[] = [];
	for (const missile of state.missiles) {
		const previousY = missile.y;
		missile.y -= (MISSILE_SPEED * dtMs) / 1000;
		// Sweep the whole distance travelled so fast missiles cannot skip over a sandbag
		const path: Rect = {
			left: missile.x - MISSILE_WIDTH / 2,
			right: missile.x + MISSILE_WIDTH / 2,
			top: missile.y,
			bottom: previousY + MISSILE_HEIGHT
		};
		const hit = firstHit(state, path, random, events);
		if (hit) {
			hit.apply();
		} else if (missile.y + MISSILE_HEIGHT < 0) {
			registerMiss(state);
			events.push({ type: 'miss' });
		} else {
			survivors.push(missile);
		}
	}
	state.missiles = survivors;
}

function firstHit(
	state: ShootdownState,
	path: Rect,
	random: Random,
	events: ShootdownEvent[]
): HitCandidate | null {
	const candidates: HitCandidate[] = [];
	const { formation } = state;

	for (const drone of formation.drones) {
		if (!drone.alive) continue;
		const rect = droneRect(formation, drone);
		if (!overlaps(path, rect)) continue;
		candidates.push({
			bottom: rect.bottom,
			apply: () => {
				drone.alive = false;
				const points = registerHit(state, dronePoints(drone.row, formation.rows, false));
				events.push({
					type: 'drone-destroyed',
					x: (rect.left + rect.right) / 2,
					y: (rect.top + rect.bottom) / 2,
					points,
					diving: false
				});
			}
		});
	}

	for (const diver of state.divers) {
		const rect = diverRect(diver);
		if (!overlaps(path, rect)) continue;
		candidates.push({
			bottom: rect.bottom,
			apply: () => {
				state.divers = state.divers.filter((other) => other !== diver);
				const points = registerHit(state, dronePoints(diver.row, formation.rows, true));
				events.push({ type: 'drone-destroyed', x: diver.x, y: diver.y, points, diving: true });
			}
		});
	}

	const boss = state.boss;
	if (boss) {
		const rect = bossRect(boss);
		if (overlaps(path, rect)) {
			candidates.push({
				bottom: rect.bottom,
				apply: () => {
					boss.hitPoints -= 1;
					const x = boss.x + BOSS_WIDTH / 2;
					const y = boss.y + BOSS_HEIGHT / 2;
					if (boss.hitPoints <= 0) {
						state.boss = null;
						const points = registerHit(state, BOSS_DESTROYED_SCORE * Math.ceil(state.wave / 5));
						events.push({ type: 'boss-destroyed', x, y, points });
					} else {
						const points = registerHit(state, BOSS_HIT_POINTS_SCORE);
						events.push({ type: 'boss-hit', x, y: rect.bottom, points, hitPoints: boss.hitPoints });
					}
				}
			});
		}
	}

	const blimp = state.blimp;
	if (blimp) {
		const rect = blimpRect(blimp);
		if (overlaps(path, rect)) {
			candidates.push({
				bottom: rect.bottom,
				apply: () => {
					state.blimp = null;
					state.blimpTimerMs = randomBetween(random, BLIMP_INTERVAL_MS);
					const points = registerHit(state, pickOne(random, BLIMP_POINTS));
					events.push({ type: 'blimp-hit', x: blimp.x + BLIMP_WIDTH / 2, y: BLIMP_TOP, points });
				}
			});
		}
	}

	for (const bunker of state.bunkers) {
		// Only the lowest sandbag in the missile's path matters
		for (let index = bunker.sandbags.length - 1; index >= 0; index--) {
			if (bunker.sandbags[index] <= 0) continue;
			const rect = sandbagRect(bunker, index);
			if (!overlaps(path, rect)) continue;
			candidates.push({
				bottom: rect.bottom,
				apply: () => {
					bunker.sandbags[index] -= 1;
					registerMiss(state);
					events.push({ type: 'bunker-hit', x: missileCenter(path), y: rect.bottom });
				}
			});
			break;
		}
	}

	if (candidates.length === 0) return null;
	return candidates.reduce((lowest, candidate) =>
		candidate.bottom > lowest.bottom ? candidate : lowest
	);
}

const missileCenter = (path: Rect) => (path.left + path.right) / 2;

// --- Bunkers -------------------------------------------------------------------------------

/** Removes every sandbag overlapping the given rectangle (drones flying through the bunker) */
function eraseSandbags(state: ShootdownState, rect: Rect) {
	for (const bunker of state.bunkers) {
		if (rect.right < bunker.x || rect.left > bunker.x + BUNKER_WIDTH) continue;
		if (rect.bottom < bunker.y || rect.top > bunker.y + BUNKER_HEIGHT) continue;
		bunker.sandbags.forEach((hitPoints, index) => {
			if (hitPoints > 0 && overlaps(rect, sandbagRect(bunker, index))) bunker.sandbags[index] = 0;
		});
	}
}

/** Damages sandbags around a crash point; returns whether any sandbag was hit */
function crashIntoSandbags(state: ShootdownState, x: number, y: number): boolean {
	let hit = false;
	for (const bunker of state.bunkers) {
		bunker.sandbags.forEach((hitPoints, index) => {
			if (hitPoints <= 0) return;
			const rect = sandbagRect(bunker, index);
			const dx = (rect.left + rect.right) / 2 - x;
			const dy = (rect.top + rect.bottom) / 2 - y;
			if (dx * dx + dy * dy <= CRASH_RADIUS * CRASH_RADIUS) {
				bunker.sandbags[index] = Math.max(0, hitPoints - SANDBAG_HIT_POINTS);
				hit = true;
			}
		});
	}
	return hit;
}

function touchesSandbag(state: ShootdownState, rect: Rect): boolean {
	return state.bunkers.some((bunker) =>
		bunker.sandbags.some(
			(hitPoints, index) => hitPoints > 0 && overlaps(rect, sandbagRect(bunker, index))
		)
	);
}

// --- Dives ---------------------------------------------------------------------------------

/** The lowest drone of each column that is not already warning; only these may break formation */
export function diveCandidates(formation: Formation): FormationDrone[] {
	const lowest = new Map<number, FormationDrone>();
	for (const drone of formation.drones) {
		if (!drone.alive) continue;
		const current = lowest.get(drone.column);
		if (!current || drone.row > current.row) lowest.set(drone.column, drone);
	}
	return [...lowest.values()].filter((drone) => drone.warningMs <= 0);
}

function activeDives(state: ShootdownState): number {
	return (
		state.divers.length +
		state.formation.drones.filter((drone) => drone.alive && drone.warningMs > 0).length
	);
}

function scheduleDives(
	state: ShootdownState,
	random: Random,
	dtMs: number,
	events: ShootdownEvent[]
) {
	state.diveTimerMs -= dtMs;
	if (state.diveTimerMs > 0) return;
	const candidates = diveCandidates(state.formation);
	if (candidates.length === 0 || activeDives(state) >= state.definition.maxDivers) {
		// Try again shortly
		state.diveTimerMs = 400;
		return;
	}
	const drone = pickOne(random, candidates);
	drone.warningMs = DIVE_WARNING_MS;
	drone.targetX = state.launcherX;
	state.diveTimerMs = randomBetween(random, state.definition.diveIntervalMs);
	events.push({ type: 'dive-warning', id: drone.id, targetX: drone.targetX });
}

/** Turns drones whose warning ran out into divers heading for the marked spot */
function launchDivers(state: ShootdownState, dtMs: number) {
	const { formation } = state;
	for (const drone of formation.drones) {
		if (!drone.alive || drone.warningMs <= 0) continue;
		drone.warningMs -= dtMs;
		if (drone.warningMs > 0) continue;
		drone.warningMs = 0;
		drone.alive = false;
		const rect = droneRect(formation, drone);
		const x = (rect.left + rect.right) / 2;
		const y = (rect.top + rect.bottom) / 2;
		const dx = drone.targetX - x;
		const dy = Math.max(1, LAUNCHER_TOP + LAUNCHER_HEIGHT / 2 - y);
		const length = Math.hypot(dx, dy);
		const speed = state.definition.diveSpeed;
		state.divers.push({
			id: drone.id,
			x,
			y,
			vx: (dx / length) * speed,
			vy: (dy / length) * speed,
			row: drone.row
		});
	}
}

function moveDivers(state: ShootdownState, dtMs: number, events: ShootdownEvent[]) {
	const launcher = launcherRect(state.launcherX);
	const survivors: Diver[] = [];
	for (const diver of state.divers) {
		diver.x += (diver.vx * dtMs) / 1000;
		diver.y += (diver.vy * dtMs) / 1000;
		const rect = diverRect(diver);
		if (overlaps(rect, launcher)) {
			events.push({ type: 'diver-crashed', x: diver.x, y: diver.y });
			if (state.invulnerableMs <= 0) {
				// Remove this diver first so loseLife does not report it twice; loseLife then clears
				// the remaining divers, so there is nothing left to move this step
				state.divers = state.divers.filter((other) => other !== diver);
				loseLife(state, 'dive-hit', events);
				return;
			}
		} else if (touchesSandbag(state, rect)) {
			crashIntoSandbags(state, diver.x, rect.bottom);
			events.push({ type: 'diver-crashed', x: diver.x, y: diver.y });
		} else if (
			rect.bottom >= WORLD_HEIGHT - 20 ||
			diver.x < -DRONE_WIDTH ||
			diver.x > WORLD_WIDTH + DRONE_WIDTH
		) {
			// Missed the launcher and crashed harmlessly into the ground
			events.push({ type: 'diver-crashed', x: diver.x, y: Math.min(diver.y, WORLD_HEIGHT - 30) });
		} else {
			survivors.push(diver);
		}
	}
	state.divers = survivors;
}

// --- Lives ---------------------------------------------------------------------------------

function loseLife(state: ShootdownState, reason: LifeLossReason, events: ShootdownEvent[]) {
	state.lives = Math.max(0, state.lives - 1);
	state.combo = 0;
	state.invulnerableMs = INVULNERABLE_MS;
	state.sinceLifeLostMs = 0;
	// Clear the sky around the launcher so the player gets a fair restart
	for (const diver of state.divers) events.push({ type: 'diver-crashed', x: diver.x, y: diver.y });
	state.divers = [];
	for (const drone of state.formation.drones) drone.warningMs = 0;
	state.diveTimerMs = Math.max(state.diveTimerMs, state.definition.diveIntervalMs[0]);
	events.push({ type: 'life-lost', reason, lives: state.lives });
	if (state.lives === 0) {
		state.phase = 'over';
		state.missiles = [];
		events.push({ type: 'game-over' });
	}
}

/** Drones reaching the ground band cost a life; the formation is then pushed back up */
function checkGroundReached(state: ShootdownState, events: ShootdownEvent[]) {
	const bounds = formationBounds(state.formation);
	const formationDown = bounds !== null && bounds.bottom >= GROUND_Y;
	const bossDown = state.boss !== null && state.boss.y + BOSS_HEIGHT >= GROUND_Y;
	if (!formationDown && !bossDown) return;
	state.formation.y = state.formation.startY;
	if (state.boss) state.boss.y = BOSS_TOP;
	loseLife(state, 'ground-reached', events);
}

// --- Blimp ---------------------------------------------------------------------------------

function stepBlimp(state: ShootdownState, random: Random, dtMs: number) {
	if (!state.blimp) {
		state.blimpTimerMs -= dtMs;
		if (state.blimpTimerMs > 0) return;
		const direction = random() < 0.5 ? 1 : -1;
		state.blimp = { x: direction === 1 ? -BLIMP_WIDTH : WORLD_WIDTH, direction };
		return;
	}
	const blimp = state.blimp;
	blimp.x += (blimp.direction * BLIMP_SPEED * dtMs) / 1000;
	if (blimp.x > WORLD_WIDTH || blimp.x < -BLIMP_WIDTH) {
		state.blimp = null;
		state.blimpTimerMs = randomBetween(random, BLIMP_INTERVAL_MS);
	}
}

// --- Commander -----------------------------------------------------------------------------

export type CommanderPose = 'pointing' | 'worried' | 'smug';

export function commanderPose(state: ShootdownState): CommanderPose {
	if (state.phase === 'over' || state.sinceLifeLostMs < WORRIED_MS) return 'worried';
	if (state.phase === 'intermission') return 'smug';
	const lowest = lowestDroneBottom(state);
	return lowest !== null && lowest >= DANGER_Y ? 'worried' : 'pointing';
}

// --- Step ----------------------------------------------------------------------------------

export function isWaveCleared(state: ShootdownState): boolean {
	return aliveInFormation(state.formation) === 0 && state.divers.length === 0 && !state.boss;
}

/** A function rather than an inline check, because helpers called during a step can end the game */
export function isGameOver(state: ShootdownState): boolean {
	return state.phase === 'over';
}

/** Advances the game by one fixed step of dtMs milliseconds and returns what happened */
export function stepGame(
	state: ShootdownState,
	input: ShootdownInput,
	random: Random,
	dtMs: number
): ShootdownEvent[] {
	const events: ShootdownEvent[] = [];
	if (isGameOver(state)) return events;

	state.reloadMs = Math.max(0, state.reloadMs - dtMs);
	state.invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);
	state.sinceLifeLostMs += dtMs;

	moveLauncher(state, input, dtMs);
	stepBlimp(state, random, dtMs);

	if (state.phase === 'intermission') {
		stepMissiles(state, random, dtMs, events);
		state.intermissionMs -= dtMs;
		if (state.intermissionMs <= 0) {
			state.missiles = [];
			startWave(state, state.wave + 1, events);
		}
		return events;
	}

	if (input.fire && canFire(state)) fire(state, events);

	moveFormation(state.formation, dtMs);
	if (state.boss) moveBoss(state.boss, dtMs);
	scheduleDives(state, random, dtMs, events);
	launchDivers(state, dtMs);
	moveDivers(state, dtMs, events);
	if (isGameOver(state)) return events;

	stepMissiles(state, random, dtMs, events);

	// Drones flying through a bunker tear the sandbags away, like the classic's shields
	for (const drone of state.formation.drones) {
		if (drone.alive) eraseSandbags(state, droneRect(state.formation, drone));
	}
	if (state.boss) eraseSandbags(state, bossRect(state.boss));

	checkGroundReached(state, events);
	if (isGameOver(state)) return events;

	if (isWaveCleared(state)) {
		const bonus = waveClearBonus(state.wave, state.lives);
		state.score += bonus;
		state.phase = 'intermission';
		state.intermissionMs = INTERMISSION_MS;
		events.push({ type: 'wave-cleared', wave: state.wave, bonus });
	}
	return events;
}

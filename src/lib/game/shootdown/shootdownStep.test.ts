import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import {
	BLIMP_POINTS,
	BLIMP_TOP,
	BOSS_WIDTH,
	CELL_HEIGHT,
	CELL_WIDTH,
	DIVE_BONUS,
	DIVE_WARNING_MS,
	DRONE_HEIGHT,
	DRONE_WIDTH,
	EDGE_MARGIN,
	FORMATION_SPEED_UP,
	GROUND_Y,
	INTERMISSION_MS,
	LAUNCHER_TOP,
	MAX_MISSILES_IN_FLIGHT,
	MISSILE_RELOAD_MS,
	NO_INPUT,
	SANDBAG_HIT_POINTS,
	STARTING_LIVES,
	WORLD_WIDTH,
	aliveInFormation,
	canFire,
	comboBonus,
	commanderPose,
	createGame,
	diveCandidates,
	dronePoints,
	formationBounds,
	formationSpeed,
	moveFormation,
	stepGame,
	waveClearBonus,
	type ShootdownEvent,
	type ShootdownInput,
	type ShootdownState
} from './shootdownStep';

const STEP = 1000 / 60;
const FIRE: ShootdownInput = { ...NO_INPUT, fire: true };

/** Runs fixed steps for the given time and collects every event */
function run(
	state: ShootdownState,
	ms: number,
	input: ShootdownInput = NO_INPUT,
	random = createRandom(1)
): ShootdownEvent[] {
	const events: ShootdownEvent[] = [];
	for (let t = 0; t < ms; t += STEP) events.push(...stepGame(state, input, random, STEP));
	return events;
}

/** Runs until an event of the given type happens (or the time limit is reached) */
function runUntil(
	state: ShootdownState,
	type: ShootdownEvent['type'],
	input: ShootdownInput = NO_INPUT,
	random = createRandom(1),
	limitMs = 10_000
): ShootdownEvent[] {
	const events: ShootdownEvent[] = [];
	for (let t = 0; t < limitMs; t += STEP) {
		events.push(...stepGame(state, input, random, STEP));
		if (events.some((event) => event.type === type)) break;
	}
	return events;
}

const ofType = <T extends ShootdownEvent['type']>(events: ShootdownEvent[], type: T) =>
	events.filter((event): event is Extract<ShootdownEvent, { type: T }> => event.type === type);

/** A still sky: the formation holds its position and no dive or blimp interrupts the test */
function quietGame(wave = 1): ShootdownState {
	const state = createGame(wave);
	state.formation.baseSpeed = 0;
	state.diveTimerMs = Number.POSITIVE_INFINITY;
	state.blimpTimerMs = Number.POSITIVE_INFINITY;
	state.bunkers = [];
	return state;
}

/** Horizontal center of a formation column */
const columnCenter = (state: ShootdownState, column: number) =>
	state.formation.x + column * CELL_WIDTH + DRONE_WIDTH / 2;

describe('formation movement', () => {
	it('reverses and steps down at the right edge', () => {
		const state = quietGame();
		const { formation } = state;
		formation.baseSpeed = 30;
		const bounds = formationBounds(formation)!;
		formation.x += WORLD_WIDTH - EDGE_MARGIN - bounds.right - 0.1;
		const y = formation.y;

		expect(moveFormation(formation, STEP)).toBe(true);
		expect(formation.direction).toBe(-1);
		expect(formation.y).toBe(y + formation.stepDown);
		expect(formationBounds(formation)!.right).toBeCloseTo(WORLD_WIDTH - EDGE_MARGIN);
	});

	it('reverses and steps down at the left edge', () => {
		const state = quietGame();
		const { formation } = state;
		formation.baseSpeed = 30;
		formation.direction = -1;
		formation.x += EDGE_MARGIN - formationBounds(formation)!.left + 0.1;
		const y = formation.y;

		expect(moveFormation(formation, STEP)).toBe(true);
		expect(formation.direction).toBe(1);
		expect(formation.y).toBe(y + formation.stepDown);
		expect(formationBounds(formation)!.left).toBeCloseTo(EDGE_MARGIN);
	});

	it('moves sideways without stepping down away from the edges', () => {
		const state = quietGame();
		const { formation } = state;
		formation.baseSpeed = 30;
		const { x, y } = formation;
		expect(moveFormation(formation, 1000)).toBe(false);
		expect(formation.x).toBeCloseTo(x + 30);
		expect(formation.y).toBe(y);
	});

	it('uses the remaining drones for the edge, not the empty columns', () => {
		const state = quietGame();
		const { formation } = state;
		formation.baseSpeed = 30;
		// Destroy the rightmost column: the formation may now travel one column further
		for (const drone of formation.drones)
			if (drone.column === formation.columns - 1) drone.alive = false;
		const bounds = formationBounds(formation)!;
		expect(bounds.right).toBe(formation.x + (formation.columns - 2) * CELL_WIDTH + DRONE_WIDTH);
		formation.x += WORLD_WIDTH - EDGE_MARGIN - bounds.right - 0.1;
		expect(moveFormation(formation, STEP)).toBe(true);
	});

	it('bounces back and forth, dropping a step at every edge', () => {
		const state = createGame();
		state.diveTimerMs = Number.POSITIVE_INFINITY;
		state.bunkers = [];
		const startY = state.formation.y;
		let reversals = 0;
		let direction = state.formation.direction;
		for (let t = 0; t < 20_000; t += STEP) {
			stepGame(state, NO_INPUT, createRandom(1), STEP);
			if (state.formation.direction !== direction) {
				reversals++;
				direction = state.formation.direction;
			}
			const bounds = formationBounds(state.formation)!;
			expect(bounds.left).toBeGreaterThanOrEqual(EDGE_MARGIN - 1e-9);
			expect(bounds.right).toBeLessThanOrEqual(WORLD_WIDTH - EDGE_MARGIN + 1e-9);
		}
		expect(reversals).toBeGreaterThanOrEqual(2);
		expect(state.formation.y).toBe(startY + reversals * state.formation.stepDown);
	});

	it('speeds up as drones are destroyed', () => {
		const state = quietGame();
		const { formation } = state;
		formation.baseSpeed = 20;
		const full = formationSpeed(formation);
		expect(full).toBe(20);

		const speeds = [full];
		for (const drone of formation.drones.slice(0, formation.total - 1)) {
			drone.alive = false;
			speeds.push(formationSpeed(formation));
		}
		for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
		expect(speeds.at(-1)).toBeCloseTo(
			20 * (1 + (FORMATION_SPEED_UP * (formation.total - 1)) / formation.total)
		);
	});

	it('covers more ground per step with fewer drones', () => {
		const full = quietGame().formation;
		const thinned = quietGame().formation;
		full.baseSpeed = thinned.baseSpeed = 20;
		thinned.drones.slice(0, 20).forEach((drone) => (drone.alive = false));
		const fullStart = full.x;
		const thinnedStart = thinned.x;
		moveFormation(full, STEP);
		moveFormation(thinned, STEP);
		expect(thinned.x - thinnedStart).toBeGreaterThan(full.x - fullStart);
	});
});

describe('firing', () => {
	it('keeps only one missile in flight, however often fire is pressed', () => {
		const state = quietGame();
		state.launcherX = WORLD_WIDTH - 30; // clear sky above the launcher
		const events = run(state, 500, FIRE);
		expect(MAX_MISSILES_IN_FLIGHT).toBe(1);
		expect(ofType(events, 'fire')).toHaveLength(1);
		expect(state.missiles).toHaveLength(1);
		expect(canFire(state)).toBe(false);
	});

	it('can fire again once the missile is gone and the launcher has reloaded', () => {
		const state = quietGame();
		state.launcherX = WORLD_WIDTH - 30;
		stepGame(state, FIRE, createRandom(1), STEP);
		const untilMiss = runUntil(state, 'miss');
		expect(ofType(untilMiss, 'miss')).toHaveLength(1);
		expect(state.missiles).toHaveLength(0);

		run(state, MISSILE_RELOAD_MS);
		expect(canFire(state)).toBe(true);
		expect(ofType(stepGame(state, FIRE, createRandom(1), STEP), 'fire')).toHaveLength(1);
	});

	it('waits for the reload after a quick hit before firing again', () => {
		const state = quietGame();
		state.reloadMs = MISSILE_RELOAD_MS;
		expect(canFire(state)).toBe(false);
		run(state, MISSILE_RELOAD_MS - 2 * STEP);
		expect(canFire(state)).toBe(false);
		run(state, 3 * STEP);
		expect(canFire(state)).toBe(true);
	});
});

describe('collisions and scoring', () => {
	it('destroys the lowest drone in the missile path and scores it', () => {
		const state = quietGame();
		state.launcherX = columnCenter(state, 3);
		const events = runUntil(state, 'drone-destroyed', FIRE);
		const [destroyed] = ofType(events, 'drone-destroyed');
		expect(destroyed).toMatchObject({ diving: false, points: dronePoints(3, 4, false) });

		const dead = state.formation.drones.filter((drone) => !drone.alive);
		expect(dead).toHaveLength(1);
		expect(dead[0]).toMatchObject({ column: 3, row: 3 });
		expect(state.missiles).toHaveLength(0);
		expect(state.score).toBe(10);
	});

	it('misses between two columns', () => {
		const state = quietGame();
		state.launcherX = columnCenter(state, 3) + CELL_WIDTH / 2;
		const events = runUntil(state, 'miss', FIRE);
		expect(ofType(events, 'drone-destroyed')).toHaveLength(0);
		expect(aliveInFormation(state.formation)).toBe(state.formation.total);
	});

	it('rewards consecutive hits with a combo bonus and resets it on a miss', () => {
		const state = quietGame();
		state.launcherX = columnCenter(state, 2);
		const events = run(state, 6000, FIRE);
		const points = ofType(events, 'drone-destroyed').map((event) => event.points);
		// Column two: rows 3 and 2 are worth 10 each, rows 1 and 0 are worth 20 and 30
		expect(points).toEqual([10, 10 + comboBonus(2), 20 + comboBonus(3), 30 + comboBonus(4)]);
		expect(state.combo).toBe(0); // the next missile flew off the top
		expect(ofType(events, 'miss').length).toBeGreaterThan(0);
	});

	it('scores top rows higher and diving drones higher still', () => {
		expect(dronePoints(0, 4, false)).toBe(30);
		expect(dronePoints(1, 4, false)).toBe(20);
		expect(dronePoints(3, 4, false)).toBe(10);
		expect(dronePoints(3, 4, true)).toBe(10 + DIVE_BONUS);
		expect(comboBonus(1)).toBe(0);
		expect(comboBonus(100)).toBe(50);
	});

	it('gives the dive bonus for a drone shot while diving', () => {
		const state = quietGame();
		state.launcherX = WORLD_WIDTH - 30;
		state.divers.push({ id: 99, x: state.launcherX, y: 300, vx: 0, vy: 0, row: 3 });
		const [destroyed] = ofType(runUntil(state, 'drone-destroyed', FIRE), 'drone-destroyed');
		expect(destroyed).toMatchObject({ diving: true, points: 10 + DIVE_BONUS });
		expect(state.divers).toHaveLength(0);
	});

	it('chips a sandbag with a stray missile and breaks the combo', () => {
		const state = quietGame();
		state.bunkers = createGame().bunkers;
		const bunker = state.bunkers[0];
		state.launcherX = bunker.x + 4;
		state.combo = 3;
		const events = runUntil(state, 'bunker-hit', FIRE);
		expect(ofType(events, 'bunker-hit')).toHaveLength(1);
		expect(state.combo).toBe(0);
		expect(state.missiles).toHaveLength(0);
		expect(aliveInFormation(state.formation)).toBe(state.formation.total);
		const damaged = bunker.sandbags.filter((hitPoints) => hitPoints < SANDBAG_HIT_POINTS);
		expect(damaged).toEqual([SANDBAG_HIT_POINTS - 1]);
	});

	it('wears through a bunker after enough missiles', () => {
		const state = quietGame();
		state.bunkers = createGame().bunkers;
		const bunker = state.bunkers[0];
		state.launcherX = bunker.x + 4;
		const events = runUntil(state, 'drone-destroyed', FIRE, createRandom(1), 20_000);
		expect(ofType(events, 'bunker-hit')).toHaveLength(3 * SANDBAG_HIT_POINTS);
		expect(ofType(events, 'drone-destroyed')).toHaveLength(1);
	});

	it('shoots down the blimp for bonus points', () => {
		const state = quietGame();
		state.launcherX = WORLD_WIDTH - 30;
		// The blimp drifts about 45 units while the missile climbs, so it starts further left
		state.blimp = { x: state.launcherX - 60, direction: 1 };
		const [hit] = ofType(runUntil(state, 'blimp-hit', FIRE), 'blimp-hit');
		expect(hit.y).toBe(BLIMP_TOP);
		expect(BLIMP_POINTS).toContain(hit.points);
		expect(state.blimp).toBeNull();
		expect(state.score).toBe(hit.points);
	});
});

describe('kamikaze dives', () => {
	it('warns first, then dives at where the launcher was', () => {
		const state = quietGame();
		state.diveTimerMs = 0;
		state.launcherX = 100;
		const [warning] = ofType(stepGame(state, NO_INPUT, createRandom(7), STEP), 'dive-warning');
		expect(warning.targetX).toBe(100);
		const drone = state.formation.drones.find((candidate) => candidate.id === warning.id)!;
		expect(drone.row).toBe(3); // only the lowest drone of a column breaks formation
		expect(state.divers).toHaveLength(0);

		run(state, DIVE_WARNING_MS - 3 * STEP);
		expect(drone.alive).toBe(true);
		run(state, 3 * STEP);
		expect(drone.alive).toBe(false);
		expect(state.divers).toHaveLength(1);
		const diver = state.divers[0];
		expect(diver.vy).toBeGreaterThan(0);
		expect(Math.sign(diver.vx)).toBe(Math.sign(100 - diver.x) || 0);
	});

	it('picks the same diver for the same seed', () => {
		const pick = (seed: number) => {
			const state = quietGame();
			state.diveTimerMs = 0;
			return ofType(stepGame(state, NO_INPUT, createRandom(seed), STEP), 'dive-warning')[0].id;
		};
		expect(pick(42)).toBe(pick(42));
		const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pick));
		expect(picks.size).toBeGreaterThan(1);
	});

	it('limits simultaneous dives to the wave maximum', () => {
		const state = quietGame();
		const random = createRandom(3);
		state.diveTimerMs = 0;
		stepGame(state, NO_INPUT, random, STEP);
		state.diveTimerMs = 0;
		const events = stepGame(state, NO_INPUT, random, STEP);
		expect(state.definition.maxDivers).toBe(1);
		expect(ofType(events, 'dive-warning')).toHaveLength(0);
	});

	it('offers only the lowest drone of each column as dive candidates', () => {
		const { formation } = quietGame();
		formation.drones.find((drone) => drone.column === 0 && drone.row === 3)!.alive = false;
		const candidates = diveCandidates(formation);
		expect(candidates).toHaveLength(formation.columns);
		expect(candidates.find((drone) => drone.column === 0)!.row).toBe(2);
		expect(candidates.filter((drone) => drone.column !== 0).every((drone) => drone.row === 3)).toBe(
			true
		);
	});
});

describe('lives', () => {
	it('loses a life when a dive lands on the launcher', () => {
		const state = quietGame();
		state.divers.push({ id: 99, x: state.launcherX, y: LAUNCHER_TOP - 40, vx: 0, vy: 200, row: 3 });
		const [lost] = ofType(runUntil(state, 'life-lost'), 'life-lost');
		expect(lost).toEqual({ type: 'life-lost', reason: 'dive-hit', lives: STARTING_LIVES - 1 });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.divers).toHaveLength(0);
	});

	it('ignores a second dive hit right after losing a life', () => {
		const state = quietGame();
		state.divers.push({ id: 98, x: state.launcherX, y: LAUNCHER_TOP - 40, vx: 0, vy: 200, row: 3 });
		runUntil(state, 'life-lost');
		state.divers.push({ id: 99, x: state.launcherX, y: LAUNCHER_TOP - 20, vx: 0, vy: 200, row: 3 });
		const events = run(state, 500);
		expect(ofType(events, 'diver-crashed')).toHaveLength(1);
		expect(ofType(events, 'life-lost')).toHaveLength(0);
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('keeps the life when a dive misses and crashes into the ground', () => {
		const state = quietGame();
		state.launcherX = WORLD_WIDTH - 30;
		state.divers.push({ id: 99, x: 20, y: 400, vx: 0, vy: 200, row: 3 });
		const events = runUntil(state, 'diver-crashed');
		expect(ofType(events, 'diver-crashed')).toHaveLength(1);
		expect(ofType(events, 'life-lost')).toHaveLength(0);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.divers).toHaveLength(0);
	});

	it('loses a life when the formation reaches the ground band and pushes it back up', () => {
		const state = quietGame();
		const { formation } = state;
		formation.y = GROUND_Y - (formation.rows - 1) * CELL_HEIGHT - DRONE_HEIGHT + 0.5;
		const events = stepGame(state, NO_INPUT, createRandom(1), STEP);
		expect(ofType(events, 'life-lost')).toEqual([
			{ type: 'life-lost', reason: 'ground-reached', lives: STARTING_LIVES - 1 }
		]);
		expect(formation.y).toBe(formation.startY);
	});

	it('does not lose a life while the formation is still above the ground band', () => {
		const state = quietGame();
		const { formation } = state;
		formation.y = GROUND_Y - (formation.rows - 1) * CELL_HEIGHT - DRONE_HEIGHT - 1;
		expect(ofType(run(state, 200), 'life-lost')).toHaveLength(0);
	});

	it('ends the game when the last life is lost', () => {
		const state = quietGame();
		const events: ShootdownEvent[] = [];
		for (let life = 0; life < STARTING_LIVES; life++) {
			state.invulnerableMs = 0;
			state.divers.push({
				id: 90 + life,
				x: state.launcherX,
				y: LAUNCHER_TOP - 20,
				vx: 0,
				vy: 200,
				row: 3
			});
			events.push(...runUntil(state, 'life-lost'));
		}
		expect(state.lives).toBe(0);
		expect(state.phase).toBe('over');
		expect(ofType(events, 'game-over')).toHaveLength(1);
		const score = state.score;
		expect(run(state, 1000, FIRE)).toEqual([]);
		expect(state.score).toBe(score);
	});
});

describe('bunkers', () => {
	it('lose sandbags when a diving drone crashes into them', () => {
		const state = quietGame();
		state.bunkers = createGame().bunkers;
		state.launcherX = WORLD_WIDTH - 30;
		const bunker = state.bunkers[0];
		const before = bunker.sandbags.reduce((sum, hitPoints) => sum + hitPoints, 0);
		state.divers.push({ id: 99, x: bunker.x + 32, y: bunker.y - 30, vx: 0, vy: 200, row: 3 });
		const events = runUntil(state, 'diver-crashed');
		expect(ofType(events, 'diver-crashed')).toHaveLength(1);
		expect(bunker.sandbags.reduce((sum, hitPoints) => sum + hitPoints, 0)).toBeLessThan(before);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('are torn away where the formation flies through them', () => {
		const state = quietGame();
		state.bunkers = createGame().bunkers;
		const { formation } = state;
		// Lower the formation so its bottom row overlaps the bunker tops
		formation.y = state.bunkers[0].y + 2 - (formation.rows - 1) * CELL_HEIGHT;
		stepGame(state, NO_INPUT, createRandom(1), STEP);
		const destroyed = state.bunkers.flatMap((bunker) => bunker.sandbags).filter((hp) => hp === 0);
		expect(destroyed.length).toBeGreaterThan(0);
	});

	it('are restocked at the start of every wave', () => {
		const state = quietGame();
		state.bunkers = createGame().bunkers;
		state.bunkers[0].sandbags.fill(0);
		state.formation.drones.forEach((drone) => (drone.alive = false));
		run(state, INTERMISSION_MS + 100);
		expect(state.wave).toBe(2);
		expect(state.bunkers[0].sandbags.every((hitPoints) => hitPoints === SANDBAG_HIT_POINTS)).toBe(
			true
		);
	});
});

describe('wave progression', () => {
	it('clears the wave with a bonus, pauses briefly, then starts the next, bigger wave', () => {
		const state = quietGame();
		state.formation.drones.forEach((drone) => (drone.alive = false));
		const cleared = stepGame(state, NO_INPUT, createRandom(1), STEP);
		expect(ofType(cleared, 'wave-cleared')).toEqual([
			{ type: 'wave-cleared', wave: 1, bonus: waveClearBonus(1, STARTING_LIVES) }
		]);
		expect(state.phase).toBe('intermission');
		expect(state.score).toBe(waveClearBonus(1, STARTING_LIVES));
		expect(commanderPose(state)).toBe('smug');
		expect(canFire(state)).toBe(false);

		const started = runUntil(state, 'wave-started');
		expect(ofType(started, 'wave-started')).toEqual([
			{ type: 'wave-started', wave: 2, boss: false }
		]);
		expect(state.phase).toBe('playing');
		expect(state.wave).toBe(2);
		expect(aliveInFormation(state.formation)).toBe(
			state.definition.columns * state.definition.rows
		);
		expect(state.formation.baseSpeed).toBeGreaterThan(createGame(1).formation.baseSpeed);
	});

	it('reaches the boss wave after four cleared waves', () => {
		const state = quietGame();
		for (let wave = 1; wave <= 4; wave++) {
			state.formation.drones.forEach((drone) => (drone.alive = false));
			runUntil(state, 'wave-started');
		}
		expect(state.wave).toBe(5);
		expect(state.boss).not.toBeNull();
	});

	it('does not clear a wave while a diver is still in the air', () => {
		const state = quietGame();
		state.formation.drones.forEach((drone) => (drone.alive = false));
		state.divers.push({ id: 99, x: 20, y: 200, vx: 0, vy: 50, row: 3 });
		expect(ofType(stepGame(state, NO_INPUT, createRandom(1), STEP), 'wave-cleared')).toHaveLength(
			0
		);
		expect(state.phase).toBe('playing');
	});
});

describe('boss wave', () => {
	it('has a Mega-Shahed that takes several hits', () => {
		const state = quietGame(5);
		const boss = state.boss!;
		boss.speed = 0;
		state.launcherX = boss.x + BOSS_WIDTH / 2;
		// Escorts out of the way so every missile reaches the boss
		state.formation.drones.forEach((drone) => (drone.alive = false));
		expect(boss.hitPoints).toBe(boss.maxHitPoints);
		expect(boss.maxHitPoints).toBeGreaterThan(1);

		const events = runUntil(state, 'boss-destroyed', FIRE, createRandom(1), 30_000);
		const hits = ofType(events, 'boss-hit');
		expect(hits.map((hit) => hit.hitPoints)).toEqual(
			Array.from({ length: boss.maxHitPoints - 1 }, (_, index) => boss.maxHitPoints - 1 - index)
		);
		expect(ofType(events, 'boss-destroyed')).toHaveLength(1);
		expect(state.boss).toBeNull();
	});

	it('is not cleared while the boss is still flying', () => {
		const state = quietGame(5);
		state.boss!.speed = 0;
		state.formation.drones.forEach((drone) => (drone.alive = false));
		expect(ofType(run(state, 500), 'wave-cleared')).toHaveLength(0);
		state.boss = null;
		expect(ofType(run(state, STEP), 'wave-cleared')).toHaveLength(1);
	});

	it('costs a life when it reaches the ground band', () => {
		const state = quietGame(5);
		state.boss!.y = GROUND_Y;
		const [lost] = ofType(stepGame(state, NO_INPUT, createRandom(1), STEP), 'life-lost');
		expect(lost.reason).toBe('ground-reached');
	});
});

describe('commander', () => {
	it('points at the sky by default and worries after a lost life or when drones get low', () => {
		const state = quietGame();
		expect(commanderPose(state)).toBe('pointing');

		state.formation.y = 380;
		expect(commanderPose(state)).toBe('worried');
		state.formation.y = state.formation.startY;

		state.divers.push({ id: 99, x: state.launcherX, y: LAUNCHER_TOP - 20, vx: 0, vy: 200, row: 3 });
		runUntil(state, 'life-lost');
		expect(commanderPose(state)).toBe('worried');
		run(state, 2000);
		expect(commanderPose(state)).toBe('pointing');
	});
});

describe('determinism', () => {
	it('plays out identically for the same seed and input', () => {
		const play = () => {
			const state = createGame();
			const random = createRandom(2024);
			for (let t = 0; t < 30_000; t += STEP) {
				const move = Math.floor(t / 1500) % 2 === 0 ? 1 : -1;
				stepGame(state, { move, targetX: null, fire: true }, random, STEP);
			}
			return state;
		};
		expect(play()).toEqual(play());
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	BOOST_MS,
	DRONE_RESET_GAP,
	DRONE_START_GAP,
	DUCK_MS,
	JUMP_MS,
	PICKUP_SCORE,
	STARTING_LIVES,
	STUMBLE_CLOSE,
	STUMBLE_GRACE_MS,
	type Lane,
	type ObstacleKind,
	type PickupKind
} from './config';
import type { Cells } from './patterns';
import { createGame, isAirborne, isDucking, scoreOf, type RunEvent, type RunState } from './state';
import { command, stepGame, type Command } from './step';

const STEP = 1000 / 60;

/** A run on an empty course: nothing is generated, so the test places what it needs */
function emptyRun(): RunState {
	const state = createGame();
	state.generator.nextZ = Infinity;
	state.generator.nextPatchZ = Infinity;
	return state;
}

function addObstacle(state: RunState, kind: ObstacleKind, lane: Lane, z: number) {
	const cells: [ObstacleKind | null, ObstacleKind | null, ObstacleKind | null] = [null, null, null];
	cells[lane] = kind;
	state.field.rows.push({
		id: state.field.rows.length + 1,
		z,
		cells: cells as Cells,
		spent: [false, false, false]
	});
}

function addPickup(state: RunState, kind: PickupKind, lane: Lane, z: number) {
	state.field.pickups.push({ id: 100 + state.field.pickups.length, kind, lane, z, taken: false });
}

function run(state: RunState, ms: number, actions: Record<number, Command> = {}): RunEvent[] {
	const events: RunEvent[] = [];
	let index = 0;
	for (let t = 0; t < ms; t += STEP, index++) {
		const action = actions[index];
		if (action) events.push(...command(state, action));
		events.push(...stepGame(state, createRandom(1), STEP));
	}
	return events;
}

/** Runs until the runner is just short of a distance */
function runTo(state: RunState, distance: number, actions: Record<number, Command> = {}) {
	const events: RunEvent[] = [];
	let index = 0;
	while (state.distance < distance && !state.over) {
		const action = actions[index++];
		if (action) events.push(...command(state, action));
		events.push(...stepGame(state, createRandom(1), STEP));
	}
	return events;
}

const types = (events: RunEvent[]) => events.map((event) => event.type);

describe('running', () => {
	it('starts in the middle lane with full lives and the drone in the distance', () => {
		const state = createGame();
		expect(state.runner.lane).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.drone.gap).toBe(DRONE_START_GAP);
		expect(scoreOf(state)).toBe(0);
	});

	it('covers ground and scores distance', () => {
		const state = emptyRun();
		run(state, 3000);
		expect(state.distance).toBeGreaterThan(15);
		expect(scoreOf(state)).toBe(Math.floor(state.distance / 5) * 5);
		expect(scoreOf(state)).toBeGreaterThan(10);
	});

	it('generates the course ahead as it goes and drops what is behind', () => {
		const state = createGame();
		const random = createRandom(4);
		for (let t = 0; t < 40_000; t += STEP) stepGame(state, random, STEP);
		expect(state.field.rows.length).toBeGreaterThan(0);
		expect(state.field.rows.every((row) => row.z >= state.distance - 12)).toBe(true);
		expect(state.field.rows.at(-1)!.z).toBeGreaterThan(state.distance);
	});

	it('does nothing once the run is over', () => {
		const state = emptyRun();
		state.over = true;
		expect(stepGame(state, createRandom(1), STEP)).toEqual([]);
		expect(command(state, 'jump')).toEqual([]);
	});
});

describe('lanes, jumping and ducking', () => {
	it('changes lane one step at a time, within the three lanes', () => {
		const state = emptyRun();
		expect(command(state, 'left')).toEqual([{ type: 'lane', lane: 0 }]);
		expect(command(state, 'left')).toEqual([]);
		expect(command(state, 'right')).toEqual([{ type: 'lane', lane: 1 }]);
		command(state, 'right');
		expect(command(state, 'right')).toEqual([]);
		expect(state.runner.lane).toBe(2);
	});

	it('slides across lanes instead of jumping', () => {
		const state = emptyRun();
		command(state, 'left');
		run(state, 40);
		expect(state.runner.x).toBeLessThan(1);
		expect(state.runner.x).toBeGreaterThan(0);
		run(state, 200);
		expect(state.runner.x).toBe(0);
	});

	it('jumps for a set time and lands, and cannot jump twice in the air', () => {
		const state = emptyRun();
		expect(command(state, 'jump')).toEqual([{ type: 'jump' }]);
		expect(isAirborne(state.runner)).toBe(true);
		expect(command(state, 'jump')).toEqual([]);
		const events = run(state, JUMP_MS + STEP);
		expect(types(events)).toContain('land');
		expect(isAirborne(state.runner)).toBe(false);
		expect(command(state, 'jump')).toEqual([{ type: 'jump' }]);
	});

	it('ducks for a set time, and ducking in the air drops the runner', () => {
		const state = emptyRun();
		expect(command(state, 'duck')).toEqual([{ type: 'duck' }]);
		expect(isDucking(state.runner)).toBe(true);
		run(state, DUCK_MS + STEP);
		expect(isDucking(state.runner)).toBe(false);

		command(state, 'jump');
		expect(types(command(state, 'duck'))).toEqual(['land', 'duck']);
		expect(isAirborne(state.runner)).toBe(false);
		expect(isDucking(state.runner)).toBe(true);
	});

	it('stops a duck when the runner jumps', () => {
		const state = emptyRun();
		command(state, 'duck');
		command(state, 'jump');
		expect(isDucking(state.runner)).toBe(false);
		expect(isAirborne(state.runner)).toBe(true);
	});
});

describe('obstacles', () => {
	it('a ditch is cleared by jumping and costs a stumble otherwise', () => {
		const walked = emptyRun();
		addObstacle(walked, 'ditch', 1, 12);
		const events = runTo(walked, 12.5);
		expect(types(events)).toContain('stumble');

		const clean = emptyRun();
		addObstacle(clean, 'ditch', 1, 12);
		// take off when the ditch is a second away and keep running
		let leapt = false;
		const cleanEvents: RunEvent[] = [];
		while (clean.distance < 14) {
			if (!leapt && clean.distance > 9) {
				cleanEvents.push(...command(clean, 'jump'));
				leapt = true;
			}
			cleanEvents.push(...stepGame(clean, createRandom(1), STEP));
		}
		expect(types(cleanEvents)).not.toContain('stumble');
		expect(clean.stumbles).toBe(0);
		expect(clean.drone.gap).toBeGreaterThanOrEqual(DRONE_START_GAP);
	});

	it('a tractor arm is cleared by ducking, and jumping does not help', () => {
		const ducked = emptyRun();
		addObstacle(ducked, 'arm', 1, 12);
		let events: RunEvent[] = [];
		while (ducked.distance < 14) {
			if (ducked.distance > 10.8 && !isDucking(ducked.runner)) command(ducked, 'duck');
			events.push(...stepGame(ducked, createRandom(1), STEP));
		}
		expect(ducked.stumbles).toBe(0);

		const jumped = emptyRun();
		addObstacle(jumped, 'arm', 1, 12);
		events = [];
		while (jumped.distance < 14) {
			if (jumped.distance > 9.5 && !isAirborne(jumped.runner) && jumped.distance < 10) {
				command(jumped, 'jump');
			}
			events.push(...stepGame(jumped, createRandom(1), STEP));
		}
		expect(types(events)).toContain('stumble');
	});

	it('a mine cannot be jumped, only sidestepped', () => {
		const jumped = emptyRun();
		addObstacle(jumped, 'mine', 1, 12);
		const events: RunEvent[] = [];
		while (jumped.distance < 14) {
			if (jumped.distance > 9.5 && jumped.runner.jumpMs < 0 && jumped.distance < 10) {
				command(jumped, 'jump');
			}
			events.push(...stepGame(jumped, createRandom(1), STEP));
		}
		expect(types(events)).toContain('stumble');

		const sidestep = emptyRun();
		addObstacle(sidestep, 'mine', 1, 12);
		runTo(sidestep, 8);
		command(sidestep, 'left');
		runTo(sidestep, 14);
		expect(sidestep.stumbles).toBe(0);
	});

	it('an obstacle in another lane does not touch the runner', () => {
		const state = emptyRun();
		addObstacle(state, 'mine', 0, 12);
		addObstacle(state, 'ditch', 2, 12);
		runTo(state, 14);
		expect(state.stumbles).toBe(0);
	});

	it('a stumble lets the drone close in, slows the runner and counts only once', () => {
		const state = emptyRun();
		addObstacle(state, 'ditch', 1, 12);
		const events = runTo(state, 13.5);
		expect(events.filter((event) => event.type === 'stumble')).toHaveLength(1);
		expect(state.stumbles).toBe(1);
		expect(state.drone.gap).toBeLessThan(DRONE_START_GAP - STUMBLE_CLOSE.ditch + 1.5);
		expect(state.speed).toBeLessThan(7);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('a stumble does not cost a heart by itself', () => {
		const state = emptyRun();
		addObstacle(state, 'ditch', 1, 12);
		runTo(state, 20);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('ignores a second obstacle during the grace time after a stumble', () => {
		const state = emptyRun();
		addObstacle(state, 'ditch', 1, 12);
		addObstacle(state, 'mine', 1, 12.8);
		runTo(state, 15);
		expect(state.stumbles).toBe(1);
		expect(STUMBLE_GRACE_MS).toBeGreaterThan(0);
	});
});

describe('drone contact', () => {
	it('costs a heart when the drone catches up, then knocks it back', () => {
		const state = emptyRun();
		state.drone.gap = 0.3;
		const events = run(state, STEP * 2);
		expect(types(events)).toContain('contact');
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.contacts).toBe(1);
		expect(state.drone.gap).toBeGreaterThan(DRONE_RESET_GAP - 0.5);
		expect(state.over).toBe(false);
	});

	it('three quick stumbles are survived, a fourth loses a heart', () => {
		const three = emptyRun();
		for (const z of [12, 18, 24]) addObstacle(three, 'ditch', 1, z);
		runTo(three, 28);
		expect(three.stumbles).toBe(3);
		expect(three.lives).toBe(STARTING_LIVES);
		expect(three.drone.gap).toBeLessThan(2);

		const four = emptyRun();
		for (const z of [12, 18, 24, 30]) addObstacle(four, 'ditch', 1, z);
		runTo(four, 34);
		expect(four.stumbles).toBe(4);
		expect(four.contacts).toBe(1);
		expect(four.lives).toBe(STARTING_LIVES - 1);
	});

	it('ends the run when the last heart goes', () => {
		const state = emptyRun();
		state.lives = 1;
		state.drone.gap = 0;
		const events = run(state, STEP * 2);
		expect(types(events)).toEqual(['contact', 'game-over']);
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
	});
});

describe('pickups', () => {
	it('a helmet boosts speed, scores and smashes through obstacles for a while', () => {
		const state = emptyRun();
		addPickup(state, 'helmet', 1, 8);
		addObstacle(state, 'mine', 1, 14);
		const slow = emptyRun();
		run(slow, 1500);
		const events = runTo(state, 16);
		expect(types(events)).toContain('pickup');
		expect(types(events)).toContain('smash');
		expect(types(events)).not.toContain('stumble');
		expect(state.pickups.helmet).toBe(1);
		expect(state.bonus).toBe(PICKUP_SCORE);
		expect(state.smashes).toBe(1);
		expect(state.speed).toBeGreaterThan(slow.speed);
	});

	it('the boost ends after its time and the drone has fallen back', () => {
		const state = emptyRun();
		state.drone.gap = 3;
		addPickup(state, 'helmet', 1, 1);
		const events = run(state, BOOST_MS + 500);
		expect(types(events)).toContain('boost-end');
		expect(state.power.boostMs).toBe(0);
		expect(state.drone.gap).toBeGreaterThan(8);
	});

	it('a rice bowl absorbs the next stumble, then the shield is gone', () => {
		const state = emptyRun();
		addPickup(state, 'rice', 1, 6);
		addObstacle(state, 'ditch', 1, 12);
		addObstacle(state, 'ditch', 1, 30);
		const events = runTo(state, 14);
		expect(types(events)).toContain('shield-block');
		expect(types(events)).not.toContain('stumble');
		expect(state.stumbles).toBe(0);
		expect(state.drone.gap).toBeGreaterThanOrEqual(DRONE_START_GAP);
		expect(state.power.shield).toBe(false);
		const later = runTo(state, 32);
		expect(types(later)).toContain('stumble');
	});

	it('a rice bowl also absorbs a drone contact', () => {
		const state = emptyRun();
		state.power.shield = true;
		state.drone.gap = 0;
		const events = run(state, STEP * 2);
		expect(events).toContainEqual({ type: 'shield-block', source: 'drone' });
		expect(types(events)).not.toContain('contact');
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.drone.gap).toBeGreaterThan(DRONE_RESET_GAP - 0.5);
		expect(state.power.shield).toBe(false);
	});

	it('is collected from the lane the runner is in, and only once', () => {
		const state = emptyRun();
		addPickup(state, 'rice', 0, 8);
		addPickup(state, 'helmet', 1, 8);
		runTo(state, 10);
		expect(state.pickups).toEqual({ helmet: 1, rice: 0 });
		expect(state.field.pickups.map((pickup) => pickup.taken)).toEqual([false, true]);
	});
});

describe('tall sunflowers', () => {
	it('hide the drone while the runner is among them', () => {
		const state = emptyRun();
		state.field.patches.push({ id: 1, zStart: 10, zEnd: 20, lanes: [1] });
		runTo(state, 5);
		expect(state.hidden).toBe(false);
		runTo(state, 12);
		expect(state.hidden).toBe(true);
		command(state, 'left');
		run(state, 300);
		expect(state.hidden).toBe(false);
	});
});

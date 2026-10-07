import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	FIRST_PREP_MS,
	PREP_MS,
	SLOTS,
	SOLDIERS,
	STARTING_HELMETS,
	STARTING_LIVES,
	defenseStats
} from './config';
import { build } from './economy';
import { ROAD } from './path';
import { createGame, type DroneWallEvent, type DroneWallState } from './state';
import { damageSoldier, spawnSoldier, stepGame, waveBonus } from './step';
import { STEP_MS, soldierAt } from './testHelpers';
import { waveSize } from './waves';

const random = () => createRandom(1);

/** Runs steps until the condition holds (or the step limit is hit), collecting every event */
function runUntil(
	state: DroneWallState,
	done: (events: DroneWallEvent[]) => boolean,
	limit = 60 * 600
) {
	const rng = random();
	const all: DroneWallEvent[] = [];
	for (let i = 0; i < limit && !state.over; i++) {
		all.push(...stepGame(state, rng, STEP_MS));
		if (done(all)) break;
	}
	return all;
}

/** A game that is already in a running wave with an empty queue, to place soldiers by hand */
function emptyWave(): DroneWallState {
	const state = createGame();
	state.phase = 'wave';
	state.wave = 1;
	state.queue = [{ atMs: 1e9, kind: 'grunt', speedScale: 1, lane: 0 }];
	return state;
}

describe('waves', () => {
	it('waits for the build time, then starts wave 1', () => {
		const state = createGame();
		const events = runUntil(state, (all) => all.some((event) => event.type === 'wave-started'));
		expect(events).toContainEqual({ type: 'wave-started', wave: 1 });
		expect(state.timeMs).toBeGreaterThanOrEqual(FIRST_PREP_MS);
		expect(state.timeMs).toBeLessThan(FIRST_PREP_MS + 100);
		expect(state.phase).toBe('wave');
	});

	it('spawns the whole wave, one soldier at a time', () => {
		const state = createGame();
		runUntil(state, () => state.phase === 'wave' && state.queueIndex >= state.queue.length);
		expect(state.queue).toHaveLength(waveSize(1));
		expect(state.soldiers.length + state.kills).toBeGreaterThan(0);
	});

	it('clears the wave, pays the bonus and gives a build break', () => {
		const state = emptyWave();
		state.queue = [];
		const events = stepGame(state, random(), STEP_MS);
		expect(events).toContainEqual({ type: 'wave-cleared', wave: 1, bonus: waveBonus(1) });
		expect(state.score).toBe(waveBonus(1));
		expect(state.phase).toBe('prep');
		expect(state.prepMs).toBe(PREP_MS);
	});

	it('does not clear a wave while soldiers or shells remain', () => {
		const state = emptyWave();
		state.queue = [];
		state.soldiers.push(soldierAt(100));
		expect(stepGame(state, random(), STEP_MS).map((e) => e.type)).not.toContain('wave-cleared');
	});

	it('makes soldiers sturdier in later waves', () => {
		const early = createGame();
		early.wave = 1;
		const late = createGame();
		late.wave = 10;
		const entry = { atMs: 0, kind: 'grunt' as const, speedScale: 1, lane: 0 };
		expect(spawnSoldier(late, entry).maxHp).toBeGreaterThan(spawnSoldier(early, entry).maxHp);
	});
});

describe('marching', () => {
	it('moves a soldier along the road at its own speed', () => {
		const state = emptyWave();
		const soldier = soldierAt(100, 'grunt', { speed: 60 });
		state.soldiers.push(soldier);
		for (let i = 0; i < 60; i++) stepGame(state, random(), STEP_MS);
		expect(soldier.progress).toBeCloseTo(160, 0);
	});

	it('a soldier crossing the line costs a heart and is removed', () => {
		const state = emptyWave();
		state.soldiers.push(soldierAt(ROAD.length - 0.1));
		const events = stepGame(state, random(), STEP_MS);
		expect(events.map((event) => event.type)).toContain('leak');
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.soldiers).toHaveLength(0);
		expect(state.over).toBe(false);
	});

	it('every soldier costs exactly one heart, brutes included', () => {
		const state = emptyWave();
		state.soldiers.push(
			soldierAt(ROAD.length - 0.1, 'scout'),
			soldierAt(ROAD.length - 0.1, 'brute'),
			soldierAt(ROAD.length - 0.1, 'grunt')
		);
		stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(STARTING_LIVES - 3);
	});

	it('ends the game when the last heart goes', () => {
		const state = emptyWave();
		state.lives = 1;
		state.soldiers.push(soldierAt(ROAD.length - 0.1));
		const events = stepGame(state, random(), STEP_MS);
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
		expect(events.at(-1)).toEqual({ type: 'game-over' });
		// A finished game stays finished
		expect(stepGame(state, random(), STEP_MS)).toEqual([]);
	});

	it('trenches slow the crowd', () => {
		const free = emptyWave();
		const slowed = emptyWave();
		build(slowed, 2, 'trench');
		const a = soldierAt(150);
		const b = soldierAt(150);
		free.soldiers.push(a);
		slowed.soldiers.push(b);
		for (let i = 0; i < 120; i++) {
			stepGame(free, random(), STEP_MS);
			stepGame(slowed, random(), STEP_MS);
		}
		expect(b.slow).toBeLessThan(1);
		expect(b.progress - 150).toBeLessThan((a.progress - 150) * 0.8);
	});
});

describe('defenses in action', () => {
	it('a squad shoots a soldier in range, drops a helmet and scores', () => {
		const state = emptyWave();
		build(state, 2, 'squad');
		const soldier = soldierAt(150, 'scout');
		state.soldiers.push(soldier);
		const events = runUntil(state, (all) => all.some((e) => e.type === 'soldier-fell'), 600);
		expect(events.map((event) => event.type)).toContain('squad-shot');
		expect(state.kills).toBe(1);
		expect(state.score).toBe(SOLDIERS.scout.points);
		expect(state.helmets).toHaveLength(1);
		expect(state.helmets[0].value).toBe(SOLDIERS.scout.value);
		expect(state.soldiers).toHaveLength(0);
	});

	it('a brute drops a helmet worth more', () => {
		const state = emptyWave();
		const brute = soldierAt(300, 'brute');
		state.soldiers.push(brute);
		damageSoldier(brute, 9999);
		stepGame(state, random(), STEP_MS);
		expect(state.helmets).toHaveLength(1);
		expect(state.helmets[0].value).toBe(SOLDIERS.brute.value);
	});

	it('a drone nest hits for its damage, then waits out the cooldown', () => {
		const state = emptyWave();
		build(state, 2, 'nest');
		const stats = defenseStats('nest', 1);
		const brute = soldierAt(250, 'brute');
		brute.speed = 0;
		state.soldiers.push(brute);
		const events = runUntil(state, (all) => all.some((e) => e.type === 'drone-strike'), 600);
		expect(events.filter((e) => e.type === 'drone-strike')).toHaveLength(1);
		expect(brute.hp).toBe(brute.maxHp - stats.damage);
		// Not again before the cooldown has passed
		const again = runUntil(state, () => false, Math.floor(stats.intervalMs / STEP_MS) - 5);
		expect(again.filter((e) => e.type === 'drone-strike')).toHaveLength(0);
		const later = runUntil(state, (all) => all.some((e) => e.type === 'drone-strike'), 20);
		expect(later.filter((e) => e.type === 'drone-strike')).toHaveLength(1);
	});

	it('a mortar shell lands after its flight and hurts everyone in the blast', () => {
		const state = emptyWave();
		build(state, 2, 'mortar');
		const stats = defenseStats('mortar', 1);
		const clump = [0, 5, 10].map((offset) => {
			const soldier = soldierAt(220 + offset, 'grunt');
			soldier.speed = 0;
			return soldier;
		});
		state.soldiers.push(...clump);
		const events = runUntil(state, (all) => all.some((e) => e.type === 'shell-landed'), 600);
		expect(events.map((event) => event.type)).toContain('shell-launched');
		expect(state.shells).toHaveLength(0);
		for (const soldier of clump) expect(soldier.hp).toBeLessThan(soldier.maxHp);
		expect(clump[0].maxHp - clump[0].hp).toBeLessThanOrEqual(stats.damage);
	});

	it('mines hurt from level 2', () => {
		const state = emptyWave();
		build(state, 2, 'trench');
		state.defenses[2]!.level = 3;
		const soldier = soldierAt(170);
		soldier.speed = 0;
		state.soldiers.push(soldier);
		for (let i = 0; i < 60; i++) stepGame(state, random(), STEP_MS);
		expect(soldier.hp).toBeLessThan(soldier.maxHp);
	});

	it('is deterministic for a seed', () => {
		const play = () => {
			const state = createGame();
			build(state, 2, 'squad');
			build(state, 3, 'mortar');
			const rng = createRandom(42);
			for (let i = 0; i < 60 * 40; i++) stepGame(state, rng, STEP_MS);
			return JSON.stringify(state);
		};
		expect(play()).toBe(play());
	});

	it('starts with enough helmets for an opening defense', () => {
		const state = createGame();
		expect(state.currency).toBe(STARTING_HELMETS);
		expect(state.defenses).toHaveLength(SLOTS.length);
	});
});

describe('spawn', () => {
	it('enters above the field at the start of the road', () => {
		const state = emptyWave();
		const soldier = spawnSoldier(state, { atMs: 0, kind: 'grunt', speedScale: 1, lane: 0 });
		expect(soldier.y).toBeLessThan(0);
		expect(soldier.progress).toBe(0);
	});
});

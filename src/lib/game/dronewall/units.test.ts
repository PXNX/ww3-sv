import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { SOLDIERS, defenseStats } from './config';
import { build, sell, upgrade } from './economy';
import { distanceBetween } from './path';
import { createGame, type DroneWallEvent, type DroneWallState } from './state';
import { stepGame } from './step';
import { STEP_MS, flyerAt, soldierAt } from './testHelpers';

const random = () => createRandom(1);

/** A game that is already in a running wave with an empty queue, to place soldiers by hand */
function emptyWave(): DroneWallState {
	const state = createGame();
	state.phase = 'wave';
	state.wave = 1;
	state.currency = 500;
	state.queue = [{ atMs: 1e9, kind: 'grunt', speedScale: 1, lane: 0 }];
	return state;
}

function run(state: DroneWallState, steps: number, until?: () => boolean): DroneWallEvent[] {
	const rng = random();
	const events: DroneWallEvent[] = [];
	for (let i = 0; i < steps && !state.over; i++) {
		events.push(...stepGame(state, rng, STEP_MS));
		if (until?.()) break;
	}
	return events;
}

const unitsOf = (state: DroneWallState, slot: number) => state.units.filter((u) => u.slot === slot);

describe('garrison units', () => {
	it('an Azov post sends its fighters one after the other, up to its count', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		const events = run(state, 60 * 3);
		expect(unitsOf(state, 2)).toHaveLength(defenseStats('azov', 1).unitCount);
		expect(events.filter((e) => e.type === 'unit-spawned')).toHaveLength(2);
	});

	it('a Leopard post sends a single tank, and an upgrade adds fighters to an Azov post', () => {
		const state = emptyWave();
		build(state, 2, 'leopard');
		build(state, 3, 'azov');
		run(state, 60 * 3);
		expect(unitsOf(state, 2)).toHaveLength(1);
		expect(unitsOf(state, 3)).toHaveLength(2);
		upgrade(state, 3);
		run(state, 60 * 3);
		expect(unitsOf(state, 3)).toHaveLength(3);
	});

	it('idle units keep to a circle around their post', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		const home = state.map.slots[2];
		for (let i = 0; i < 20; i++) {
			run(state, 30);
			for (const unit of unitsOf(state, 2)) {
				expect(distanceBetween(home, unit)).toBeLessThan(60);
			}
		}
		const first = unitsOf(state, 2)[0];
		const before = { x: first.x, y: first.y };
		run(state, 120);
		expect(distanceBetween(before, first)).toBeGreaterThan(1);
	});

	it('fighters run at a soldier in range, hold it and fight it to the end', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		run(state, 60 * 3);
		const grunt = soldierAt(190, 'grunt');
		state.soldiers.push(grunt);
		const events = run(state, 60 * 12, () => state.kills > 0);
		expect(events.map((e) => e.type)).toContain('melee-hit');
		expect(state.kills).toBe(1);
		expect(state.helmets).toHaveLength(1);
	});

	it('a soldier in melee stops marching', () => {
		const free = emptyWave();
		const blocked = emptyWave();
		build(blocked, 2, 'azov');
		run(blocked, 60 * 3);
		const a = soldierAt(190, 'brute');
		const b = soldierAt(190, 'brute');
		free.soldiers.push(a);
		blocked.soldiers.push(b);
		run(free, 60 * 4);
		run(blocked, 60 * 4);
		expect(b.engaged).toBe(true);
		expect(b.progress).toBeLessThan(a.progress - 40);
	});

	it('does not touch soldiers beyond the leash of the post', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		run(state, 60 * 3);
		const far = soldierAt(900, 'grunt', { speed: 0 });
		state.soldiers.push(far);
		run(state, 60 * 3);
		expect(far.hp).toBe(far.maxHp);
		expect(far.engaged).toBe(false);
		expect(unitsOf(state, 2).every((u) => u.targetId === null)).toBe(true);
	});

	it('a Leopard crushes every soldier in reach with each hit, a fighter only the one it fights', () => {
		const damageDealt = (kind: 'azov' | 'leopard') => {
			const state = emptyWave();
			build(state, 2, kind);
			run(state, 60 * 3);
			const unit = unitsOf(state, 2)[0];
			// A clump standing on top of the unit
			const clump = [0, 1, 2].map(() => {
				const soldier = soldierAt(190, 'brute', { speed: 0 });
				soldier.x = unit.x + 4;
				soldier.y = unit.y;
				return soldier;
			});
			state.soldiers.push(...clump);
			run(state, 5);
			return clump.filter((soldier) => soldier.hp < soldier.maxHp).length;
		};
		expect(damageDealt('azov')).toBe(1);
		expect(damageDealt('leopard')).toBe(3);
	});

	it('a unit falls when soldiers wear it down, and the post sends a new one later', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		run(state, 60 * 3);
		const stats = defenseStats('azov', 1);
		// A very strong brute that cannot be stopped
		const brute = soldierAt(190, 'brute', { hp: 99999, maxHp: 99999 });
		state.soldiers.push(brute);
		const events = run(state, 60 * 60, () => unitsOf(state, 2).length === 0);
		expect(events.map((e) => e.type)).toContain('unit-fell');
		expect(unitsOf(state, 2).length).toBeLessThan(stats.unitCount);
		// With the brute gone, the post refills
		state.soldiers = [];
		run(state, Math.ceil((stats.intervalMs * 2.5) / STEP_MS));
		expect(unitsOf(state, 2)).toHaveLength(stats.unitCount);
	});

	it('hurts a unit by the damage per second of the soldier it fights', () => {
		const state = emptyWave();
		build(state, 2, 'leopard');
		run(state, 60 * 3);
		const unit = unitsOf(state, 2)[0];
		const grunt = soldierAt(190, 'grunt', { speed: 0, hp: 99999, maxHp: 99999 });
		grunt.x = unit.x + 5;
		grunt.y = unit.y;
		state.soldiers.push(grunt);
		const before = unit.hp;
		run(state, 60);
		expect(before - unit.hp).toBeGreaterThan(SOLDIERS.grunt.meleeDps * 0.5);
		expect(before - unit.hp).toBeLessThan(SOLDIERS.grunt.meleeDps * 1.5);
	});

	it('selling the post sends its units away', () => {
		const state = emptyWave();
		build(state, 2, 'azov');
		run(state, 60 * 3);
		expect(unitsOf(state, 2).length).toBeGreaterThan(0);
		sell(state, 2);
		expect(state.units).toHaveLength(0);
	});

	it('ignores aircraft', () => {
		const state = emptyWave();
		build(state, 2, 'leopard');
		run(state, 60 * 3);
		const heli = flyerAt(110, 190, 'heli', { speed: 0 });
		state.flyers.push(heli);
		run(state, 60 * 2);
		expect(state.units[0].targetId).toBeNull();
		expect(heli.hp).toBe(heli.maxHp);
	});
});

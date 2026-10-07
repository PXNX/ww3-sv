import { describe, expect, it } from 'vitest';
import { SLOTS, defenseStats } from './config';
import { ROAD, distanceBetween, pointAt } from './path';
import type { Defense } from './state';
import {
	inRange,
	mineDpsAt,
	pickMortarAim,
	pickNestTarget,
	pickSquadTarget,
	predictPosition,
	slowAt,
	splashDamage
} from './targeting';
import { soldierAt } from './testHelpers';

const origin = SLOTS[2];
// Progress values of road points near SLOTS[2] (100, 165): the row at y = 100 and the row at y = 230
const ROW_ONE = 120 + 100; // on the first long row, around x = 150
const ROW_TWO = 120 + 260 + 130 + 190; // on the second row, around x = 120

describe('range filter', () => {
	it('keeps living soldiers in range and drops the rest', () => {
		const near = soldierAt(ROW_ONE);
		const far = soldierAt(ROW_ONE + 600);
		const dead = soldierAt(ROW_ONE, 'grunt', { hp: 0 });
		const offscreen = soldierAt(0);
		const found = inRange([near, far, dead, offscreen], origin, 120);
		expect(found).toEqual([near]);
	});

	it('honours the minimum range', () => {
		const near = soldierAt(ROW_ONE);
		const distance = distanceBetween(origin, near);
		expect(inRange([near], origin, 200, distance + 1)).toEqual([]);
		expect(inRange([near], origin, 200, distance - 1)).toEqual([near]);
	});
});

describe('assault squad targeting', () => {
	const stats = defenseStats('squad', 1);

	it('shoots whoever is closest to the line', () => {
		const behind = soldierAt(ROW_ONE);
		const ahead = soldierAt(ROW_TWO);
		expect(pickSquadTarget([behind, ahead], origin, stats)).toBe(ahead);
		expect(pickSquadTarget([ahead, behind], origin, stats)).toBe(ahead);
	});

	it('finds nobody when the crowd is out of range', () => {
		expect(pickSquadTarget([soldierAt(900)], origin, stats)).toBeNull();
		expect(pickSquadTarget([], origin, stats)).toBeNull();
	});
});

describe('drone nest targeting', () => {
	const stats = defenseStats('nest', 1);

	it('picks the toughest soldier in reach', () => {
		const grunt = soldierAt(ROW_ONE);
		const brute = soldierAt(ROW_ONE - 20, 'brute');
		const hurtBrute = soldierAt(ROW_ONE + 10, 'brute', { hp: 20 });
		expect(pickNestTarget([grunt, hurtBrute, brute], origin, stats)).toBe(brute);
	});

	it('breaks ties by progress', () => {
		const a = soldierAt(ROW_ONE);
		const b = soldierAt(ROW_ONE + 15);
		expect(pickNestTarget([a, b], origin, stats)).toBe(b);
	});
});

describe('mortar targeting', () => {
	const stats = defenseStats('mortar', 1);

	it('predicts where a soldier will be when the shell lands', () => {
		const soldier = soldierAt(ROW_ONE);
		const spot = predictPosition(soldier, 1000);
		const expected = pointAt(ROAD, ROW_ONE + soldier.speed);
		expect(spot.x).toBeCloseTo(expected.x);
		expect(spot.y).toBeCloseTo(expected.y);
	});

	it('aims at the clump, not at the lone soldier ahead of it', () => {
		const clump = [0, 6, 12, 18].map((offset) => soldierAt(ROW_ONE + offset));
		const loner = soldierAt(ROW_TWO + 40);
		const aim = pickMortarAim([loner, ...clump], origin, stats);
		expect(aim).not.toBeNull();
		expect(aim!.hits).toBe(4);
		const centre = predictPosition(clump[1], stats.flightMs);
		expect(distanceBetween(aim!, centre)).toBeLessThan(stats.splashRadius);
	});

	it('goes for the soldier closest to the line when nothing is clumped', () => {
		const behind = soldierAt(ROW_ONE);
		const ahead = soldierAt(ROW_TWO);
		const aim = pickMortarAim([behind, ahead], origin, stats)!;
		expect(aim.hits).toBe(1);
		expect(distanceBetween(aim, predictPosition(ahead, stats.flightMs))).toBeLessThan(1);
	});

	it('cannot hit targets closer than its minimum range', () => {
		const soldier = soldierAt(ROW_ONE);
		const aim = pickMortarAim([soldier], origin, { ...stats, minRange: 500 });
		expect(aim).toBeNull();
	});

	it('does nothing without targets', () => {
		expect(pickMortarAim([], origin, stats)).toBeNull();
	});
});

describe('damage', () => {
	it('splash is full at the centre, half at the edge and zero outside', () => {
		expect(splashDamage(40, 0, 50)).toBe(40);
		expect(splashDamage(40, 25, 50)).toBe(30);
		expect(splashDamage(40, 50, 50)).toBe(20);
		expect(splashDamage(40, 51, 50)).toBe(0);
		expect(splashDamage(40, 0, 0)).toBe(0);
	});
});

describe('trenches', () => {
	const trench = (level: number): Defense => ({
		kind: 'trench',
		level,
		cooldownMs: 0,
		aim: 0,
		firedMs: 0
	});

	it('slow soldiers inside their range only', () => {
		const defenses: (Defense | null)[] = SLOTS.map(() => null);
		defenses[2] = trench(1);
		const range = defenseStats('trench', 1).range;
		expect(slowAt({ x: origin.x + range - 1, y: origin.y }, defenses)).toBeLessThan(1);
		expect(slowAt({ x: origin.x + range + 1, y: origin.y }, defenses)).toBe(1);
	});

	it('use the strongest slow when they overlap, without stacking', () => {
		const defenses: (Defense | null)[] = SLOTS.map(() => null);
		defenses[2] = trench(1);
		defenses[3] = trench(3);
		const between = { x: (SLOTS[2].x + SLOTS[3].x) / 2, y: SLOTS[2].y };
		expect(slowAt(between, defenses)).toBe(defenseStats('trench', 3).slow);
	});

	it('only mines from level 2 and ignore other defenses', () => {
		const defenses: (Defense | null)[] = SLOTS.map(() => null);
		defenses[2] = trench(1);
		expect(mineDpsAt(origin, defenses)).toBe(0);
		defenses[2] = trench(2);
		expect(mineDpsAt(origin, defenses)).toBe(defenseStats('trench', 2).dps);
		defenses[2] = { ...trench(3), kind: 'squad' };
		expect(slowAt(origin, defenses)).toBe(1);
		expect(mineDpsAt(origin, defenses)).toBe(0);
	});
});

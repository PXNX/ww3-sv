import { describe, expect, it } from 'vitest';
import { cellOf, type CellOutcome, type Ship } from './fleet';
import {
	HIT_POINTS,
	STAR_BONUS,
	comboMultiplier,
	fleetResult,
	newRun,
	scoreVolley,
	starsFor
} from './scoring';

const SHIPS: Ship[] = [{ class: 'tarantul', cells: [cellOf(0, 0), cellOf(1, 0)] }];

const hit: CellOutcome = { cell: 0, kind: 'hit', ship: 0 };
const sunk: CellOutcome = { cell: 1, kind: 'sunk', ship: 0, points: 100 };
const miss: CellOutcome = { cell: 5, kind: 'miss' };

describe('combo scoring', () => {
	it('grows the multiplier with the streak up to a limit', () => {
		expect([0, 1, 2, 3, 10].map(comboMultiplier)).toEqual([1, 1, 1.25, 1.5, 2.5]);
	});

	it('builds a streak over hits, pays the sunk class and resets on a strike without a hit', () => {
		const first = scoreVolley(newRun(), [hit], SHIPS);
		expect(first.gained).toBe(HIT_POINTS);
		expect(first.run).toMatchObject({ streak: 1, hits: 1, strikes: 1 });

		const second = scoreVolley(first.run, [sunk], SHIPS);
		expect(second.gained).toBe(Math.round((HIT_POINTS + 100) * 1.25));
		expect(second.run.streak).toBe(2);
		expect(second.run.bestStreak).toBe(2);

		const third = scoreVolley(second.run, [miss], SHIPS);
		expect(third.gained).toBe(0);
		expect(third.run).toMatchObject({ streak: 0, bestStreak: 2, strikes: 3 });
	});

	it('keeps a streak through a salvo that has at least one hit', () => {
		const result = scoreVolley(newRun(), [miss, hit], SHIPS);
		expect(result.run.streak).toBe(1);
	});
});

describe('fleet result', () => {
	it('rates accuracy in stars and adds the bonus', () => {
		expect([0.2, 0.34, 0.49, 0.5, 1].map(starsFor)).toEqual([1, 2, 2, 3, 3]);
		const run = { ...newRun(), strikes: 3, hits: 2, bestStreak: 2, points: 150 };
		const shots = [0, 1, 7, 8].map((cell) => ({ cell, weapon: 'neptune' as const }));
		const result = fleetResult(SHIPS, shots, run);
		expect(result.accuracy).toBe(0.5);
		expect(result.stars).toBe(3);
		expect(result.bonus).toBe(3 * STAR_BONUS);
		expect(result.points).toBe(150 + 3 * STAR_BONUS);
	});
});

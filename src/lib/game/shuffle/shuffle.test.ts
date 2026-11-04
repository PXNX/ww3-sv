import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { MAX_SHIPS, MIN_SHIPS, TOTAL_ROUNDS, roundConfig } from './config.js';
import { FLAGS, createFleet, repaint } from './fleet.js';
import { applyMove, arcOffset, destinationSlot, easeInOut, planShuffle } from './moves.js';
import {
	clearBonus,
	earnsPing,
	pickScore,
	speedBonus,
	starRating,
	streakMultiplier,
	wrongPenalty
} from './scoring.js';

describe('round config', () => {
	it('escalates: more ships, more moves, faster moves', () => {
		const first = roundConfig(1);
		const last = roundConfig(TOTAL_ROUNDS);
		expect(first.ships).toBe(MIN_SHIPS);
		expect(last.ships).toBe(MAX_SHIPS);
		expect(last.moves).toBeGreaterThan(first.moves);
		expect(last.moveMs).toBeLessThan(first.moveMs);
		expect(last.revealMs).toBeLessThan(first.revealMs);
	});

	it('introduces the tricks one by one', () => {
		expect(roundConfig(1)).toMatchObject({
			crossChance: 0,
			cycleChance: 0,
			reflags: 0,
			darkDecoys: 0
		});
		expect(roundConfig(3).crossChance).toBeGreaterThan(0);
		expect(roundConfig(3).reflags).toBeGreaterThan(0);
		expect(roundConfig(4).darkDecoys).toBeGreaterThan(0);
		expect(roundConfig(5).cycleChance).toBeGreaterThan(0);
	});

	it('clamps rounds out of range and keeps at least one ship un-dark', () => {
		expect(roundConfig(0).round).toBe(1);
		expect(roundConfig(99).round).toBe(TOTAL_ROUNDS);
		for (let r = 1; r <= TOTAL_ROUNDS; r++) {
			const c = roundConfig(r);
			expect(c.darkDecoys).toBeLessThan(c.ships);
			expect(c.moveMs).toBeGreaterThanOrEqual(280);
		}
	});
});

describe('moves', () => {
	it('rotates the ships along the slots', () => {
		expect(applyMove([10, 11, 12], [0, 2])).toEqual([12, 11, 10]);
		expect(applyMove([10, 11, 12, 13], [0, 1, 3])).toEqual([13, 10, 12, 11]);
	});

	it('keeps every ship exactly once', () => {
		const random = createRandom(5);
		for (let round = 1; round <= TOTAL_ROUNDS; round++) {
			const config = roundConfig(round);
			let order = Array.from({ length: config.ships }, (_, i) => i);
			for (const step of planShuffle(config, random)) {
				if (step.type !== 'move') continue;
				expect(new Set(step.slots).size).toBe(step.slots.length);
				expect(step.slots.every((s) => s >= 0 && s < config.ships)).toBe(true);
				order = applyMove(order, step.slots);
			}
			expect([...order].sort()).toEqual(Array.from({ length: config.ships }, (_, i) => i));
		}
	});

	it('plans the right number of moves and extra events', () => {
		const config = roundConfig(8);
		const steps = planShuffle(config, createRandom(1));
		expect(steps.filter((s) => s.type === 'move')).toHaveLength(config.moves);
		expect(steps.filter((s) => s.type === 'reflag')).toHaveLength(config.reflags);
		expect(steps.filter((s) => s.type === 'dark')).toHaveLength(config.darkDecoys);
		expect(steps[0].type).toBe('move');
	});

	it('only plays plain swaps in round one and never undoes the last swap', () => {
		for (let seed = 1; seed < 30; seed++) {
			const steps = planShuffle(roundConfig(1), createRandom(seed));
			let previous: number[] | null = null;
			for (const step of steps) {
				if (step.type !== 'move') continue;
				expect(step.kind).toBe('swap');
				if (previous) expect([...step.slots].sort()).not.toEqual([...previous].sort());
				previous = step.slots;
			}
		}
	});

	it('uses crossings that jump over a ship and three-way rotations later on', () => {
		const kinds = new Set<string>();
		for (let seed = 1; seed < 40; seed++) {
			for (const step of planShuffle(roundConfig(9), createRandom(seed))) {
				if (step.type !== 'move') continue;
				kinds.add(step.kind);
				if (step.kind === 'cross')
					expect(Math.abs(step.slots[0] - step.slots[1])).toBeGreaterThanOrEqual(2);
				if (step.kind === 'cycle') expect(step.slots).toHaveLength(3);
			}
		}
		expect([...kinds].sort()).toEqual(['cross', 'cycle', 'swap']);
	});

	it('finds where a ship ends up', () => {
		expect(destinationSlot([0, 2], 0)).toBe(2);
		expect(destinationSlot([0, 2], 2)).toBe(0);
		expect(destinationSlot([0, 2], 1)).toBe(1);
		expect(destinationSlot([1, 2, 3], 3)).toBe(1);
	});

	it('eases from 0 to 1 and sends the two ships over opposite arcs', () => {
		expect(easeInOut(0)).toBe(0);
		expect(easeInOut(1)).toBe(1);
		expect(easeInOut(0.5)).toBeCloseTo(0.5);
		expect(easeInOut(0.2)).toBeLessThan(0.2);
		expect(arcOffset('swap', 0, 0)).toBeCloseTo(0);
		expect(arcOffset('swap', 0, 1)).toBeCloseTo(0);
		expect(arcOffset('swap', 0, 0.5)).toBeLessThan(0);
		expect(arcOffset('swap', 1, 0.5)).toBeGreaterThan(0);
		expect(Math.abs(arcOffset('cross', 0, 0.5))).toBeGreaterThan(
			Math.abs(arcOffset('swap', 0, 0.5))
		);
	});
});

describe('fleet', () => {
	it('lines up unique flags and exactly one tanker', () => {
		for (let count = MIN_SHIPS; count <= MAX_SHIPS; count++) {
			const { ships, tankerId } = createFleet(count, createRandom(count));
			expect(ships).toHaveLength(count);
			expect(ships.filter((s) => s.kind === 'tanker')).toHaveLength(1);
			expect(ships[tankerId].kind).toBe('tanker');
			expect(new Set(ships.map((s) => s.flag)).size).toBe(count);
			expect(new Set(ships.map((s) => s.name)).size).toBe(count);
			expect(ships.map((s) => s.slot)).toEqual(ships.map((_, i) => i));
		}
	});

	it('repaints to a different flag and name', () => {
		const random = createRandom(2);
		for (let i = 0; i < 40; i++) {
			const next = repaint({ flag: i % FLAGS.length, name: i % 10 }, random);
			expect(next.flag).not.toBe(i % FLAGS.length);
			expect(next.name).not.toBe(i % 10);
		}
	});
});

describe('scoring', () => {
	it('builds a combo up to x3', () => {
		expect(streakMultiplier(1)).toBe(1);
		expect(streakMultiplier(2)).toBe(1.25);
		expect(streakMultiplier(5)).toBe(2);
		expect(streakMultiplier(50)).toBe(3);
	});

	it('pays quick picks more', () => {
		expect(speedBonus(0)).toBe(0.5);
		expect(speedBonus(3000)).toBeCloseTo(0.25);
		expect(speedBonus(9000)).toBe(0);
	});

	it('pays the round, the combo and the speed, and halves a pinged pick', () => {
		const slow = { round: 3, streak: 1, elapsedMs: 10000, pinged: false };
		expect(pickScore(slow)).toBe(300);
		expect(pickScore({ ...slow, streak: 3 })).toBe(450);
		expect(pickScore({ ...slow, elapsedMs: 0 })).toBe(450);
		expect(pickScore({ ...slow, pinged: true })).toBe(150);
	});

	it('punishes a miss, rewards the clear and hands out pings and stars', () => {
		expect(wrongPenalty(4)).toBe(100);
		expect(clearBonus(2)).toBe(500);
		expect(clearBonus(-1)).toBe(0);
		expect(earnsPing(4, 1)).toBe(true);
		expect(earnsPing(4, 2)).toBe(false);
		expect(earnsPing(3, 0)).toBe(false);
		expect(starRating(true, TOTAL_ROUNDS, 3)).toBe(3);
		expect(starRating(true, TOTAL_ROUNDS, 1)).toBe(2);
		expect(starRating(false, 6, 0)).toBe(1);
		expect(starRating(false, 2, 0)).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { ENDS_TOTAL, HOUSE, SEAL_R, STAR_THRESHOLDS } from './config';
import {
	endHazards,
	finalScore,
	hazardIntroducedAt,
	hintFraction,
	ringPoints,
	scoreStone,
	sealCount,
	starsFor,
	summarizeEnd
} from './ends';

const at = (dx: number, dy: number) => ({ x: HOUSE.x + dx, y: HOUSE.y + dy });
const rest = (dx: number, dy: number, gamble = false) => ({
	...at(dx, dy),
	status: 'rest' as const,
	gamble
});

describe('hazards per end', () => {
	it('start clean and add wind, a penguin, seals and drift one after the other', () => {
		const random = () => createRandom(5);
		const first = endHazards(0, random());
		expect(first).toEqual({ wind: 0, penguin: null, seals: [], drift: null });
		expect(endHazards(1, random()).wind).not.toBe(0);
		expect(endHazards(1, random()).penguin).toBeNull();
		expect(endHazards(2, random()).penguin).not.toBeNull();
		expect(endHazards(2, random()).seals).toHaveLength(0);
		expect(endHazards(3, random()).seals).toHaveLength(1);
		expect(endHazards(4, random()).drift).toBeNull();
		expect(endHazards(5, random()).drift).not.toBeNull();
		expect(endHazards(7, random()).seals).toHaveLength(3);
	});

	it('announces each new hazard in the end that introduces it', () => {
		expect([0, 1, 2, 3, 4, 5, 6, 7].map(hazardIntroducedAt)).toEqual([
			null,
			'wind',
			'penguin',
			'seals',
			null,
			'drift',
			null,
			null
		]);
	});

	it('gets stronger wind and more seals late in the game', () => {
		let early = 0;
		let late = 0;
		for (let seed = 1; seed <= 30; seed++) {
			early += Math.abs(endHazards(1, createRandom(seed)).wind);
			late += Math.abs(endHazards(7, createRandom(seed)).wind);
		}
		expect(late).toBeGreaterThan(early);
		expect(sealCount(7)).toBeGreaterThan(sealCount(3));
	});

	it('keeps seals apart from each other and off the house', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const { seals } = endHazards(7, createRandom(seed));
			for (const seal of seals) {
				expect(Math.hypot(seal.x - HOUSE.x, seal.y - HOUSE.y)).toBeGreaterThan(70 + SEAL_R);
			}
			for (let i = 0; i < seals.length; i++) {
				for (let j = i + 1; j < seals.length; j++) {
					expect(Math.hypot(seals[i].x - seals[j].x, seals[i].y - seals[j].y)).toBeGreaterThan(70);
				}
			}
		}
	});

	it('is the same end for the same seed', () => {
		expect(endHazards(6, createRandom(9))).toEqual(endHazards(6, createRandom(9)));
	});

	it('shrinks the aiming hint with every end but never removes it', () => {
		const fractions = Array.from({ length: ENDS_TOTAL }, (_, end) => hintFraction(end));
		expect(fractions[0]).toBe(1);
		for (let i = 1; i < fractions.length; i++) expect(fractions[i]).toBeLessThan(fractions[i - 1]);
		expect(fractions[ENDS_TOTAL - 1]).toBeGreaterThan(0);
	});
});

describe('scoring', () => {
	it('scores the ring a stone rests in', () => {
		expect(ringPoints(HOUSE.x, HOUSE.y)).toBe(10);
		expect(ringPoints(HOUSE.x + 30, HOUSE.y)).toBe(6);
		expect(ringPoints(HOUSE.x, HOUSE.y + 60)).toBe(3);
		expect(ringPoints(HOUSE.x - 90, HOUSE.y)).toBe(1);
		expect(ringPoints(HOUSE.x + 120, HOUSE.y)).toBe(0);
	});

	it('doubles a gamble inside the house and charges for one outside or in the sea', () => {
		expect(scoreStone(rest(0, 0, true)).points).toBe(20);
		expect(scoreStone(rest(150, 0, true)).points).toBe(-3);
		expect(scoreStone({ ...at(0, 0), status: 'sunk', gamble: true }).points).toBe(-3);
		expect(scoreStone({ ...at(0, 0), status: 'sunk', gamble: false }).points).toBe(0);
		expect(scoreStone(rest(150, 0)).points).toBe(0);
	});

	it('awards stars at the thresholds', () => {
		expect(starsFor(0)).toBe(0);
		expect(starsFor(STAR_THRESHOLDS[0] - 1)).toBe(0);
		expect(starsFor(STAR_THRESHOLDS[0])).toBe(1);
		expect(starsFor(STAR_THRESHOLDS[1])).toBe(2);
		expect(starsFor(STAR_THRESHOLDS[2])).toBe(3);
		expect(starsFor(99)).toBe(3);
	});

	it('sums an end, takes off the penguin penalty and never goes below zero', () => {
		const good = summarizeEnd(0, [rest(0, 0), rest(30, 0)], 0, 0);
		expect(good.points).toBe(16);
		expect(good.stars).toBe(3);
		expect(good.sold).toBe(true);

		const hit = summarizeEnd(3, [rest(30, 0), rest(0, 60)], 1, 2);
		expect(hit.points).toBe(6);
		expect(hit.penguinPenalty).toBe(3);
		expect(hit.sealBumps).toBe(2);
		expect(hit.sold).toBe(false);

		expect(summarizeEnd(4, [rest(150, 0, true), rest(150, 0)], 2, 0).points).toBe(0);
	});

	it('turns the ends into a final score with a clean ice bonus', () => {
		const results = Array.from({ length: ENDS_TOTAL }, (_, end) =>
			summarizeEnd(end, [rest(30, 0), rest(60, 0)], 0, 0)
		);
		const clean = finalScore(results, 0);
		expect(clean.points).toBe(9 * ENDS_TOTAL);
		expect(clean.cleanIce).toBe(true);
		const dirty = finalScore(results, 1);
		expect(dirty.cleanIce).toBe(false);
		expect(clean.score - dirty.score).toBe(100);
		expect(finalScore(results.slice(0, 3), 0).cleanIce).toBe(false);
	});
});

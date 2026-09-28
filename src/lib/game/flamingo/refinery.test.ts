import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	BIGGEST_TANK_BONUS,
	BIGGEST_TIER,
	CHAIN_GAP,
	REFINERY_NAME_COUNT,
	TANK_TIERS,
	flareRect,
	generateRefinery,
	strikeTank,
	tankRect,
	type Refinery
} from './refinery';

const SEEDS = Array.from({ length: 100 }, (_, index) => index * 104729 + 1);

/** Two tanks close enough to chain, then a gap, then the biggest tank on its own */
const CRAFTED: Refinery = {
	startX: 0,
	endX: 312,
	tanks: [
		{ x: 18, halfWidth: 18, height: 54, tier: 0 },
		{ x: 70, halfWidth: 24, height: 72, tier: 1 },
		{ x: 180, halfWidth: 30, height: 88, tier: 2 },
		{ x: 270, halfWidth: 42, height: 112, tier: 3 }
	],
	flare: { x: 125, width: 14, height: 200 },
	biggest: 3,
	nameIndex: 0
};

describe('generateRefinery', () => {
	it('is deterministic for a given seed', () => {
		expect(generateRefinery(createRandom(5), 1, 100)).toEqual(
			generateRefinery(createRandom(5), 1, 100)
		);
	});

	it('lays out a different refinery for a different seed', () => {
		const layouts = new Set(
			SEEDS.slice(0, 20).map((seed) =>
				JSON.stringify(generateRefinery(createRandom(seed), 0, 0).tanks)
			)
		);
		expect(layouts.size).toBe(20);
	});

	it('has exactly one biggest tank, clearly bigger than the rest', () => {
		for (const seed of SEEDS) {
			const refinery = generateRefinery(createRandom(seed), seed % 6, 0);
			const biggest = refinery.tanks[refinery.biggest];
			expect(biggest.tier).toBe(BIGGEST_TIER);
			const others = refinery.tanks.filter((_, index) => index !== refinery.biggest);
			expect(others.every((tank) => tank.tier < BIGGEST_TIER)).toBe(true);
			expect(others.every((tank) => tank.halfWidth < biggest.halfWidth)).toBe(true);
		}
	});

	it('places tanks and the flare stack side by side without overlapping', () => {
		for (const seed of SEEDS) {
			const refinery = generateRefinery(createRandom(seed), seed % 6, 500);
			const rects = [...refinery.tanks.map(tankRect), flareRect(refinery.flare)].sort(
				(a, b) => a.x - b.x
			);
			expect(rects[0].x).toBe(500);
			expect(rects[rects.length - 1].x + rects[rects.length - 1].width).toBe(refinery.endX);
			for (let index = 1; index < rects.length; index++) {
				expect(rects[index].x).toBeGreaterThan(rects[index - 1].x + rects[index - 1].width);
			}
			expect(refinery.tanks.length).toBeGreaterThanOrEqual(3);
			expect(refinery.nameIndex).toBeGreaterThanOrEqual(0);
			expect(refinery.nameIndex).toBeLessThan(REFINERY_NAME_COUNT);
		}
	});

	it('builds bigger refineries in later segments', () => {
		const average = (segment: number) =>
			SEEDS.reduce(
				(sum, seed) => sum + generateRefinery(createRandom(seed), segment, 0).tanks.length,
				0
			) / SEEDS.length;
		expect(average(4)).toBeGreaterThan(average(0));
	});
});

describe('strikeTank', () => {
	it('sets off the whole refinery and adds the bonus on a direct hit on the biggest tank', () => {
		const result = strikeTank(CRAFTED, 3);
		expect(result.biggestHit).toBe(true);
		expect(result.destroyed).toEqual([0, 1, 2, 3]);
		expect(result.points).toBe(20 + 30 + 40 + 60 + BIGGEST_TANK_BONUS);
	});

	it('chains to neighboring tanks standing close together', () => {
		// The first two tanks are 10 units apart, well within the chain gap
		expect(CRAFTED.tanks[1].x - CRAFTED.tanks[1].halfWidth - 36).toBeLessThanOrEqual(CHAIN_GAP);
		expect(strikeTank(CRAFTED, 0)).toEqual({
			hitIndex: 0,
			destroyed: [0, 1],
			biggestHit: false,
			points: 50
		});
		expect(strikeTank(CRAFTED, 1).destroyed).toEqual([0, 1]);
	});

	it('only destroys a lone tank on its own', () => {
		expect(strikeTank(CRAFTED, 2)).toEqual({
			hitIndex: 2,
			destroyed: [2],
			biggestHit: false,
			points: TANK_TIERS[2].points
		});
	});

	it('always scores the most for the biggest tank', () => {
		for (const seed of SEEDS) {
			const refinery = generateRefinery(createRandom(seed), seed % 8, 0);
			const best = strikeTank(refinery, refinery.biggest).points;
			refinery.tanks.forEach((_, index) => {
				if (index !== refinery.biggest) {
					expect(strikeTank(refinery, index).points).toBeLessThan(best);
				}
			});
		}
	});

	it('scores more for bigger tanks', () => {
		for (let tier = 1; tier < TANK_TIERS.length; tier++) {
			expect(TANK_TIERS[tier].points).toBeGreaterThan(TANK_TIERS[tier - 1].points);
		}
	});
});

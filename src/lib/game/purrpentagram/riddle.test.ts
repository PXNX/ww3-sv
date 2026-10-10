import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { CAT_NAMES, COATS, generateCats, PERSONALITIES } from './cats';
import { CAT_COUNT } from './config';
import { seatPosition, starSeat } from './geometry';
import {
	assignSeats,
	CLUE_KINDS,
	cluePointsAt,
	generateRiddle,
	isSolved,
	TRAIT_IDS,
	TRAIT_OF,
	validateRiddle,
	type Clue
} from './riddle';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('generateCats', () => {
	it('gives the five cats five different names, coats, personalities and purr pitches', () => {
		for (const seed of SEEDS) {
			const cats = generateCats(createRandom(seed));
			expect(cats).toHaveLength(CAT_COUNT);
			expect(new Set(cats.map((cat) => cat.name)).size).toBe(CAT_COUNT);
			expect(new Set(cats.map((cat) => cat.coat)).size).toBe(CAT_COUNT);
			expect(new Set(cats.map((cat) => cat.personality)).size).toBe(CAT_COUNT);
			expect(new Set(cats.map((cat) => cat.quirk)).size).toBe(CAT_COUNT);
			expect(cats.map((cat) => cat.purrRank).sort()).toEqual([0, 1, 2, 3, 4]);
			expect(cats.map((cat) => cat.id)).toEqual([0, 1, 2, 3, 4]);
		}
	});

	it('only uses names and coats from the pools', () => {
		const cats = generateCats(createRandom(11));
		for (const cat of cats) {
			expect(CAT_NAMES).toContain(cat.name);
			expect(COATS).toContain(cat.coat);
			expect(PERSONALITIES).toContain(cat.personality);
		}
	});
});

describe('the riddle validator', () => {
	it('accepts every generated riddle: each clue points at exactly the cat it is for', () => {
		for (const seed of SEEDS) {
			const random = createRandom(seed);
			const cats = generateCats(random);
			const riddle = generateRiddle(cats, random);
			expect(validateRiddle(cats, riddle), `seed ${seed}`).toEqual([]);
		}
	});

	it('visits every cat once and mixes all four kinds of clue', () => {
		for (const seed of SEEDS) {
			const random = createRandom(seed);
			const cats = generateCats(random);
			const riddle = generateRiddle(cats, random);
			expect([...riddle.target].sort()).toEqual([0, 1, 2, 3, 4]);
			expect(new Set(riddle.clues.map((clue) => clue.kind))).toEqual(new Set(CLUE_KINDS));
		}
	});

	it('has one trait clue for each personality that no other personality matches', () => {
		const cats = generateCats(createRandom(5));
		for (const cat of cats) {
			const trait = TRAIT_OF[cat.personality];
			expect(TRAIT_IDS).toContain(trait);
			expect(cluePointsAt({ kind: 'trait', trait }, cats)).toEqual([cat.id]);
		}
	});

	it('rejects a clue that fits two cats or none', () => {
		const random = createRandom(9);
		const cats = generateCats(random);
		const riddle = generateRiddle(cats, random);
		const none: Clue = { kind: 'name', name: 'Nobody' };
		const missing = { ...riddle, clues: [none, ...riddle.clues.slice(1)] };
		expect(validateRiddle(cats, missing).join()).toContain('clue 1 points at 0 cats');

		const wrong = { ...riddle, target: [...riddle.target].reverse() };
		expect(validateRiddle(cats, wrong).join()).toContain('wrong cat');
	});

	it('rejects a riddle that visits a cat twice', () => {
		const random = createRandom(4);
		const cats = generateCats(random);
		const riddle = generateRiddle(cats, random);
		const twice = { ...riddle, target: [riddle.target[0], ...riddle.target.slice(0, 4)] };
		expect(validateRiddle(cats, twice).join()).toContain('visited twice');
	});

	it('is the same riddle for the same seed', () => {
		const make = () => {
			const random = createRandom(123);
			return generateRiddle(generateCats(random), random);
		};
		expect(make()).toEqual(make());
	});
});

describe('isSolved', () => {
	it('needs every cat in exactly the target order', () => {
		expect(isSolved([2, 0, 4, 1, 3], [2, 0, 4, 1, 3])).toBe(true);
		expect(isSolved([2, 0, 4, 3, 1], [2, 0, 4, 1, 3])).toBe(false);
		expect(isSolved([2, 0, 4, 1], [2, 0, 4, 1, 3])).toBe(false);
		expect(isSolved([], [2, 0, 4, 1, 3])).toBe(false);
	});
});

describe('assignSeats', () => {
	it('seats the cats so that the ritual order walks the pentagram', () => {
		for (const seed of SEEDS) {
			const random = createRandom(seed);
			const target = [3, 1, 4, 0, 2];
			const seatOf = assignSeats(target, random);
			expect([...seatOf].sort()).toEqual([0, 1, 2, 3, 4]);
			// Every step skips exactly one seat, in one consistent direction
			const steps = target.map((id, i) => (seatOf[target[(i + 1) % 5]] - seatOf[id] + 5) % 5);
			expect(new Set(steps).size).toBe(1);
			expect([2, 3]).toContain(steps[0]);
		}
	});

	it('does not always start at the top', () => {
		const starts = new Set(
			SEEDS.map((seed) => assignSeats([0, 1, 2, 3, 4], createRandom(seed))[0])
		);
		expect(starts.size).toBe(CAT_COUNT);
	});
});

describe('seats', () => {
	it('puts seat 0 at the top and spreads the others evenly around the centre', () => {
		const top = seatPosition(0);
		expect(top.x).toBeCloseTo(500);
		expect(top.y).toBeLessThan(500);
		const radii = [0, 1, 2, 3, 4].map((seat) => {
			const { x, y } = seatPosition(seat);
			return Math.hypot(x - 500, y - 510);
		});
		for (const radius of radii) expect(radius).toBeCloseTo(radii[0]);
	});

	it('walks a star by skipping a seat, and wraps in both directions', () => {
		expect([0, 1, 2, 3, 4].map((step) => starSeat(0, 1, step))).toEqual([0, 2, 4, 1, 3]);
		expect([0, 1, 2, 3, 4].map((step) => starSeat(0, -1, step))).toEqual([0, 3, 1, 4, 2]);
		expect(starSeat(3, 1, 5)).toBe(3);
	});
});

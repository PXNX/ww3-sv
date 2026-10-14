import { describe, expect, it } from 'vitest';
import { NO_LIE, createLie, falsePosition, stepLie, type LieParams } from './lie';

const CENTER = { x: 10, y: 8 };
const truth = { x: 14, y: 5 };

function lie(overrides: Partial<LieParams>, seed = 1) {
	return createLie({ ...NO_LIE, ...overrides }, CENTER, seed);
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y);

describe('GPS lie', () => {
	it('tells the truth without any lie', () => {
		const honest = lie({});
		expect(falsePosition(honest, truth)).toEqual(truth);
		stepLie(honest, 30);
		expect(falsePosition(honest, truth)).toEqual(truth);
	});

	it('starts with the base offset in some direction', () => {
		const liar = lie({ base: 2, max: 5 });
		expect(distance(falsePosition(liar, truth), truth)).toBeCloseTo(2);
	});

	it('grows the offset up to its maximum', () => {
		const liar = lie({ base: 1, growth: 0.5, max: 3 });
		stepLie(liar, 2);
		expect(distance(falsePosition(liar, truth), truth)).toBeCloseTo(2);
		stepLie(liar, 60);
		expect(distance(falsePosition(liar, truth), truth)).toBeCloseTo(3);
	});

	it('drifts the direction without changing the size', () => {
		const liar = lie({ base: 2, max: 2, drift: 1 });
		const before = falsePosition(liar, truth);
		stepLie(liar, 1);
		const after = falsePosition(liar, truth);
		expect(distance(after, truth)).toBeCloseTo(2);
		expect(distance(before, after)).toBeGreaterThan(0.5);
	});

	it('jumps on schedule and reports it', () => {
		const liar = lie({ base: 1, max: 6, jumpEvery: 5, jumpSize: 2 });
		expect(stepLie(liar, 4.9)).toBe(false);
		expect(stepLie(liar, 0.2)).toBe(true);
		expect(distance(falsePosition(liar, truth), truth)).toBeCloseTo(3);
		expect(stepLie(liar, 1)).toBe(false);
	});

	it('mirrors left to right around the middle of the map', () => {
		const liar = lie({ mirror: true });
		expect(falsePosition(liar, truth)).toEqual({ x: 6, y: 5 });
	});

	it('rotates around the middle of the map', () => {
		const liar = lie({ rotate: Math.PI / 2 });
		const shown = falsePosition(liar, { x: 14, y: 8 });
		expect(shown.x).toBeCloseTo(10);
		expect(shown.y).toBeCloseTo(12);
	});

	it('lies the same way for the same seed and differently for another', () => {
		const a = falsePosition(lie({ base: 2, max: 2 }, 7), truth);
		const b = falsePosition(lie({ base: 2, max: 2 }, 7), truth);
		const c = falsePosition(lie({ base: 2, max: 2 }, 8), truth);
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
	});
});

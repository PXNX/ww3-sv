import { describe, expect, it } from 'vitest';
import { POINTER_DEAD_ZONE, POINTER_FULL_AT, isSteerKey, keyVector, pointerVector } from './input';

describe('keyboard steering', () => {
	it('steers with arrows and WASD', () => {
		expect(keyVector(new Set(['ArrowUp']))).toEqual({ x: 0, y: -1 });
		expect(keyVector(new Set(['KeyS']))).toEqual({ x: 0, y: 1 });
		expect(keyVector(new Set(['KeyA']))).toEqual({ x: -1, y: 0 });
		expect(keyVector(new Set(['ArrowRight']))).toEqual({ x: 1, y: 0 });
	});

	it('cancels opposite keys and ignores other keys', () => {
		expect(keyVector(new Set(['ArrowLeft', 'ArrowRight']))).toEqual({ x: 0, y: 0 });
		expect(keyVector(new Set(['KeyQ']))).toEqual({ x: 0, y: 0 });
		expect(keyVector(new Set())).toEqual({ x: 0, y: 0 });
	});

	it('normalises diagonals', () => {
		const diagonal = keyVector(new Set(['ArrowUp', 'ArrowRight']));
		expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
		expect(diagonal.x).toBeGreaterThan(0);
		expect(diagonal.y).toBeLessThan(0);
	});

	it('knows which keys steer', () => {
		expect(isSteerKey('KeyD')).toBe(true);
		expect(isSteerKey('Space')).toBe(false);
	});
});

describe('pointer steering', () => {
	it('does not steer inside the dead zone', () => {
		expect(pointerVector(POINTER_DEAD_ZONE / 2, 0)).toEqual({ x: 0, y: 0 });
	});

	it('steers toward the pointer, harder the farther it is', () => {
		const near = pointerVector(0.8, 0);
		const far = pointerVector(POINTER_FULL_AT * 3, 0);
		expect(near.x).toBeCloseTo(0.8 / POINTER_FULL_AT);
		expect(far).toEqual({ x: 1, y: 0 });
	});

	it('points the right way in every direction', () => {
		expect(pointerVector(0, -3).y).toBeCloseTo(-1);
		expect(pointerVector(0, 3).y).toBeCloseTo(1);
		expect(pointerVector(-3, 0).x).toBeCloseTo(-1);
	});
});

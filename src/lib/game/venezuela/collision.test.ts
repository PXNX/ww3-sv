import { describe, expect, it } from 'vitest';
import { moveBody, overlaps, standingOn, type Body } from './collision';
import { levelFrom } from './testLevel';

const STEP = 1 / 60;

function body(x: number, y: number, vx = 0, vy = 0): Body {
	return { x, y, w: 0.7, h: 0.95, vx, vy };
}

/** Floor with its top at row 8 */
const FLOOR = '##############';

describe('tile collision', () => {
	it('lands a falling body on solid ground and keeps it there', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const b = body(3, 6.5, 0, 12);
		let landed = false;
		for (let i = 0; i < 30; i++) {
			b.vy += 55 * STEP;
			landed = moveBody(level, b, STEP).landed || landed;
		}
		expect(landed).toBe(true);
		expect(b.y + b.h).toBeCloseTo(8, 2);
		expect(b.vy).toBe(0);
		expect(standingOn(level, b)).toBe(true);
	});

	it('stops at a wall in both directions', () => {
		const level = levelFrom(['.......W......', '.......W......', FLOOR, FLOOR]);
		// Wall at column 7 in rows 6 and 7; floor top at row 8
		const right = body(5, 7.04, 6);
		let hit = false;
		for (let i = 0; i < 40; i++) hit = moveBody(level, right, STEP).hitWall || hit;
		expect(hit).toBe(true);
		expect(right.x + right.w).toBeLessThanOrEqual(7);
		expect(right.x + right.w).toBeGreaterThan(6.99);

		const left = body(10, 7.04, -6);
		for (let i = 0; i < 40; i++) moveBody(level, left, STEP);
		expect(left.x).toBeGreaterThanOrEqual(8);
		expect(left.x).toBeLessThan(8.01);
	});

	it('bumps its head on a ceiling', () => {
		const level = levelFrom(['..............', '.....WWW......', '..............', FLOOR, FLOOR]);
		// Ceiling at row 6 (its underside at y = 7), floor top at row 8; jump up under it
		const b = body(5.2, 7.05, 0, -17);
		let bumpedAt: number | null = null;
		for (let i = 0; i < 12; i++) {
			b.vy += 55 * STEP;
			if (moveBody(level, b, STEP).bumped) bumpedAt = b.y;
		}
		expect(bumpedAt).not.toBeNull();
		expect(bumpedAt).toBeCloseTo(7, 2);
	});

	it('keeps a body inside the level sideways: the edges are walls', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const b = body(0.5, 7.05, -8);
		for (let i = 0; i < 30; i++) moveBody(level, b, STEP);
		expect(b.x).toBeGreaterThanOrEqual(0);
		const far = body(12, 7.05, 8);
		for (let i = 0; i < 30; i++) moveBody(level, far, STEP);
		expect(far.x + far.w).toBeLessThanOrEqual(level.width);
	});

	it('lets a body fall below the level (a pit is a fall)', () => {
		const level = levelFrom(['..............', '..............']);
		const b = body(3, 7, 0, 10);
		for (let i = 0; i < 120; i++) {
			b.vy += 55 * STEP;
			moveBody(level, b, STEP);
		}
		expect(b.y).toBeGreaterThan(level.height);
	});

	describe('catwalks (one-way tiles)', () => {
		// A catwalk at row 5 (its top at y = 5), floor top at row 8
		const level = levelFrom(['....====......', '..............', '..............', FLOOR, FLOOR]);

		it('catches a body that comes down onto it', () => {
			const b = body(5, 3.5, 0, 6);
			let landed = false;
			for (let i = 0; i < 40; i++) {
				b.vy += 55 * STEP;
				landed = moveBody(level, b, STEP).landed || landed;
			}
			expect(landed).toBe(true);
			expect(b.y + b.h).toBeCloseTo(5, 2);
		});

		it('lets a body jump up through it from below', () => {
			const b = body(5, 6.8, 0, -16);
			for (let i = 0; i < 8; i++) moveBody(level, b, STEP);
			expect(b.y).toBeLessThan(6);
			expect(b.vy).toBeLessThan(0);
		});

		it('does not catch a body that is already inside it when falling', () => {
			// Feet well below the catwalk's top: it has already passed through
			const b = body(5, 5.3, 0, 4);
			const result = moveBody(level, b, STEP);
			expect(result.landed).toBe(false);
		});

		it('lets a body walk sideways along it without catching on its edge', () => {
			const b = body(4.1, 4.04, 5);
			for (let i = 0; i < 10; i++) {
				b.vy += 55 * STEP;
				moveBody(level, b, STEP);
			}
			expect(b.x).toBeGreaterThan(4.5);
			expect(b.y + b.h).toBeCloseTo(5, 1);
		});
	});

	it('does not tunnel through a floor at the fastest fall speed', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const b = body(3, 4, 0, 20);
		for (let i = 0; i < 60; i++) moveBody(level, b, STEP);
		expect(b.y + b.h).toBeCloseTo(8, 2);
	});
});

describe('overlaps', () => {
	it('is true for crossing boxes and false for touching or separate ones', () => {
		const a = { x: 0, y: 0, w: 1, h: 1 };
		expect(overlaps(a, { x: 0.5, y: 0.5, w: 1, h: 1 })).toBe(true);
		expect(overlaps(a, { x: 1, y: 0, w: 1, h: 1 })).toBe(false);
		expect(overlaps(a, { x: 3, y: 3, w: 1, h: 1 })).toBe(false);
	});
});

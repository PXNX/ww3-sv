import { describe, expect, it } from 'vitest';
import {
	CELL_HEIGHT,
	CELL_WIDTH,
	FIELD_TOP,
	HOLE_COUNT,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from './config';
import { holeAt, holeBase, holeForDigit, holeRect, isHole } from './layout';

describe('holeAt (hit test)', () => {
	it('finds the podium under a point in every cell', () => {
		for (let hole = 0; hole < HOLE_COUNT; hole++) {
			const rect = holeRect(hole);
			expect(holeAt(rect.x + rect.width / 2, rect.y + rect.height / 2)).toBe(hole);
			expect(holeAt(rect.x + 1, rect.y + 1)).toBe(hole);
			expect(holeAt(rect.x + rect.width - 1, rect.y + rect.height - 1)).toBe(hole);
		}
	});

	it('numbers podiums row by row from the top left', () => {
		expect(holeAt(10, FIELD_TOP + 10)).toBe(0);
		expect(holeAt(WORLD_WIDTH - 10, FIELD_TOP + 10)).toBe(2);
		expect(holeAt(10, WORLD_HEIGHT - 10)).toBe(6);
		expect(holeAt(WORLD_WIDTH - 10, WORLD_HEIGHT - 10)).toBe(8);
	});

	it('changes podium exactly at the cell edges', () => {
		expect(holeAt(CELL_WIDTH - 0.01, FIELD_TOP + 5)).toBe(0);
		expect(holeAt(CELL_WIDTH, FIELD_TOP + 5)).toBe(1);
		expect(holeAt(5, FIELD_TOP + CELL_HEIGHT - 0.01)).toBe(0);
		expect(holeAt(5, FIELD_TOP + CELL_HEIGHT)).toBe(3);
	});

	it('returns null on the backdrop and outside the field', () => {
		expect(holeAt(100, FIELD_TOP - 1)).toBeNull();
		expect(holeAt(100, 0)).toBeNull();
		expect(holeAt(-1, FIELD_TOP + 10)).toBeNull();
		expect(holeAt(WORLD_WIDTH, FIELD_TOP + 10)).toBeNull();
		expect(holeAt(100, WORLD_HEIGHT)).toBeNull();
		expect(holeAt(Number.NaN, 200)).toBeNull();
		expect(holeAt(100, Number.POSITIVE_INFINITY)).toBeNull();
	});
});

describe('layout helpers', () => {
	it('puts a figure base inside its own cell, horizontally centered', () => {
		for (let hole = 0; hole < HOLE_COUNT; hole++) {
			const base = holeBase(hole);
			const rect = holeRect(hole);
			expect(base.x).toBeCloseTo(rect.x + rect.width / 2);
			expect(base.y).toBeGreaterThan(rect.y);
			expect(base.y).toBeLessThan(rect.y + rect.height);
			expect(holeAt(base.x, base.y)).toBe(hole);
		}
	});

	it('validates hole numbers', () => {
		expect(isHole(0)).toBe(true);
		expect(isHole(8)).toBe(true);
		expect(isHole(9)).toBe(false);
		expect(isHole(-1)).toBe(false);
		expect(isHole(1.5)).toBe(false);
	});

	it('maps the digits 1 to 9 to podiums and nothing else', () => {
		expect(holeForDigit('1')).toBe(0);
		expect(holeForDigit('5')).toBe(4);
		expect(holeForDigit('9')).toBe(8);
		expect(holeForDigit('0')).toBeNull();
		expect(holeForDigit('a')).toBeNull();
		expect(holeForDigit('12')).toBeNull();
	});
});

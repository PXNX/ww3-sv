import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS, isDifficultyId } from './difficulty';
import { cellIndex, cellPosition, neighborIndices, orthogonalNeighborIndices } from './grid';

const size = { columns: 4, rows: 3 };

describe('grid helpers', () => {
	it('converts between positions and indices', () => {
		expect(cellIndex(size, 2, 1)).toBe(6);
		expect(cellPosition(size, 6)).toEqual({ column: 2, row: 1 });
		expect(cellPosition(size, 11)).toEqual({ column: 3, row: 2 });
	});

	it('lists surrounding cells, clipped at the edges', () => {
		expect(neighborIndices(size, 0)).toEqual([1, 4, 5]);
		expect(neighborIndices(size, 5)).toEqual([0, 1, 2, 4, 6, 8, 9, 10]);
		expect(neighborIndices(size, 5, true)).toHaveLength(9);
		expect(neighborIndices(size, 11)).toEqual([6, 7, 10]);
	});

	it('lists edge-sharing cells, eastward first', () => {
		expect(orthogonalNeighborIndices(size, 5)).toEqual([6, 1, 9, 4]);
		expect(orthogonalNeighborIndices(size, 3)).toEqual([7, 2]);
	});
});

describe('difficulty table', () => {
	it('matches the requirements', () => {
		const summary = DIFFICULTY_IDS.map((id) => {
			const { columns, rows, mineDensity, submarines } = DIFFICULTIES[id];
			return [id, columns, rows, mineDensity, submarines];
		});
		expect(summary).toEqual([
			['easy', 8, 6, 0.12, 3],
			['normal', 10, 8, 0.15, 2],
			['hard', 12, 9, 0.19, 1]
		]);
	});

	it('validates stored difficulty values', () => {
		expect(isDifficultyId('hard')).toBe(true);
		expect(isDifficultyId('impossible')).toBe(false);
		expect(isDifficultyId(2)).toBe(false);
	});
});

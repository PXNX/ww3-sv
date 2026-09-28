/*
 * Index helpers for a rectangular grid stored row by row (index = row * columns + column).
 * Column 0 is the western (Gulf) edge, the last column the eastern (open sea) edge.
 */

export interface GridSize {
	readonly columns: number;
	readonly rows: number;
}

export function cellIndex(size: GridSize, column: number, row: number): number {
	return row * size.columns + column;
}

export function cellPosition(size: GridSize, index: number): { column: number; row: number } {
	return { column: index % size.columns, row: Math.floor(index / size.columns) };
}

export function isInside(size: GridSize, column: number, row: number): boolean {
	return column >= 0 && column < size.columns && row >= 0 && row < size.rows;
}

/** The up to eight surrounding cells, optionally including the cell itself (a three-by-three area) */
export function neighborIndices(size: GridSize, index: number, includeSelf = false): number[] {
	const { column, row } = cellPosition(size, index);
	const result: number[] = [];
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0 && !includeSelf) continue;
			if (isInside(size, column + dx, row + dy))
				result.push(cellIndex(size, column + dx, row + dy));
		}
	}
	return result;
}

/** The up to four cells sharing an edge, eastward first so searches head for the open sea */
export function orthogonalNeighborIndices(size: GridSize, index: number): number[] {
	const { column, row } = cellPosition(size, index);
	const steps = [
		[1, 0],
		[0, -1],
		[0, 1],
		[-1, 0]
	] as const;
	return steps
		.filter(([dx, dy]) => isInside(size, column + dx, row + dy))
		.map(([dx, dy]) => cellIndex(size, column + dx, row + dy));
}

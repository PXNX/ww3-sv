/*
 * Where the podiums are and which one a point falls on: the hit test of the mode. Pure geometry,
 * shared by the pointer handling, the keyboard and the renderer.
 */
import {
	BASELINE_OFFSET,
	CELL_HEIGHT,
	CELL_WIDTH,
	COLUMNS,
	FIELD_TOP,
	HOLE_COUNT,
	ROWS
} from './config';

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function isHole(hole: number): boolean {
	return Number.isInteger(hole) && hole >= 0 && hole < HOLE_COUNT;
}

/** The whole cell of a podium, the area a tap counts for */
export function holeRect(hole: number): Rect {
	const column = hole % COLUMNS;
	const row = Math.floor(hole / COLUMNS);
	return {
		x: column * CELL_WIDTH,
		y: FIELD_TOP + row * CELL_HEIGHT,
		width: CELL_WIDTH,
		height: CELL_HEIGHT
	};
}

/** Where a figure's feet are: bottom center of the figure, at the podium's top edge */
export function holeBase(hole: number): { x: number; y: number } {
	const rect = holeRect(hole);
	return { x: rect.x + rect.width / 2, y: rect.y + BASELINE_OFFSET };
}

/** The podium under a world point, or null for the backdrop and anything outside the field */
export function holeAt(x: number, y: number): number | null {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	if (x < 0 || y < FIELD_TOP) return null;
	const column = Math.floor(x / CELL_WIDTH);
	const row = Math.floor((y - FIELD_TOP) / CELL_HEIGHT);
	if (column >= COLUMNS || row >= ROWS) return null;
	return row * COLUMNS + column;
}

/** Keyboard digits 1 to 9 are laid out like the podiums, top left to bottom right */
export function holeForDigit(digit: string): number | null {
	if (!/^[1-9]$/.test(digit)) return null;
	return Number(digit) - 1;
}

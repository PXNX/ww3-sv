/*
 * The hidden fleet: which ships of the Russian Black Sea Fleet there are, how they are placed on
 * the grid (straight lines, horizontal or vertical, never touching each other, not even
 * diagonally) and what a strike on a cell does. Cells are row-major indices into the grid.
 */
import { randomInt, type Random } from '../random';

export const COLUMNS = 10;
export const ROWS = 10;
export const CELL_COUNT = COLUMNS * ROWS;

export type ShipClass = 'moskva' | 'ropucha' | 'kilo' | 'buyan' | 'tarantul';

export interface ShipClassInfo {
	length: number;
	/** Points for sinking a ship of this class */
	points: number;
}

export const SHIP_CLASSES: Record<ShipClass, ShipClassInfo> = {
	moskva: { length: 5, points: 500 },
	ropucha: { length: 4, points: 250 },
	kilo: { length: 3, points: 200 },
	buyan: { length: 3, points: 150 },
	tarantul: { length: 2, points: 100 }
};

/** The ships of every fleet, biggest first */
export const FLEET: readonly ShipClass[] = [
	'moskva',
	'ropucha',
	'kilo',
	'buyan',
	'tarantul',
	'tarantul'
];

export type Weapon = 'neptune' | 'usv';

export interface Ship {
	class: ShipClass;
	/** The cells the ship covers, from bow to stern */
	cells: number[];
}

export interface Shot {
	cell: number;
	weapon: Weapon;
}

export type StrikeResult =
	{ kind: 'miss' } | { kind: 'hit'; ship: number } | { kind: 'sunk'; ship: number; points: number };

export function cellOf(column: number, row: number): number {
	return row * COLUMNS + column;
}

export function columnOf(cell: number): number {
	return cell % COLUMNS;
}

export function rowOf(cell: number): number {
	return Math.floor(cell / COLUMNS);
}

/** The up to eight cells around a cell */
export function neighbours(cell: number): number[] {
	const column = columnOf(cell);
	const row = rowOf(cell);
	const result: number[] = [];
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const x = column + dx;
			const y = row + dy;
			if (x >= 0 && x < COLUMNS && y >= 0 && y < ROWS) result.push(cellOf(x, y));
		}
	}
	return result;
}

/** The cells of a ship of `length` starting at a cell, or null when it would leave the grid */
export function shipCells(start: number, length: number, vertical: boolean): number[] | null {
	const column = columnOf(start);
	const row = rowOf(start);
	if (vertical ? row + length > ROWS : column + length > COLUMNS) return null;
	return Array.from({ length }, (_, step) =>
		vertical ? cellOf(column, row + step) : cellOf(column + step, row)
	);
}

/** True for cells in a straight, gapless line inside the grid */
export function isStraightLine(cells: readonly number[]): boolean {
	if (cells.length === 0) return false;
	const vertical = cells.length > 1 && columnOf(cells[0]) === columnOf(cells[1]);
	const expected = shipCells(cells[0], cells.length, vertical);
	return expected !== null && expected.every((cell, index) => cell === cells[index]);
}

const MAX_ATTEMPTS = 200;

/**
 * Places a whole fleet at random. Ships never overlap or touch, which also makes a sunk ship
 * leave a ring of water around it that the player can rule out.
 */
export function placeFleet(random: Random, fleet: readonly ShipClass[] = FLEET): Ship[] {
	for (;;) {
		const blocked = new Set<number>();
		const ships: Ship[] = [];
		for (const shipClass of fleet) {
			const { length } = SHIP_CLASSES[shipClass];
			let placed: number[] | null = null;
			for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
				const cells = shipCells(randomInt(random, 0, CELL_COUNT), length, random() < 0.5);
				if (cells && cells.every((cell) => !blocked.has(cell))) placed = cells;
			}
			// A crowded board can leave no room for the last ships: start over
			if (!placed) break;
			ships.push({ class: shipClass, cells: placed });
			for (const cell of placed) {
				blocked.add(cell);
				for (const near of neighbours(cell)) blocked.add(near);
			}
		}
		if (ships.length === fleet.length) return ships;
	}
}

/** The index of the ship on a cell, or -1 for open water */
export function shipAt(ships: readonly Ship[], cell: number): number {
	return ships.findIndex((ship) => ship.cells.includes(cell));
}

export function isSunk(ship: Ship, struck: ReadonlySet<number>): boolean {
	return ship.cells.every((cell) => struck.has(cell));
}

export function struckCells(shots: readonly Shot[]): Set<number> {
	return new Set(shots.map((shot) => shot.cell));
}

export function allSunk(ships: readonly Ship[], shots: readonly Shot[]): boolean {
	const struck = struckCells(shots);
	return ships.every((ship) => isSunk(ship, struck));
}

/** What a new strike on `cell` does, given the shots fired before it */
export function strikeResult(
	ships: readonly Ship[],
	shots: readonly Shot[],
	cell: number
): StrikeResult {
	const index = shipAt(ships, cell);
	if (index < 0) return { kind: 'miss' };
	const struck = struckCells(shots);
	struck.add(cell);
	const ship = ships[index];
	if (!isSunk(ship, struck)) return { kind: 'hit', ship: index };
	return { kind: 'sunk', ship: index, points: SHIP_CLASSES[ship.class].points };
}

/**
 * The drone camera of a sea drone that found open water: how many ship cells around it are still
 * untouched. Worked out live, so the number goes down as those cells are hit.
 */
export function droneContacts(
	ships: readonly Ship[],
	shots: readonly Shot[],
	cell: number
): number {
	const struck = struckCells(shots);
	return neighbours(cell).filter((near) => !struck.has(near) && shipAt(ships, near) >= 0).length;
}

/** The points all sunk ships of a fleet are worth */
export function fleetPoints(ships: readonly Ship[], shots: readonly Shot[]): number {
	const struck = struckCells(shots);
	return ships
		.filter((ship) => isSunk(ship, struck))
		.reduce((sum, ship) => sum + SHIP_CLASSES[ship.class].points, 0);
}

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	CELL_COUNT,
	FLEET,
	SHIP_CLASSES,
	allSunk,
	cellOf,
	droneContacts,
	fleetPoints,
	isStraightLine,
	neighbours,
	placeFleet,
	shipAt,
	shipCells,
	strikeResult,
	type Ship
} from './fleet';

/** A Kilo along the top row and a Tarantul standing in the bottom-right corner */
const SHIPS: Ship[] = [
	{ class: 'kilo', cells: [cellOf(0, 0), cellOf(1, 0), cellOf(2, 0)] },
	{ class: 'tarantul', cells: [cellOf(9, 8), cellOf(9, 9)] }
];

describe('grid geometry', () => {
	it('lists eight neighbours in the middle and three in a corner', () => {
		expect(neighbours(cellOf(5, 5))).toHaveLength(8);
		expect(neighbours(cellOf(0, 0)).sort((a, b) => a - b)).toEqual([1, 10, 11]);
	});

	it('lays ships out horizontally and vertically and refuses to leave the grid', () => {
		expect(shipCells(cellOf(2, 3), 3, false)).toEqual([cellOf(2, 3), cellOf(3, 3), cellOf(4, 3)]);
		expect(shipCells(cellOf(2, 3), 2, true)).toEqual([cellOf(2, 3), cellOf(2, 4)]);
		expect(shipCells(cellOf(8, 0), 3, false)).toBeNull();
		expect(shipCells(cellOf(0, 9), 2, true)).toBeNull();
	});

	it('only accepts straight, gapless lines', () => {
		expect(isStraightLine([cellOf(1, 1), cellOf(1, 2), cellOf(1, 3)])).toBe(true);
		expect(isStraightLine([cellOf(1, 1), cellOf(2, 1)])).toBe(true);
		expect(isStraightLine([cellOf(1, 1), cellOf(3, 1)])).toBe(false);
		expect(isStraightLine([cellOf(9, 0), cellOf(0, 1)])).toBe(false);
		expect(isStraightLine([])).toBe(false);
	});
});

describe('placeFleet', () => {
	it.each([1, 2, 3, 42, 1234])(
		'places the whole fleet without overlaps or touching (seed %i)',
		(seed) => {
			const ships = placeFleet(createRandom(seed));
			expect(ships.map((ship) => ship.class)).toEqual(FLEET);
			for (const [index, ship] of ships.entries()) {
				expect(ship.cells).toHaveLength(SHIP_CLASSES[ship.class].length);
				expect(isStraightLine(ship.cells)).toBe(true);
				for (const cell of ship.cells) {
					expect(cell).toBeGreaterThanOrEqual(0);
					expect(cell).toBeLessThan(CELL_COUNT);
					for (const near of [cell, ...neighbours(cell)]) {
						const other = shipAt(ships, near);
						expect(other === -1 || other === index).toBe(true);
					}
				}
			}
		}
	);

	it('places the same fleet for the same seed', () => {
		expect(placeFleet(createRandom(7))).toEqual(placeFleet(createRandom(7)));
	});
});

describe('strikes', () => {
	it('tells a miss, a hit and a sinking apart', () => {
		expect(strikeResult(SHIPS, [], cellOf(5, 5))).toEqual({ kind: 'miss' });
		expect(strikeResult(SHIPS, [], cellOf(9, 8))).toEqual({ kind: 'hit', ship: 1 });
		expect(strikeResult(SHIPS, [{ cell: cellOf(9, 8), weapon: 'usv' }], cellOf(9, 9))).toEqual({
			kind: 'sunk',
			ship: 1,
			points: SHIP_CLASSES.tarantul.points
		});
	});

	it('counts the untouched ship cells around a drone that found water', () => {
		expect(droneContacts(SHIPS, [], cellOf(1, 1))).toBe(3);
		expect(droneContacts(SHIPS, [{ cell: cellOf(0, 0), weapon: 'neptune' }], cellOf(1, 1))).toBe(2);
		expect(droneContacts(SHIPS, [], cellOf(5, 5))).toBe(0);
	});

	it('knows when the whole fleet is sunk and what it was worth', () => {
		const shots = SHIPS[0].cells.map((cell) => ({ cell, weapon: 'neptune' as const }));
		expect(allSunk(SHIPS, shots)).toBe(false);
		expect(fleetPoints(SHIPS, shots)).toBe(SHIP_CLASSES.kilo.points);
		const all = [...shots, ...SHIPS[1].cells.map((cell) => ({ cell, weapon: 'usv' as const }))];
		expect(allSunk(SHIPS, all)).toBe(true);
		expect(fleetPoints(SHIPS, all)).toBe(SHIP_CLASSES.kilo.points + SHIP_CLASSES.tarantul.points);
	});
});

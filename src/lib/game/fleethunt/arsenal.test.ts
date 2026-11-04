import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	decoyCount,
	evade,
	evadesAfter,
	fleetFor,
	newHunt,
	placeDecoys,
	resolveVolley,
	revealedCells,
	sonarContacts,
	weaponCells
} from './arsenal';
import {
	CELL_COUNT,
	SHIP_CLASSES,
	cellOf,
	droneContacts,
	neighbours,
	shipAt,
	type Ship
} from './fleet';

const SHIPS: Ship[] = [
	{ class: 'kilo', cells: [cellOf(0, 0), cellOf(1, 0), cellOf(2, 0)] },
	{ class: 'tarantul', cells: [cellOf(5, 5), cellOf(6, 5)] }
];

describe('weapon patterns', () => {
	it('covers one cell, a row of three and a cross, cut off at the edge', () => {
		expect(weaponCells('neptune', cellOf(4, 4))).toEqual([cellOf(4, 4)]);
		expect(weaponCells('salvo', cellOf(4, 4))).toEqual([cellOf(4, 4), cellOf(3, 4), cellOf(5, 4)]);
		expect(weaponCells('depth', cellOf(4, 4))).toHaveLength(5);
		expect(weaponCells('salvo', cellOf(0, 0))).toEqual([cellOf(0, 0), cellOf(1, 0)]);
		expect(weaponCells('depth', cellOf(0, 0))).toHaveLength(3);
	});
});

describe('resolveVolley', () => {
	it('resolves the cells in order, skips struck ones and can sink with the last shell', () => {
		const shots = [{ cell: cellOf(0, 0), weapon: 'neptune' as const }];
		const outcomes = resolveVolley(SHIPS, [], shots, 'salvo', cellOf(1, 0));
		expect(outcomes.map((outcome) => outcome.kind)).toEqual(['hit', 'sunk']);
		expect(outcomes.map((outcome) => outcome.cell)).toEqual([cellOf(1, 0), cellOf(2, 0)]);
		expect(resolveVolley(SHIPS, [], shots, 'neptune', cellOf(0, 0))).toEqual([]);
	});

	it('answers a decoy buoy like a miss that looks different', () => {
		const outcomes = resolveVolley(SHIPS, [cellOf(8, 8)], [], 'neptune', cellOf(8, 8));
		expect(outcomes).toEqual([{ cell: cellOf(8, 8), kind: 'decoy' }]);
	});
});

describe('sensors', () => {
	it('lets sonar hear submarines and decoys, but not a drone camera', () => {
		expect(droneContacts(SHIPS, [], cellOf(1, 1))).toBe(0);
		expect(sonarContacts(SHIPS, [], [], cellOf(1, 1))).toBe(3);
		expect(sonarContacts(SHIPS, [cellOf(3, 3)], [], cellOf(1, 1))).toBe(4);
		expect(droneContacts(SHIPS, [], cellOf(5, 4), [cellOf(4, 3)])).toBe(3);
	});

	it('clears the fog around pings, drones, sunk ships and struck cells', () => {
		const shots = SHIPS[1].cells.map((cell) => ({ cell, weapon: 'usv' as const }));
		const revealed = revealedCells(SHIPS, shots, [{ cell: cellOf(9, 9) }]);
		expect(revealed.has(cellOf(9, 9))).toBe(true);
		expect(revealed.has(cellOf(7, 7))).toBe(true);
		expect(revealed.has(cellOf(5, 5))).toBe(true);
		expect(revealed.has(cellOf(4, 4))).toBe(true);
		expect(revealed.has(cellOf(0, 9))).toBe(false);
	});
});

describe('escalating fleets', () => {
	it('adds ships and decoys with every hunt, up to a limit', () => {
		expect(fleetFor(0)).toHaveLength(6);
		expect(fleetFor(2)).toHaveLength(8);
		expect(fleetFor(50)).toHaveLength(9);
		expect(decoyCount(0)).toBe(0);
		expect(decoyCount(50)).toBe(4);
	});

	it.each([0, 1, 3, 9])('places a legal hunt for level %i on many seeds', (level) => {
		for (let seed = 1; seed <= 20; seed++) {
			const { ships, decoys } = newHunt(createRandom(seed), level);
			expect(ships).toHaveLength(fleetFor(level).length);
			expect(decoys.length).toBeLessThanOrEqual(decoyCount(level));
			expect(decoys.length).toBeGreaterThanOrEqual(Math.min(2, decoyCount(level)));
			for (const decoy of decoys) {
				for (const near of [decoy, ...neighbours(decoy)]) expect(shipAt(ships, near)).toBe(-1);
			}
		}
	});

	it('keeps decoys apart', () => {
		const decoys = placeDecoys(createRandom(4), [], 4);
		for (const decoy of decoys) {
			for (const near of neighbours(decoy)) expect(decoys).not.toContain(near);
		}
		expect(decoys.every((cell) => cell >= 0 && cell < CELL_COUNT)).toBe(true);
	});
});

describe('evasion', () => {
	it('moves an unhurt patrol boat one cell along its line and keeps the fleet legal', () => {
		const result = evade(SHIPS, [], [], createRandom(2));
		expect(result).not.toBeNull();
		const moved = result!.ships[1];
		expect(result!.move.ship).toBe(1);
		expect(moved.cells).toHaveLength(SHIP_CLASSES.tarantul.length);
		expect(Math.abs(moved.cells[0] - SHIPS[1].cells[0])).toBe(1);
		expect(result!.ships[0]).toBe(SHIPS[0]);
	});

	it('never moves a hurt ship, a submarine, or onto struck cells and decoys', () => {
		expect(
			evade(SHIPS, [], [{ cell: cellOf(5, 5), weapon: 'neptune' }], createRandom(2))
		).toBeNull();
		const boxed = [cellOf(4, 5), cellOf(7, 5)];
		const shots = boxed.map((cell) => ({ cell, weapon: 'neptune' as const }));
		expect(evade(SHIPS, [], shots, createRandom(2))).toBeNull();
		expect(evade(SHIPS, boxed, [], createRandom(2))).toBeNull();
	});

	it('does not wrap around the edge of the grid', () => {
		const edge: Ship[] = [{ class: 'tarantul', cells: [cellOf(0, 3), cellOf(1, 3)] }];
		for (let seed = 1; seed < 10; seed++) {
			expect(evade(edge, [], [], createRandom(seed))?.ships[0].cells).toEqual([
				cellOf(1, 3),
				cellOf(2, 3)
			]);
		}
	});

	it('gives the boats a chance every third strike', () => {
		expect([0, 1, 2, 3, 4, 6].map(evadesAfter)).toEqual([false, false, false, true, false, true]);
	});
});

/*
 * What the weapons of the Black Sea Fleet Hunt do beyond one cell, and the fleet's own tricks:
 * the cells a salvo or a depth charge covers, a volley fired cell by cell, sonar pings, decoy
 * buoys, evasive patrol boats and the larger fleets of later hunts. Pure functions on the fleet
 * from fleet.ts, with the random source passed in so they can be tested.
 */
import { randomInt, type Random } from '../random';
import {
	CELL_COUNT,
	COLUMNS,
	DRONE_RADIUS,
	FLEET,
	ROWS,
	SHIP_CLASSES,
	SONAR_RADIUS,
	cellOf,
	columnOf,
	contactsAround,
	neighbours,
	placeFleet,
	rowOf,
	shipCells,
	squareAround,
	strikeResult,
	struckCells,
	type CellOutcome,
	type Ship,
	type ShipClass,
	type Shot,
	type Weapon
} from './fleet';

/** Weapons that strike cells, as opposed to sonar, which only listens */
export function isStrike(weapon: Weapon): boolean {
	return weapon !== 'sonar';
}

/** The cells a strike weapon covers when aimed at `cell`, cut off at the edge of the grid */
export function weaponCells(weapon: Weapon, cell: number): number[] {
	const column = columnOf(cell);
	const row = rowOf(cell);
	const offsets: [number, number][] =
		weapon === 'salvo'
			? [
					[0, 0],
					[-1, 0],
					[1, 0]
				]
			: weapon === 'depth'
				? [
						[0, 0],
						[0, -1],
						[-1, 0],
						[1, 0],
						[0, 1]
					]
				: [[0, 0]];
	return offsets
		.map(([dx, dy]) => [column + dx, row + dy])
		.filter(([x, y]) => x >= 0 && x < COLUMNS && y >= 0 && y < ROWS)
		.map(([x, y]) => cellOf(x, y));
}

/**
 * Fires a volley: the cells the weapon covers that were not struck before, one after another, so
 * a salvo can sink a ship with its last shell. A decoy buoy answers like a ship but is worth
 * nothing.
 */
export function resolveVolley(
	ships: readonly Ship[],
	decoys: readonly number[],
	shots: readonly Shot[],
	weapon: Weapon,
	target: number
): CellOutcome[] {
	const outcomes: CellOutcome[] = [];
	const fired = [...shots];
	const struck = struckCells(shots);
	for (const cell of weaponCells(weapon, target)) {
		if (struck.has(cell)) continue;
		const result = strikeResult(ships, fired, cell);
		fired.push({ cell, weapon });
		struck.add(cell);
		if (result.kind !== 'miss') outcomes.push({ cell, ...result });
		else outcomes.push({ cell, kind: decoys.includes(cell) ? 'decoy' : 'miss' });
	}
	return outcomes;
}

/** The most ships a hunt ever brings */
export const MAX_SHIPS = FLEET.length + 3;

/**
 * The fleet of the n-th hunt (0 for the first): the six classic ships, then, as the fleets
 * escalate, one more patrol boat, a second submarine and a second Buyan.
 */
export function fleetFor(level: number): ShipClass[] {
	const extras: ShipClass[] = ['tarantul', 'kilo', 'buyan'];
	return [...FLEET, ...extras.slice(0, Math.max(0, Math.min(level, extras.length)))];
}

/** How many decoy buoys the n-th fleet drags along */
export function decoyCount(level: number): number {
	return Math.max(0, Math.min(level, 4));
}

/** Drops decoy buoys on open water away from every ship and from each other */
export function placeDecoys(random: Random, ships: readonly Ship[], count: number): number[] {
	const blocked = new Set<number>();
	for (const ship of ships) {
		for (const cell of ship.cells) {
			blocked.add(cell);
			for (const near of neighbours(cell)) blocked.add(near);
		}
	}
	const free = Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
		(cell) => !blocked.has(cell)
	);
	const decoys: number[] = [];
	while (decoys.length < count && free.length > 0) {
		const [cell] = free.splice(randomInt(random, 0, free.length), 1);
		decoys.push(cell);
		for (const near of [cell, ...neighbours(cell)]) {
			const index = free.indexOf(near);
			if (index >= 0) free.splice(index, 1);
		}
	}
	return decoys;
}

/** The n-th hunt: its fleet and its decoys */
export function newHunt(random: Random, level: number): { ships: Ship[]; decoys: number[] } {
	const ships = placeFleet(random, fleetFor(level));
	return { ships, decoys: placeDecoys(random, ships, decoyCount(level)) };
}

/** A sonar ping: the untouched ship cells (submarines too) and decoys in the wide square around a cell */
export function sonarContacts(
	ships: readonly Ship[],
	decoys: readonly number[],
	shots: readonly Shot[],
	cell: number
): number {
	return contactsAround(ships, decoys, shots, cell, SONAR_RADIUS, true);
}

export interface Evasion {
	/** Index of the ship that slipped away */
	ship: number;
	from: number[];
	to: number[];
}

/**
 * Lets one unhurt patrol boat slip a cell along its own line, onto open water that was never
 * struck and keeps the ships apart. Returns the new fleet and the move, or null when no boat can.
 */
export function evade(
	ships: readonly Ship[],
	decoys: readonly number[],
	shots: readonly Shot[],
	random: Random
): { ships: Ship[]; move: Evasion } | null {
	const struck = struckCells(shots);
	const options: { ship: number; cells: number[] }[] = [];
	for (const [index, ship] of ships.entries()) {
		if (!SHIP_CLASSES[ship.class].evasive || ship.cells.some((cell) => struck.has(cell))) continue;
		const vertical = ship.cells.length > 1 && columnOf(ship.cells[0]) === columnOf(ship.cells[1]);
		const blocked = new Set<number>();
		for (const [otherIndex, other] of ships.entries()) {
			if (otherIndex === index) continue;
			for (const cell of other.cells) {
				blocked.add(cell);
				for (const near of neighbours(cell)) blocked.add(near);
			}
		}
		for (const direction of [-1, 1]) {
			const start = ship.cells[0] + direction * (vertical ? COLUMNS : 1);
			if (start < 0 || start >= CELL_COUNT) continue;
			if (!vertical && rowOf(start) !== rowOf(ship.cells[0])) continue;
			const cells = shipCells(start, ship.cells.length, vertical);
			if (
				cells &&
				cells.every((cell) => !blocked.has(cell) && !struck.has(cell) && !decoys.includes(cell))
			) {
				options.push({ ship: index, cells });
			}
		}
	}
	if (options.length === 0) return null;
	const pick = options[randomInt(random, 0, options.length)];
	const moved = ships.map((ship, index) =>
		index === pick.ship ? { ...ship, cells: pick.cells } : ship
	);
	return { ships: moved, move: { ship: pick.ship, from: ships[pick.ship].cells, to: pick.cells } };
}

/** Every this many strikes the patrol boats get a chance to slip away */
export const EVADE_EVERY = 3;

/** True once the n-th strike of a hunt (counting from 1) gives the patrol boats their chance */
export function evadesAfter(strikes: number): boolean {
	return strikes > 0 && strikes % EVADE_EVERY === 0;
}

/**
 * The cells that are out of the fog of war: whatever was struck, the squares a sonar ping and a
 * sea drone camera looked at, and the ring of open water around every sunk ship.
 */
export function revealedCells(
	ships: readonly Ship[],
	shots: readonly Shot[],
	pings: readonly { cell: number }[]
): Set<number> {
	const struck = struckCells(shots);
	const revealed = new Set<number>(struck);
	for (const ping of pings)
		for (const cell of squareAround(ping.cell, SONAR_RADIUS)) revealed.add(cell);
	for (const shot of shots) {
		if (shot.weapon === 'usv')
			for (const cell of squareAround(shot.cell, DRONE_RADIUS)) revealed.add(cell);
	}
	for (const ship of ships) {
		if (!ship.cells.every((cell) => struck.has(cell))) continue;
		for (const cell of ship.cells) for (const near of neighbours(cell)) revealed.add(near);
	}
	return revealed;
}

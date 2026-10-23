/*
 * The daily supply of strikes and the saved hunt. The fleet and the shots fired at it stay until
 * the fleet is sunk, however many days that takes; the Neptune missiles and sea drones are handed
 * out again on every new local day, and whatever was not used the day before is lost. The save is
 * plain JSON and read back defensively because the stored value may be stale or tampered with.
 */
import { isFiniteNumber } from '#lib/services/storage.js';
import {
	CELL_COUNT,
	SHIP_CLASSES,
	isStraightLine,
	type Ship,
	type ShipClass,
	type Shot,
	type Weapon
} from './fleet';

export type Ammo = Record<Weapon, number>;

/** The strikes handed out on every new day */
export const DAILY_AMMO: Readonly<Ammo> = { neptune: 10, usv: 4 };

/** Extra Neptune missiles the player can unlock once a day with a button */
export const BONUS_SHOTS = 2;

export const SAVE_KEY = 'fleethunt';

export interface FleetHuntSave {
	version: 1;
	/** Local day (YYYY-MM-DD) the ammo and the bonus belong to */
	day: string;
	ships: Ship[];
	shots: Shot[];
	ammo: Ammo;
	/** Whether today's bonus shots were already taken */
	bonusClaimed: boolean;
	/**
	 * Points from every ship sunk so far, across all fleets.
	 * TODO: move these into a shared wallet so they can be spent as currency in other games.
	 */
	points: number;
	/** Whole fleets sunk */
	fleetsSunk: number;
}

/** The save after the day has changed: fresh ammo and the bonus available again */
export function resupply(save: FleetHuntSave, today: string): FleetHuntSave {
	if (save.day === today) return save;
	return { ...save, day: today, ammo: { ...DAILY_AMMO }, bonusClaimed: false };
}

export function totalAmmo(ammo: Ammo): number {
	return ammo.neptune + ammo.usv;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isCount(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
	return isFiniteNumber(value) && Number.isInteger(value) && value >= 0 && value <= max;
}

function isCell(value: unknown): value is number {
	return isCount(value, CELL_COUNT - 1);
}

function isShip(value: unknown): value is Ship {
	if (typeof value !== 'object' || value === null) return false;
	const ship = value as Record<string, unknown>;
	return (
		typeof ship.class === 'string' &&
		Object.hasOwn(SHIP_CLASSES, ship.class) &&
		Array.isArray(ship.cells) &&
		ship.cells.length === SHIP_CLASSES[ship.class as ShipClass].length &&
		ship.cells.every(isCell) &&
		isStraightLine(ship.cells as number[])
	);
}

function isShot(value: unknown): value is Shot {
	if (typeof value !== 'object' || value === null) return false;
	const shot = value as Record<string, unknown>;
	return isCell(shot.cell) && (shot.weapon === 'neptune' || shot.weapon === 'usv');
}

function isAmmo(value: unknown): value is Ammo {
	if (typeof value !== 'object' || value === null) return false;
	const ammo = value as Record<string, unknown>;
	return (
		isCount(ammo.neptune, DAILY_AMMO.neptune + BONUS_SHOTS) && isCount(ammo.usv, DAILY_AMMO.usv)
	);
}

export function isFleetHuntSave(value: unknown): value is FleetHuntSave {
	if (typeof value !== 'object' || value === null) return false;
	const save = value as Record<string, unknown>;
	if (
		save.version !== 1 ||
		typeof save.day !== 'string' ||
		!DAY.test(save.day) ||
		!Array.isArray(save.ships) ||
		save.ships.length === 0 ||
		!save.ships.every(isShip) ||
		!Array.isArray(save.shots) ||
		!save.shots.every(isShot) ||
		!isAmmo(save.ammo) ||
		typeof save.bonusClaimed !== 'boolean' ||
		!isCount(save.points) ||
		!isCount(save.fleetsSunk)
	) {
		return false;
	}
	// No cell is struck twice and no two ships share a cell
	const shotCells = (save.shots as Shot[]).map((shot) => shot.cell);
	const shipCells = (save.ships as Ship[]).flatMap((ship) => ship.cells);
	return (
		new Set(shotCells).size === shotCells.length && new Set(shipCells).size === shipCells.length
	);
}

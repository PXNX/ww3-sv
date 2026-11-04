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
	WEAPONS,
	isStraightLine,
	type Ship,
	type ShipClass,
	type Shot,
	type Weapon
} from './fleet';
import { newRun, type RunStats } from './scoring';

export type Ammo = Record<Weapon, number>;

/** The strikes handed out on every new day */
export const DAILY_AMMO: Readonly<Ammo> = { neptune: 10, usv: 4, salvo: 2, depth: 1, sonar: 3 };

/** Extra Neptune missiles the player can unlock once a day with a button */
export const BONUS_SHOTS = 2;

export const SAVE_KEY = 'fleethunt';

/** A sonar ping and the contacts it counted when it was sent; ships may have moved since */
export interface Ping {
	cell: number;
	count: number;
}

export interface FleetHuntSave {
	version: 1;
	/** Local day (YYYY-MM-DD) the ammo and the bonus belong to */
	day: string;
	ships: Ship[];
	/** Decoy buoys that answer a strike like a ship does */
	decoys: number[];
	shots: Shot[];
	pings: Ping[];
	/** The numbers of the hunt in progress */
	run: RunStats;
	/** Stars earned for sunk fleets so far */
	stars: number;
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
	return WEAPONS.reduce((sum, weapon) => sum + ammo[weapon], 0);
}

/** Strikes left: sonar pings do not count, because a hunt cannot be won by listening */
export function strikesLeft(ammo: Ammo): number {
	return totalAmmo(ammo) - ammo.sonar;
}

/**
 * What the save may look like on disk: an older save has none of the newer fields, and its ammo
 * knows only the first weapons. `normalize` fills the gaps.
 */
export type StoredSave = Omit<FleetHuntSave, 'decoys' | 'pings' | 'run' | 'stars' | 'ammo'> &
	Partial<Pick<FleetHuntSave, 'decoys' | 'pings' | 'run' | 'stars'>> & {
		ammo: Partial<Ammo> & Pick<Ammo, 'neptune' | 'usv'>;
	};

export function normalize(save: StoredSave): FleetHuntSave {
	return {
		...save,
		decoys: save.decoys ?? [],
		pings: save.pings ?? [],
		run: save.run ?? newRun(),
		stars: save.stars ?? 0,
		// Weapons added later start with a full day's supply
		ammo: { ...DAILY_AMMO, ...save.ammo }
	};
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
	return isCell(shot.cell) && shot.weapon !== 'sonar' && WEAPONS.includes(shot.weapon as Weapon);
}

function isPing(value: unknown): value is Ping {
	if (typeof value !== 'object' || value === null) return false;
	const ping = value as Record<string, unknown>;
	return isCell(ping.cell) && isCount(ping.count, CELL_COUNT);
}

function isRun(value: unknown): value is RunStats {
	if (typeof value !== 'object' || value === null) return false;
	const run = value as Record<string, unknown>;
	return (
		isCount(run.strikes) &&
		isCount(run.hits) &&
		isCount(run.streak) &&
		isCount(run.bestStreak) &&
		isCount(run.points)
	);
}

/** Ammo as stored: the newer weapons may be missing from an older save */
function isAmmo(value: unknown): boolean {
	if (typeof value !== 'object' || value === null) return false;
	const ammo = value as Record<string, unknown>;
	return WEAPONS.every((weapon) => {
		const left = ammo[weapon];
		if (left === undefined) return weapon !== 'neptune' && weapon !== 'usv';
		return isCount(left, DAILY_AMMO[weapon] + (weapon === 'neptune' ? BONUS_SHOTS : 0));
	});
}

export function isFleetHuntSave(value: unknown): value is StoredSave {
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
		!isCount(save.fleetsSunk) ||
		(save.decoys !== undefined && !(Array.isArray(save.decoys) && save.decoys.every(isCell))) ||
		(save.pings !== undefined && !(Array.isArray(save.pings) && save.pings.every(isPing))) ||
		(save.run !== undefined && !isRun(save.run)) ||
		(save.stars !== undefined && !isCount(save.stars))
	) {
		return false;
	}
	// No cell is struck twice, no two ships share a cell and no decoy sits on a ship
	const shotCells = (save.shots as Shot[]).map((shot) => shot.cell);
	const shipCells = (save.ships as Ship[]).flatMap((ship) => ship.cells);
	const decoys = (save.decoys ?? []) as number[];
	return (
		new Set(shotCells).size === shotCells.length &&
		new Set(shipCells).size === shipCells.length &&
		new Set(decoys).size === decoys.length &&
		decoys.every((cell) => !shipCells.includes(cell))
	);
}

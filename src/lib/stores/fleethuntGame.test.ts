import { describe, expect, it } from 'vitest';
import { CELL_COUNT, SHIP_CLASSES, shipAt, type Ship } from '#lib/game/fleethunt/fleet.js';
import {
	BONUS_SHOTS,
	DAILY_AMMO,
	SAVE_KEY,
	isFleetHuntSave,
	type StoredSave
} from '#lib/game/fleethunt/save.js';
import { createRandom } from '#lib/game/random.js';
import { createStore, type KeyValueStorage, type Store } from '#lib/services/storage.js';
import { missingMessages } from '#lib/testing/messages.js';
import { FleetHuntGame } from './fleethuntGame.svelte';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

const DAY_ONE = new Date(2026, 9, 22, 10, 0, 0);
const DAY_TWO = new Date(2026, 9, 23, 9, 0, 0);

function setup() {
	const store = createStore(memoryStorage());
	const clock = { now: DAY_ONE };
	const make = () =>
		new FleetHuntGame({ store: () => store, now: () => clock.now, random: () => createRandom(3) });
	return { game: make(), make, store, clock };
}

function readSave(store: Store): StoredSave | null {
	return store.read<StoredSave | null>(SAVE_KEY, null, isFleetHuntSave);
}

/** Open-water cells, for shots that should miss */
function waterCells(ships: readonly Ship[]): number[] {
	return Array.from({ length: CELL_COUNT }, (_, cell) => cell).filter(
		(cell) => shipAt(ships, cell) < 0
	);
}

describe('FleetHuntGame', () => {
	it('starts a hunt with a hidden fleet and the daily ammo, and saves it', () => {
		const { game, store } = setup();
		expect(game.ships.length).toBeGreaterThan(0);
		expect(game.ammo).toEqual(DAILY_AMMO);
		expect(game.status).toBe('playing');
		expect(game.weapon).toBe('neptune');
		expect(readSave(store)?.ships).toEqual(game.ships);
	});

	it('spends one strike per shot, ignores a cell struck twice and reports misses and hits', () => {
		const { game } = setup();
		const water = waterCells(game.ships)[0];
		expect(game.fire(water)).toBe(true);
		expect(game.notice).toMatchObject({ kind: 'miss', contacts: null });
		expect(game.fire(water)).toBe(false);
		expect(game.ammo.neptune).toBe(DAILY_AMMO.neptune - 1);

		game.selectWeapon('usv');
		expect(game.fire(game.ships[0].cells[0])).toBe(true);
		expect(game.notice?.kind).toBe('hit');
		expect(game.ammo.usv).toBe(DAILY_AMMO.usv - 1);
	});

	it('gives sea drones that find water a count of the ship cells around them', () => {
		const { game } = setup();
		const [first] = game.ships[0].cells;
		const next = waterCells(game.ships).find((cell) =>
			[first - 1, first + 1, first - 10, first + 10].includes(cell)
		);
		expect(next).toBeDefined();
		game.selectWeapon('usv');
		game.fire(next!);
		expect(game.notice).toMatchObject({ kind: 'miss' });
		expect(game.notice?.kind === 'miss' && game.notice.contacts).toBeGreaterThan(0);
	});

	it('awards the class points for every sunk ship and keeps them in the save', () => {
		const { game, store } = setup();
		const ship = game.ships[0];
		for (const cell of ship.cells) game.fire(cell);
		expect(game.notice).toMatchObject({ kind: 'sunk', ship: ship.class });
		// The class points plus a point for every hit cell, multiplied by the growing streak
		expect(game.points).toBeGreaterThan(SHIP_CLASSES[ship.class].points);
		expect(game.run.hits).toBe(ship.cells.length);
		expect(readSave(store)?.points).toBe(game.points);
	});

	it('switches weapons when one runs out and waits for tomorrow when no strike is left', () => {
		const { game } = setup();
		const water = waterCells(game.ships);
		game.ammo = { neptune: 1, usv: 1, salvo: 0, depth: 0, sonar: 2 };
		game.fire(water[0]);
		expect(game.weapon).toBe('usv');
		game.fire(water[5]);
		expect(game.weapon).toBe('sonar');
		expect(game.status).toBe('resupply');
		expect(game.fire(water[40])).toBe(false);
	});

	it('fires a salvo as three shots for one round and a depth charge as five', () => {
		const { game } = setup();
		const [target] = waterCells(game.ships).filter(
			(cell) => cell % 10 > 1 && cell % 10 < 8 && cell > 20 && cell < 70
		);
		game.selectWeapon('salvo');
		expect(game.fire(target)).toBe(true);
		expect(game.shots).toHaveLength(3);
		expect(game.ammo.salvo).toBe(DAILY_AMMO.salvo - 1);
		expect(game.volley).toMatchObject({ weapon: 'salvo', target });
		expect(game.volley?.outcomes).toHaveLength(3);

		game.selectWeapon('depth');
		const far = target + 30 < CELL_COUNT ? target + 30 : target - 30;
		expect(game.fire(far)).toBe(true);
		expect(game.shots.length).toBeGreaterThanOrEqual(7);
		expect(game.ammo.depth).toBe(0);
	});

	it('pings with sonar without striking, once per cell, and saves the reading', () => {
		const { game, store } = setup();
		game.selectWeapon('sonar');
		const cell = game.ships[0].cells[0];
		expect(game.fire(cell)).toBe(true);
		expect(game.shots).toEqual([]);
		expect(game.ammo.sonar).toBe(DAILY_AMMO.sonar - 1);
		expect(game.notice).toMatchObject({ kind: 'ping' });
		expect(game.pings[0].count).toBeGreaterThan(0);
		expect(game.fire(cell)).toBe(false);
		expect(readSave(store)?.pings).toEqual(game.pings);
	});

	it('builds a streak over hits and breaks it with a miss', () => {
		const { game } = setup();
		const [first, second] = game.ships[0].cells;
		game.fire(first);
		game.fire(second);
		expect(game.run.streak).toBe(2);
		expect(game.notice).toMatchObject({ kind: 'hit', combo: 2 });
		game.fire(waterCells(game.ships)[0]);
		expect(game.run.streak).toBe(0);
		expect(game.run.bestStreak).toBe(2);
	});

	it('answers a decoy buoy with a wasted strike', () => {
		const { game } = setup();
		game.decoys = [waterCells(game.ships)[0]];
		game.fire(game.decoys[0]);
		expect(game.notice?.kind).toBe('decoy');
		expect(game.run.streak).toBe(0);
	});

	it('lets a patrol boat slip away every third strike without breaking the fleet', () => {
		const { game } = setup();
		const water = waterCells(game.ships);
		for (const cell of water.slice(0, 3)) game.fire(cell);
		const move = game.volley?.evasion;
		if (move) expect(game.ships[move.ship].cells).toEqual(move.to);
		const cells = game.ships.flatMap((ship) => ship.cells);
		expect(new Set(cells).size).toBe(cells.length);
	});

	it('loads an older save without the newer fields', () => {
		const { game, store, make } = setup();
		const { decoys, pings, run, stars, ...old } = game.ships.length
			? (readSave(store) as StoredSave)
			: ({} as StoredSave);
		void [decoys, pings, run, stars];
		store.write(SAVE_KEY, { ...old, ammo: { neptune: 4, usv: 1 } });
		const loaded = make();
		expect(loaded.ammo).toEqual({ ...DAILY_AMMO, neptune: 4, usv: 1 });
		expect(loaded.decoys).toEqual([]);
		expect(loaded.run.strikes).toBe(0);
	});

	it('grants the bonus shots once a day', () => {
		const { game } = setup();
		expect(game.claimBonus()).toBe(true);
		expect(game.ammo.neptune).toBe(DAILY_AMMO.neptune + BONUS_SHOTS);
		expect(game.claimBonus()).toBe(false);
		expect(game.ammo.neptune).toBe(DAILY_AMMO.neptune + BONUS_SHOTS);
	});

	it('keeps the fleet and the shots across days but hands out fresh ammo and bonus', () => {
		const { game, make, clock } = setup();
		game.fire(waterCells(game.ships)[0]);
		game.claimBonus();
		clock.now = DAY_TWO;
		const reloaded = make();
		expect(reloaded.ships).toEqual(game.ships);
		expect(reloaded.shots).toEqual(game.shots);
		expect(reloaded.ammo).toEqual(DAILY_AMMO);
		expect(reloaded.bonusClaimed).toBe(false);
	});

	it('resupplies a running game when the day changes', () => {
		const { game, clock } = setup();
		game.fire(waterCells(game.ships)[0]);
		clock.now = DAY_TWO;
		game.tick();
		expect(game.ammo).toEqual(DAILY_AMMO);
		expect(game.notice?.kind).toBe('newDay');
	});

	it('counts a sunk fleet once, rates it and sends a larger one on request', () => {
		const { game } = setup();
		game.claimBonus();
		const fleet = game.ships;
		const fleetLength = fleet.length;
		// The fleet needs more strikes than one day brings, and patrol boats slip away: keep
		// aiming at what is left and refill as a new day would
		for (let guard = 0; guard < 100 && game.status !== 'won'; guard++) {
			game.ammo = { ...DAILY_AMMO };
			game.weapon = 'neptune';
			const cell = game.ships.flatMap((ship) => ship.cells).find((c) => !game.struck.has(c))!;
			game.fire(cell);
		}
		expect(game.status).toBe('won');
		expect(game.fleetsSunk).toBe(1);
		expect(game.finishes).toBe(1);
		expect(game.result?.stars).toBeGreaterThanOrEqual(1);
		expect(game.stars).toBe(game.result?.stars);
		expect(game.points).toBeGreaterThan(
			fleet.reduce((sum, ship) => sum + SHIP_CLASSES[ship.class].points, 0)
		);

		game.nextFleet();
		expect(game.status).not.toBe('won');
		expect(game.shots).toEqual([]);
		expect(game.run.strikes).toBe(0);
		expect(game.ships.length).toBe(fleetLength + 1);
		expect(game.decoys).toHaveLength(1);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['fleethunt_', 'mode_fleethunt_'])).toEqual([]);
	});
});

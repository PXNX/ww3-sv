import { describe, expect, it } from 'vitest';
import { CELL_COUNT, SHIP_CLASSES, shipAt, type Ship } from '#lib/game/fleethunt/fleet.js';
import {
	BONUS_SHOTS,
	DAILY_AMMO,
	SAVE_KEY,
	isFleetHuntSave,
	type FleetHuntSave
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

function readSave(store: Store): FleetHuntSave | null {
	return store.read<FleetHuntSave | null>(SAVE_KEY, null, isFleetHuntSave);
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
		expect(game.points).toBe(SHIP_CLASSES[ship.class].points);
		expect(readSave(store)?.points).toBe(game.points);
	});

	it('switches weapons when one runs out and stops when both are spent', () => {
		const { game } = setup();
		const water = waterCells(game.ships);
		for (let shot = 0; shot < DAILY_AMMO.neptune; shot++) game.fire(water[shot]);
		expect(game.weapon).toBe('usv');
		for (let shot = 0; shot < DAILY_AMMO.usv; shot++) game.fire(water[DAILY_AMMO.neptune + shot]);
		expect(game.status).toBe('resupply');
		expect(game.fire(water[40])).toBe(false);
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

	it('counts a sunk fleet once and sends a new one on request', () => {
		const { game } = setup();
		game.claimBonus();
		const fleet = game.ships;
		const cells = fleet.flatMap((ship) => ship.cells);
		// The fleet needs more strikes than one day brings: refill as a new day would
		for (const cell of cells) {
			if (game.status === 'resupply') game.ammo = { ...DAILY_AMMO };
			game.fire(cell);
		}
		expect(game.status).toBe('won');
		expect(game.fleetsSunk).toBe(1);
		expect(game.finishes).toBe(1);
		expect(game.points).toBe(fleet.reduce((sum, ship) => sum + SHIP_CLASSES[ship.class].points, 0));

		game.nextFleet();
		expect(game.status).not.toBe('won');
		expect(game.shots).toEqual([]);
		expect(game.ships).not.toEqual(fleet);
	});

	it('has messages in every language', () => {
		expect(missingMessages(['fleethunt_', 'mode_fleethunt_'])).toEqual([]);
	});
});

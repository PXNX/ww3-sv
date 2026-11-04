import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { placeFleet } from './fleet';
import {
	normalize,
	BONUS_SHOTS,
	DAILY_AMMO,
	isFleetHuntSave,
	resupply,
	type FleetHuntSave
} from './save';

function save(overrides: Partial<FleetHuntSave> = {}): FleetHuntSave {
	return {
		version: 1,
		day: '2026-10-22',
		ships: placeFleet(createRandom(5)),
		decoys: [],
		shots: [],
		pings: [],
		run: { strikes: 0, hits: 0, streak: 0, bestStreak: 0, points: 0 },
		stars: 0,
		ammo: { neptune: 1, usv: 0, salvo: 0, depth: 0, sonar: 0 },
		bonusClaimed: true,
		points: 350,
		fleetsSunk: 2,
		...overrides
	};
}

describe('resupply', () => {
	it('hands out fresh ammo and the bonus on a new day, keeping the hunt and the points', () => {
		const old = save({ shots: [{ cell: 0, weapon: 'neptune' }] });
		const next = resupply(old, '2026-10-23');
		expect(next.day).toBe('2026-10-23');
		expect(next.ammo).toEqual(DAILY_AMMO);
		expect(next.bonusClaimed).toBe(false);
		expect(next.shots).toBe(old.shots);
		expect(next.ships).toBe(old.ships);
		expect(next.points).toBe(350);
	});

	it('changes nothing on the same day', () => {
		const today = save();
		expect(resupply(today, today.day)).toBe(today);
	});
});

describe('isFleetHuntSave', () => {
	it('accepts an older save without the newer fields and fills them in', () => {
		const { decoys, pings, run, stars, ...old } = save();
		void [decoys, pings, run, stars];
		const legacy = { ...old, ammo: { neptune: 3, usv: 1 } };
		expect(isFleetHuntSave(legacy)).toBe(true);
		const fresh = normalize(legacy as never);
		expect(fresh.ammo).toEqual({ ...DAILY_AMMO, neptune: 3, usv: 1 });
		expect(fresh.decoys).toEqual([]);
		expect(fresh.run.streak).toBe(0);
	});

	it('rejects a decoy on a ship', () => {
		const ships = save().ships;
		expect(isFleetHuntSave(save({ decoys: [ships[0].cells[0]] }))).toBe(false);
	});

	it('accepts a valid save, including the bonus on top of the daily missiles', () => {
		expect(isFleetHuntSave(save())).toBe(true);
		expect(
			isFleetHuntSave(save({ ammo: { ...DAILY_AMMO, neptune: DAILY_AMMO.neptune + BONUS_SHOTS } }))
		).toBe(true);
	});

	it.each([
		['null', null],
		['a wrong version', { ...save(), version: 2 }],
		['a bad day', save({ day: 'today' })],
		['no ships', save({ ships: [] })],
		['a ship of the wrong length', save({ ships: [{ class: 'moskva', cells: [0, 1] }] })],
		['a bent ship', save({ ships: [{ class: 'tarantul', cells: [0, 11] }] })],
		['an unknown class', save({ ships: [{ class: 'kirov' as 'kilo', cells: [0, 1, 2] }] })],
		[
			'overlapping ships',
			save({
				ships: [
					{ class: 'tarantul', cells: [0, 1] },
					{ class: 'tarantul', cells: [1, 2] }
				]
			})
		],
		[
			'a cell struck twice',
			save({
				shots: [
					{ cell: 3, weapon: 'usv' },
					{ cell: 3, weapon: 'neptune' }
				]
			})
		],
		['a shot off the grid', save({ shots: [{ cell: 100, weapon: 'usv' }] })],
		['an unknown weapon', save({ shots: [{ cell: 3, weapon: 'kalibr' as 'usv' }] })],
		['too much ammo', save({ ammo: { ...DAILY_AMMO, neptune: 99 } })],
		['negative points', save({ points: -5 })]
	])('rejects %s', (_, value) => {
		expect(isFleetHuntSave(value)).toBe(false);
	});
});

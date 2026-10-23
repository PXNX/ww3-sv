/*
 * Black Sea Fleet Hunt game state: one hidden fleet that stays in local storage until every ship
 * is sunk, a daily supply of Neptune missiles and sea drones, the once-a-day bonus shots and the
 * points from sunk ships. The rules live in $lib/game/fleethunt; this store ties them to the
 * chosen weapon, the saved hunt, the notices and the sounds.
 */
import { createRandom, dayKey, randomSeed, type Random } from '#lib/game/random.js';
import { msUntilNextDay } from '#lib/game/wordle/daily.js';
import {
	allSunk,
	droneContacts,
	placeFleet,
	strikeResult,
	struckCells,
	type Ship,
	type ShipClass,
	type Shot,
	type Weapon
} from '#lib/game/fleethunt/fleet.js';
import {
	BONUS_SHOTS,
	DAILY_AMMO,
	SAVE_KEY,
	isFleetHuntSave,
	resupply,
	totalAmmo,
	type Ammo,
	type FleetHuntSave
} from '#lib/game/fleethunt/save.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

/** Hunting, the whole fleet sunk, or out of strikes until tomorrow */
export type FleetHuntStatus = 'playing' | 'won' | 'resupply';

export type FleetHuntNotice =
	| { id: number; kind: 'miss'; contacts: number | null }
	| { id: number; kind: 'hit' }
	| { id: number; kind: 'sunk'; ship: ShipClass }
	| { id: number; kind: 'bonus' | 'newDay' };

export interface FleetHuntGameOptions {
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
	/** Injected for tests; the current time */
	now?: () => Date;
	/** Injected for tests; the random source for placing fleets */
	random?: () => Random;
}

export class FleetHuntGame {
	/** The local day the ammo belongs to */
	day = $state('');
	ships = $state.raw<Ship[]>([]);
	shots = $state.raw<Shot[]>([]);
	ammo = $state.raw<Ammo>({ ...DAILY_AMMO });
	bonusClaimed = $state(false);
	points = $state(0);
	fleetsSunk = $state(0);
	weapon = $state<Weapon>('neptune');
	notice = $state<FleetHuntNotice | null>(null);
	/** Counts up each time a fleet is sunk during play (not when a sunk one is loaded) */
	finishes = $state(0);
	msLeft = $state(0);

	#store: () => Store;
	#now: () => Date;
	#random: Random;
	#noticeId = 0;

	constructor(options: FleetHuntGameOptions = {}) {
		this.#store = options.store ?? localStore;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a clock reading, never reactive state
		this.#now = options.now ?? (() => new Date());
		this.#random = (options.random ?? (() => createRandom(randomSeed())))();
		this.load();
	}

	get status(): FleetHuntStatus {
		if (allSunk(this.ships, this.shots)) return 'won';
		return totalAmmo(this.ammo) === 0 ? 'resupply' : 'playing';
	}

	get struck(): Set<number> {
		return struckCells(this.shots);
	}

	/** Reads the saved hunt, or starts a new one, and hands out today's ammo (call in the browser) */
	load() {
		const today = dayKey(this.#now());
		const saved = this.#store().read<FleetHuntSave | null>(SAVE_KEY, null, isFleetHuntSave);
		if (saved) {
			this.#apply(resupply(saved, today));
		} else {
			this.#apply({
				version: 1,
				day: today,
				ships: placeFleet(this.#random),
				shots: [],
				ammo: { ...DAILY_AMMO },
				bonusClaimed: false,
				points: 0,
				fleetsSunk: 0
			});
		}
		this.notice = null;
		this.msLeft = msUntilNextDay(this.#now());
		this.#save();
	}

	selectWeapon(weapon: Weapon) {
		if (this.ammo[weapon] === 0 || this.weapon === weapon) return;
		this.weapon = weapon;
		soundManager().play('ui-toggle');
	}

	/** Strikes a cell with the chosen weapon; returns whether a strike was fired */
	fire(cell: number): boolean {
		if (this.status !== 'playing' || this.struck.has(cell)) return false;
		const weapon = this.weapon;
		if (this.ammo[weapon] === 0) return false;

		const result = strikeResult(this.ships, this.shots, cell);
		this.shots = [...this.shots, { cell, weapon }];
		this.ammo = { ...this.ammo, [weapon]: this.ammo[weapon] - 1 };

		if (result.kind === 'miss') {
			const contacts = weapon === 'usv' ? droneContacts(this.ships, this.shots, cell) : null;
			this.#notify({ kind: 'miss', contacts });
			soundManager().play('splash');
		} else if (result.kind === 'hit') {
			this.#notify({ kind: 'hit' });
			soundManager().play('explosion-small');
		} else {
			this.points += result.points;
			this.#notify({ kind: 'sunk', ship: this.ships[result.ship].class });
			if (allSunk(this.ships, this.shots)) {
				this.fleetsSunk += 1;
				this.finishes += 1;
				soundManager().play('chime-big');
			} else {
				soundManager().play('explosion-big');
			}
		}

		// Keep firing with the other weapon once this one is used up
		const other: Weapon = weapon === 'neptune' ? 'usv' : 'neptune';
		if (this.ammo[weapon] === 0 && this.ammo[other] > 0) this.weapon = other;
		this.#save();
		return true;
	}

	/**
	 * Adds today's bonus Neptune missiles; returns whether they were granted.
	 * TODO: play a rewarded advertisement first and only grant the shots once it was watched.
	 */
	claimBonus(): boolean {
		if (this.bonusClaimed) return false;
		this.bonusClaimed = true;
		this.ammo = { ...this.ammo, neptune: this.ammo.neptune + BONUS_SHOTS };
		if (this.ammo[this.weapon] === 0) this.weapon = 'neptune';
		this.#notify({ kind: 'bonus' });
		soundManager().play('pickup');
		this.#save();
		return true;
	}

	/** Sends out a new fleet once the current one is sunk; today's remaining ammo carries over */
	nextFleet() {
		if (this.status !== 'won') return;
		this.ships = placeFleet(this.#random);
		this.shots = [];
		this.notice = null;
		soundManager().play('ui-tap');
		this.#save();
	}

	/** Updates the countdown and hands out new ammo once the local day has changed */
	tick() {
		const now = this.#now();
		this.msLeft = msUntilNextDay(now);
		if (dayKey(now) !== this.day) {
			this.load();
			this.#notify({ kind: 'newDay' });
		}
	}

	#apply(save: FleetHuntSave) {
		this.day = save.day;
		this.ships = save.ships;
		this.shots = save.shots;
		this.ammo = save.ammo;
		this.bonusClaimed = save.bonusClaimed;
		this.points = save.points;
		this.fleetsSunk = save.fleetsSunk;
		if (this.ammo[this.weapon] === 0) this.weapon = this.weapon === 'neptune' ? 'usv' : 'neptune';
	}

	#save() {
		const save: FleetHuntSave = {
			version: 1,
			day: this.day,
			ships: this.ships,
			shots: this.shots,
			ammo: this.ammo,
			bonusClaimed: this.bonusClaimed,
			points: this.points,
			fleetsSunk: this.fleetsSunk
		};
		this.#store().write(SAVE_KEY, save);
	}

	#notify(notice: DistributiveOmit<FleetHuntNotice, 'id'>) {
		this.#noticeId += 1;
		this.notice = { ...notice, id: this.#noticeId } as FleetHuntNotice;
	}
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

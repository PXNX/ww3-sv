/*
 * Black Sea Fleet Hunt game state: one hidden fleet that stays in local storage until every ship
 * is sunk, a daily supply of strikes (Neptune missiles, sea drones, salvos, depth charges) and
 * sonar pings, the once-a-day bonus shots, the combo streak and the points from sunk ships. The
 * rules live in $lib/game/fleethunt; this store ties them to the chosen weapon, the saved hunt
 * and the notices. Every action leaves a `volley` behind that the board animates and voices.
 */
import { createRandom, dayKey, randomSeed, type Random } from '#lib/game/random.js';
import { msUntilNextDay } from '#lib/game/wordle/daily.js';
import {
	evadesAfter,
	evade,
	isStrike,
	newHunt,
	resolveVolley,
	sonarContacts,
	type Evasion
} from '#lib/game/fleethunt/arsenal.js';
import {
	WEAPONS,
	allSunk,
	droneContacts,
	struckCells,
	type CellOutcome,
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
	normalize,
	resupply,
	strikesLeft,
	type Ammo,
	type FleetHuntSave,
	type Ping,
	type StoredSave
} from '#lib/game/fleethunt/save.js';
import {
	fleetResult,
	newRun,
	scoreVolley,
	type FleetResult,
	type RunStats
} from '#lib/game/fleethunt/scoring.js';
import { localStore, type Store } from '#lib/services/storage.js';
import { soundManager } from '#lib/sound/soundManager.svelte.js';

/** Hunting, the whole fleet sunk, or out of strikes until tomorrow */
export type FleetHuntStatus = 'playing' | 'won' | 'resupply';

export type FleetHuntNotice =
	| { id: number; kind: 'miss'; contacts: number | null }
	| { id: number; kind: 'hit'; combo: number }
	| { id: number; kind: 'sunk'; ship: ShipClass; combo: number }
	| { id: number; kind: 'decoy' }
	| { id: number; kind: 'ping'; count: number }
	| { id: number; kind: 'bonus' | 'newDay' };

/** What the last action did, for the board to animate; a new `id` is a new action */
export interface Volley {
	id: number;
	weapon: Weapon;
	/** The cell the weapon was aimed at */
	target: number;
	/** What each struck cell did, in the order the shells land */
	outcomes: CellOutcome[];
	/** Ships this volley sank, with the cells they covered */
	sunk: { ship: ShipClass; cells: number[] }[];
	/** The sonar ping this action sent, if it was one */
	ping: Ping | null;
	/** A patrol boat that slipped away after the action */
	evasion: Evasion | null;
	/** The streak after the action */
	streak: number;
	/** Points the action earned */
	gained: number;
	/** True when this volley sank the last ship */
	won: boolean;
}

export interface FleetHuntGameOptions {
	/** Injected for tests; defaults to the browser's local storage */
	store?: () => Store;
	/** Injected for tests; the current time */
	now?: () => Date;
	/** Injected for tests; the random source for placing fleets */
	random?: () => Random;
}

/** The order the weapon in hand changes to when it runs out; sonar comes last */
const WEAPON_ORDER: readonly Weapon[] = WEAPONS;

export class FleetHuntGame {
	/** The local day the ammo belongs to */
	day = $state('');
	ships = $state.raw<Ship[]>([]);
	decoys = $state.raw<number[]>([]);
	shots = $state.raw<Shot[]>([]);
	pings = $state.raw<Ping[]>([]);
	run = $state.raw<RunStats>(newRun());
	ammo = $state.raw<Ammo>({ ...DAILY_AMMO });
	bonusClaimed = $state(false);
	points = $state(0);
	fleetsSunk = $state(0);
	stars = $state(0);
	weapon = $state<Weapon>('neptune');
	notice = $state<FleetHuntNotice | null>(null);
	volley = $state.raw<Volley | null>(null);
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
		return strikesLeft(this.ammo) === 0 ? 'resupply' : 'playing';
	}

	get struck(): Set<number> {
		return struckCells(this.shots);
	}

	/** The result screen of a sunk fleet */
	get result(): FleetResult | null {
		return this.status === 'won' ? fleetResult(this.ships, this.shots, this.run) : null;
	}

	/** Which hunt this is, counting from 0: it sets how large the fleet is and how many decoys */
	get level(): number {
		return this.fleetsSunk;
	}

	/** Reads the saved hunt, or starts a new one, and hands out today's ammo (call in the browser) */
	load() {
		const today = dayKey(this.#now());
		const stored = this.#store().read<StoredSave | null>(SAVE_KEY, null, isFleetHuntSave);
		if (stored) {
			this.#apply(resupply(normalize(stored), today));
		} else {
			this.#apply({
				version: 1,
				day: today,
				...newHunt(this.#random, 0),
				shots: [],
				pings: [],
				run: newRun(),
				stars: 0,
				ammo: { ...DAILY_AMMO },
				bonusClaimed: false,
				points: 0,
				fleetsSunk: 0
			});
		}
		this.notice = null;
		this.volley = null;
		this.msLeft = msUntilNextDay(this.#now());
		this.#save();
	}

	selectWeapon(weapon: Weapon) {
		if (this.ammo[weapon] === 0 || this.weapon === weapon) return;
		this.weapon = weapon;
		soundManager().play('ui-toggle');
	}

	/** Uses the weapon in hand on a cell; returns whether it was used */
	fire(cell: number): boolean {
		if (this.status !== 'playing') return false;
		const weapon = this.weapon;
		if (this.ammo[weapon] === 0) return false;
		return isStrike(weapon) ? this.#strike(weapon, cell) : this.#ping(cell);
	}

	#ping(cell: number): boolean {
		if (this.pings.some((ping) => ping.cell === cell)) return false;
		const ping: Ping = { cell, count: sonarContacts(this.ships, this.decoys, this.shots, cell) };
		this.pings = [...this.pings, ping];
		this.#spend('sonar');
		this.#notify({ kind: 'ping', count: ping.count });
		this.#announce({
			weapon: 'sonar',
			target: cell,
			outcomes: [],
			sunk: [],
			ping,
			evasion: null,
			streak: this.run.streak,
			gained: 0,
			won: false
		});
		this.#save();
		return true;
	}

	#strike(weapon: Weapon, cell: number): boolean {
		const outcomes = resolveVolley(this.ships, this.decoys, this.shots, weapon, cell);
		if (outcomes.length === 0) return false;

		this.shots = [...this.shots, ...outcomes.map((outcome) => ({ cell: outcome.cell, weapon }))];
		this.#spend(weapon);
		const scored = scoreVolley(this.run, outcomes, this.ships);
		this.run = scored.run;
		this.points += scored.gained;

		const sunk = outcomes.flatMap((outcome) =>
			outcome.kind === 'sunk'
				? [{ ship: this.ships[outcome.ship].class, cells: this.ships[outcome.ship].cells }]
				: []
		);
		const won = allSunk(this.ships, this.shots);
		const streak = this.run.streak;
		if (sunk.length > 0) {
			this.#notify({ kind: 'sunk', ship: sunk[sunk.length - 1].ship, combo: streak });
		} else if (outcomes.some((outcome) => outcome.kind === 'hit')) {
			this.#notify({ kind: 'hit', combo: streak });
		} else if (outcomes.every((outcome) => outcome.kind === 'decoy')) {
			this.#notify({ kind: 'decoy' });
		} else {
			const contacts =
				weapon === 'usv' ? droneContacts(this.ships, this.shots, cell, this.decoys) : null;
			this.#notify({ kind: 'miss', contacts });
		}

		let evasion: Evasion | null = null;
		if (won) {
			const result = fleetResult(this.ships, this.shots, this.run);
			this.points += result.bonus;
			this.stars += result.stars;
			this.fleetsSunk += 1;
			this.finishes += 1;
		} else if (evadesAfter(this.run.strikes)) {
			const moved = evade(this.ships, this.decoys, this.shots, this.#random);
			if (moved) {
				this.ships = moved.ships;
				evasion = moved.move;
			}
		}

		this.#announce({
			weapon,
			target: cell,
			outcomes,
			sunk,
			ping: null,
			evasion,
			streak,
			gained: scored.gained,
			won
		});
		this.#save();
		return true;
	}

	/** Takes one round of a weapon, and changes weapon when it was the last one */
	#spend(weapon: Weapon) {
		this.ammo = { ...this.ammo, [weapon]: this.ammo[weapon] - 1 };
		if (this.ammo[weapon] === 0) this.#pickWeapon();
	}

	/** Keeps the weapon in hand if it still has rounds, otherwise takes the next one that has */
	#pickWeapon() {
		if (this.ammo[this.weapon] > 0) return;
		const next = WEAPON_ORDER.find((weapon) => this.ammo[weapon] > 0);
		if (next) this.weapon = next;
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

	/** Sends out a larger fleet once the current one is sunk; today's remaining ammo carries over */
	nextFleet() {
		if (this.status !== 'won') return;
		const hunt = newHunt(this.#random, this.level);
		this.ships = hunt.ships;
		this.decoys = hunt.decoys;
		this.shots = [];
		this.pings = [];
		this.run = newRun();
		this.notice = null;
		this.volley = null;
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
		this.decoys = save.decoys;
		this.shots = save.shots;
		this.pings = save.pings;
		this.run = save.run;
		this.ammo = save.ammo;
		this.bonusClaimed = save.bonusClaimed;
		this.points = save.points;
		this.fleetsSunk = save.fleetsSunk;
		this.stars = save.stars;
		this.#pickWeapon();
	}

	#save() {
		const save: FleetHuntSave = {
			version: 1,
			day: this.day,
			ships: this.ships,
			decoys: this.decoys,
			shots: this.shots,
			pings: this.pings,
			run: this.run,
			stars: this.stars,
			ammo: this.ammo,
			bonusClaimed: this.bonusClaimed,
			points: this.points,
			fleetsSunk: this.fleetsSunk
		};
		this.#store().write(SAVE_KEY, save);
	}

	#announce(volley: Omit<Volley, 'id'>) {
		this.#noticeId += 1;
		this.volley = { ...volley, id: this.#noticeId };
	}

	#notify(notice: DistributiveOmit<FleetHuntNotice, 'id'>) {
		this.#noticeId += 1;
		this.notice = { ...notice, id: this.#noticeId } as FleetHuntNotice;
	}
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

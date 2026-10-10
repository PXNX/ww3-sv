/*
 * Drone Wall: the simulation state (a plain object, read by the renderer every frame) and the
 * events a step reports (sounds, effects, banners).
 */
import {
	FIRST_PREP_MS,
	STARTING_HELMETS,
	STARTING_LIVES,
	type DefenseKind,
	type FlyerKind,
	type GarrisonKind,
	type MapId,
	type PowerKind,
	type SoldierKind,
	type WeatherKind
} from './config';
import { getMap, type DroneWallMap } from './maps';
import type { SpawnEntry } from './waves';

export interface Soldier {
	id: number;
	kind: SoldierKind;
	/** Distance travelled along the road */
	progress: number;
	hp: number;
	maxHp: number;
	/** Base speed in units per second, including this soldier's own variation */
	speed: number;
	/** Sideways position on the road, from -1 to 1 (drawing only) */
	lane: number;
	x: number;
	y: number;
	/** Speed multiplier from trenches during the last step (1 = free) */
	slow: number;
	/** Hit flash, counts down */
	hitMs: number;
	/** In melee with a defender unit this step, so it stands still and fights */
	engaged: boolean;
	/** Frozen solid in the snow: stands still while this counts down */
	frozenMs: number;
	/** Cannot freeze again while this counts down (it has just thawed) */
	thawMs: number;
	/** Speed multiplier from an officer shouting nearby during the last step (1 = none) */
	rally: number;
}

/** A defender that walks around its post and fights soldiers in melee (Azov infantry, a Leopard tank) */
export interface Unit {
	id: number;
	/** The defense (slot) it belongs to */
	slot: number;
	kind: GarrisonKind;
	x: number;
	y: number;
	hp: number;
	maxHp: number;
	/** Where it is looking, in radians (drawing, and the tank's turret) */
	facing: number;
	/** Offsets its place on the patrol circle from the other units of the post */
	phase: number;
	targetId: number | null;
	attackMs: number;
	/** Hit flash, counts down */
	hitMs: number;
	/** Swing animation, counts down (drawing only) */
	swingMs: number;
}

/** An aerial enemy: flies a straight line from above the field to the line, ignoring the road */
export interface Flyer {
	id: number;
	kind: FlyerKind;
	/** Tells it apart from a Soldier */
	air: true;
	hp: number;
	maxHp: number;
	/** Base speed in units per second, including this flyer's own variation */
	speed: number;
	/** Entry and exit x of the flight line, and the height it ends at (the line) */
	fromX: number;
	toX: number;
	toY: number;
	/** Distance flown, and the total length of the flight */
	progress: number;
	length: number;
	/** Sideways wobble phase (also moves it a little off the straight line) */
	phase: number;
	x: number;
	y: number;
	hitMs: number;
}

export type ProjectileKind = 'fpv' | 'missile';

/** A homing FPV drone (from a nest, chases soldiers) or Patriot missile (chases flyers) */
export interface Projectile {
	id: number;
	kind: ProjectileKind;
	x: number;
	y: number;
	/** Heading in radians (0 = right, PI / 2 = down) */
	angle: number;
	/** The enemy it chases, or null once it has lost it */
	targetId: number | null;
	damage: number;
	/** Cruise speed in units per second */
	speed: number;
	ageMs: number;
}

export interface Defense {
	kind: DefenseKind;
	level: number;
	cooldownMs: number;
	/** Where the defense last aimed, in radians (drawing only) */
	aim: number;
	/** Shows the shooting pose for a moment (drawing only) */
	firedMs: number;
}

export interface Helmet {
	id: number;
	x: number;
	y: number;
	value: number;
	ageMs: number;
}

/** What lands on the road: artillery shells, HIMARS rockets, F-16 bombs or a Storm Shadow */
export type ShellKind = 'shell' | 'rocket' | 'bomb' | 'cruise';

export interface Shell {
	id: number;
	kind: ShellKind;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	/** Negative while it waits to be launched (a salvo or a bombing run is staggered) */
	ageMs: number;
	flightMs: number;
	damage: number;
	radius: number;
}

/** F-16 jets crossing the field on a bombing run, for drawing (the bombs are shells) */
export interface AirRun {
	id: number;
	/** The middle of the bombed band */
	y: number;
	ageMs: number;
	durationMs: number;
}

export interface PowerState {
	/** Time until the power can be called again */
	cooldownMs: number;
}

export type WavePhase = 'prep' | 'wave';

export interface DroneWallState {
	timeMs: number;
	/** Number of the wave that is running or was last played (0 before the first one) */
	wave: number;
	phase: WavePhase;
	/** Time left until the next wave, while in the prep phase */
	prepMs: number;
	/** Time since the current wave started */
	waveMs: number;
	queue: SpawnEntry[];
	queueIndex: number;
	/** The map being played: road, slots and scenery */
	map: DroneWallMap;
	soldiers: Soldier[];
	units: Unit[];
	flyers: Flyer[];
	helmets: Helmet[];
	shells: Shell[];
	projectiles: Projectile[];
	runs: AirRun[];
	/** One entry per slot, null when empty */
	defenses: (Defense | null)[];
	/** The weather of the wave that is running or was last played, and the next wave's */
	weather: WeatherKind;
	forecast: WeatherKind;
	/** Time the current weather has lasted (drawing: it fades in) */
	weatherMs: number;
	/** The highest elite tier any defense has reached (0 to 3): unlocks and strengthens the powers */
	eliteRank: number;
	powers: Record<PowerKind, PowerState>;
	/** When the sudden mass assault of this wave starts, or null if there is none */
	rushAtMs: number | null;
	rushWarned: boolean;
	/** Helmets in the player's pocket: the only currency */
	currency: number;
	lives: number;
	score: number;
	/** Soldiers stopped */
	kills: number;
	/** Helmets picked up */
	collected: number;
	over: boolean;
	nextId: number;
}

export function createGame(mapId: MapId = 'serpentine'): DroneWallState {
	const map = getMap(mapId);
	return {
		timeMs: 0,
		wave: 0,
		phase: 'prep',
		prepMs: FIRST_PREP_MS,
		waveMs: 0,
		queue: [],
		queueIndex: 0,
		map,
		soldiers: [],
		units: [],
		flyers: [],
		helmets: [],
		shells: [],
		projectiles: [],
		runs: [],
		weather: 'clear',
		forecast: 'clear',
		weatherMs: 0,
		eliteRank: 0,
		powers: { airstrike: { cooldownMs: 0 }, stormshadow: { cooldownMs: 0 } },
		rushAtMs: null,
		rushWarned: false,
		defenses: map.slots.map(() => null),
		currency: STARTING_HELMETS,
		lives: STARTING_LIVES,
		score: 0,
		kills: 0,
		collected: 0,
		over: false,
		nextId: 1
	};
}

export type DroneWallEvent =
	| { type: 'wave-started'; wave: number }
	| { type: 'wave-cleared'; wave: number; bonus: number }
	| { type: 'soldier-fell'; x: number; y: number; kind: SoldierKind }
	| { type: 'unit-spawned'; x: number; y: number; kind: GarrisonKind }
	| { type: 'unit-fell'; x: number; y: number; kind: GarrisonKind }
	| { type: 'melee-hit'; x: number; y: number; kind: GarrisonKind }
	| { type: 'flyer-spawned'; kind: FlyerKind }
	| { type: 'flyer-fell'; x: number; y: number; kind: FlyerKind }
	| { type: 'helmet-collected'; x: number; y: number; value: number }
	| { type: 'leak'; x: number; y: number }
	| {
			type: 'squad-shot';
			weapon: DefenseKind;
			slot: number;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
	  }
	| { type: 'drone-launched'; slot: number; x: number; y: number }
	| { type: 'missile-launched'; slot: number; x: number; y: number }
	| { type: 'projectile-hit'; kind: ProjectileKind; x: number; y: number }
	| { type: 'projectile-lost'; kind: ProjectileKind; x: number; y: number }
	| {
			type: 'shell-launched';
			kind: ShellKind;
			slot: number;
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
	  }
	| { type: 'shell-landed'; kind: ShellKind; x: number; y: number; radius: number }
	| { type: 'weather-changed'; weather: WeatherKind }
	| { type: 'soldier-froze'; x: number; y: number; kind: SoldierKind }
	| { type: 'rush-warning'; wave: number }
	| { type: 'rush-started'; wave: number }
	| { type: 'power-called'; power: PowerKind; x: number; y: number }
	| { type: 'game-over' };

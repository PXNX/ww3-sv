/*
 * Radar Slice constants, all in world units. The playfield is a portrait 360 x 560 box that the
 * canvas scales to fit; y grows downwards, so "up" is negative y.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 560;

export const STARTING_LIVES = 5;

/** Downward acceleration in world units per second squared (before the per-kind scale) */
export const GRAVITY = 520;

export type ThreatKind =
	'zircon' | 'kinzhal' | 'geran' | 'kalibr' | 'iskander' | 'cluster' | 'bomblet';
/** Friendly traffic and floating mines: cutting one costs a heart */
export type DecoyKind = 'tanker' | 'balloon' | 'gull' | 'mine';
/** Floating supplies: cutting one is a reward and missing one costs nothing */
export type PickupKind = 'focus' | 'repair';
export type FlyerKind = ThreatKind | DecoyKind | PickupKind;

export interface KindSpec {
	/** Collision radius in world units; also sets the drawn size */
	radius: number;
	/** Points for a clean slice (threats only) */
	points: number;
	/** Multiplies gravity: above 1 is a fast arc, below 1 floats */
	gravityScale: number;
	/** Whether the nose follows the direction of flight (otherwise the body rocks gently) */
	pointsForward: boolean;
	/** Rocking of decoys: swing in radians and speed in radians per second */
	sway: number;
	swayRate: number;
	/** Relative chance to be picked among its group (0: never launched from the sea) */
	weight: number;
	/** Cuts it takes, each in its own swipe: above 1 is armoured */
	hp: number;
	/** Smaller threats it breaks into when cut */
	splits: number;
	/** A small fragment: falling back unsliced breaks the streak but costs no heart */
	minor: boolean;
	/** The first wave it can be launched in */
	minWave: number;
	/** Constant tumbling in radians per second (0 for none) */
	tumble: number;
}

const BASE: KindSpec = {
	radius: 20,
	points: 0,
	gravityScale: 1,
	pointsForward: true,
	sway: 0,
	swayRate: 0,
	weight: 1,
	hp: 1,
	splits: 0,
	minor: false,
	minWave: 1,
	tumble: 0
};

function kind(spec: Partial<KindSpec>): KindSpec {
	return { ...BASE, ...spec };
}

export const THREATS: Readonly<Record<ThreatKind, KindSpec>> = {
	zircon: kind({ radius: 17, points: 25, gravityScale: 1.35, weight: 2 }),
	kinzhal: kind({ radius: 20, points: 20, gravityScale: 1.1, weight: 3 }),
	geran: kind({ radius: 22, points: 10, gravityScale: 0.8, weight: 4 }),
	kalibr: kind({ radius: 21, points: 15, gravityScale: 1, weight: 3 }),
	// Armoured: two separate swipes to get through the plating
	iskander: kind({ radius: 24, points: 40, gravityScale: 0.95, weight: 2, hp: 2, minWave: 2 }),
	// Breaks into two bomblets when cut
	cluster: kind({ radius: 22, points: 30, gravityScale: 1, weight: 2, splits: 2, minWave: 3 }),
	// Only ever born from a cluster
	bomblet: kind({ radius: 12, points: 8, gravityScale: 1, weight: 0, minor: true })
};

export const DECOYS: Readonly<Record<DecoyKind, KindSpec>> = {
	tanker: kind({
		radius: 26,
		gravityScale: 0.9,
		pointsForward: false,
		sway: 0.45,
		swayRate: 3,
		weight: 3
	}),
	balloon: kind({
		radius: 22,
		gravityScale: 0.35,
		pointsForward: false,
		sway: 0.25,
		swayRate: 2.5,
		weight: 3
	}),
	gull: kind({
		radius: 19,
		gravityScale: 0.8,
		pointsForward: false,
		sway: 0.3,
		swayRate: 6,
		weight: 3
	}),
	// A tumbling sea mine: cutting it sets it off and shoves everything nearby
	mine: kind({
		radius: 20,
		gravityScale: 0.9,
		pointsForward: false,
		weight: 2,
		minWave: 4,
		tumble: 1.6
	})
};

export const PICKUPS: Readonly<Record<PickupKind, KindSpec>> = {
	focus: kind({ radius: 19, gravityScale: 0.55, pointsForward: false, weight: 4, tumble: 2.2 }),
	repair: kind({ radius: 19, gravityScale: 0.55, pointsForward: false, weight: 1, tumble: -1.8 })
};

export const THREAT_KINDS = Object.keys(THREATS) as ThreatKind[];
export const DECOY_KINDS = Object.keys(DECOYS) as DecoyKind[];
export const PICKUP_KINDS = Object.keys(PICKUPS) as PickupKind[];

export function specOf(kind: FlyerKind): KindSpec {
	if (kind in THREATS) return THREATS[kind as ThreatKind];
	if (kind in DECOYS) return DECOYS[kind as DecoyKind];
	return PICKUPS[kind as PickupKind];
}

export function isDecoy(kind: FlyerKind): kind is DecoyKind {
	return kind in DECOYS;
}

export function isPickup(kind: FlyerKind): kind is PickupKind {
	return kind in PICKUPS;
}

/** Where a launch starts: just below the bottom edge, at least this fraction in from the sides */
export const LAUNCH_MARGIN = 0.1;
/** How high the arc may peak, as a fraction of the world height from the top */
export const APEX_MIN = 0.12;
export const APEX_MAX = 0.5;
/** The apex x stays inside this band of the world width */
export const APEX_X_MIN = 0.2;
export const APEX_X_MAX = 0.8;

/** Trail: the newest points of the swipe, each fading after a short while */
export const TRAIL_MAX_POINTS = 8;
export const TRAIL_FADE_MS = 220;
/** Extra reach around a flyer so a thumb does not have to be pixel perfect */
export const TRAIL_REACH = 5;

/** Slices of one swipe chain into a combo while each follows the last within this time */
export const COMBO_WINDOW_MS = 450;
export const COMBO_STEP = 5;
export const COMBO_CAP = 8;

/** A streak of clean slices (no miss, no decoy) lifts every score by one tier per this many */
export const STREAK_TIER = 10;
export const STREAK_MULTIPLIER_CAP = 4;

/** Sliced halves */
export const HALF_SEPARATION_SPEED = 95;
export const HALF_SPIN = 4;
export const HALF_LIFE_MS = 1300;
/** Halves skim off the sea surface once, keeping this share of their fall speed */
export const SEA_SKIM_RESTITUTION = 0.38;
/** Height of the sea strip the flyers launch from and fall back into */
export const SEA_HEIGHT = 30;

/** Flyers and halves rebound off the side walls, keeping this share of their sideways speed */
export const WALL_RESTITUTION = 0.8;

/** A mine going off shoves every flyer within this distance */
export const BLAST_RADIUS = 120;
export const BLAST_IMPULSE = 300;

/** Armoured flyers get a knock from every cut that does not break them */
export const ARMOR_KNOCK = 90;
/** Bomblets fly out of a cluster at this sideways speed (plus a spread) and upward speed */
export const SPLIT_SIDE_SPEED = 80;
export const SPLIT_UP_SPEED = 150;

/** Waves: a set number of volleys, then a lull while the sky clears */
export const WAVE_COUNT = 8;
export const WAVE_LULL_MS = 2200;
export const WAVE_START_MS = 900;
/** Bonus for clearing a wave, per wave number, and extra for losing no heart in it */
export const WAVE_BONUS = 25;
export const FLAWLESS_BONUS = 50;

export function waveVolleys(wave: number): number {
	return 5 + 2 * wave;
}

/** Focus: the world slows down while the player's blade stays at full speed */
export const FOCUS_MS = 4500;
export const FOCUS_SCALE = 0.4;

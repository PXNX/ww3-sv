/*
 * Radar Slice constants, all in world units. The playfield is a portrait 360 x 560 box that the
 * canvas scales to fit; y grows downwards, so "up" is negative y.
 */

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 560;

export const STARTING_LIVES = 5;

/** Downward acceleration in world units per second squared (before the per-kind scale) */
export const GRAVITY = 520;

export type ThreatKind = 'zircon' | 'kinzhal' | 'geran' | 'kalibr';
export type DecoyKind = 'tanker' | 'balloon' | 'gull';
export type FlyerKind = ThreatKind | DecoyKind;

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
	/** Relative chance to be picked among its group */
	weight: number;
}

export const THREATS: Readonly<Record<ThreatKind, KindSpec>> = {
	zircon: {
		radius: 17,
		points: 25,
		gravityScale: 1.35,
		pointsForward: true,
		sway: 0,
		swayRate: 0,
		weight: 2
	},
	kinzhal: {
		radius: 20,
		points: 20,
		gravityScale: 1.1,
		pointsForward: true,
		sway: 0,
		swayRate: 0,
		weight: 3
	},
	geran: {
		radius: 22,
		points: 10,
		gravityScale: 0.8,
		pointsForward: true,
		sway: 0,
		swayRate: 0,
		weight: 4
	},
	kalibr: {
		radius: 21,
		points: 15,
		gravityScale: 1,
		pointsForward: true,
		sway: 0,
		swayRate: 0,
		weight: 3
	}
};

export const DECOYS: Readonly<Record<DecoyKind, KindSpec>> = {
	tanker: {
		radius: 26,
		points: 0,
		gravityScale: 0.9,
		pointsForward: false,
		sway: 0.45,
		swayRate: 3,
		weight: 3
	},
	balloon: {
		radius: 22,
		points: 0,
		gravityScale: 0.35,
		pointsForward: false,
		sway: 0.25,
		swayRate: 2.5,
		weight: 3
	},
	gull: {
		radius: 19,
		points: 0,
		gravityScale: 0.8,
		pointsForward: false,
		sway: 0.3,
		swayRate: 6,
		weight: 3
	}
};

export const THREAT_KINDS = Object.keys(THREATS) as ThreatKind[];
export const DECOY_KINDS = Object.keys(DECOYS) as DecoyKind[];

export function specOf(kind: FlyerKind): KindSpec {
	return kind in THREATS ? THREATS[kind as ThreatKind] : DECOYS[kind as DecoyKind];
}

export function isDecoy(kind: FlyerKind): kind is DecoyKind {
	return kind in DECOYS;
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

/** Sliced halves */
export const HALF_SEPARATION_SPEED = 95;
export const HALF_SPIN = 4;
export const HALF_LIFE_MS = 1300;

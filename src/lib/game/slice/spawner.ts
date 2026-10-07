/*
 * Trajectory spawner. Every flyer is launched from just below the bottom edge on a ballistic
 * arc: its peak is picked first (how high, and over which x), then the launch speed is solved
 * so the arc really reaches it. The arc is mirrored around the peak, so picking the peak so that
 * the landing spot stays inside the field also keeps the whole flight inside it.
 */
import {
	APEX_MAX,
	APEX_MIN,
	APEX_X_MAX,
	APEX_X_MIN,
	DECOY_KINDS,
	GRAVITY,
	LAUNCH_MARGIN,
	THREAT_KINDS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	specOf,
	type FlyerKind
} from './config';
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';

export interface Launch {
	kind: FlyerKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Downward acceleration of this flyer */
	gravity: number;
	/** Drawing angle in radians; 0 points right */
	angle: number;
	/** Per-flyer phase so decoys do not all sway in step */
	phase: number;
}

/** Plans one arc for the given kind; consumes a fixed number of random values */
export function launchFlyer(random: Random, kind: FlyerKind): Launch {
	const spec = specOf(kind);
	const gravity = GRAVITY * spec.gravityScale;
	const startX = WORLD_WIDTH * (LAUNCH_MARGIN + random() * (1 - 2 * LAUNCH_MARGIN));
	const startY = WORLD_HEIGHT + spec.radius;
	const apexY = WORLD_HEIGHT * (APEX_MIN + random() * (APEX_MAX - APEX_MIN));

	// The landing spot (mirror of the start around the peak) must stay on the field
	const low = Math.max(WORLD_WIDTH * APEX_X_MIN, (startX + spec.radius) / 2);
	const high = Math.min(WORLD_WIDTH * APEX_X_MAX, (WORLD_WIDTH - spec.radius + startX) / 2);
	const apexX = low + random() * Math.max(0, high - low);

	const vy = -Math.sqrt(2 * gravity * (startY - apexY));
	const riseSeconds = -vy / gravity;
	return {
		kind,
		x: startX,
		y: startY,
		vx: (apexX - startX) / riseSeconds,
		vy,
		gravity,
		angle: 0,
		phase: random() * Math.PI * 2
	};
}

/** Position of an arc after the given seconds of flight */
export function arcAt(launch: Launch, seconds: number): { x: number; y: number } {
	return {
		x: launch.x + launch.vx * seconds,
		y: launch.y + launch.vy * seconds + 0.5 * launch.gravity * seconds * seconds
	};
}

/** Seconds from the launch until the arc peaks */
export function timeToApex(launch: Launch): number {
	return -launch.vy / launch.gravity;
}

export interface Difficulty {
	/** Time between volleys */
	intervalMs: number;
	/** Chance that a volley holds more than one flyer */
	burstChance: number;
	/** Most flyers in one volley */
	maxBurst: number;
	/** Chance that each flyer after the first is a decoy */
	decoyChance: number;
}

/** Ramps up with time: faster volleys, bigger bursts, more decoys */
export function difficultyAt(timeMs: number): Difficulty {
	const seconds = Math.max(0, timeMs) / 1000;
	return {
		intervalMs: Math.max(650, 1500 - seconds * 12),
		burstChance: Math.min(0.7, 0.15 + seconds * 0.006),
		maxBurst: seconds < 40 ? 2 : seconds < 90 ? 3 : 4,
		decoyChance: Math.min(0.45, 0.2 + seconds * 0.004)
	};
}

export interface Spawner {
	/** Milliseconds until the next volley */
	nextMs: number;
}

export const FIRST_VOLLEY_MS = 700;

export function createSpawner(): Spawner {
	return { nextMs: FIRST_VOLLEY_MS };
}

function pickKind(random: Random, decoy: boolean): FlyerKind {
	const kinds: readonly FlyerKind[] = decoy ? DECOY_KINDS : THREAT_KINDS;
	return pickWeighted(
		random,
		kinds.map((kind) => ({ item: kind, weight: specOf(kind).weight }))
	);
}

/** One volley: always at least one threat, the rest are threats or decoys */
export function planVolley(random: Random, timeMs: number): Launch[] {
	const difficulty = difficultyAt(timeMs);
	const count =
		random() < difficulty.burstChance ? randomInt(random, 2, difficulty.maxBurst + 1) : 1;
	const launches: Launch[] = [];
	for (let i = 0; i < count; i++) {
		const decoy = i > 0 && random() < difficulty.decoyChance;
		launches.push(launchFlyer(random, pickKind(random, decoy)));
	}
	return launches;
}

/** Counts the timer down and returns the launches that are due this step */
export function stepSpawner(
	spawner: Spawner,
	random: Random,
	dtMs: number,
	timeMs: number
): Launch[] {
	spawner.nextMs -= dtMs;
	if (spawner.nextMs > 0) return [];
	spawner.nextMs += difficultyAt(timeMs).intervalMs;
	return planVolley(random, timeMs);
}

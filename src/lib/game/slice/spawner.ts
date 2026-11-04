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
	STARTING_LIVES,
	THREAT_KINDS,
	WAVE_START_MS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	specOf,
	waveVolleys,
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
	/** Chance that a volley carries a floating supply */
	pickupChance: number;
}

/** Ramps up with the wave (1 is the first): faster volleys, bigger bursts, more decoys */
export function difficultyAt(wave: number): Difficulty {
	const step = Math.max(0, wave - 1);
	return {
		intervalMs: Math.max(650, 1450 - step * 110),
		burstChance: Math.min(0.7, 0.12 + step * 0.08),
		maxBurst: wave < 3 ? 2 : wave < 6 ? 3 : 4,
		decoyChance: Math.min(0.45, 0.2 + step * 0.035),
		pickupChance: wave < 2 ? 0 : 0.1
	};
}

export interface Spawner {
	/** Milliseconds until the next volley */
	nextMs: number;
	/** The wave being launched, from 1 */
	wave: number;
	/** Volleys of this wave still to launch */
	volleysLeft: number;
	/** Milliseconds of the calm between waves that are left (0 while a wave runs) */
	lullMs: number;
	/** The current wave has not been announced yet */
	announce: boolean;
}

export const FIRST_VOLLEY_MS = 700;

export function createSpawner(): Spawner {
	return {
		nextMs: FIRST_VOLLEY_MS,
		wave: 1,
		volleysLeft: waveVolleys(1),
		lullMs: 0,
		announce: true
	};
}

/** Starts the next wave: its volleys and a short pause before the first one */
export function beginWave(spawner: Spawner, wave: number) {
	spawner.wave = wave;
	spawner.volleysLeft = waveVolleys(wave);
	spawner.lullMs = 0;
	spawner.nextMs = WAVE_START_MS;
	spawner.announce = true;
}

function pickKind(random: Random, group: readonly FlyerKind[], wave: number): FlyerKind {
	return pickWeighted(
		random,
		group.map((kind) => {
			const spec = specOf(kind);
			return { item: kind, weight: spec.minWave <= wave ? spec.weight : 0 };
		})
	);
}

/**
 * One volley: always at least one threat, the rest are threats or decoys, and now and then a
 * floating supply (a repair only while a heart is missing).
 */
export function planVolley(random: Random, wave: number, lives = STARTING_LIVES): Launch[] {
	const difficulty = difficultyAt(wave);
	const count =
		random() < difficulty.burstChance ? randomInt(random, 2, difficulty.maxBurst + 1) : 1;
	const launches: Launch[] = [];
	for (let i = 0; i < count; i++) {
		const decoy = i > 0 && random() < difficulty.decoyChance;
		launches.push(launchFlyer(random, pickKind(random, decoy ? DECOY_KINDS : THREAT_KINDS, wave)));
	}
	if (random() < difficulty.pickupChance) {
		const repair = lives < STARTING_LIVES && random() < 0.45;
		launches.push(launchFlyer(random, repair ? 'repair' : 'focus'));
	}
	return launches;
}

/**
 * Counts the volley timer down while a wave runs and returns the launches that are due this
 * step. Between waves (lull) or with every volley out it launches nothing.
 */
export function stepSpawner(
	spawner: Spawner,
	random: Random,
	dtMs: number,
	lives = STARTING_LIVES
): Launch[] {
	if (spawner.volleysLeft <= 0) return [];
	spawner.nextMs -= dtMs;
	if (spawner.nextMs > 0) return [];
	spawner.nextMs += difficultyAt(spawner.wave).intervalMs;
	spawner.volleysLeft -= 1;
	return planVolley(random, spawner.wave, lives);
}

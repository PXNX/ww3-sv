/*
 * The spawn scheduler. A timer counts down to the next pop-up; each one picks a free podium and
 * a figure. Difficulty ramps with the run time: pop-ups come faster, more of them are up at once,
 * statements run shorter and decoys mix in more often.
 */
import { DECOY_KINDS, HOLE_COUNT, TARGET_KINDS, specOf, type MoleKind } from './config';
import { pickWeighted, type Random } from '#lib/game/random.js';

export interface Spawn {
	hole: number;
	kind: MoleKind;
	/** How long the statement runs (targets) or the visit lasts (decoys), after rising */
	lifeMs: number;
}

export interface Difficulty {
	/** Time between pop-ups */
	intervalMs: number;
	/** Most figures up at the same time */
	maxActive: number;
	/** Multiplies every statement's length: below 1 is faster */
	speakScale: number;
	/** Chance that a pop-up is a decoy (only while a target is up, so they never come alone) */
	decoyChance: number;
}

export function difficultyAt(timeMs: number): Difficulty {
	const seconds = Math.max(0, timeMs) / 1000;
	return {
		intervalMs: Math.max(420, 1150 - seconds * 8),
		maxActive: Math.min(5, 2 + Math.floor(seconds / 20)),
		speakScale: Math.max(0.6, 1 - seconds * 0.004),
		decoyChance: Math.min(0.35, 0.12 + seconds * 0.003)
	};
}

export interface Spawner {
	/** Milliseconds until the next pop-up */
	nextMs: number;
}

export const FIRST_SPAWN_MS = 600;
/** When the field is full the scheduler looks again after this long */
export const RETRY_MS = 120;

export function createSpawner(): Spawner {
	return { nextMs: FIRST_SPAWN_MS };
}

function pickKind(random: Random, decoy: boolean): MoleKind {
	const kinds: readonly MoleKind[] = decoy ? DECOY_KINDS : TARGET_KINDS;
	return pickWeighted(
		random,
		kinds.map((kind) => ({ item: kind, weight: specOf(kind).weight }))
	);
}

/**
 * Plans one pop-up on a free podium, or null when none is free. Always consumes the same number
 * of random values, so a run stays reproducible from its seed.
 */
export function planSpawn(
	random: Random,
	timeMs: number,
	freeHoles: readonly number[],
	targetsUp: number
): Spawn | null {
	const difficulty = difficultyAt(timeMs);
	const holeRoll = random();
	const decoyRoll = random();
	const kindRoll = random();
	const lifeRoll = random();
	if (freeHoles.length === 0) return null;

	const hole = freeHoles[Math.min(freeHoles.length - 1, Math.floor(holeRoll * freeHoles.length))];
	const decoy = targetsUp > 0 && decoyRoll < difficulty.decoyChance;
	const kind = pickKind(() => kindRoll, decoy);
	const jitter = 0.9 + lifeRoll * 0.2;
	return { hole, kind, lifeMs: Math.round(specOf(kind).lifeMs * difficulty.speakScale * jitter) };
}

/** Counts the timer down and returns the pop-ups that are due this step */
export function stepSpawner(
	spawner: Spawner,
	random: Random,
	dtMs: number,
	timeMs: number,
	occupied: ReadonlySet<number>,
	targetsUp: number
): Spawn[] {
	spawner.nextMs -= dtMs;
	if (spawner.nextMs > 0) return [];
	const difficulty = difficultyAt(timeMs);
	if (occupied.size >= difficulty.maxActive) {
		spawner.nextMs = RETRY_MS;
		return [];
	}
	const free: number[] = [];
	for (let hole = 0; hole < HOLE_COUNT; hole++) if (!occupied.has(hole)) free.push(hole);
	const spawn = planSpawn(random, timeMs, free, targetsUp);
	spawner.nextMs += difficulty.intervalMs;
	return spawn ? [spawn] : [];
}

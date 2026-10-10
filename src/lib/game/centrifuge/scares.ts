/*
 * The scare scheduler. Scares are pure noise: sirens, BREAKING banners, screen shake and a looming
 * "Something". They never change what the dial does except to make the needle twitchier, so the
 * right answer to every scare is to do nothing. The scheduler decides when they start and end;
 * the higher the difficulty, the more often they come, the stronger they are and the more of them
 * overlap.
 */
import { pickWeighted, randomInt, type Random } from '#lib/game/random.js';
import { BANNER_COUNT, clamp01, lerp } from './config.js';

export type ScareKind = 'siren' | 'banner' | 'shake' | 'something';

export interface Scare {
	id: number;
	kind: ScareKind;
	/** 0 to 1: how loud the scare is, and how much it twitches the needle */
	intensity: number;
	durationMs: number;
	ageMs: number;
	/** Which banner text to show (0 to BANNER_COUNT - 1); unused by other kinds */
	variant: number;
	/** The player pressed the button while this scare was on: it earns nothing */
	reacted: boolean;
}

export interface Scheduler {
	/** Time until the next scare starts */
	nextInMs: number;
	nextId: number;
	active: Scare[];
}

export interface SchedulerResult {
	started: Scare[];
	ended: Scare[];
}

/** How much each kind twitches the needle, relative to its intensity */
const KIND_JITTER: Record<ScareKind, number> = {
	banner: 0.5,
	siren: 0.7,
	something: 0.8,
	shake: 1
};

/** Fade in and out of a scare, so the needle does not jump the moment it starts */
const ENVELOPE_MS = 500;

export function createScheduler(firstInMs: number): Scheduler {
	return { nextInMs: firstInMs, nextId: 1, active: [] };
}

/** Kinds that can appear at this difficulty with their weights: shake and the looming thing come later */
export function scareKindsAt(difficulty: number): { item: ScareKind; weight: number }[] {
	const kinds: { item: ScareKind; weight: number }[] = [
		{ item: 'siren', weight: 3 },
		{ item: 'banner', weight: 3 }
	];
	if (difficulty >= 0.15) kinds.push({ item: 'shake', weight: 2 });
	if (difficulty >= 0.3) kinds.push({ item: 'something', weight: 2 });
	return kinds;
}

/** Most scares that may be on at once */
export function maxConcurrent(difficulty: number): number {
	return difficulty >= 0.85 ? 3 : difficulty >= 0.5 ? 2 : 1;
}

/** Time between one scare starting and the next */
export function gapMs(difficulty: number, random: Random): number {
	return lerp(6000, 1800, clamp01(difficulty)) * (0.7 + random() * 0.6);
}

/** Creates one scare of a kind not already on screen; null when every available kind is running */
export function spawnScare(scheduler: Scheduler, random: Random, difficulty: number): Scare | null {
	const running = new Set(scheduler.active.map((scare) => scare.kind));
	const kinds = scareKindsAt(difficulty).filter((entry) => !running.has(entry.item));
	if (kinds.length === 0) return null;
	const d = clamp01(difficulty);
	const scare: Scare = {
		id: scheduler.nextId++,
		kind: pickWeighted(random, kinds),
		intensity: lerp(0.25, 0.5, d) + random() * lerp(0.25, 0.5, d),
		durationMs: 2200 + random() * 2200 + d * 1200,
		ageMs: 0,
		variant: randomInt(random, 0, BANNER_COUNT),
		reacted: false
	};
	scheduler.active.push(scare);
	return scare;
}

/** Starts a scare right now (a drift hiding behind it), if there is room for one */
export function forceScare(scheduler: Scheduler, random: Random, difficulty: number): Scare | null {
	if (scheduler.active.length >= maxConcurrent(difficulty)) return null;
	return spawnScare(scheduler, random, difficulty);
}

/** Ages the active scares, ends the finished ones and starts new ones on schedule */
export function stepScheduler(
	scheduler: Scheduler,
	random: Random,
	dtMs: number,
	difficulty: number
): SchedulerResult {
	const started: Scare[] = [];
	const ended: Scare[] = [];

	for (const scare of scheduler.active) scare.ageMs += dtMs;
	scheduler.active = scheduler.active.filter((scare) => {
		if (scare.ageMs < scare.durationMs) return true;
		ended.push(scare);
		return false;
	});

	scheduler.nextInMs -= dtMs;
	if (scheduler.nextInMs <= 0) {
		scheduler.nextInMs = gapMs(difficulty, random);
		const first = forceScare(scheduler, random, difficulty);
		if (first) {
			started.push(first);
			// Later in a run scares often arrive in pairs
			if (random() < clamp01(difficulty) * 0.5) {
				const second = forceScare(scheduler, random, difficulty);
				if (second) started.push(second);
			}
		}
	}
	return { started, ended };
}

/** How much the active scares twitch the needle right now, 0 to 1 */
export function jitterOf(scares: readonly Scare[]): number {
	let jitter = 0;
	for (const scare of scares) {
		const envelope = Math.min(
			1,
			scare.ageMs / ENVELOPE_MS,
			Math.max(0, scare.durationMs - scare.ageMs) / ENVELOPE_MS
		);
		jitter = Math.max(jitter, scare.intensity * KIND_JITTER[scare.kind] * envelope);
	}
	return jitter;
}

/** The player reacted: every scare on screen right now is spoiled */
export function markReacted(scheduler: Scheduler): void {
	for (const scare of scheduler.active) scare.reacted = true;
}

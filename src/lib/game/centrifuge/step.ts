/*
 * One step of a run and the player's single action. Everything here is pure apart from the
 * injected random source, so the rules can be tested without a browser.
 */
import type { Random } from '#lib/game/random.js';
import { clamp01, difficultyAt, FIX_LOCKOUT_MS, LOCKOUT_MS, lerp } from './config.js';
import { fixDial, isOutOfBand, startDrift, stepDial } from './dial.js';
import { forceScare, jitterOf, markReacted, stepScheduler } from './scares.js';
import { calmPoints, fixPoints } from './scoring.js';
import type { CentrifugeEvent, CentrifugeState } from './state.js';

/** Time from the end of one drift (or the start) to the next */
export function driftGapMs(difficulty: number, random: Random): number {
	return lerp(9000, 4500, clamp01(difficulty)) * (0.75 + random() * 0.5);
}

/** Chance that a new drift starts under cover of a scare: none at first, most of the time at the end */
export function coverChance(difficulty: number): number {
	return clamp01((difficulty - 0.15) / 0.85) * 0.85;
}

function loseHeart(state: CentrifugeState, events: CentrifugeEvent[]) {
	state.lives = Math.max(0, state.lives - 1);
	state.streak = 0;
	if (state.lives === 0) {
		state.over = true;
		events.push({ type: 'game-over' });
	}
}

export function stepGame(state: CentrifugeState, random: Random, dtMs: number): CentrifugeEvent[] {
	if (state.over) return [];
	const events: CentrifugeEvent[] = [];
	state.timeMs += dtMs;
	state.lockMs = Math.max(0, state.lockMs - dtMs);
	const difficulty = difficultyAt(state.timeMs);

	const { started, ended } = stepScheduler(state.scheduler, random, dtMs, difficulty);
	for (const scare of started) events.push({ type: 'scare-start', scare });
	for (const scare of ended) {
		let points = 0;
		if (!scare.reacted) {
			points = calmPoints(scare.intensity, state.streak);
			state.score += points;
			state.streak += 1;
			state.bestStreak = Math.max(state.bestStreak, state.streak);
			state.calmScares += 1;
		}
		events.push({ type: 'scare-end', scare, points });
	}

	if (!state.dial.drift && !state.dial.returning) {
		state.driftInMs -= dtMs;
		if (state.driftInMs <= 0 && startDrift(state.dial, random, difficulty)) {
			events.push({ type: 'drift-start' });
			if (random() < coverChance(difficulty)) {
				const cover = forceScare(state.scheduler, random, difficulty);
				if (cover) events.push({ type: 'scare-start', scare: cover });
			}
		}
	}

	for (const dialEvent of stepDial(state.dial, random, dtMs, jitterOf(state.scheduler.active))) {
		if (dialEvent.type === 'band-exit') {
			events.push({ type: 'band-exit' });
		} else {
			state.meltdowns += 1;
			state.driftInMs = driftGapMs(difficulty, random);
			state.lockMs = LOCKOUT_MS;
			events.push({ type: 'meltdown' });
			loseHeart(state, events);
		}
	}
	return events;
}

/**
 * The player's one action: stabilize. It is right only while a drift has pushed the needle out of
 * the safe band; any other press is an overreaction that costs a heart.
 */
export function press(state: CentrifugeState, random: Random): CentrifugeEvent[] {
	if (state.over || state.lockMs > 0 || state.dial.returning) return [];
	const events: CentrifugeEvent[] = [];
	const difficulty = difficultyAt(state.timeMs);

	if (isOutOfBand(state.dial)) {
		const reactionMs = state.dial.outMs;
		const points = fixPoints(reactionMs, state.streak);
		state.score += points;
		state.streak += 1;
		state.bestStreak = Math.max(state.bestStreak, state.streak);
		state.fixes += 1;
		state.lockMs = FIX_LOCKOUT_MS;
		state.driftInMs = driftGapMs(difficulty, random);
		fixDial(state.dial);
		events.push({ type: 'fix', points, reactionMs });
		return events;
	}

	const duringScare = state.scheduler.active.length > 0;
	state.overreactions += 1;
	state.lockMs = LOCKOUT_MS;
	markReacted(state.scheduler);
	events.push({ type: 'overreact', duringScare });
	loseHeart(state, events);
	return events;
}

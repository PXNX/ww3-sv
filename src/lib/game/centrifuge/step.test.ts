import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { FIRST_DRIFT_MS, LOCKOUT_MS, STARTING_LIVES } from './config.js';
import { inBand, startDrift } from './dial.js';
import { createScheduler } from './scares.js';
import { createGame, type CentrifugeEvent, type CentrifugeState } from './state.js';
import { coverChance, driftGapMs, press, stepGame } from './step.js';

const STEP = 50;

/** A run with no scares and no drift due, so a test sets up exactly what it needs */
function quietGame(): CentrifugeState {
	const state = createGame();
	state.scheduler = createScheduler(1e9);
	state.driftInMs = 1e9;
	return state;
}

function advance(
	state: CentrifugeState,
	random: () => number,
	ms: number,
	until?: (events: CentrifugeEvent[]) => boolean
): CentrifugeEvent[] {
	const all: CentrifugeEvent[] = [];
	for (let t = 0; t < ms; t += STEP) {
		const events = stepGame(state, random, STEP);
		all.push(...events);
		if (until?.(events)) break;
	}
	return all;
}

const types = (events: CentrifugeEvent[]) => events.map((event) => event.type);

/** Starts a drift and runs until the needle has left the band */
function pushOut(state: CentrifugeState, random: () => number) {
	startDrift(state.dial, random, 0);
	for (let t = 0; t < 10_000 && inBand(state.dial.value); t += STEP) stepGame(state, random, STEP);
}

describe('a fresh run', () => {
	it('has full lives, no score and a quiet start before the first drift', () => {
		const state = createGame();
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.score).toBe(0);
		expect(state.driftInMs).toBe(FIRST_DRIFT_MS);
		const events = advance(state, createRandom(1), FIRST_DRIFT_MS - 500);
		expect(types(events)).not.toContain('drift-start');
	});
});

describe('staying calm', () => {
	it('earns points and a streak for every scare sat through', () => {
		const state = createGame();
		state.driftInMs = 1e9;
		const events = advance(state, createRandom(2), 12_000);
		const ends = events.filter((event) => event.type === 'scare-end');
		expect(ends.length).toBeGreaterThan(0);
		expect(state.score).toBeGreaterThan(0);
		expect(state.calmScares).toBe(ends.length);
		expect(state.streak).toBe(ends.length);
	});

	it('pays nothing for a scare the player reacted to', () => {
		const state = quietGame();
		state.scheduler = createScheduler(0);
		const random = createRandom(3);
		advance(state, random, STEP);
		expect(state.scheduler.active.length).toBe(1);
		const events = press(state, random);
		expect(events[0]).toEqual({ type: 'overreact', duringScare: true });
		state.lockMs = 0;
		const scoreBefore = state.score;
		const ended = advance(state, random, 10_000, (list) =>
			types(list).includes('scare-end')
		).filter((event) => event.type === 'scare-end');
		expect(ended).toHaveLength(1);
		expect(ended[0]).toMatchObject({ points: 0 });
		expect(state.score).toBe(scoreBefore);
		expect(state.calmScares).toBe(0);
	});
});

describe('overreacting', () => {
	it('costs a heart and the streak when the dial is in the band', () => {
		const state = quietGame();
		state.streak = 6;
		const events = press(state, createRandom(4));
		expect(types(events)).toEqual(['overreact']);
		expect(events[0]).toEqual({ type: 'overreact', duringScare: false });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.streak).toBe(0);
		expect(state.overreactions).toBe(1);
	});

	it('also costs a heart while a drift has not yet left the band', () => {
		const state = quietGame();
		const random = createRandom(5);
		startDrift(state.dial, random, 0);
		advance(state, random, STEP);
		expect(inBand(state.dial.value)).toBe(true);
		press(state, random);
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('ignores a second press during the lockout, so a panic tap costs one heart', () => {
		const state = quietGame();
		const random = createRandom(6);
		press(state, random);
		expect(press(state, random)).toEqual([]);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		advance(state, random, LOCKOUT_MS + STEP);
		press(state, random);
		expect(state.lives).toBe(STARTING_LIVES - 2);
	});

	it('ends the run when the last heart is gone', () => {
		const state = quietGame();
		const random = createRandom(7);
		state.lives = 1;
		const events = press(state, random);
		expect(types(events)).toEqual(['overreact', 'game-over']);
		expect(state.over).toBe(true);
		expect(press(state, random)).toEqual([]);
		expect(stepGame(state, random, STEP)).toEqual([]);
	});
});

describe('a real drift', () => {
	it('is fixed by pressing once the needle is out of the band, which scores', () => {
		const state = quietGame();
		const random = createRandom(8);
		pushOut(state, random);
		expect(inBand(state.dial.value)).toBe(false);
		const events = press(state, random);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ type: 'fix' });
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.score).toBeGreaterThanOrEqual(40);
		expect(state.streak).toBe(1);
		expect(state.fixes).toBe(1);
		expect(state.dial.drift).toBeNull();
	});

	it('pays more for a quick reaction', () => {
		const react = (extraMs: number) => {
			const state = quietGame();
			const random = createRandom(9);
			pushOut(state, random);
			advance(state, random, extraMs);
			const [event] = press(state, random);
			return event.type === 'fix' ? event.points : -1;
		};
		expect(react(0)).toBeGreaterThan(react(1500));
	});

	it('costs a heart and the streak when it reaches the end of the dial', () => {
		const state = quietGame();
		const random = createRandom(10);
		state.streak = 5;
		startDrift(state.dial, random, 0);
		const events = advance(state, random, 20_000, (list) => types(list).includes('meltdown'));
		expect(types(events)).toContain('band-exit');
		expect(types(events)).toContain('meltdown');
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.streak).toBe(0);
		expect(state.meltdowns).toBe(1);
	});

	it('cannot be fixed again while the needle eases back', () => {
		const state = quietGame();
		const random = createRandom(11);
		pushOut(state, random);
		press(state, random);
		expect(state.dial.returning).toBe(true);
		const lives = state.lives;
		state.lockMs = 0;
		expect(press(state, random)).toEqual([]);
		expect(state.lives).toBe(lives);
	});

	it('starts on schedule and then waits for the next gap after a fix', () => {
		const state = quietGame();
		state.driftInMs = 1000;
		const random = createRandom(12);
		const events = advance(state, random, 1500);
		expect(types(events)).toContain('drift-start');
		expect(state.dial.drift).not.toBeNull();
		advance(state, random, 10_000, () => !inBand(state.dial.value));
		press(state, random);
		expect(state.driftInMs).toBeGreaterThanOrEqual(driftGapMs(0, () => 0));
	});

	it('is missed by a player who never presses until the hearts run out', () => {
		const state = createGame();
		const random = createRandom(13);
		advance(state, random, 600_000, () => state.over);
		expect(state.over).toBe(true);
		expect(state.meltdowns).toBe(STARTING_LIVES);
		expect(state.overreactions).toBe(0);
	});
});

describe('difficulty', () => {
	it('hides drifts behind scares more and more often', () => {
		expect(coverChance(0)).toBe(0);
		expect(coverChance(0.15)).toBe(0);
		expect(coverChance(0.5)).toBeGreaterThan(0);
		expect(coverChance(1)).toBeGreaterThan(coverChance(0.5));
		expect(coverChance(1)).toBeLessThan(1);
	});

	it('spaces drifts closer together', () => {
		expect(driftGapMs(1, () => 0.5)).toBeLessThan(driftGapMs(0, () => 0.5));
	});

	it('starts late drifts under cover of a scare most of the time', () => {
		const random = createRandom(14);
		let covered = 0;
		for (let i = 0; i < 80; i++) {
			const state = quietGame();
			state.timeMs = 140_000;
			state.driftInMs = 0;
			const events = stepGame(state, random, STEP);
			expect(types(events)).toContain('drift-start');
			if (state.scheduler.active.length > 0) covered++;
		}
		expect(covered).toBeGreaterThan(40);
	});
});

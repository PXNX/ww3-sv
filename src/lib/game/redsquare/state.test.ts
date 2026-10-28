import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { nextColumn } from './columns.js';
import {
	AIR_FIRST_WAVE,
	AIR_POINTS,
	COLUMN_COUNT,
	FEEDBACK_MS,
	GAME_OVER_FEEDBACK_MS,
	HITS_PER_WAVE,
	POINTS_MAX,
	POINTS_MIN,
	SLOT_MIN_MS,
	STARTING_MOOD,
	WINDOW_MIN
} from './config.js';
import { loadMessages } from '#lib/testing/messages.js';
import { airProgress, createGame, cue, markerOf, shootAir, step, type AirTarget } from './state.js';
import { cueWindow, interceptorsFor, slotMs, windowShare } from './timing.js';

const seed = 3;

function fresh() {
	const random = createRandom(seed);
	const state = createGame(random);
	return { random, state };
}

/** Moves the column to the middle of its band and cues it */
function cueAtCentre(state: ReturnType<typeof createGame>) {
	state.elapsedMs = state.slotMs * state.window.centre;
	return cue(state);
}

function nextRound(state: ReturnType<typeof createGame>, random = createRandom(seed)) {
	return step(state, FEEDBACK_MS + 1, random);
}

describe('red square timing', () => {
	it('shortens the crossing every wave but never below the floor', () => {
		expect(slotMs(1)).toBeGreaterThan(slotMs(2));
		expect(slotMs(50)).toBe(SLOT_MIN_MS);
	});

	it('narrows the cue band every wave but never below the floor', () => {
		expect(windowShare(1)).toBeGreaterThan(windowShare(2));
		expect(windowShare(99)).toBe(WINDOW_MIN);
	});

	it('keeps the band on the same spot in front of the tribune', () => {
		for (const wave of [1, 2, 7]) {
			const window = cueWindow(wave);
			expect(window.start).toBeLessThan(window.centre);
			expect(window.centre).toBeLessThan(window.end);
			expect(window.end - window.start).toBeCloseTo(windowShare(wave), 10);
		}
	});

	it('thins the interceptors down to one', () => {
		expect(interceptorsFor(1)).toBeGreaterThan(interceptorsFor(2));
		expect(interceptorsFor(40)).toBe(1);
	});
});

describe('the parade order', () => {
	it('never repeats the same column twice in a row', () => {
		const random = createRandom(11);
		let previous = nextColumn(random, null);
		for (let i = 0; i < 500; i++) {
			const next = nextColumn(random, previous);
			expect(next).not.toBe(previous);
			expect(next).toBeGreaterThanOrEqual(0);
			expect(next).toBeLessThan(COLUMN_COUNT);
			previous = next;
		}
	});
});

describe('red square state', () => {
	it('starts on the first column with a full mood', () => {
		const { state } = fresh();
		expect(state.phase).toBe('march');
		expect(state.round).toBe(1);
		expect(state.wave).toBe(1);
		expect(state.mood).toBe(STARTING_MOOD);
		expect(state.score).toBe(0);
		expect(markerOf(state)).toBe(0);
	});

	it('scores a clean cue at the top of the range', () => {
		const { state } = fresh();
		const events = cueAtCentre(state);
		expect(events[0]).toMatchObject({ type: 'hit', points: POINTS_MAX });
		expect(state.score).toBe(POINTS_MAX);
		expect(state.hits).toBe(1);
		expect(state.streak).toBe(1);
		expect(state.phase).toBe('feedback');
	});

	it('scores a cue at the edge of the band lower than a clean one', () => {
		const { state } = fresh();
		state.elapsedMs = state.slotMs * (state.window.start + 0.001);
		cue(state);
		expect(state.score).toBe(POINTS_MIN);
		expect(state.hits).toBe(1);
	});

	it('adds a streak bonus and resets the streak on a miss', () => {
		const { state, random } = fresh();
		cueAtCentre(state);
		const first = state.score;
		nextRound(state, random);
		cueAtCentre(state);
		expect(state.score - first).toBe(POINTS_MAX + 5);
		expect(state.streak).toBe(2);

		nextRound(state, random);
		state.elapsedMs = 0;
		cue(state);
		expect(state.streak).toBe(0);
		expect(state.bestStreak).toBe(2);
	});

	it('costs a mood for an early cue and for a late one', () => {
		const { state, random } = fresh();
		state.elapsedMs = 0;
		expect(cue(state)).toEqual([{ type: 'miss', reason: 'early' }]);
		expect(state.mood).toBe(STARTING_MOOD - 1);

		nextRound(state, random);
		state.elapsedMs = state.slotMs;
		expect(cue(state)).toEqual([{ type: 'miss', reason: 'late' }]);
		expect(state.mood).toBe(STARTING_MOOD - 2);
	});

	it('costs a mood when the marker leaves the square without a cue', () => {
		const { state, random } = fresh();
		const events = step(state, state.slotMs + 10, random);
		expect(events).toEqual([{ type: 'miss', reason: 'missed' }]);
		expect(state.mood).toBe(STARTING_MOOD - 1);
		expect(state.misses).toBe(1);
	});

	it('announces a wave every four hits with fewer interceptors', () => {
		const { state, random } = fresh();
		const waves: number[] = [];
		for (let i = 0; i < HITS_PER_WAVE; i++) {
			const hitEvents = cueAtCentre(state);
			for (const event of hitEvents) {
				if (event.type === 'wave') waves.push(event.interceptors);
			}
			for (const event of nextRound(state, random)) {
				if (event.type === 'wave') waves.push(event.interceptors);
			}
		}
		expect(waves).toEqual([interceptorsFor(2)]);
		expect(state.wave).toBe(2);
		expect(state.slotMs).toBeLessThan(slotMs(1));
	});

	it('ends the parade when the mood runs out, then restarts cleanly', () => {
		const { state, random } = fresh();
		for (let i = 0; i < STARTING_MOOD; i++) {
			step(state, state.slotMs + 1, random);
			step(state, GAME_OVER_FEEDBACK_MS + 1, random);
		}
		expect(state.mood).toBe(0);
		expect(state.phase).toBe('over');
		expect(step(state, 1000, random)).toEqual([]);
		expect(cue(state)).toEqual([]);

		const restarted = createGame(createRandom(4));
		expect(restarted.mood).toBe(STARTING_MOOD);
		expect(restarted.round).toBe(1);
		expect(restarted.score).toBe(0);
	});

	it('ignores the cue button outside the march', () => {
		const { state } = fresh();
		cueAtCentre(state);
		expect(cue(state)).toEqual([]);
		expect(state.score).toBe(POINTS_MAX);
	});
});

describe('the air over the square', () => {
	const drone = (crossMs = 1000): AirTarget => ({ kind: 'drone', elapsedMs: 0, crossMs });

	it('stays empty through the whole first wave', () => {
		for (let seed = 1; seed <= 40; seed++) {
			expect(createGame(createRandom(seed)).air).toBeNull();
		}
		// Even a random source that would always send one cannot do it in wave 1
		const forced = createGame(() => 0);
		expect(forced.wave).toBeLessThan(AIR_FIRST_WAVE);
		expect(forced.air).toBeNull();
	});

	it('sends a target along with a column from the second wave on', () => {
		const { state } = fresh();
		state.wave = AIR_FIRST_WAVE;
		cueAtCentre(state);
		// A random source that lands below the spawn chance every time
		const events = nextRound(state, () => 0);
		expect(state.air).toMatchObject({ kind: 'drone', elapsedMs: 0 });
		expect(events).toContainEqual({ type: 'air', kind: 'drone' });

		// ...and one that never spawns
		const { state: quiet } = fresh();
		quiet.wave = AIR_FIRST_WAVE;
		cueAtCentre(quiet);
		nextRound(quiet, () => 0.99);
		expect(quiet.air).toBeNull();
	});

	it('scores a target that is shot down and clears the sky', () => {
		const { state } = fresh();
		const before = state.score;
		state.air = drone();
		expect(shootAir(state)).toEqual([{ type: 'air-down', kind: 'drone', points: AIR_POINTS }]);
		expect(state.score).toBe(before + AIR_POINTS);
		expect(state.air).toBeNull();
		expect(shootAir(state)).toEqual([]);
	});

	it('costs a mood when a target crosses unopposed, and can end the parade', () => {
		const { state, random } = fresh();
		state.streak = 3;
		state.bestStreak = 3;
		state.air = drone(200);
		const events = step(state, 250, random);
		expect(events).toContainEqual({ type: 'air-escaped', kind: 'drone' });
		expect(state.air).toBeNull();
		expect(state.mood).toBe(STARTING_MOOD - 1);
		// A missile that gets through is the general's problem, not a broken streak
		expect(state.streak).toBe(3);

		state.mood = 1;
		state.air = drone(200);
		expect(state.doomed).toBe(false);
		step(state, 250, random);
		expect(state.mood).toBe(0);
		expect(state.doomed).toBe(true);
	});

	it('keeps flying while the verdict is up, so it cannot be waited out', () => {
		const { state, random } = fresh();
		cueAtCentre(state);
		state.air = drone();
		for (let i = 0; i < 3; i++) step(state, 100, random);
		expect(state.phase).toBe('feedback');
		expect(state.air).not.toBeNull();
		expect(airProgress(state)).toBeCloseTo(0.3, 5);
		// Which leaves time to shoot it down even after a hit
		shootAir(state);
		expect(state.air).toBeNull();
	});
});

describe('red square columns', () => {
	it('has a translated name for every column in English', () => {
		const english = loadMessages('en');
		for (let i = 0; i < COLUMN_COUNT; i++) {
			expect(english[`redsquare_column_${i}`], `redsquare_column_${i}`).toBeTruthy();
		}
		expect(english[`redsquare_column_${COLUMN_COUNT}`]).toBeUndefined();
	});
});

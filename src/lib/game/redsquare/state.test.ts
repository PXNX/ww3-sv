import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import { nextColumn } from './columns.js';
import {
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
import { createGame, cue, markerOf, step } from './state.js';
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

describe('red square columns', () => {
	it('has a translated name for every column in English', () => {
		const english = loadMessages('en');
		for (let i = 0; i < COLUMN_COUNT; i++) {
			expect(english[`redsquare_column_${i}`], `redsquare_column_${i}`).toBeTruthy();
		}
		expect(english[`redsquare_column_${COLUMN_COUNT}`]).toBeUndefined();
	});
});

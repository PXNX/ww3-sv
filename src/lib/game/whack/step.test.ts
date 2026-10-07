import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	COMBO_WINDOW_MS,
	HITTABLE_RISE,
	LEAVE_MS,
	RISE_MS,
	STARTING_LIVES,
	WHACKED_MS,
	type MoleKind
} from './config';
import { holeBase } from './layout';
import { createGame, riseOf, type Mole, type WhackEvent, type WhackState } from './state';
import { stepGame, tapAt, tapHole } from './step';

const STEP = 1000 / 60;

/** A figure already standing at full height */
function standing(state: WhackState, hole: number, kind: MoleKind, lifeMs = 2000): Mole {
	const mole: Mole = {
		id: state.nextId++,
		hole,
		kind,
		phase: 'up',
		ageMs: RISE_MS,
		phaseMs: RISE_MS,
		lifeMs,
		progress: 0,
		riseFrom: 0,
		finished: false
	};
	state.moles.push(mole);
	return mole;
}

/** Steps with no new pop-ups, so tests control exactly who is on the field */
function quietStep(state: WhackState, ms: number): WhackEvent[] {
	state.spawner.nextMs = Number.POSITIVE_INFINITY;
	const events: WhackEvent[] = [];
	for (let t = 0; t < ms; t += STEP) events.push(...stepGame(state, createRandom(1), STEP));
	return events;
}

const types = (events: WhackEvent[]) => events.map((event) => event.type);

describe('spawning', () => {
	it('pops figures up over time and never double-books a podium', () => {
		const state = createGame();
		const random = createRandom(2);
		for (let t = 0; t < 60_000; t += STEP) {
			stepGame(state, random, STEP);
			const holes = state.moles.map((mole) => mole.hole);
			expect(new Set(holes).size).toBe(holes.length);
		}
		expect(state.escaped).toBeGreaterThan(0);
	});

	it('emits a spawned event and starts the figure rising', () => {
		const state = createGame();
		state.spawner.nextMs = 0;
		const events = stepGame(state, createRandom(1), STEP);
		expect(types(events)).toEqual(['spawned']);
		expect(state.moles).toHaveLength(1);
		stepGame(state, createRandom(1), STEP);
		expect(riseOf(state.moles[0])).toBeLessThan(1);
		expect(riseOf(state.moles[0])).toBeGreaterThan(0);
	});
});

describe('hit test and whacking', () => {
	it('whacks a target for its points and removes it after the daze', () => {
		const state = createGame();
		standing(state, 4, 'spokesperson');
		const events = tapHole(state, 4);
		expect(events).toMatchObject([{ type: 'hit', kind: 'spokesperson', points: 10, streak: 1 }]);
		expect(state.score).toBe(10);
		expect(state.hits).toBe(1);
		expect(state.moles[0].phase).toBe('whacked');
		quietStep(state, WHACKED_MS + STEP);
		expect(state.moles).toHaveLength(0);
	});

	it('scores each kind with its own points', () => {
		for (const [kind, points] of [
			['spokesperson', 10],
			['official', 15],
			['talkinghead', 25]
		] as const) {
			const state = createGame();
			standing(state, 0, kind);
			expect(tapHole(state, 0)).toMatchObject([{ type: 'hit', points }]);
		}
	});

	it('hits through a world position and ignores the backdrop', () => {
		const state = createGame();
		standing(state, 2, 'official');
		expect(tapAt(state, 50, 50)).toEqual([]);
		const base = holeBase(2);
		expect(types(tapAt(state, base.x, base.y - 20))).toEqual(['hit']);
	});

	it('cannot whack the same figure twice', () => {
		const state = createGame();
		standing(state, 1, 'official');
		tapHole(state, 1);
		expect(tapHole(state, 1)).toEqual([]);
		expect(state.hits).toBe(1);
		expect(state.emptyTaps).toBe(0);
	});

	it('ignores a figure that has barely begun to rise', () => {
		const state = createGame();
		const mole = standing(state, 3, 'official');
		mole.ageMs = RISE_MS * (HITTABLE_RISE - 0.1);
		expect(tapHole(state, 3)).toEqual([]);
		mole.ageMs = RISE_MS * (HITTABLE_RISE + 0.1);
		expect(types(tapHole(state, 3))).toEqual(['hit']);
	});

	it('counts a tap on an empty podium without costing a heart', () => {
		const state = createGame();
		const events = tapHole(state, 5);
		expect(events).toMatchObject([{ type: 'empty', broke: false }]);
		expect(state.emptyTaps).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('ignores nonsense podiums and taps after game over', () => {
		const state = createGame();
		expect(tapHole(state, 99)).toEqual([]);
		expect(tapHole(state, -1)).toEqual([]);
		state.over = true;
		standing(state, 0, 'official');
		expect(tapHole(state, 0)).toEqual([]);
	});
});

describe('decoys', () => {
	it('cost a heart and break the combo when whacked', () => {
		const state = createGame();
		standing(state, 0, 'spokesperson');
		standing(state, 1, 'journalist');
		tapHole(state, 0);
		const events = tapHole(state, 1);
		expect(types(events)).toEqual(['decoy-hit']);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.decoysHit).toBe(1);
		expect(state.score).toBe(10);
		expect(state.combo.streak).toBe(0);
	});

	it('leave unharmed when left alone, with no penalty', () => {
		const state = createGame();
		standing(state, 7, 'aidworker', 500);
		const events = quietStep(state, 500 + LEAVE_MS + 100);
		expect(events).toEqual([]);
		expect(state.moles).toHaveLength(0);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.escaped).toBe(0);
	});

	it('can end the game', () => {
		const state = createGame();
		state.lives = 1;
		standing(state, 0, 'journalist');
		expect(types(tapHole(state, 0))).toEqual(['decoy-hit', 'game-over']);
		expect(state.over).toBe(true);
		expect(state.lives).toBe(0);
	});
});

describe('statements', () => {
	it('fill up while the target stands there', () => {
		const state = createGame();
		const mole = standing(state, 4, 'official', 1000);
		quietStep(state, 500);
		expect(mole.progress).toBeGreaterThan(0.4);
		expect(mole.progress).toBeLessThan(0.6);
	});

	it('cost a heart when they finish, once, and break the combo', () => {
		const state = createGame();
		standing(state, 0, 'spokesperson');
		standing(state, 4, 'official', 800);
		tapHole(state, 0);
		const events = quietStep(state, 1200);
		expect(types(events)).toEqual(['statement-finished']);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.escaped).toBe(1);
		expect(state.combo.streak).toBe(0);
		expect(state.moles).toHaveLength(0);
	});

	it('are stopped by a whack in time', () => {
		const state = createGame();
		standing(state, 4, 'official', 800);
		quietStep(state, 600);
		tapHole(state, 4);
		quietStep(state, 1500);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.escaped).toBe(0);
	});

	it('end the game when the last heart goes, and the simulation then stops', () => {
		const state = createGame();
		state.lives = 1;
		standing(state, 4, 'talkinghead', 300);
		const events = quietStep(state, 800);
		expect(types(events)).toEqual(['statement-finished', 'game-over']);
		expect(state.over).toBe(true);
		const time = state.timeMs;
		expect(stepGame(state, createRandom(1), STEP)).toEqual([]);
		expect(state.timeMs).toBe(time);
	});

	it('lose one heart each for several finishing at once', () => {
		const state = createGame();
		standing(state, 0, 'official', 300);
		standing(state, 1, 'official', 300);
		quietStep(state, 700);
		expect(state.lives).toBe(STARTING_LIVES - 2);
	});
});

describe('combo in play', () => {
	it('multiplies quick consecutive hits', () => {
		const state = createGame();
		for (let hole = 0; hole < 4; hole++) standing(state, hole, 'spokesperson', 5000);
		const points: number[] = [];
		for (let hole = 0; hole < 4; hole++) {
			const [event] = tapHole(state, hole);
			if (event.type === 'hit') points.push(event.points);
			quietStep(state, 200);
		}
		expect(points).toEqual([10, 10, 20, 20]);
		expect(state.bestStreak).toBe(4);
	});

	it('resets when you are too slow', () => {
		const state = createGame();
		for (let hole = 0; hole < 4; hole++) standing(state, hole, 'spokesperson', 9000);
		tapHole(state, 0);
		tapHole(state, 1);
		quietStep(state, COMBO_WINDOW_MS + 200);
		const [event] = tapHole(state, 2);
		expect(event).toMatchObject({ type: 'hit', streak: 1, multiplier: 1, points: 10 });
		expect(state.bestStreak).toBe(2);
	});

	it('breaks on an empty podium and says so', () => {
		const state = createGame();
		standing(state, 0, 'spokesperson');
		tapHole(state, 0);
		const [event] = tapHole(state, 8);
		expect(event).toMatchObject({ type: 'empty', broke: true });
		expect(state.combo.streak).toBe(0);
	});
});

describe('riseOf', () => {
	it('rises, stands, then sinks', () => {
		const state = createGame();
		const mole = standing(state, 0, 'official');
		mole.ageMs = 0;
		expect(riseOf(mole)).toBe(0);
		mole.ageMs = RISE_MS / 2;
		expect(riseOf(mole)).toBeCloseTo(0.5);
		mole.ageMs = RISE_MS * 3;
		expect(riseOf(mole)).toBe(1);
		tapHole(state, 0);
		expect(riseOf(mole)).toBe(1);
		mole.phaseMs = WHACKED_MS / 2;
		expect(riseOf(mole)).toBeCloseTo(0.5);
		mole.phaseMs = WHACKED_MS * 2;
		expect(riseOf(mole)).toBe(0);
	});
});

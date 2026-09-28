import { describe, expect, it } from 'vitest';
import { createRandom, type Random } from '$lib/game/random';
import { computeFlow } from './pipeGrid';
import {
	DIFFICULTIES,
	DIFFICULTY_CONFIG,
	EFFECT_MS,
	TANKER_DEPART_MS,
	barrelsPerSecond,
	createGame,
	finalScore,
	intercept,
	isDifficulty,
	rotateTile,
	shutdownSecondsLeft,
	startRepair,
	stepGame,
	stopRepair,
	streakMultiplier,
	type PipelineConfig,
	type PipelineState
} from './pipelineStep';
import { gridFrom } from './testGrid';

const STEP = 100;
// Station tile turned sideways: one tap on cell 0 connects the route (path length 5)
const ALMOST = ['s1 s1 s1', 'e0 s1 e2', 's1 s1 s0'];
const NO_STRIKES = { firstDelayMs: 1e9, startIntervalMs: 1e9 };

function gameOn(rows: string[], overrides: Partial<PipelineConfig> = {}, seed = 1) {
	const base = DIFFICULTY_CONFIG.normal;
	const state = createGame(createRandom(seed), 'normal', {
		...overrides,
		strikes: { ...base.strikes, ...NO_STRIKES, ...overrides.strikes }
	});
	state.grid = gridFrom(rows, 0, 2);
	state.flow = computeFlow(state.grid);
	return state;
}

function run(state: PipelineState, ms: number, random: Random = createRandom(2)) {
	for (let t = 0; t < ms; t += STEP) stepGame(state, STEP, random);
}

/** Turns every route tile until it matches the reference solution */
function solve(state: PipelineState) {
	state.route.forEach((cell, index) => {
		for (let i = 0; i < 4 && state.grid.tiles[cell].rotation !== state.solution[index]; i++) {
			rotateTile(state, cell);
		}
	});
}

describe('game setup', () => {
	it('uses the grid size of each difficulty', () => {
		expect(DIFFICULTIES.map((level) => createGame(createRandom(1), level).grid.rows)).toEqual([
			5, 6, 7
		]);
		expect(createGame(createRandom(1), 'hard').grid.cols).toBe(7);
	});

	it('recognizes valid difficulty names', () => {
		expect(isDifficulty('easy')).toBe(true);
		expect(isDifficulty('hard')).toBe(true);
		expect(isDifficulty('extreme')).toBe(false);
		expect(isDifficulty(3)).toBe(false);
	});

	it('starts in the setup phase with a disconnected board and one charge', () => {
		const state = createGame(createRandom(4), 'normal');
		expect(state.phase).toBe('setup');
		expect(state.flow.reachesTerminal).toBe(false);
		expect(state.charges).toBe(1);
		expect(state.score).toBe(0);
	});

	it('does nothing in the setup phase: no strikes and no shutdown timer', () => {
		const state = createGame(createRandom(4), 'normal');
		run(state, 60_000);
		expect(state.phase).toBe('setup');
		expect(state.strikes).toEqual([]);
		expect(state.cutMs).toBe(0);
		expect(state.elapsedMs).toBe(0);
	});

	it('starts pumping as soon as the route is first connected', () => {
		const state = gameOn(ALMOST);
		expect(rotateTile(state, 0)).toBe(true);
		expect(state.grid.tiles[0].rotation).toBe(2);
		expect(state.flow.reachesTerminal).toBe(true);
		expect(state.phase).toBe('running');
	});

	it('can solve every generated board with the reference solution', () => {
		for (const level of DIFFICULTIES) {
			for (let seed = 0; seed < 40; seed++) {
				const state = createGame(createRandom(seed), level);
				solve(state);
				expect(state.phase, `${level} seed ${seed}`).toBe('running');
			}
		}
	});
});

describe('oil delivery', () => {
	it('delivers barrels per second according to the flowing path length', () => {
		const state = gameOn(ALMOST);
		rotateTile(state, 0);
		run(state, 1000);
		expect(state.flow.pathLength).toBe(5);
		expect(state.barrels).toBeCloseTo(1 + 0.35 * 5, 5);
		expect(state.score).toBeCloseTo(state.barrels, 5);
		expect(finalScore(state)).toBe(Math.floor(state.score));
	});

	it('pays more for longer flowing paths', () => {
		const config = DIFFICULTY_CONFIG.normal;
		expect(barrelsPerSecond(config, 0)).toBe(0);
		expect(barrelsPerSecond(config, 10)).toBeGreaterThan(barrelsPerSecond(config, 5));
	});

	it('fills tankers and adds a bonus when one sails away', () => {
		const state = gameOn(ALMOST, { tankerCapacity: 5, tankerBonus: 100 });
		rotateTile(state, 0);
		run(state, 2000);
		expect(state.tankersFilled).toBe(1);
		expect(state.tankerFill).toBeCloseTo(0.5, 5);
		expect(state.score).toBeCloseTo(5.5 + 100, 5);
		// The tanker filled during the step ending at 1900 ms and sails for TANKER_DEPART_MS
		expect(state.tankerDepartMs).toBe(TANKER_DEPART_MS - STEP);
		run(state, 1000);
		expect(state.tankerDepartMs).toBe(TANKER_DEPART_MS - 1100);
	});

	it('earns interceptor charges from delivered barrels, up to the maximum', () => {
		const state = gameOn(ALMOST, { barrelsPerCharge: 2, startCharges: 0, maxCharges: 2 });
		rotateTile(state, 0);
		run(state, 1000);
		expect(state.charges).toBe(1);
		expect(state.chargeProgress).toBeCloseTo(0.75, 5);
		run(state, 4000);
		expect(state.charges).toBe(2);
		expect(state.chargeProgress).toBe(0);
	});
});

describe('strikes', () => {
	const soon = { firstDelayMs: STEP, warningMs: 1000 };

	function struck(overrides: Partial<PipelineConfig> = {}) {
		const state = gameOn(ALMOST, {
			...overrides,
			strikes: { ...DIFFICULTY_CONFIG.normal.strikes, ...NO_STRIKES, ...soon }
		});
		rotateTile(state, 0);
		run(state, STEP);
		return state;
	}

	it('shows a warning first and breaks the tile on impact', () => {
		const state = struck();
		expect(state.strikes).toHaveLength(1);
		const [strike] = state.strikes;
		expect(strike.remainingMs).toBe(1000);
		expect(state.grid.tiles[strike.cell].broken).toBe(false);

		run(state, 900);
		expect(state.grid.tiles[strike.cell].broken).toBe(false);
		run(state, STEP);
		expect(state.grid.tiles[strike.cell].broken).toBe(true);
		expect(state.strikes).toEqual([]);
		expect(state.hits).toBe(1);
		expect(state.effects.map((effect) => effect.kind)).toEqual(['impact']);
		run(state, EFFECT_MS);
		expect(state.effects).toEqual([]);
	});

	it('is destroyed by an interceptor charge before impact', () => {
		const state = struck();
		const [strike] = state.strikes;
		expect(intercept(state, strike.id)).toBe(true);
		expect(state.charges).toBe(0);
		expect(state.intercepted).toBe(1);
		expect(state.streak).toBe(1);
		expect(state.strikes).toEqual([]);
		expect(state.effects.map((effect) => effect.kind)).toEqual(['intercept']);
		run(state, 2000);
		expect(state.grid.tiles.every((tile) => !tile.broken)).toBe(true);
	});

	it('cannot be intercepted without a charge, or once it is gone', () => {
		const state = struck({ startCharges: 0 });
		const [strike] = state.strikes;
		expect(intercept(state, strike.id)).toBe(false);
		expect(state.strikes).toHaveLength(1);
		state.charges = 1;
		expect(intercept(state, 12345)).toBe(false);
		expect(state.charges).toBe(1);
	});

	it('multiplies the score during a perfect-save streak and resets it on impact', () => {
		expect([0, 1, 2, 3, 4, 9].map(streakMultiplier)).toEqual([1, 1.5, 2, 2.5, 3, 3]);

		const state = struck();
		intercept(state, state.strikes[0].id);
		const before = state.score;
		const barrelsBefore = state.barrels;
		run(state, 1000);
		expect(state.score - before).toBeCloseTo((state.barrels - barrelsBefore) * 1.5, 5);

		state.strikes.push({ id: 999, cell: 8, kind: 'rocket', warningMs: 100, remainingMs: 100 });
		run(state, STEP);
		expect(state.streak).toBe(0);
		expect(state.bestStreak).toBe(1);
	});

	it('never exceeds the simultaneous cap, never targets a tile twice, and stays repairable', () => {
		for (const level of DIFFICULTIES) {
			const random = createRandom(77);
			const state = createGame(random, level);
			solve(state);
			const cap = state.config.strikes.maxSimultaneous;
			let maxSeen = 0;
			for (let t = 0; t < 300_000 && state.phase === 'running'; t += STEP) {
				// A diligent player: always has the wrench on some broken tile
				if (state.repairing === null) {
					const broken = state.grid.tiles.findIndex((tile) => tile.broken);
					if (broken !== -1) startRepair(state, broken);
				}
				stepGame(state, STEP, random);
				maxSeen = Math.max(maxSeen, state.strikes.length);
				expect(state.strikes.length).toBeLessThanOrEqual(cap);
				const cells = state.strikes.map((strike) => strike.cell);
				expect(new Set(cells).size).toBe(cells.length);
				for (const cell of cells) expect(state.grid.tiles[cell].broken).toBe(false);
			}
			expect(maxSeen, level).toBe(cap);
			expect(state.hits).toBeGreaterThan(0);

			// Fairness: repairing every broken tile and re-solving always restores the flow.
			// The setup phase advances repairs without new strikes or the shutdown timer.
			state.phase = 'setup';
			state.strikes = [];
			for (let cell = 0; cell < state.grid.tiles.length; cell++) {
				if (!state.grid.tiles[cell].broken) continue;
				expect(startRepair(state, cell)).toBe(true);
				for (let i = 0; i < 100 && state.grid.tiles[cell].broken; i++) {
					stepGame(state, STEP, random);
				}
				expect(state.grid.tiles[cell].broken).toBe(false);
			}
			solve(state);
			expect(state.flow.reachesTerminal, level).toBe(true);
		}
	});
});

describe('repair', () => {
	function broken() {
		const state = gameOn(['s0 s1 s1', 'e0 s1! e2', 's1 s1 s0'], { repairMs: 1000 });
		state.phase = 'running';
		return state;
	}

	it('fixes a broken tile after holding the wrench for the repair time', () => {
		const state = broken();
		expect(startRepair(state, 4)).toBe(true);
		run(state, 900);
		expect(state.grid.tiles[4].broken).toBe(true);
		expect(state.grid.tiles[4].repair).toBeCloseTo(0.9, 5);
		run(state, STEP);
		expect(state.grid.tiles[4].broken).toBe(false);
		expect(state.grid.tiles[4].repair).toBe(0);
		expect(state.repairs).toBe(1);
		expect(state.repairing).toBeNull();
		expect(state.flow.reachesTerminal).toBe(true);
	});

	it('keeps partial progress when the wrench is lifted', () => {
		const state = broken();
		startRepair(state, 4);
		run(state, 500);
		stopRepair(state);
		run(state, 2000);
		expect(state.grid.tiles[4].repair).toBeCloseTo(0.5, 5);
		startRepair(state, 4);
		run(state, 500);
		expect(state.grid.tiles[4].broken).toBe(false);
	});

	it('only repairs broken tiles, and broken tiles cannot be rotated', () => {
		const state = broken();
		expect(startRepair(state, 0)).toBe(false);
		expect(rotateTile(state, 4)).toBe(false);
		expect(state.grid.tiles[4].rotation).toBe(1);
	});

	it('restarts the repair when a repaired tile is struck again', () => {
		const state = broken();
		startRepair(state, 4);
		run(state, 1000);
		state.strikes.push({ id: 50, cell: 4, kind: 'drone', warningMs: 100, remainingMs: 100 });
		run(state, STEP);
		expect(state.grid.tiles[4].broken).toBe(true);
		expect(state.grid.tiles[4].repair).toBe(0);
	});
});

describe('shutdown timer', () => {
	function cut(overrides: Partial<PipelineConfig> = {}) {
		const state = gameOn(ALMOST, overrides);
		rotateTile(state, 0);
		run(state, 1000);
		rotateTile(state, 0);
		expect(state.flow.reachesTerminal).toBe(false);
		return state;
	}

	it('shuts the station down after ten seconds of continuous cut flow', () => {
		const state = cut();
		run(state, 9900);
		expect(state.phase).toBe('running');
		expect(shutdownSecondsLeft(state)).toBe(1);
		run(state, STEP);
		expect(state.phase).toBe('over');
		expect(shutdownSecondsLeft(state)).toBe(0);
	});

	it('resets when the flow is restored in time', () => {
		const state = cut();
		run(state, 9000);
		rotateTile(state, 0);
		rotateTile(state, 0);
		rotateTile(state, 0);
		expect(state.flow.reachesTerminal).toBe(true);
		run(state, STEP);
		expect(state.cutMs).toBe(0);
		rotateTile(state, 0);
		run(state, 9000);
		expect(state.phase).toBe('running');
	});

	it('uses a configurable shutdown time', () => {
		const state = cut({ shutdownMs: 3000 });
		run(state, 3000);
		expect(state.phase).toBe('over');
	});

	it('freezes the game once it is over', () => {
		const state = cut();
		run(state, 10_000);
		const snapshot = structuredClone(state);
		run(state, 5000);
		expect(state).toEqual(snapshot);
		expect(rotateTile(state, 1)).toBe(false);
		expect(startRepair(state, 1)).toBe(false);
	});
});

describe('determinism', () => {
	it('plays out identically for the same seed and inputs', () => {
		const play = () => {
			const random = createRandom(2024);
			const state = createGame(random, 'hard');
			solve(state);
			for (let t = 0; t < 60_000; t += STEP) {
				if (t % 5000 === 0 && state.strikes.length > 0) intercept(state, state.strikes[0].id);
				stepGame(state, STEP, random);
			}
			return state;
		};
		expect(play()).toEqual(play());
	});
});

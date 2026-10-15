import { describe, expect, it } from 'vitest';
import { createRandom } from '../random.js';
import {
	COMBO_STEP,
	DELIVERY_POINTS,
	LOAD_MS,
	NOTICE_LEAD_MS,
	RULE_LIFE_ROUNDS,
	ROUND_MS,
	STARTING_LIVES,
	TARIFF_SPEED
} from './config.js';
import { difficulty } from './difficulty.js';
import { ELEMENTS, type Element } from './graph.js';
import type { Rule } from './rules.js';
import {
	createGame,
	cycleSwitch,
	selectedLane,
	setSwitch,
	spawnCrate,
	step,
	timeLeftShare,
	type Crate,
	type RareEarthEvent,
	type RareEarthState
} from './state.js';

const STEP_MS = 50;

/** A quiet game: no random spawns, the test places its own crates */
function quiet(): RareEarthState {
	const state = createGame();
	state.nextSpawnMs = Infinity;
	return state;
}

/** Points the switches of the straight lane m1 > h1 > p1 > f1 (neodymium) */
function lineToNeodymium(state: RareEarthState) {
	setSwitch(state, 'm1', 1);
	setSwitch(state, 'h1', 1);
	setSwitch(state, 'p1', 1);
}

function crate(state: RareEarthState, element: Element, patch: Partial<Crate> = {}): Crate {
	const made: Crate = {
		id: state.nextCrateId++,
		element,
		mine: 'm1',
		spawnedMs: state.elapsedMs,
		deadlineMs: state.elapsedMs + 60_000,
		speed: 50,
		node: 'm1',
		edge: null,
		progress: 0,
		loadMs: LOAD_MS,
		visited: [],
		tariffed: false,
		needs: [],
		...patch
	};
	state.crates.push(made);
	return made;
}

function rule(state: RareEarthState, patch: Partial<Rule>): Rule {
	const made: Rule = {
		id: state.nextRuleId++,
		kind: 'ban',
		noticeMs: state.elapsedMs,
		startMs: state.elapsedMs,
		endMs: state.elapsedMs + RULE_LIFE_ROUNDS * ROUND_MS,
		edge: null,
		limit: 0,
		used: 0,
		element: null,
		node: null,
		...patch
	};
	state.rules.push(made);
	return made;
}

function run(state: RareEarthState, ms: number, random = createRandom(1)): RareEarthEvent[] {
	const events: RareEarthEvent[] = [];
	for (let t = 0; t < ms && state.phase === 'playing'; t += STEP_MS) {
		events.push(...step(state, STEP_MS, random));
	}
	return events;
}

const types = (events: RareEarthEvent[]) => events.map((event) => event.type);

describe('createGame', () => {
	it('starts with full lives, no crates and every switch on its first lane', () => {
		const state = createGame();
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.score).toBe(0);
		expect(state.crates).toEqual([]);
		expect(state.round).toBe(1);
		expect(selectedLane(state, 'm0')).toBe('m0>h0');
		expect(selectedLane(state, 'f0')).toBeNull();
		expect(selectedLane(state, 'nowhere')).toBeNull();
	});
});

describe('switches', () => {
	it('sets and cycles the lane of a node', () => {
		const state = quiet();
		expect(setSwitch(state, 'h1', 2)).toEqual([
			{ type: 'switch', node: 'h1', lane: 2, auto: false }
		]);
		expect(selectedLane(state, 'h1')).toBe('h1>p2');
		cycleSwitch(state, 'h1');
		expect(selectedLane(state, 'h1')).toBe('h1>p0');
		cycleSwitch(state, 'h1', -1);
		expect(selectedLane(state, 'h1')).toBe('h1>p2');
	});

	it('ignores nonsense: same lane, out of range, factories, unknown nodes, a finished game', () => {
		const state = quiet();
		expect(setSwitch(state, 'h1', 0)).toEqual([]);
		expect(setSwitch(state, 'h1', 3)).toEqual([]);
		expect(setSwitch(state, 'h1', -1)).toEqual([]);
		expect(setSwitch(state, 'h1', 0.5)).toEqual([]);
		expect(setSwitch(state, 'f0', 0)).toEqual([]);
		expect(cycleSwitch(state, 'f0')).toEqual([]);
		expect(setSwitch(state, 'nowhere', 0)).toEqual([]);
		state.phase = 'over';
		expect(setSwitch(state, 'h1', 1)).toEqual([]);
	});
});

describe('crate lifecycle', () => {
	it('spawns at a mine with a deadline that grows with the trip and shrinks with the round', () => {
		const first = createGame();
		const early = spawnCrate(first, createRandom(1));
		expect(early.edge).toBeNull();
		expect(first.graph.nodes[early.node].kind).toBe('mine');
		expect(early.loadMs).toBe(LOAD_MS);
		expect(early.deadlineMs).toBeGreaterThan(early.spawnedMs + LOAD_MS);
		expect(early.speed).toBe(difficulty(1).speed);

		const late = createGame();
		late.elapsedMs = 20 * ROUND_MS;
		late.round = 21;
		const hurried = spawnCrate(late, createRandom(1));
		expect(hurried.speed).toBe(difficulty(21).speed);
		expect(hurried.deadlineMs - hurried.spawnedMs).toBeLessThan(early.deadlineMs - early.spawnedMs);
	});

	it('only spawns elements the round has unlocked', () => {
		const state = createGame();
		const random = createRandom(9);
		const seen = new Set<Element>();
		for (let i = 0; i < 60; i++) seen.add(spawnCrate(state, random).element);
		expect(seen.size).toBe(2);
		expect(seen.has(ELEMENTS[2])).toBe(false);
		state.round = 3;
		for (let i = 0; i < 90; i++) seen.add(spawnCrate(state, random).element);
		expect(seen.size).toBe(3);
	});

	it('waits at its mine, then follows the switches to the right factory and scores', () => {
		const state = quiet();
		lineToNeodymium(state);
		const delivered = crate(state, 'neodymium');
		const events = run(state, 12_000);
		expect(types(events)).toContain('deliver');
		expect(state.crates).toEqual([]);
		expect(delivered.visited).toEqual(['h1', 'p1']);
		expect(state.delivered).toBe(1);
		expect(state.score).toBeGreaterThanOrEqual(DELIVERY_POINTS);
		expect(state.combo).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('does not move during the loading time and lets the mine switch still change', () => {
		const state = quiet();
		const waiting = crate(state, 'neodymium');
		run(state, LOAD_MS - STEP_MS);
		expect(waiting.edge).toBeNull();
		setSwitch(state, 'm1', 1);
		run(state, STEP_MS * 3);
		expect(waiting.edge).toBe('m1>h1');
	});

	it('follows a switch that is flipped while the crate is on its way', () => {
		const state = quiet();
		lineToNeodymium(state);
		const moving = crate(state, 'neodymium');
		run(state, 2000);
		expect(moving.node).toBe('m1');
		expect(moving.edge).toBe('m1>h1');
		setSwitch(state, 'h1', 0);
		run(state, 4000);
		expect(moving.visited[0]).toBe('h1');
		expect(moving.edge === 'h1>p0' || moving.node === 'p0').toBe(true);
	});

	it('costs a heart and the combo when a crate reaches the wrong factory', () => {
		const state = quiet();
		lineToNeodymium(state);
		state.combo = 4;
		crate(state, 'europium');
		const events = run(state, 12_000);
		const wrong = events.find((event) => event.type === 'wrong');
		expect(wrong).toMatchObject({ factory: 'f1' });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.wrong).toBe(1);
		expect(state.combo).toBe(0);
		expect(state.score).toBe(0);
		expect(state.crates).toEqual([]);
	});

	it('costs a heart when a crate misses its deadline', () => {
		const state = quiet();
		lineToNeodymium(state);
		state.combo = 2;
		crate(state, 'neodymium', { deadlineMs: 3000 });
		const events = run(state, 4000);
		expect(types(events)).toContain('late');
		expect(types(events)).not.toContain('deliver');
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.late).toBe(1);
		expect(state.combo).toBe(0);
		expect(state.crates).toEqual([]);
	});

	it('ends the game on the last heart and then ignores further steps', () => {
		const state = quiet();
		lineToNeodymium(state);
		state.lives = 1;
		crate(state, 'europium');
		const events = run(state, 12_000);
		expect(types(events)).toContain('game-over');
		expect(state.phase).toBe('over');
		expect(state.lives).toBe(0);
		const elapsed = state.elapsedMs;
		expect(step(state, STEP_MS, createRandom(1))).toEqual([]);
		expect(state.elapsedMs).toBe(elapsed);
	});

	it('tells how much of its time a crate has left', () => {
		const state = quiet();
		const made = crate(state, 'neodymium', { spawnedMs: 0, deadlineMs: 10_000 });
		expect(timeLeftShare(made, 0)).toBe(1);
		expect(timeLeftShare(made, 2500)).toBe(0.75);
		expect(timeLeftShare(made, 20_000)).toBe(0);
		expect(timeLeftShare({ ...made, deadlineMs: 0 }, 0)).toBe(0);
	});

	it('does not spawn past the crate cap and tries again soon', () => {
		const state = createGame();
		state.nextSpawnMs = 0;
		for (let i = 0; i < difficulty(1).maxCrates; i++) crate(state, 'neodymium', { loadMs: 1e9 });
		const events = step(state, STEP_MS, createRandom(1));
		expect(types(events)).not.toContain('spawn');
		expect(state.crates).toHaveLength(difficulty(1).maxCrates);
		expect(state.nextSpawnMs).toBeGreaterThan(0);
	});

	it('spawns the first crate on schedule', () => {
		const state = createGame();
		const events = run(state, 2000);
		expect(types(events)).toContain('spawn');
	});
});

describe('bans', () => {
	it('confiscate a crate sent down a banned lane, cost a heart and flip the switch', () => {
		const state = quiet();
		lineToNeodymium(state);
		state.combo = 3;
		rule(state, { kind: 'ban', edge: 'm1>h1' });
		crate(state, 'neodymium');
		const events = run(state, LOAD_MS + STEP_MS * 2);
		const violation = events.find((event) => event.type === 'violation');
		expect(violation).toMatchObject({ kind: 'ban', node: 'm1' });
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.combo).toBe(0);
		expect(state.crates).toEqual([]);
		expect(state.violations).toBe(1);
		expect(selectedLane(state, 'm1')).not.toBe('m1>h1');
		expect(events.some((event) => event.type === 'switch' && event.auto)).toBe(true);
	});

	it('only bite once they are in force, not while merely announced', () => {
		const state = quiet();
		lineToNeodymium(state);
		rule(state, { kind: 'ban', edge: 'm1>h1', startMs: 30_000 });
		crate(state, 'neodymium');
		run(state, 12_000);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.delivered).toBe(1);
	});

	it('are no problem for a crate that took another route', () => {
		const state = quiet();
		lineToNeodymium(state);
		rule(state, { kind: 'ban', edge: 'm1>h0' });
		crate(state, 'neodymium');
		run(state, 12_000);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.delivered).toBe(1);
	});
});

describe('quotas', () => {
	it('let the allowed number of crates through per round and confiscate the next', () => {
		const state = quiet();
		lineToNeodymium(state);
		const quota = rule(state, { kind: 'quota', edge: 'h1>p1', limit: 2 });
		for (let i = 0; i < 3; i++) crate(state, 'neodymium', { speed: 200 });
		const events = run(state, 5000);
		expect(quota.used).toBe(2);
		expect(state.delivered).toBe(2);
		expect(events.find((event) => event.type === 'violation')).toMatchObject({ kind: 'quota' });
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('count from zero in the next round', () => {
		const state = quiet();
		lineToNeodymium(state);
		const quota = rule(state, { kind: 'quota', edge: 'h1>p1', limit: 1, endMs: 1e9 });
		quota.used = 1;
		state.elapsedMs = ROUND_MS - STEP_MS;
		run(state, STEP_MS * 2);
		expect(state.round).toBe(2);
		expect(quota.used).toBe(0);
	});
});

describe('tariffs', () => {
	it('slow a crate down and take it out of the combo', () => {
		const free = quiet();
		lineToNeodymium(free);
		const quick = crate(free, 'neodymium', { loadMs: 0 });
		run(free, 1000);

		const taxed = quiet();
		lineToNeodymium(taxed);
		rule(taxed, { kind: 'tariff', edge: 'm1>h1' });
		const slow = crate(taxed, 'neodymium', { loadMs: 0 });
		run(taxed, 1000);

		expect(slow.progress).toBeCloseTo(quick.progress * TARIFF_SPEED, 5);
		expect(slow.tariffed).toBe(true);
		expect(quick.tariffed).toBe(false);
	});

	it('pay the plain points and leave the combo alone', () => {
		const state = quiet();
		lineToNeodymium(state);
		state.combo = COMBO_STEP;
		rule(state, { kind: 'tariff', edge: 'h1>p1' });
		crate(state, 'neodymium', { speed: 120 });
		const events = run(state, 20_000);
		const delivery = events.find((event) => event.type === 'deliver');
		expect(delivery).toMatchObject({ byTheBook: false, multiplier: 1 });
		expect(state.combo).toBe(COMBO_STEP);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('are a detour away: a by-the-book delivery extends the combo', () => {
		const state = quiet();
		lineToNeodymium(state);
		rule(state, { kind: 'tariff', edge: 'm1>h0' });
		crate(state, 'neodymium', { speed: 120 });
		run(state, 20_000);
		expect(state.combo).toBe(1);
	});
});

describe('licences', () => {
	it('send a crate that skipped the checkpoint back as a violation', () => {
		const state = quiet();
		lineToNeodymium(state);
		const licence = rule(state, { kind: 'licence', element: 'neodymium', node: 'p0' });
		crate(state, 'neodymium', { needs: [{ rule: licence.id, node: 'p0' }] });
		const events = run(state, 12_000);
		expect(events.find((event) => event.type === 'violation')).toMatchObject({
			kind: 'licence',
			node: 'f1'
		});
		expect(state.delivered).toBe(0);
		expect(state.lives).toBe(STARTING_LIVES - 1);
	});

	it('let a crate that passed the checkpoint through', () => {
		const state = quiet();
		setSwitch(state, 'm1', 1);
		setSwitch(state, 'h1', 0);
		setSwitch(state, 'p0', 1);
		const licence = rule(state, { kind: 'licence', element: 'neodymium', node: 'p0' });
		crate(state, 'neodymium', { needs: [{ rule: licence.id, node: 'p0' }], speed: 120 });
		run(state, 15_000);
		expect(state.delivered).toBe(1);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('are handed to new crates of the licensed element only', () => {
		const state = quiet();
		rule(state, { kind: 'licence', element: 'neodymium', node: 'p1', startMs: 1e9 });
		const random = createRandom(4);
		for (let i = 0; i < 40; i++) {
			const spawned = spawnCrate(state, random);
			expect(spawned.needs.length).toBe(spawned.element === 'neodymium' ? 1 : 0);
		}
	});
});

describe('the notice schedule', () => {
	it('issues a notice at the start of round 2, puts it in force after the lead time and retires it', () => {
		const state = quiet();
		state.lives = 99;
		const events = run(state, ROUND_MS + STEP_MS * 2);
		const notice = events.find((event) => event.type === 'notice');
		expect(notice).toBeDefined();
		expect(state.rules).toHaveLength(1);
		const issued = state.rules[0];
		expect(issued.noticeMs).toBeGreaterThanOrEqual(ROUND_MS);
		expect(issued.noticeMs).toBeLessThan(ROUND_MS + STEP_MS);

		const later = run(state, NOTICE_LEAD_MS + STEP_MS);
		expect(later.some((event) => event.type === 'rule-start')).toBe(true);

		const end = run(state, RULE_LIFE_ROUNDS * ROUND_MS);
		expect(end.some((event) => event.type === 'rule-end')).toBe(true);
	});

	it('issues no notice in round 1', () => {
		const state = quiet();
		const events = run(state, ROUND_MS - STEP_MS);
		expect(types(events)).not.toContain('notice');
		expect(state.rules).toEqual([]);
	});

	it('announces round changes', () => {
		const state = quiet();
		const events = run(state, 3 * ROUND_MS + STEP_MS);
		const rounds = events.filter((event) => event.type === 'round').map((event) => event.round);
		expect(rounds).toEqual([2, 3, 4]);
	});
});

describe('determinism', () => {
	/** A scripted player that sends every crate the shortest way: same seed, same game */
	function play(seed: number): { score: number; delivered: number; rules: number; crates: number } {
		const state = createGame();
		const random = createRandom(seed);
		state.lives = 999;
		for (let t = 0; t < 5 * ROUND_MS; t += STEP_MS) {
			step(state, STEP_MS, random);
			for (const node of Object.keys(state.switches)) {
				if (state.graph.nodes[node].kind === 'mine' && state.crates.length % 2 === 0) {
					cycleSwitch(state, node);
				}
			}
		}
		return {
			score: state.score,
			delivered: state.delivered,
			rules: state.rules.length,
			crates: state.nextCrateId
		};
	}

	it('plays out identically for the same seed', () => {
		expect(play(21)).toEqual(play(21));
		expect(play(4)).toEqual(play(4));
	});

	it('plays out differently for different seeds', () => {
		const outcomes = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(play(seed))));
		expect(outcomes.size).toBeGreaterThan(1);
	});

	it('keeps rising in pace: later rounds spawn more crates than earlier ones', () => {
		const state = createGame();
		const random = createRandom(2);
		state.lives = 999;
		const spawnedIn: Record<number, number> = {};
		for (let t = 0; t < 8 * ROUND_MS; t += STEP_MS) {
			const events = step(state, STEP_MS, random);
			for (const event of events) {
				if (event.type === 'spawn') spawnedIn[state.round] = (spawnedIn[state.round] ?? 0) + 1;
			}
			// Keep the map clear so the cap never throttles the schedule
			state.crates = [];
		}
		expect(spawnedIn[6]).toBeGreaterThan(spawnedIn[1]);
	});
});

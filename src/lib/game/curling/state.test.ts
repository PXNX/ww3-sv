import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { ENDS_TOTAL, HACK, HOUSE, STONES_PER_END } from './config';
import {
	createCurl,
	endGame,
	nextEnd,
	setAim,
	setGamble,
	setSpin,
	setSweeping,
	stepCurl,
	throwStone,
	type CurlEvent,
	type CurlState
} from './state';

const DT = 1 / 60;

function newState() {
	const random = createRandom(11);
	return { state: createCurl(random), random };
}

/** Steps until the thrown stone has settled and the phase moves on; returns all events */
function runUntilSettled(state: CurlState, maxSeconds = 40): CurlEvent[] {
	const events: CurlEvent[] = [];
	const from = state.phase;
	for (let i = 0; i < maxSeconds * 60 && state.phase === from; i++) {
		events.push(...stepCurl(state, DT));
	}
	return events;
}

/** A throw that lands in the house on a calm sheet */
function throwIntoHouse(state: CurlState, spin = 1) {
	setSpin(state, spin);
	setAim(state, -spin * 1.5, 0.64);
	throwStone(state);
}

describe('throwing', () => {
	it('starts an end waiting for the first stone', () => {
		const { state } = newState();
		expect(state.phase).toBe('aiming');
		expect(state.stones).toHaveLength(0);
		expect(state.endIndex).toBe(0);
	});

	it('releases a stone from the hack with the aim, once', () => {
		const { state } = newState();
		setAim(state, 10, 0.5);
		const events = throwStone(state);
		expect(events).toEqual([{ type: 'throw', power: 0.5, gamble: false }]);
		expect(state.phase).toBe('sliding');
		expect(state.stones[0]).toMatchObject({ x: HACK.x, y: HACK.y, status: 'moving' });
		expect(state.stones[0].vx).toBeGreaterThan(0);
		expect(state.stones[0].vy).toBeLessThan(0);
		expect(throwStone(state)).toEqual([]);
		expect(state.stones).toHaveLength(1);
	});

	it('only lets the aim, curl and gamble change while aiming', () => {
		const { state } = newState();
		setSpin(state, -1);
		setGamble(state, true);
		throwStone(state);
		setAim(state, 20, 0.9);
		setSpin(state, 1);
		setGamble(state, false);
		expect(state.angle).toBe(0);
		expect(state.spin).toBe(-1);
		expect(state.gamble).toBe(true);
		expect(state.stones[0].gamble).toBe(true);
		expect(state.stones[0].spin).toBe(-1);
	});
});

describe('sliding and sweeping', () => {
	it('brings the next stone after one settles, then summarises the end after two', () => {
		const { state } = newState();
		throwIntoHouse(state);
		const first = runUntilSettled(state);
		expect(first.some((event) => event.type === 'stone-done')).toBe(true);
		expect(state.phase).toBe('aiming');
		expect(state.stoneIndex).toBe(1);

		throwIntoHouse(state, -1);
		const second = runUntilSettled(state);
		expect(state.phase).toBe('summary');
		const done = second.find((event) => event.type === 'end-done');
		expect(done).toBeDefined();
		expect(state.results).toHaveLength(1);
		expect(state.stones).toHaveLength(STONES_PER_END);
		expect(state.score).toBe(state.results[0].points * 10 + state.results[0].stars * 25);
	});

	it('scores a calm well-aimed stone in the house', () => {
		const { state } = newState();
		throwIntoHouse(state);
		runUntilSettled(state);
		const stone = state.stones[0];
		expect(Math.hypot(stone.x - HOUSE.x, stone.y - HOUSE.y)).toBeLessThan(96);
	});

	it('spends sweep energy only while sweeping and carries the stone further', () => {
		const calm = newState().state;
		setAim(calm, 0, 0.5);
		throwStone(calm);
		runUntilSettled(calm);

		const swept = newState().state;
		setAim(swept, 0, 0.5);
		throwStone(swept);
		setSweeping(swept, true);
		for (let i = 0; i < 60; i++) stepCurl(swept, DT);
		expect(swept.sweepEnergy).toBeLessThan(0.7);
		runUntilSettled(swept);
		expect(swept.stones[0].y).toBeLessThan(calm.stones[0].y - 20);
	});

	it('stops sweeping when the energy is gone', () => {
		const { state } = newState();
		setAim(state, 0, 1);
		throwStone(state);
		setSweeping(state, true);
		for (let i = 0; i < 60 * 4 && state.stones[0].status === 'moving'; i++) stepCurl(state, DT);
		expect(state.sweepEnergy).toBeLessThan(0.5);
		expect(state.sweepEnergy).toBeGreaterThanOrEqual(0);
	});

	it('ignores sweeping outside a slide', () => {
		const { state } = newState();
		setSweeping(state, true);
		expect(state.sweeping).toBe(false);
	});

	it('drops a stone that slides off the slab into the sea', () => {
		const { state } = newState();
		setAim(state, 0, 1);
		throwStone(state);
		const events = runUntilSettled(state);
		expect(state.stones[0].status).toBe('sunk');
		expect(events.some((event) => event.type === 'sunk')).toBe(true);
	});

	it('makes a failed gamble cost points', () => {
		const { state } = newState();
		setGamble(state, true);
		setAim(state, 0, 1);
		throwStone(state);
		runUntilSettled(state);
		throwIntoHouse(state);
		runUntilSettled(state);
		expect(state.results[0].stones[0]).toMatchObject({ gamble: true, outcome: 'sunk', points: -3 });
	});
});

describe('collisions between stones and hazards', () => {
	it('knocks a stone out of the way and reports the bump', () => {
		const { state } = newState();
		state.stones.push({
			id: 99,
			x: HACK.x,
			y: 250,
			vx: 0,
			vy: 0,
			spin: 1,
			gamble: false,
			status: 'rest',
			rot: 0,
			sunkAt: 0
		});
		setAim(state, 0, 0.6);
		throwStone(state);
		const events = runUntilSettled(state);
		expect(events.some((event) => event.type === 'bump' && event.kind === 'stone')).toBe(true);
		expect(state.stones[0].y).toBeLessThan(250);
	});

	it('bounces off a seal', () => {
		const { state } = newState();
		state.hazards.seals.push({ x: HACK.x, y: 250, side: 1 });
		setAim(state, 0, 0.6);
		throwStone(state);
		const events = runUntilSettled(state);
		expect(events.some((event) => event.type === 'bump' && event.kind === 'seal')).toBe(true);
		expect(state.sealBumps).toBeGreaterThan(0);
	});

	it('costs points once when a stone hits the penguin', () => {
		const { state } = newState();
		state.hazards.penguin = { x: HACK.x, y: 250, vx: 0, cooldown: 0, phase: 0 };
		setAim(state, 0, 0.6);
		throwStone(state);
		const events = runUntilSettled(state);
		expect(events.filter((event) => event.type === 'penguin-hit')).toHaveLength(1);
		expect(state.penguinHits).toBe(1);
		expect(state.endPenguinHits).toBe(1);
	});

	it('lets a waddling penguin shove a resting stone', () => {
		const { state } = newState();
		state.stones.push({
			id: 5,
			x: 300,
			y: 250,
			vx: 0,
			vy: 0,
			spin: 1,
			gamble: false,
			status: 'rest',
			rot: 0,
			sunkAt: 0
		});
		state.hazards.penguin = { x: 270, y: 250, vx: 60, cooldown: 0, phase: 0 };
		for (let i = 0; i < 30; i++) stepCurl(state, DT);
		expect(state.stones[0].x).toBeGreaterThan(300);
		expect(state.penguinHits).toBe(0);
	});
});

describe('ends and the game', () => {
	function playEnd(state: CurlState, random: ReturnType<typeof createRandom>) {
		for (let i = 0; i < STONES_PER_END; i++) {
			throwIntoHouse(state, i % 2 === 0 ? 1 : -1);
			runUntilSettled(state);
		}
		return nextEnd(state, random);
	}

	it('moves to the next end with fresh hazards and an empty sheet', () => {
		const { state, random } = newState();
		const events = playEnd(state, random);
		expect(state.endIndex).toBe(1);
		expect(state.stones).toHaveLength(0);
		expect(state.phase).toBe('aiming');
		expect(state.hazards.wind).not.toBe(0);
		expect(events).toEqual([{ type: 'end-start', end: 1, hazard: 'wind' }]);
	});

	it('does not move on before the end is finished', () => {
		const { state, random } = newState();
		expect(nextEnd(state, random)).toEqual([]);
		expect(state.endIndex).toBe(0);
	});

	it('ends the game after the last end with the final score', () => {
		const { state, random } = newState();
		let last: CurlEvent[] = [];
		for (let end = 0; end < ENDS_TOTAL; end++) {
			last = playEnd(state, random);
		}
		expect(state.over).toBe(true);
		expect(state.phase).toBe('over');
		expect(state.results).toHaveLength(ENDS_TOTAL);
		const over = last.find((event) => event.type === 'game-over');
		expect(over).toBeDefined();
		expect(state.score).toBeGreaterThan(0);
		expect(stepCurl(state, DT)).toEqual([]);
	});

	it('counts only the finished ends when the player gives up', () => {
		const { state, random } = newState();
		playEnd(state, random);
		const before = state.score;
		endGame(state);
		expect(state.over).toBe(true);
		expect(state.score).toBe(before);
		expect(endGame(state)).toEqual([]);
	});

	it('is deterministic for a seed', () => {
		const first = newState();
		const second = newState();
		playEnd(first.state, first.random);
		playEnd(second.state, second.random);
		expect(first.state.score).toBe(second.state.score);
		expect(first.state.hazards).toEqual(second.state.hazards);
	});
});

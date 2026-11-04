import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	COUNTER_GAIN,
	DECOY_PENALTY,
	PRESS_COOLDOWN,
	RESIGN_LINE,
	START_APPROVAL,
	WEEKS_TOTAL,
	WEEK_SECONDS,
	comboMultiplier,
	createSlider,
	pressConference,
	spawnWeights,
	starsFor,
	tap,
	tick,
	type SliderState,
	type Target
} from './state';

function addTarget(state: SliderState, kind: Target['kind'], ttl = 5): Target {
	const target: Target = { id: state.nextId++, kind, x: 50, y: 50, age: 0, ttl };
	state.targets.push(target);
	return target;
}

describe('slider logic', () => {
	it('lets the approval sink while nothing is tapped, until the player resigns', () => {
		const state = createSlider();
		const random = createRandom(1);
		for (let i = 0; i < 20 * 120 && !state.over; i++) tick(state, 0.05, random);
		expect(state.over).toBe(true);
		expect(state.won).toBe(false);
		expect(state.approval).toBeLessThanOrEqual(RESIGN_LINE);
		expect(state.stars).toBe(0);
	});

	it('a bot that taps every rally and scandal survives all weeks with stars', () => {
		const state = createSlider();
		const random = createRandom(7);
		for (let i = 0; i < 20 * 140 && !state.over; i++) {
			tick(state, 0.05, random);
			for (const target of [...state.targets]) {
				if (target.kind !== 'decoy' && target.age > 0.3) tap(state, target.id);
			}
		}
		expect(state.over).toBe(true);
		expect(state.won).toBe(true);
		expect(state.week).toBe(WEEKS_TOTAL);
		expect(state.stars).toBeGreaterThanOrEqual(1);
		expect(state.score).toBeGreaterThan(0);
	});

	it('a rally lifts the approval, scores and builds the combo', () => {
		const state = createSlider();
		const rally = addTarget(state, 'rally');
		const events = tap(state, rally.id);
		expect(state.approval).toBeGreaterThan(START_APPROVAL);
		expect(state.combo).toBe(1);
		expect(state.score).toBeGreaterThan(0);
		expect(events[0].type).toBe('rally');
		expect(state.targets).toHaveLength(0);
	});

	it('tapping a fake poll costs approval and breaks the combo', () => {
		const state = createSlider();
		state.combo = 6;
		const decoy = addTarget(state, 'decoy');
		tap(state, decoy.id);
		expect(state.approval).toBeCloseTo(START_APPROVAL - DECOY_PENALTY);
		expect(state.combo).toBe(0);
	});

	it('countering a scandal is cheap but safe, and ignoring it hurts', () => {
		const countered = createSlider();
		tap(countered, addTarget(countered, 'scandal').id);
		expect(countered.approval).toBeCloseTo(START_APPROVAL + COUNTER_GAIN);
		expect(countered.countered).toBe(1);

		const ignored = createSlider();
		addTarget(ignored, 'scandal', 0.01);
		const events = tick(ignored, 0.05, createRandom(2));
		expect(events.some((event) => event.type === 'scandal')).toBe(true);
		expect(ignored.approval).toBeLessThan(START_APPROVAL - 8);
	});

	it('a missed rally only breaks the combo', () => {
		const state = createSlider();
		state.combo = 4;
		addTarget(state, 'rally', 0.01);
		tick(state, 0.05, createRandom(3));
		expect(state.combo).toBe(0);
	});

	it('the press conference clears scandals, costs the streak and has a cooldown', () => {
		const state = createSlider();
		state.combo = 9;
		addTarget(state, 'scandal');
		addTarget(state, 'scandal');
		addTarget(state, 'rally');
		const [event] = pressConference(state);
		expect(event).toMatchObject({ type: 'press', cleared: 2 });
		expect(state.targets.map((target) => target.kind)).toEqual(['rally']);
		expect(state.combo).toBe(0);
		expect(state.pressCooldown).toBe(PRESS_COOLDOWN);
		expect(pressConference(state)[0].type).toBe('press-not-ready');
		tick(state, PRESS_COOLDOWN, createRandom(4));
		expect(state.pressCooldown).toBe(0);
	});

	it('the combo multiplier grows with the streak and caps at x3', () => {
		expect(comboMultiplier(0)).toBe(1);
		expect(comboMultiplier(5)).toBe(1.5);
		expect(comboMultiplier(10)).toBe(2);
		expect(comboMultiplier(99)).toBe(3);
	});

	it('introduces scandals in week 2 and fake polls in week 3', () => {
		expect(spawnWeights(1)).toMatchObject({ scandal: 0, decoy: 0 });
		expect(spawnWeights(2).scandal).toBeGreaterThan(0);
		expect(spawnWeights(2).decoy).toBe(0);
		expect(spawnWeights(3).decoy).toBeGreaterThan(0);
	});

	it('announces each new week and awards stars by final approval', () => {
		const state = createSlider();
		state.approval = 100;
		const events = tick(state, WEEK_SECONDS + 0.1, createRandom(5));
		expect(events).toContainEqual({ type: 'week', week: 2 });
		expect([starsFor(30), starsFor(40), starsFor(55), starsFor(70)]).toEqual([0, 1, 2, 3]);
	});

	it('the drawn line overshoots the approval after a hit, then settles', () => {
		const state = createSlider();
		tap(state, addTarget(state, 'rally').id);
		const target = state.approval;
		let peak = state.shown;
		const random = createRandom(6);
		for (let i = 0; i < 10; i++) {
			tick(state, 0.03, random);
			peak = Math.max(peak, state.shown);
		}
		expect(peak).toBeGreaterThan(target);
	});
});

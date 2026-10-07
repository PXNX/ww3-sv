import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { COMBO_STEP, STARTING_LIVES, THREATS, WORLD_HEIGHT, type FlyerKind } from './config';
import { createGame, type Flyer, type SliceState } from './state';
import { sliceWithTrail, stepGame } from './step';
import { addTrailPoint, beginSwipe } from './trail';

const STEP = 1000 / 60;

/** A flyer hanging in place (no gravity, no speed) so a swipe can be aimed at it */
function park(state: SliceState, kind: FlyerKind, x: number, y: number): Flyer {
	const flyer: Flyer = {
		kind,
		x,
		y,
		vx: 0,
		vy: 0,
		gravity: 0,
		angle: 0,
		phase: 0,
		id: state.nextId++,
		ageMs: 0
	};
	state.flyers.push(flyer);
	return flyer;
}

/** A game whose spawner never fires, so only parked flyers exist */
function quietGame(): SliceState {
	const state = createGame();
	state.spawner.nextMs = Infinity;
	return state;
}

function swipe(state: SliceState, points: [number, number][]) {
	beginSwipe(state.trail, { x: points[0][0], y: points[0][1] }, state.timeMs);
	for (const [x, y] of points.slice(1)) addTrailPoint(state.trail, { x, y }, state.timeMs);
}

describe('stepGame', () => {
	it('launches flyers over time and they fly on arcs', () => {
		const state = createGame();
		const random = createRandom(11);
		let launched = 0;
		for (let i = 0; i < 180; i++) {
			launched += stepGame(state, random, STEP).filter((event) => event.type === 'launched').length;
		}
		expect(launched).toBeGreaterThan(0);
		expect(state.flyers.length).toBeGreaterThan(0);
		expect(state.flyers.every((flyer) => flyer.y < WORLD_HEIGHT + 60)).toBe(true);
	});

	it('is deterministic for a seed', () => {
		const run = () => {
			const state = createGame();
			const random = createRandom(5);
			for (let i = 0; i < 600; i++) stepGame(state, random, STEP);
			return { lives: state.lives, missed: state.missed, flyers: state.flyers.length };
		};
		expect(run()).toEqual(run());
	});

	it('costs a heart for every threat that falls back, and ends the game at none', () => {
		const state = createGame();
		const random = createRandom(3);
		let over = false;
		for (let i = 0; i < 60 * 120 && !over; i++) {
			over = stepGame(state, random, STEP).some((event) => event.type === 'game-over');
		}
		expect(over).toBe(true);
		expect(state.lives).toBe(0);
		expect(state.over).toBe(true);
		expect(state.missed).toBe(STARTING_LIVES);
		expect(stepGame(state, random, STEP)).toEqual([]);
	});

	it('lets a decoy fall away for free', () => {
		const state = quietGame();
		park(state, 'balloon', 100, WORLD_HEIGHT + 100).vy = 50;
		const events = stepGame(state, createRandom(1), STEP);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(events.some((event) => event.type === 'missed')).toBe(false);
		expect(state.flyers).toHaveLength(0);
	});
});

describe('slicing', () => {
	it('scores a threat and splits it into two halves flying apart', () => {
		const state = quietGame();
		park(state, 'kinzhal', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events).toMatchObject([
			{ type: 'sliced', kind: 'kinzhal', points: THREATS.kinzhal.points, chain: 1 }
		]);
		expect(state.score).toBe(THREATS.kinzhal.points);
		expect(state.flyers).toHaveLength(0);
		expect(state.halves).toHaveLength(2);
		const [a, b] = state.halves;
		expect(a.side).toBe(-b.side);
		// A horizontal swipe parts the halves up and down
		expect(a.vy).not.toBeCloseTo(b.vy);
		expect(Math.sign(a.spin)).toBe(-Math.sign(b.spin));
	});

	it('never slices a flyer twice', () => {
		const state = quietGame();
		park(state, 'geran', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		sliceWithTrail(state);
		expect(sliceWithTrail(state)).toEqual([]);
		expect(state.sliced).toBe(1);
	});

	it('misses a flyer the swipe does not touch', () => {
		const state = quietGame();
		park(state, 'geran', 100, 200);
		swipe(state, [
			[60, 300],
			[140, 300]
		]);
		expect(sliceWithTrail(state)).toEqual([]);
		expect(state.flyers).toHaveLength(1);
	});

	it('cuts through several flyers in one swipe as a combo', () => {
		const state = quietGame();
		park(state, 'geran', 60, 200);
		park(state, 'geran', 140, 200);
		park(state, 'geran', 220, 200);
		swipe(state, [
			[20, 200],
			[120, 200],
			[260, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events.map((event) => (event.type === 'sliced' ? event.chain : 0))).toEqual([1, 2, 3]);
		const base = THREATS.geran.points;
		expect(state.score).toBe(base + (base + COMBO_STEP) + (base + 2 * COMBO_STEP));
		expect(state.bestCombo).toBe(3);
	});

	it('does not chain slices of separate swipes', () => {
		const state = quietGame();
		park(state, 'geran', 60, 200);
		park(state, 'geran', 220, 200);
		swipe(state, [
			[20, 200],
			[100, 200]
		]);
		sliceWithTrail(state);
		swipe(state, [
			[180, 200],
			[260, 200]
		]);
		sliceWithTrail(state);
		expect(state.score).toBe(2 * THREATS.geran.points);
		expect(state.bestCombo).toBe(1);
	});

	it('costs a heart for a decoy and breaks the combo', () => {
		const state = quietGame();
		park(state, 'geran', 60, 200);
		park(state, 'tanker', 140, 200);
		park(state, 'geran', 220, 200);
		swipe(state, [
			[20, 200],
			[260, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events.map((event) => event.type)).toEqual(['sliced', 'decoy-hit', 'sliced']);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.decoysHit).toBe(1);
		// The chain started over after the tanker
		expect(state.score).toBe(2 * THREATS.geran.points);
	});

	it('ends the game when the last heart goes to a decoy', () => {
		const state = quietGame();
		state.lives = 1;
		park(state, 'gull', 60, 200);
		park(state, 'geran', 200, 200);
		swipe(state, [
			[20, 200],
			[260, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events.map((event) => event.type)).toEqual(['decoy-hit', 'game-over']);
		expect(state.over).toBe(true);
		expect(state.score).toBe(0);
		expect(sliceWithTrail(state)).toEqual([]);
	});

	it('cuts a flyer that flies into a held swipe, and forgets the swipe after it fades', () => {
		const state = quietGame();
		swipe(state, [
			[100, 300],
			[200, 300]
		]);
		const flyer = park(state, 'kalibr', 150, 360);
		flyer.vy = -300;
		let sliced = false;
		for (let i = 0; i < 20 && !sliced; i++) {
			sliced = stepGame(state, createRandom(1), STEP).some((event) => event.type === 'sliced');
		}
		expect(sliced).toBe(true);

		const late = quietGame();
		swipe(late, [
			[100, 300],
			[200, 300]
		]);
		for (let i = 0; i < 30; i++) stepGame(late, createRandom(1), STEP);
		expect(late.trail.points).toHaveLength(0);
	});

	it('lets the halves fall and then removes them', () => {
		const state = quietGame();
		park(state, 'zircon', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		sliceWithTrail(state);
		state.halves.forEach((half) => (half.gravity = 800));
		const startY = state.halves.map((half) => half.y);
		stepGame(state, createRandom(1), STEP);
		expect(state.halves).toHaveLength(2);
		expect(state.halves.every((half, i) => half.vy > 0 || half.y !== startY[i])).toBe(true);
		for (let i = 0; i < 120; i++) stepGame(state, createRandom(1), STEP);
		expect(state.halves).toHaveLength(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import {
	COMBO_STEP,
	FOCUS_MS,
	FOCUS_SCALE,
	STARTING_LIVES,
	THREATS,
	WAVE_COUNT,
	WAVE_LULL_MS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
	waveVolleys,
	type FlyerKind,
	type ThreatKind
} from './config';
import { createGame, type Flyer, type SliceState } from './state';
import { reviveGame, sliceWithTrail, stepGame, timeScale } from './step';
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
		ageMs: 0,
		hp: THREATS[kind as ThreatKind]?.hp ?? 1,
		hitSwipe: -1,
		hitMs: 0
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

describe('armour', () => {
	it('needs two separate swipes and ignores a second pass of the same swipe', () => {
		const state = quietGame();
		const flyer = park(state, 'iskander', 100, 200);
		expect(flyer.hp).toBe(2);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		expect(sliceWithTrail(state).map((event) => event.type)).toEqual(['armor-hit']);
		expect(flyer.hp).toBe(1);
		expect(state.sliced).toBe(0);
		expect(state.halves).toHaveLength(0);
		// Still touching the same swipe: no second dent
		expect(sliceWithTrail(state)).toEqual([]);
		expect(flyer.hp).toBe(1);

		// Park it again where the next swipe will pass, then a new swipe breaks it
		flyer.x = 100;
		flyer.y = 200;
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		expect(sliceWithTrail(state).map((event) => event.type)).toEqual(['sliced']);
		expect(state.score).toBe(THREATS.iskander.points);
		expect(state.flyers).toHaveLength(0);
	});
});

describe('clusters', () => {
	it('break into two bomblets that cost no heart when missed', () => {
		const state = quietGame();
		park(state, 'cluster', 180, 200);
		swipe(state, [
			[140, 200],
			[220, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events.map((event) => event.type)).toEqual(['sliced', 'split']);
		expect(state.flyers.map((flyer) => flyer.kind)).toEqual(['bomblet', 'bomblet']);
		expect(state.flyers[0].vx).toBeLessThan(0);
		expect(state.flyers[1].vx).toBeGreaterThan(0);

		// Let them fall back into the sea unsliced
		const random = createRandom(1);
		let missedEvents = 0;
		for (let i = 0; i < 60 * 6 && state.flyers.length > 0; i++) {
			missedEvents += stepGame(state, random, STEP).filter(
				(event) => event.type === 'missed'
			).length;
		}
		expect(missedEvents).toBe(2);
		expect(state.lives).toBe(STARTING_LIVES);
		expect(state.streak).toBe(0);
	});
});

describe('mines', () => {
	it('cost a heart, shove what is near and leave no halves', () => {
		const state = quietGame();
		park(state, 'mine', 100, 200);
		const near = park(state, 'geran', 160, 200);
		const far = park(state, 'geran', 320, 520);
		swipe(state, [
			[60, 200],
			[110, 200]
		]);
		const events = sliceWithTrail(state);
		expect(events).toMatchObject([{ type: 'decoy-hit', kind: 'mine', blast: true }]);
		expect(state.lives).toBe(STARTING_LIVES - 1);
		expect(state.halves).toHaveLength(0);
		expect(near.vx).toBeGreaterThan(50);
		expect(far.vx).toBe(0);
	});
});

describe('pickups', () => {
	it('focus slows the world, then wears off with an event', () => {
		const state = quietGame();
		park(state, 'focus', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		expect(sliceWithTrail(state)).toMatchObject([{ type: 'pickup', kind: 'focus' }]);
		expect(state.focusMs).toBe(FOCUS_MS);
		expect(state.sliced).toBe(0);
		expect(timeScale(state.focusMs)).toBe(FOCUS_SCALE);

		const slow = park(state, 'geran', 100, 100);
		slow.gravity = 0;
		slow.vx = 100;
		stepGame(state, createRandom(1), 100);
		expect(slow.x).toBeCloseTo(100 + 100 * 0.1 * FOCUS_SCALE);

		let ended = false;
		for (let i = 0; i < 400 && !ended; i++) {
			ended = stepGame(state, createRandom(1), STEP).some((event) => event.type === 'focus-end');
		}
		expect(ended).toBe(true);
		expect(state.focusMs).toBe(0);
		expect(timeScale(0)).toBe(1);
	});

	it('a repair gives back a heart up to the starting number', () => {
		const state = quietGame();
		state.lives = STARTING_LIVES - 2;
		park(state, 'repair', 100, 200);
		park(state, 'repair', 200, 200);
		swipe(state, [
			[60, 200],
			[240, 200]
		]);
		sliceWithTrail(state);
		expect(state.lives).toBe(STARTING_LIVES);
	});

	it('fall away for free', () => {
		const state = quietGame();
		park(state, 'focus', 100, WORLD_HEIGHT + 100).vy = 50;
		const events = stepGame(state, createRandom(1), STEP);
		expect(events.some((event) => event.type === 'missed')).toBe(false);
		expect(state.lives).toBe(STARTING_LIVES);
	});
});

describe('streaks', () => {
	it('raise the multiplier every ten clean slices and drop on a miss', () => {
		const state = quietGame();
		state.streak = 10;
		park(state, 'geran', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		expect(sliceWithTrail(state)).toMatchObject([{ type: 'sliced', multiplier: 2 }]);
		expect(state.score).toBe(2 * THREATS.geran.points);
		expect(state.streak).toBe(11);
		expect(state.bestStreak).toBe(11);

		park(state, 'geran', 100, WORLD_HEIGHT + 100).vy = 50;
		stepGame(state, createRandom(1), STEP);
		expect(state.streak).toBe(0);
		expect(state.bestStreak).toBe(11);
	});
});

describe('physics', () => {
	it('bounces a flyer off the side wall', () => {
		const state = quietGame();
		const flyer = park(state, 'geran', THREATS.geran.radius + 1, 200);
		flyer.vx = -200;
		const events = stepGame(state, createRandom(1), STEP * 2);
		expect(flyer.vx).toBeGreaterThan(0);
		expect(flyer.x).toBeGreaterThanOrEqual(THREATS.geran.radius);
		expect(events.some((event) => event.type === 'bounce')).toBe(true);
	});

	it('lets a sliced half skim off the sea once', () => {
		const state = quietGame();
		park(state, 'kinzhal', 100, 200);
		swipe(state, [
			[60, 200],
			[140, 200]
		]);
		sliceWithTrail(state);
		const half = state.halves[0];
		half.y = WORLD_HEIGHT - 20;
		half.vy = 300;
		half.vx = 0;
		const events = stepGame(state, createRandom(1), STEP);
		expect(events.some((event) => event.type === 'skim')).toBe(true);
		expect(half.vy).toBeLessThan(0);
		expect(half.skimmed).toBe(true);
	});

	it('keeps halves inside the side walls', () => {
		const state = quietGame();
		park(state, 'kinzhal', 8, 200);
		swipe(state, [
			[0, 180],
			[10, 220]
		]);
		sliceWithTrail(state);
		for (let i = 0; i < 30; i++) stepGame(state, createRandom(1), STEP);
		expect(state.halves.every((half) => half.x >= 0 && half.x <= WORLD_WIDTH)).toBe(true);
	});
});

describe('waves', () => {
	it('announces wave 1, clears it with a bonus after the last volley, then rests', () => {
		const state = createGame();
		const random = createRandom(21);
		const kinds: string[] = [];
		let clear: { wave: number; bonus: number; flawless: boolean } | undefined;
		// Keep the sky empty of flyers so the wave clears as soon as its volleys are out
		for (let i = 0; i < 60 * 60 && !clear; i++) {
			for (const event of stepGame(state, random, STEP)) {
				kinds.push(event.type);
				if (event.type === 'wave-clear') clear = event;
			}
			if (!clear) state.flyers.length = 0;
		}
		expect(kinds[0]).toBe('wave-start');
		expect(clear).toMatchObject({ wave: 1, flawless: true });
		expect(state.spawner.volleysLeft).toBe(0);
		expect(state.spawner.lullMs).toBe(WAVE_LULL_MS);
		expect(state.score).toBe(clear!.bonus);

		let second = false;
		for (let i = 0; i < 60 * 10 && !second; i++) {
			second = stepGame(state, random, STEP).some(
				(event) => event.type === 'wave-start' && event.wave === 2
			);
		}
		expect(second).toBe(true);
		expect(state.spawner.volleysLeft).toBe(waveVolleys(2));
	});

	it('wins the run when the last wave is cleared, and a win cannot be revived', () => {
		const state = quietGame();
		state.spawner.wave = WAVE_COUNT;
		state.spawner.volleysLeft = 0;
		state.spawner.announce = false;
		const events = stepGame(state, createRandom(1), STEP);
		expect(events.map((event) => event.type)).toEqual(['wave-clear', 'victory']);
		expect(state.won).toBe(true);
		expect(state.over).toBe(true);
		reviveGame(state);
		expect(state.over).toBe(true);
	});

	it('keeps the wave when a lost run is revived', () => {
		const state = quietGame();
		state.spawner.wave = 4;
		state.over = true;
		state.lives = 0;
		reviveGame(state);
		expect(state.over).toBe(false);
		expect(state.lives).toBe(1);
		expect(state.spawner.wave).toBe(4);
	});
});

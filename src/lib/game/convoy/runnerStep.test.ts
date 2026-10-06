import { describe, expect, it } from 'vitest';
import { createRandom } from '$lib/game/random';
import {
	BARREL_POINTS,
	ESCORT_BONUS_POINTS,
	FIRST_PATTERN_AT,
	INVULNERABLE_MS,
	LANE_CHANGE_MS,
	LANE_COUNT,
	MAX_HULL,
	MAX_SPEED,
	NAUTICAL_MILES_PER_UNIT,
	POINTS_PER_UNIT,
	SLICK_SLIDE_MS,
	START_SPEED,
	type ItemKind,
	type Lane
} from './constants';
import {
	createRunner,
	dragShip,
	driftProgress,
	droneArrival,
	grabShip,
	makeObstacle,
	multiplierFor,
	releaseShip,
	runnerNauticalMiles,
	runnerScore,
	shipRange,
	shoreInsetLanes,
	speedAt,
	springSlide,
	steer,
	stepRunner,
	type RunnerState
} from './runnerStep';

const STEP = 1000 / 60;

/** A runner without automatic spawning, holding exactly the given obstacles */
function runnerWith(
	items: { kind: ItemKind; lane: Lane; ahead: number; targetLane?: Lane; push?: -1 | 1 }[] = [],
	overrides: Partial<RunnerState> = {}
): RunnerState {
	const base = { ...createRunner(), nextSpawnAt: Number.POSITIVE_INFINITY, ...overrides };
	return {
		...base,
		obstacles: items.map((item, index) =>
			makeObstacle(index + 1, item.kind, item.lane, base.distance + item.ahead, item)
		)
	};
}

function run(state: RunnerState, ms: number, seed = 1, reducedMotion = false): RunnerState {
	const random = createRandom(seed);
	let current = state;
	const events: RunnerState['events'] = [];
	for (let t = 0; t < ms; t += STEP) {
		current = stepRunner(current, STEP, random, { reducedMotion });
		events.push(...current.events);
	}
	return { ...current, events };
}

describe('speed', () => {
	it('starts slow, ramps with distance and is capped', () => {
		expect(speedAt(0)).toBe(START_SPEED);
		expect(speedAt(100)).toBeGreaterThan(speedAt(50));
		expect(speedAt(1_000_000)).toBe(MAX_SPEED);
	});

	it('ramps more gently with reduced motion', () => {
		expect(speedAt(100, true)).toBeLessThan(speedAt(100));
		expect(speedAt(100, true)).toBeGreaterThan(START_SPEED);
		expect(speedAt(1_000_000, true)).toBe(MAX_SPEED);
	});

	it('moves the same distance whatever the step size', () => {
		const random = createRandom(1);
		let fine = runnerWith();
		for (let i = 0; i < 120; i++) fine = stepRunner(fine, 1000 / 120, random);
		let coarse = runnerWith();
		for (let i = 0; i < 60; i++) coarse = stepRunner(coarse, 1000 / 60, random);
		expect(fine.distance).toBeCloseTo(coarse.distance, 2);
		expect(coarse.distance).toBeCloseTo(START_SPEED, 1);
	});
});

describe('lane changes', () => {
	it('moves one lane per input and stops at the edges', () => {
		let state = runnerWith();
		state = steer(state, -1);
		expect(state.lane).toBe(0);
		expect(steer(state, -1)).toBe(state);
		let right = state;
		for (let i = 0; i < LANE_COUNT - 1; i++) right = steer(right, 1);
		expect(right.lane).toBe(LANE_COUNT - 1);
		expect(steer(right, 1)).toBe(right);
	});

	it('slides springily: overshoots slightly and settles within the lane-change time', () => {
		expect(springSlide(0)).toBe(0);
		expect(springSlide(1)).toBe(1);
		const peak = Math.max(...Array.from({ length: 101 }, (_, i) => springSlide(i / 100)));
		expect(peak).toBeGreaterThan(1);
		expect(peak).toBeLessThan(1.1);

		let state = steer(runnerWith(), 1);
		state = stepRunner(state, LANE_CHANGE_MS / 2, createRandom(1));
		expect(state.x).toBeGreaterThan(1);
		expect(state.x).toBeLessThan(2.1);
		state = stepRunner(state, LANE_CHANGE_MS, createRandom(1));
		expect(state.x).toBe(2);
	});

	it('can change direction mid-slide', () => {
		let state = stepRunner(steer(runnerWith(), 1), LANE_CHANGE_MS / 2, createRandom(1));
		state = steer(state, -1);
		expect(state.lane).toBe(1);
		state = run(state, LANE_CHANGE_MS + 20);
		expect(state.x).toBe(1);
	});
});

describe('holding the tanker (direct manipulation)', () => {
	it('puts the tanker exactly at the pointer, immediately and after every step', () => {
		let state = grabShip(runnerWith());
		for (const target of [1.37, 2.9, 0.42, 3.05]) {
			state = dragShip(state, target);
			expect(state.x).toBe(target);
			// Stepping the simulation does not ease or lag behind
			state = stepRunner(state, STEP, createRandom(1));
			expect(state.x).toBe(target);
		}
	});

	it('clamps to the lane area but remembers where the pointer is', () => {
		let state = grabShip(runnerWith());
		state = dragShip(state, -4);
		expect(state.x).toBe(0);
		state = dragShip(state, 40);
		expect(state.x).toBe(LANE_COUNT - 1);
		expect(state.lane).toBe(LANE_COUNT - 1);
		expect(stepRunner(state, STEP, createRandom(1)).x).toBe(LANE_COUNT - 1);
	});

	it('keeps the tanker inside the water the banks leave open', () => {
		const narrow = {
			...runnerWith(),
			shorePhase: 'narrow' as const,
			shoreLeftBlocked: 1,
			shoreRightBlocked: 2
		};
		let state = grabShip(narrow);
		expect(shipRange(state)).toEqual({ min: 1, max: LANE_COUNT - 1 - 2 });
		state = dragShip(state, 0);
		expect(state.x).toBe(1);
		state = dragShip(state, 4);
		expect(state.x).toBe(2);
		expect(state.lane).toBe(2);
	});

	it('does nothing until the tanker has been grabbed', () => {
		const state = runnerWith();
		expect(dragShip(state, 3)).toBe(state);
	});

	it('settles into the nearest lane on release', () => {
		let state = dragShip(grabShip(runnerWith()), 2.7);
		state = releaseShip(state);
		expect(state.dragX).toBeNull();
		expect(state.lane).toBe(3);
		expect(state.x).toBe(2.7);
		state = run(state, LANE_CHANGE_MS + 20);
		expect(state.x).toBe(3);
	});

	it('is taken out of the hands by an oil slick, which then slides as usual', () => {
		let state = grabShip(runnerWith([{ kind: 'slick', lane: 1, ahead: 0.2, push: 1 }]));
		state = stepRunner(state, STEP, createRandom(1));
		expect(state.slipping).toBe(true);
		expect(state.dragX).toBeNull();
		expect(dragShip(state, 4)).toBe(state);
		state = run(state, SLICK_SLIDE_MS + 50);
		expect(state.x).toBe(2);
	});

	it('lets a lane change from the keyboard take over', () => {
		const state = steer(dragShip(grabShip(runnerWith()), 1.4), 1);
		expect(state.dragX).toBeNull();
		expect(state.lane).toBe(2);
	});

	it('still hits obstacles at its exact position', () => {
		// A mine in lane 2, tanker held at 1.0: clear. Dragged to 1.8: collides
		const mine = runnerWith([{ kind: 'mine', lane: 2, ahead: 0.5 }]);
		const clear = run(dragShip(grabShip(mine), 1), 400);
		expect(clear.hull).toBe(MAX_HULL);
		const hit = run(dragShip(grabShip(mine), 1.8), 400);
		expect(hit.hull).toBe(MAX_HULL - 1);
	});
});

describe('collisions and hull', () => {
	it('loses a hull point on a mine and becomes briefly invulnerable', () => {
		const state = run(runnerWith([{ kind: 'mine', lane: 1, ahead: 2 }]), 1200);
		expect(state.hull).toBe(MAX_HULL - 1);
		expect(state.events.map((event) => event.type)).toContain('hit');
		expect(state.obstacles).toHaveLength(0);
	});

	it('ignores hazards during the invulnerability flicker', () => {
		const state = run(
			runnerWith([
				{ kind: 'mine', lane: 1, ahead: 1 },
				{ kind: 'drone', lane: 1, ahead: 2 }
			]),
			900
		);
		expect(state.hull).toBe(MAX_HULL - 1);
		expect(state.invulnerableMs).toBeGreaterThan(0);
		expect(state.invulnerableMs).toBeLessThan(INVULNERABLE_MS);
	});

	it('ends the run at zero hull points', () => {
		const state = run(runnerWith([{ kind: 'gunboat', lane: 1, ahead: 1 }], { hull: 1 }), 800);
		expect(state.hull).toBe(0);
		expect(state.over).toBe(true);
		expect(state.events.map((event) => event.type)).toContain('sunk');
		// A finished run no longer changes
		const later = run(state, 1000);
		expect(later.distance).toBe(state.distance);
		expect(steer(later, 1)).toBe(later);
	});

	it('dodges a hazard in another lane', () => {
		const state = run(runnerWith([{ kind: 'mine', lane: 0, ahead: 1.5 }]), 1500);
		expect(state.hull).toBe(MAX_HULL);
	});

	it('hits a hazard while crossing into its lane', () => {
		let state = runnerWith([{ kind: 'mine', lane: 2, ahead: 0.3 }]);
		state = steer(state, 1);
		state = run(state, 300);
		expect(state.hull).toBe(MAX_HULL - 1);
	});

	it('hits a gunboat that drifts into the tanker lane', () => {
		const state = run(runnerWith([{ kind: 'gunboat', lane: 0, targetLane: 1, ahead: 4.5 }]), 3000);
		expect(state.hull).toBe(MAX_HULL - 1);
	});

	it('drifts gunboats smoothly and fully before they reach the tanker', () => {
		expect(driftProgress(10)).toBe(0);
		expect(driftProgress(3.4)).toBeGreaterThan(0);
		expect(driftProgress(3.4)).toBeLessThan(1);
		expect(driftProgress(1)).toBe(1);
	});

	it('lets drones arrive only after their warning, well before the tanker', () => {
		expect(droneArrival(4)).toBe(0);
		expect(droneArrival(2.8)).toBeGreaterThan(0);
		expect(droneArrival(1.5)).toBe(1);
	});
});

describe('oil slicks', () => {
	it('slides the tanker one lane sideways instead of costing a hull point', () => {
		let state = run(runnerWith([{ kind: 'slick', lane: 1, ahead: 1, push: -1 }]), 600);
		expect(state.hull).toBe(MAX_HULL);
		expect(state.lane).toBe(0);
		expect(state.events.map((event) => event.type)).toContain('slick');
		state = run(state, SLICK_SLIDE_MS);
		expect(state.x).toBe(0);
	});

	it('always pushes inward from an edge lane', () => {
		const state = run(
			runnerWith([{ kind: 'slick', lane: 0, ahead: 1, push: -1 }], { lane: 0, x: 0, slideFrom: 0 }),
			600
		);
		expect(state.lane).toBe(1);
	});

	it('locks steering during the slide', () => {
		let state = runnerWith([{ kind: 'slick', lane: 1, ahead: 0.2, push: 1 }]);
		state = stepRunner(state, STEP, createRandom(1));
		expect(state.slipping).toBe(true);
		expect(steer(state, -1)).toBe(state);
		state = run(state, SLICK_SLIDE_MS + 50);
		expect(state.slipping).toBe(false);
		expect(steer(state, -1).lane).toBe(1);
	});
});

describe('collectibles', () => {
	it('collects oil barrels for bonus points', () => {
		const state = run(runnerWith([{ kind: 'barrel', lane: 1, ahead: 1 }]), 1000);
		expect(state.barrels).toBe(1);
		expect(state.points).toBeGreaterThanOrEqual(BARREL_POINTS);
	});

	it('the submarine escort absorbs exactly one hit', () => {
		let state = run(runnerWith([{ kind: 'escort', lane: 1, ahead: 1 }]), 800);
		expect(state.escort).toBe(true);
		state = run(
			{
				...state,
				obstacles: [
					makeObstacle(10, 'mine', 1, state.distance + 1),
					makeObstacle(11, 'mine', 1, state.distance + 5)
				]
			},
			3000
		);
		expect(state.escort).toBe(false);
		expect(state.hull).toBe(MAX_HULL - 1);
		const types = state.events.map((event) => event.type);
		expect(types.indexOf('shield')).toBeLessThan(types.indexOf('hit'));
	});

	it('gives points for a second escort instead of stacking', () => {
		const state = run(runnerWith([{ kind: 'escort', lane: 1, ahead: 1 }], { escort: true }), 800);
		expect(state.escort).toBe(true);
		expect(state.points).toBeGreaterThanOrEqual(ESCORT_BONUS_POINTS);
	});
});

describe('scoring', () => {
	it('scores distance travelled and reports nautical miles', () => {
		const state = run(runnerWith(), 2000);
		expect(runnerScore(state)).toBe(Math.floor(state.distance * POINTS_PER_UNIT));
		expect(runnerNauticalMiles(state)).toBeCloseTo(state.distance * NAUTICAL_MILES_PER_UNIT);
	});

	it('counts hazards passing in the next lane as near misses and raises the multiplier', () => {
		const state = run(
			runnerWith([
				{ kind: 'mine', lane: 0, ahead: 1 },
				{ kind: 'drone', lane: 2, ahead: 2 },
				{ kind: 'mine', lane: 0, ahead: 3 }
			]),
			2500
		);
		expect(state.nearMisses).toBe(3);
		expect(state.nearMissStreak).toBe(3);
		expect(multiplierFor(state.nearMissStreak)).toBe(1.3);
	});

	it('does not count hazards two lanes away', () => {
		const state = run(
			runnerWith([{ kind: 'mine', lane: 2, ahead: 1 }], { lane: 0, x: 0, slideFrom: 0 }),
			1500
		);
		expect(state.nearMisses).toBe(0);
	});

	it('resets the near-miss streak on a hit', () => {
		const state = run(
			runnerWith([
				{ kind: 'mine', lane: 0, ahead: 1 },
				{ kind: 'mine', lane: 1, ahead: 3 }
			]),
			2000
		);
		expect(state.nearMisses).toBe(1);
		expect(state.nearMissStreak).toBe(0);
	});

	it('caps the multiplier', () => {
		expect(multiplierFor(0)).toBe(1);
		expect(multiplierFor(5)).toBe(1.5);
		expect(multiplierFor(100)).toBe(2);
	});

	it('applies the multiplier to distance points', () => {
		const plain = run(runnerWith(), 1000);
		const boosted = run(runnerWith([], { nearMissStreak: 10 }), 1000);
		expect(boosted.points).toBeCloseTo(plain.points * 2, 5);
	});
});

describe('shore narrowing', () => {
	it('starts fully open', () => {
		const state = createRunner();
		expect(state.shorePhase).toBe('open');
		expect(shoreInsetLanes(state)).toEqual({ left: 0, right: 0 });
	});

	it('reports full inset only once fully narrow', () => {
		const narrow = {
			...runnerWith(),
			shorePhase: 'narrow' as const,
			shoreLeftBlocked: 2,
			shoreRightBlocked: 1
		};
		expect(shoreInsetLanes(narrow)).toEqual({ left: 2, right: 1 });
	});

	it('keeps steering within whatever lanes are still open', () => {
		const narrowed = { ...runnerWith(), shoreLeftBlocked: 1, shoreRightBlocked: 1 };
		expect(steer({ ...narrowed, lane: 1 }, -1).lane).toBe(1);
		expect(steer({ ...narrowed, lane: 3 }, 1).lane).toBe(3);
	});

	it('never leaves the tanker in a lane the bank has swallowed', () => {
		let state = createRunner();
		const random = createRandom(3);
		for (let t = 0; t < 200; t++) {
			state = stepRunner(state, 250, random);
			expect(state.lane).toBeGreaterThanOrEqual(state.shoreLeftBlocked);
			expect(state.lane).toBeLessThanOrEqual(LANE_COUNT - 1 - state.shoreRightBlocked);
		}
	});
});

describe('spawning', () => {
	it('starts with a calm opening and spawns patterns ahead of the tanker', () => {
		let state = createRunner();
		state = stepRunner(state, STEP, createRandom(1));
		expect(Math.min(...state.obstacles.map((obstacle) => obstacle.y))).toBeGreaterThanOrEqual(
			FIRST_PATTERN_AT
		);
		expect(state.nextSpawnAt).toBeGreaterThan(state.distance);
	});

	it('is deterministic for a seed', () => {
		const a = run(createRunner(), 20_000, 42);
		const b = run(createRunner(), 20_000, 42);
		expect(a).toEqual(b);
		const c = run(createRunner(), 20_000, 43);
		expect(c.obstacles).not.toEqual(a.obstacles);
	});

	it('keeps the obstacle list small by dropping what has scrolled away', () => {
		const state = run(createRunner(), 60_000, 7);
		expect(state.obstacles.length).toBeLessThan(40);
		expect(state.obstacles.every((obstacle) => obstacle.y > state.distance - 3)).toBe(true);
	});
});

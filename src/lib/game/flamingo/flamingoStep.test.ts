import { describe, expect, it } from 'vitest';
import { COLUMN_WIDTH, TAP_INTERVAL_SECONDS, gapCenter, gapCountFor } from './gapSequence';
import {
	FIRST_COLUMN_X,
	GAP_POINTS,
	NEXT_SEGMENT_CLEARANCE,
	OVER_DELAY_SECONDS,
	OVERSHOOT_MARGIN,
	READY_Y,
	STRIKE_BOUNCE_VELOCITY,
	createFlamingoState,
	createSegment,
	currentSegment,
	findContact,
	gapsLeft,
	predictDive,
	stepFlamingo,
	type Contact,
	type FlamingoEvent,
	type FlamingoState,
	type Segment
} from './flamingoStep';
import {
	FLAMINGO_RADIUS,
	FLAP_VELOCITY,
	GRAVITY,
	GROUND_Y,
	MAX_FALL_SPEED,
	SCROLL_SPEED,
	STEP_SECONDS,
	integrate
} from './physics';
import { strikeTank, type Refinery } from './refinery';

const TAP_STEPS = Math.round(TAP_INTERVAL_SECONDS / STEP_SECONDS);

const REFINERY: Refinery = {
	startX: 1000,
	endX: 1228,
	tanks: [
		{ x: 1030, halfWidth: 30, height: 88, tier: 2 },
		{ x: 1130, halfWidth: 42, height: 112, tier: 3 },
		{ x: 1210, halfWidth: 18, height: 54, tier: 0 }
	],
	flare: { x: 1075, width: 14, height: 200 },
	biggest: 1,
	nameIndex: 0
};

function segmentWith(overrides: Partial<Segment> = {}): Segment {
	return {
		index: 0,
		columns: [{ x: 200, gapTop: 150, gapBottom: 350, kind: 'radar' }],
		refinery: REFINERY,
		passed: 0,
		strike: null,
		...overrides
	};
}

function flyingState(overrides: Partial<FlamingoState> = {}): FlamingoState {
	return {
		...createFlamingoState(1),
		phase: 'flying',
		segments: [segmentWith()],
		...overrides
	};
}

/** Steps until the predicate holds or the step budget runs out; collects every event */
function runUntil(
	state: FlamingoState,
	done: (state: FlamingoState) => boolean,
	flap: (state: FlamingoState) => boolean = () => false,
	maxSteps = 5000
): FlamingoEvent[] {
	const events: FlamingoEvent[] = [];
	for (let step = 0; step < maxSteps && !done(state); step++) {
		stepFlamingo(state, flap(state));
		events.push(...state.events);
	}
	return events;
}

/**
 * A human-paced autopilot: at most four taps per second, aiming a little under the center of
 * the next gap, cruising high over the refinery and diving once the dive would hit the biggest tank.
 * Like a person, it may also flap early to time the start of the dive.
 */
function autopilot() {
	let sinceTap = TAP_STEPS;
	return (state: FlamingoState) => {
		const segment = currentSegment(state);
		const canTap = sinceTap >= TAP_STEPS;
		let tap: boolean;
		if (state.phase === 'ready') {
			tap = true;
		} else if (state.stage === 'gaps') {
			tap = canTap && state.y > gapCenter(segment.columns[segment.passed]) + 24;
		} else {
			const hitsBiggest = (contact: Contact | null) =>
				contact?.kind === 'tank' && contact.index === segment.refinery.biggest;
			const afterFlap = {
				...state,
				x: state.x + SCROLL_SPEED * STEP_SECONDS,
				...integrate(state, true)
			};
			if (hitsBiggest(predictDive(state))) tap = false;
			else if (canTap && hitsBiggest(predictDive(afterFlap))) tap = true;
			else tap = canTap && state.y > 200;
		}
		sinceTap = tap ? 0 : sinceTap + 1;
		return tap;
	};
}

describe('flight physics', () => {
	it('sets the vertical speed on a flap and pulls down with gravity otherwise', () => {
		expect(integrate({ y: 100, vy: 300 }, true)).toEqual({
			y: 100 + FLAP_VELOCITY * STEP_SECONDS,
			vy: FLAP_VELOCITY
		});
		const falling = integrate({ y: 100, vy: 0 }, false);
		expect(falling.vy).toBeCloseTo(GRAVITY * STEP_SECONDS);
		expect(falling.y).toBeGreaterThan(100);
	});

	it('caps the fall speed', () => {
		let body = { y: 0, vy: 0 };
		for (let step = 0; step < 200; step++) body = integrate(body, false);
		expect(body.vy).toBe(MAX_FALL_SPEED);
	});

	it('rises and falls back to the same height after one flap', () => {
		let body = { y: 300, vy: 0 };
		body = integrate(body, true);
		let highest = body.y;
		while (body.y < 300) {
			body = integrate(body, false);
			highest = Math.min(highest, body.y);
		}
		// One flap lifts the flamingo by roughly sixty units
		expect(300 - highest).toBeGreaterThan(50);
		expect(300 - highest).toBeLessThan(70);
	});
});

describe('ready and take-off', () => {
	it('hovers in place until the first flap', () => {
		const state = createFlamingoState(3);
		for (let step = 0; step < 120; step++) stepFlamingo(state, false);
		expect(state.phase).toBe('ready');
		expect(state.x).toBe(0);
		expect(Math.abs(state.y - READY_Y)).toBeLessThanOrEqual(6);
	});

	it('takes off with a flap', () => {
		const state = createFlamingoState(3);
		stepFlamingo(state, true);
		expect(state.phase).toBe('flying');
		expect(state.vy).toBe(FLAP_VELOCITY);
		expect(state.events).toEqual([{ type: 'flap' }]);
		expect(state.x).toBeGreaterThan(0);
	});

	it('starts with eight gaps before the first refinery', () => {
		const state = createFlamingoState(3);
		expect(gapsLeft(state)).toBe(8);
		expect(currentSegment(state).columns[0].x).toBe(FIRST_COLUMN_X);
	});
});

describe('collision', () => {
	const segment = segmentWith({
		columns: [
			{ x: 200, gapTop: 150, gapBottom: 350, kind: 'radar' },
			{ x: 500, gapTop: 150, gapBottom: 350, kind: 'pylon' }
		]
	});

	it('detects barrage balloons above and masts or pylons below the gap', () => {
		expect(findContact(segment, 220, 100)).toEqual({ kind: 'column', cause: 'balloon' });
		expect(findContact(segment, 220, 400)).toEqual({ kind: 'column', cause: 'radar' });
		expect(findContact(segment, 520, 400)).toEqual({ kind: 'column', cause: 'pylon' });
		// Touching the edge of a column with the side of the flamingo counts
		expect(findContact(segment, 200 - FLAMINGO_RADIUS + 1, 100)).not.toBeNull();
	});

	it('lets the flamingo through the middle of the gap and in open sky', () => {
		expect(findContact(segment, 220, 250)).toBeNull();
		expect(findContact(segment, 200 + COLUMN_WIDTH / 2, 150 + FLAMINGO_RADIUS + 1)).toBeNull();
		expect(findContact(segment, 350, 100)).toBeNull();
		expect(findContact(segment, 200 - FLAMINGO_RADIUS - 1, 100)).toBeNull();
	});

	it('detects the ground, tanks and the flare stack', () => {
		expect(findContact(segment, 700, GROUND_Y - FLAMINGO_RADIUS)).toEqual({ kind: 'ground' });
		expect(findContact(segment, 1130, GROUND_Y - 112)).toEqual({ kind: 'tank', index: 1 });
		expect(findContact(segment, 1075, GROUND_Y - 190)).toEqual({ kind: 'flare' });
		expect(findContact(segment, 1130, GROUND_Y - 200)).toBeNull();
	});

	it('ignores the tanks of a refinery that was already struck', () => {
		const struck = { ...segment, strike: strikeTank(REFINERY, 1) };
		expect(findContact(struck, 1130, GROUND_Y - 112)).toBeNull();
	});

	it('crashes into a balloon and tumbles to the ground', () => {
		const state = flyingState({ x: 150, y: 100 });
		const events = runUntil(state, (s) => s.phase !== 'flying');
		expect(state.phase).toBe('tumbling');
		expect(state.crash).toBe('balloon');
		expect(events).toContainEqual({ type: 'crash', cause: 'balloon' });

		const after = runUntil(state, (s) => s.phase === 'over');
		expect(after.map((event) => event.type)).toEqual(['landed', 'over']);
		expect(state.y).toBe(GROUND_Y - FLAMINGO_RADIUS);
	});

	it('crashes into the ground when the flamingo never flaps', () => {
		const state = createFlamingoState(9);
		stepFlamingo(state, true);
		runUntil(state, (s) => s.phase !== 'flying');
		expect(state.crash).toBe('ground');
	});

	it('waits a moment on the ground before the run is over', () => {
		const state = flyingState({ x: 700, y: GROUND_Y - 20, vy: 300 });
		runUntil(state, (s) => s.landedSeconds !== null);
		let steps = 0;
		runUntil(
			state,
			(s) => s.phase === 'over',
			() => {
				steps++;
				return true;
			}
		);
		expect(steps * STEP_SECONDS).toBeCloseTo(OVER_DELAY_SECONDS, 1);
		// Flapping does nothing any more
		const before = { ...state };
		stepFlamingo(state, true);
		expect(state.y).toBe(before.y);
		expect(state.events).toEqual([]);
	});
});

describe('gaps and segment progression', () => {
	it('scores points for every gap passed', () => {
		const state = flyingState({ x: 100, y: 250 });
		let sinceTap = TAP_STEPS;
		const events = runUntil(
			state,
			(s) => s.x > 300,
			(s) => {
				const tap = sinceTap >= TAP_STEPS && s.y > 270;
				sinceTap = tap ? 0 : sinceTap + 1;
				return tap;
			}
		);
		expect(state.phase).toBe('flying');
		expect(state.gapsPassed).toBe(1);
		expect(state.score).toBe(GAP_POINTS);
		expect(events.filter((event) => event.type === 'gap')).toHaveLength(1);
		// The last gap of the segment starts the refinery approach
		expect(state.stage).toBe('approach');
		expect(events).toContainEqual({ type: 'approach' });
	});

	it('gives every segment its own layout and a slightly harder gap sequence', () => {
		const first = createSegment(11, 0, 0);
		const second = createSegment(11, 1, 0);
		expect(second.columns).toHaveLength(gapCountFor(1));
		expect(second.columns.length).toBeGreaterThan(first.columns.length);
		const size = (segment: Segment) => segment.columns[0].gapBottom - segment.columns[0].gapTop;
		expect(size(second)).toBeLessThan(size(first));
		expect(second.columns[1].x - second.columns[0].x).toBeLessThan(
			first.columns[1].x - first.columns[0].x
		);
		expect(second.refinery.tanks).not.toEqual(first.refinery.tanks);
		expect(createSegment(11, 1, 0)).toEqual(second);
	});

	it('places the refinery after the last gap of the segment', () => {
		const segment = createSegment(4, 0, FIRST_COLUMN_X);
		const last = segment.columns[segment.columns.length - 1];
		expect(segment.refinery.startX).toBeGreaterThan(last.x + COLUMN_WIDTH + 100);
	});
});

describe('refinery strike', () => {
	function approachState(x: number, y: number, vy = 300): FlamingoState {
		return flyingState({
			x,
			y,
			vy,
			stage: 'approach',
			segments: [segmentWith({ passed: 1 })]
		});
	}

	it('scores a dive onto a tank and starts the next segment', () => {
		const state = approachState(1130, GROUND_Y - 112 - 10);
		stepFlamingo(state, false);
		const strike = state.events.find((event) => event.type === 'strike');
		expect(strike?.type === 'strike' && strike.result.biggestHit).toBe(true);
		const expected = strikeTank(REFINERY, 1).points;
		expect(state.score).toBe(expected);
		expect(state.refineriesStruck).toBe(1);
		expect(state.tanksDestroyed).toBe(3);

		expect(state.phase).toBe('flying');
		expect(state.stage).toBe('gaps');
		expect(state.vy).toBe(STRIKE_BOUNCE_VELOCITY);
		expect(state.segments).toHaveLength(2);
		const next = currentSegment(state);
		expect(next.index).toBe(1);
		expect(next.columns).toHaveLength(gapCountFor(1));
		expect(next.columns[0].x).toBeGreaterThanOrEqual(REFINERY.endX + NEXT_SEGMENT_CLEARANCE);
		expect(gapsLeft(state)).toBe(gapCountFor(1));
	});

	it('scores less for a smaller tank', () => {
		const state = approachState(1210, GROUND_Y - 54 - 10);
		stepFlamingo(state, false);
		expect(state.score).toBe(strikeTank(REFINERY, 2).points);
		expect(state.score).toBeLessThan(strikeTank(REFINERY, 1).points);
		expect(state.tanksDestroyed).toBe(1);
	});

	it('tumbles into the ground on a miss, without any points', () => {
		const state = approachState(1240, GROUND_Y - 30);
		runUntil(state, (s) => s.phase !== 'flying');
		expect(state.crash).toBe('missed');
		expect(state.score).toBe(0);
		expect(state.refineriesStruck).toBe(0);
	});

	it('crashes on the flare stack', () => {
		const state = approachState(1060, GROUND_Y - 190, 0);
		runUntil(state, (s) => s.phase !== 'flying');
		expect(state.crash).toBe('flare');
	});

	it('counts flying past the refinery as a miss', () => {
		const state = approachState(REFINERY.endX, 150, FLAP_VELOCITY);
		runUntil(
			state,
			(s) => s.phase !== 'flying',
			(s) => s.y > 150
		);
		expect(state.crash).toBe('overshoot');
		expect(state.x - FLAMINGO_RADIUS).toBeGreaterThan(REFINERY.endX + OVERSHOOT_MARGIN);
	});

	it('predicts which tank a dive starting now would hit', () => {
		const state = approachState(1100, GROUND_Y - 200, 0);
		expect(predictDive(state)).toEqual({ kind: 'tank', index: 1 });
		expect(predictDive(approachState(1245, GROUND_Y - 24, 0))).toEqual({ kind: 'ground' });
		// Too late to dive from high up: the flamingo would sail past the last tank
		expect(predictDive(approachState(1150, 150, 0))).toEqual({ kind: 'overshoot' });
		// The prediction does not change the state
		expect(state.x).toBe(1100);
	});
});

describe('whole runs', () => {
	it('is deterministic for a given seed and flap sequence', () => {
		const run = () => {
			const state = createFlamingoState(2024);
			runUntil(state, (s) => s.phase === 'over' || s.refineriesStruck >= 2, autopilot(), 20_000);
			return { x: state.x, y: state.y, score: state.score, time: state.time };
		};
		expect(run()).toEqual(run());
	});

	it('can always be flown through three full segments at a human tapping pace', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const state = createFlamingoState(seed * 2654435761);
			const events = runUntil(
				state,
				(s) => (s.phase !== 'flying' && s.phase !== 'ready') || s.refineriesStruck >= 3,
				autopilot(),
				30_000
			);
			if (state.crash) throw new Error(`seed ${seed}: crashed (${state.crash})`);
			expect(state.refineriesStruck).toBe(3);
			const strikes = events.filter((event) => event.type === 'strike');
			expect(strikes.every((event) => event.type === 'strike' && event.result.biggestHit)).toBe(
				true
			);
			expect(state.gapsPassed).toBe(gapCountFor(0) + gapCountFor(1) + gapCountFor(2));
		}
	});
});

import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
	COLUMN_WIDTH,
	EDGE_MARGIN,
	MAX_GAP_COUNT,
	MIN_GAP,
	START_GAP,
	START_GAP_COUNT,
	TAP_INTERVAL_SECONDS,
	bottomRect,
	climbReach,
	dropReach,
	gapCenter,
	gapCountFor,
	gapSizeFor,
	generateGapSequence,
	maxShiftFor,
	spacingFor,
	topRect,
	transitSeconds,
	type GapColumn
} from './gapSequence';
import {
	FLAMINGO_RADIUS,
	FLAP_VELOCITY,
	GROUND_Y,
	MAX_FALL_SPEED,
	SCROLL_SPEED,
	STEP_SECONDS,
	circleHitsRect,
	integrate
} from './physics';

const SEEDS = Array.from({ length: 60 }, (_, index) => index * 7919 + 13);
const SEGMENTS = [0, 1, 2, 3, 4, 6, 9];
const TAP_STEPS = Math.round(TAP_INTERVAL_SECONDS / STEP_SECONDS);

/**
 * Flies from just past column a through column b with a simple, human-paced autopilot: tap
 * (at most four times per second) whenever the flamingo is below a line a little under the
 * center of the next gap. Returns whether it got through without touching anything.
 */
function autopilotTraverses(
	a: GapColumn,
	b: GapColumn,
	startY: number,
	startVy: number,
	justFlapped: boolean
): boolean {
	const r = FLAMINGO_RADIUS;
	const target = gapCenter(b) + 24;
	let body = { y: startY, vy: startVy };
	let sinceTap = justFlapped ? 0 : TAP_STEPS;
	let x = a.x + COLUMN_WIDTH + r;
	const end = b.x + COLUMN_WIDTH + r;
	while (x < end) {
		const tap = sinceTap >= TAP_STEPS && body.y > target;
		body = integrate(body, tap);
		sinceTap = tap ? 0 : sinceTap + 1;
		if (body.y < r) body = { y: r, vy: Math.max(0, body.vy) };
		x += SCROLL_SPEED * STEP_SECONDS;
		if (circleHitsRect(x, body.y, r, topRect(b))) return false;
		if (circleHitsRect(x, body.y, r, bottomRect(b))) return false;
		if (body.y + r >= GROUND_Y) return false;
	}
	return true;
}

describe('gap sequence parameters', () => {
	it('starts with eight gaps per segment and grows to a cap', () => {
		expect(gapCountFor(0)).toBe(START_GAP_COUNT);
		expect(START_GAP_COUNT).toBe(8);
		expect(gapCountFor(1)).toBe(9);
		expect(gapCountFor(50)).toBe(MAX_GAP_COUNT);
	});

	it('starts generous and shrinks the gap size to a fixed minimum', () => {
		expect(gapSizeFor(0, 0)).toBe(START_GAP);
		for (let segment = 0; segment < 12; segment++) {
			for (let index = 1; index < gapCountFor(segment); index++) {
				expect(gapSizeFor(segment, index)).toBeLessThanOrEqual(gapSizeFor(segment, index - 1));
			}
			expect(gapSizeFor(segment + 1, 0)).toBeLessThanOrEqual(gapSizeFor(segment, 0));
		}
		expect(gapSizeFor(20, 13)).toBe(MIN_GAP);
		expect(MIN_GAP).toBeGreaterThan(4 * FLAMINGO_RADIUS);
	});

	it('makes every new segment slightly harder', () => {
		for (let segment = 0; segment < 8; segment++) {
			expect(spacingFor(segment + 1)).toBeLessThanOrEqual(spacingFor(segment));
			expect(gapSizeFor(segment + 1, 0)).toBeLessThanOrEqual(gapSizeFor(segment, 0));
		}
		expect(maxShiftFor(1)).toBeGreaterThan(maxShiftFor(0));
		expect(gapSizeFor(1, 0)).toBeLessThan(gapSizeFor(0, 0));
		expect(spacingFor(1)).toBeLessThan(spacingFor(0));
	});

	it('keeps the allowed shift well inside the physically reachable range', () => {
		for (let segment = 0; segment < 20; segment++) {
			const seconds = transitSeconds(spacingFor(segment));
			expect(seconds).toBeGreaterThan(0.5);
			expect(maxShiftFor(segment)).toBeLessThan(climbReach(seconds));
			expect(maxShiftFor(segment)).toBeLessThan(dropReach(seconds));
		}
	});

	it('bounds reach with the real physics', () => {
		// Climbing needs taps; falling from right after a flap first rises, then drops
		expect(climbReach(1)).toBeGreaterThan(150);
		expect(dropReach(0.2)).toBeLessThan(0);
		expect(dropReach(1)).toBeGreaterThan(150);
		expect(dropReach(1)).toBeLessThan(MAX_FALL_SPEED);
	});
});

describe('generateGapSequence', () => {
	it('is deterministic for a given seed', () => {
		const first = generateGapSequence(createRandom(42), 2, 500);
		const second = generateGapSequence(createRandom(42), 2, 500);
		expect(first).toEqual(second);
		expect(generateGapSequence(createRandom(43), 2, 500)).not.toEqual(first);
	});

	it('lays out columns at the segment spacing with the right gap sizes', () => {
		for (const segment of SEGMENTS) {
			const columns = generateGapSequence(createRandom(7), segment, 1000);
			expect(columns).toHaveLength(gapCountFor(segment));
			columns.forEach((column, index) => {
				expect(column.x).toBe(1000 + index * spacingFor(segment));
				expect(column.gapBottom - column.gapTop).toBe(gapSizeFor(segment, index));
				expect(['radar', 'pylon']).toContain(column.kind);
			});
		}
	});

	it('keeps every gap inside the sky with an obstacle above and below', () => {
		for (const seed of SEEDS) {
			for (const segment of SEGMENTS) {
				for (const column of generateGapSequence(createRandom(seed), segment, 0)) {
					expect(column.gapTop).toBeGreaterThanOrEqual(EDGE_MARGIN);
					expect(column.gapBottom).toBeLessThanOrEqual(GROUND_Y - EDGE_MARGIN);
				}
			}
		}
	});

	it('never shifts consecutive gaps further than the reach bound', () => {
		for (const seed of SEEDS) {
			for (const segment of SEGMENTS) {
				const columns = generateGapSequence(createRandom(seed), segment, 0);
				for (let index = 1; index < columns.length; index++) {
					const shift = Math.abs(gapCenter(columns[index]) - gapCenter(columns[index - 1]));
					expect(shift).toBeLessThanOrEqual(maxShiftFor(segment) + 0.5);
				}
			}
		}
	});

	it('makes every consecutive gap reachable from any position and speed in the previous gap', () => {
		const r = FLAMINGO_RADIUS;
		let pairs = 0;
		for (const seed of SEEDS) {
			for (const segment of SEGMENTS) {
				const columns = generateGapSequence(createRandom(seed), segment, 0);
				for (let index = 1; index < columns.length; index++) {
					const a = columns[index - 1];
					const b = columns[index];
					for (const y of [a.gapTop + r, gapCenter(a), a.gapBottom - r]) {
						for (const vy of [FLAP_VELOCITY, 0, MAX_FALL_SPEED]) {
							const reached = autopilotTraverses(a, b, y, vy, vy === FLAP_VELOCITY);
							if (!reached) {
								throw new Error(
									`seed ${seed}, segment ${segment}, gap ${index}: unreachable from y ${y}, speed ${vy}`
								);
							}
						}
					}
					pairs++;
				}
			}
		}
		expect(pairs).toBeGreaterThan(3_000);
	});
});

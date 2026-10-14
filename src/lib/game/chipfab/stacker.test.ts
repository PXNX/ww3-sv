import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { FIELD_WIDTH, MIN_SUPPLY, START_WIDTH, stackerParams } from './config';
import {
	advanceSlab,
	createStacker,
	dropPoints,
	dropSlab,
	stackedLayers,
	topLayer,
	trimLayer,
	waferOutput,
	type Slab,
	type StackerState
} from './stacker';

const TOLERANCE = 1.5;

describe('trimLayer', () => {
	const top = { left: 30, width: 40 };

	it('keeps only the overlap when dropped to the right', () => {
		const result = trimLayer(top, { left: 38, width: 40 }, TOLERANCE);
		expect(result.kind).toBe('trim');
		expect(result.layer).toEqual({ left: 38, width: 32 });
		expect(result.cut).toEqual({ left: 70, width: 8 });
	});

	it('keeps only the overlap when dropped to the left', () => {
		const result = trimLayer(top, { left: 22, width: 40 }, TOLERANCE);
		expect(result.kind).toBe('trim');
		expect(result.layer).toEqual({ left: 30, width: 32 });
		expect(result.cut).toEqual({ left: 22, width: 8 });
	});

	it('aligns the edges: the new layer never sticks out past the layer below', () => {
		for (const left of [10, 22, 29, 31, 40, 55, 69]) {
			const result = trimLayer(top, { left, width: 40 }, 0.2);
			if (result.layer === null) continue;
			expect(result.layer.left).toBeGreaterThanOrEqual(top.left);
			expect(result.layer.left + result.layer.width).toBeLessThanOrEqual(top.left + top.width);
		}
	});

	it('conserves width: the layer plus the cut equal the dropped layer', () => {
		const result = trimLayer(top, { left: 41, width: 40 }, TOLERANCE);
		expect(result.layer!.width + result.cut!.width).toBeCloseTo(40);
	});

	it('is perfect within the tolerance and snaps to the layer below', () => {
		const result = trimLayer(top, { left: 31.2, width: 40 }, TOLERANCE);
		expect(result.kind).toBe('perfect');
		expect(result.layer).toEqual(top);
		expect(result.cut).toBeNull();
	});

	it('is a trim just outside the tolerance', () => {
		const result = trimLayer(top, { left: 31.6, width: 40 }, TOLERANCE);
		expect(result.kind).toBe('trim');
		expect(result.layer!.width).toBeCloseTo(38.4);
	});

	it('misses when nothing overlaps, also when only touching', () => {
		const apart = trimLayer(top, { left: 80, width: 15 }, TOLERANCE);
		expect(apart.kind).toBe('miss');
		expect(apart.layer).toBeNull();
		expect(apart.cut).toEqual({ left: 80, width: 15 });
		expect(trimLayer(top, { left: 70, width: 15 }, TOLERANCE).kind).toBe('miss');
	});

	it('cuts the larger overhang when the dropped layer is wider on both sides', () => {
		const result = trimLayer({ left: 40, width: 10 }, { left: 38, width: 20 }, 0.1);
		expect(result.layer).toEqual({ left: 40, width: 10 });
		expect(result.cut).toEqual({ left: 50, width: 8 });
	});
});

describe('advanceSlab', () => {
	const slab: Slab = { x: 0, width: 40, dir: 1 };

	it('moves at the given speed', () => {
		expect(advanceSlab(slab, 500, 20).x).toBeCloseTo(10);
	});

	it('bounces off the right end and comes back', () => {
		const range = FIELD_WIDTH - 40;
		const moved = advanceSlab({ x: range - 5, width: 40, dir: 1 }, 1000, 20);
		expect(moved.dir).toBe(-1);
		expect(moved.x).toBeCloseTo(range - 15);
	});

	it('bounces off the left end', () => {
		const moved = advanceSlab({ x: 5, width: 40, dir: -1 }, 1000, 20);
		expect(moved.dir).toBe(1);
		expect(moved.x).toBeCloseTo(15);
	});

	it('stays inside the field after a very long stall', () => {
		let current = slab;
		for (const dt of [10, 333, 100000, 7, 5000000]) {
			current = advanceSlab(current, dt, 73);
			expect(current.x).toBeGreaterThanOrEqual(0);
			expect(current.x + current.width).toBeLessThanOrEqual(FIELD_WIDTH + 1e-9);
		}
	});

	it('does not move when there is no time or no room', () => {
		expect(advanceSlab(slab, 0, 50).x).toBe(0);
		expect(advanceSlab({ x: 0, width: FIELD_WIDTH, dir: 1 }, 100, 50).x).toBe(0);
	});
});

/** A stacker whose sliding layer is placed exactly where the test wants it */
function stackerWith(x: number, overrides: Partial<StackerState> = {}): StackerState {
	const stacker = createStacker(createRandom(1), 1);
	return { ...stacker, slab: { ...stacker.slab, x }, ...overrides };
}

describe('dropSlab', () => {
	const random = createRandom(5);
	const baseLeft = (FIELD_WIDTH - START_WIDTH) / 2;

	it('stacks a trimmed layer and narrows the tower', () => {
		const result = dropSlab(stackerWith(baseLeft + 10), random);
		expect(result.kind).toBe('trim');
		expect(stackedLayers(result.state)).toBe(1);
		expect(topLayer(result.state).width).toBeCloseTo(START_WIDTH - 10);
		// The next sliding layer is as wide as the layer it will land on
		expect(result.state.slab.width).toBeCloseTo(START_WIDTH - 10);
		expect(result.points).toBe(dropPoints('trim', 0));
	});

	it('counts perfect drops and builds a streak', () => {
		let state = stackerWith(baseLeft);
		let result = dropSlab(state, random);
		expect(result.kind).toBe('perfect');
		state = { ...result.state, slab: { ...result.state.slab, x: topLayer(result.state).left } };
		result = dropSlab(state, random);
		expect(result.state.perfects).toBe(2);
		expect(result.state.streak).toBe(2);
		expect(result.points).toBeGreaterThan(dropPoints('trim', 0));
	});

	it('a trim breaks the streak', () => {
		const state = stackerWith(baseLeft + 10, { streak: 4, perfects: 4 });
		const result = dropSlab(state, random);
		expect(result.state.streak).toBe(0);
		expect(result.state.perfects).toBe(4);
	});

	it('lets layers grow back after a streak of perfect drops', () => {
		const narrow = { left: 30, width: 30 };
		const state = stackerWith(30, {
			layers: [narrow],
			slab: { x: 30, width: 30, dir: 1 },
			streak: 1
		});
		const result = dropSlab(state, random);
		expect(result.kind).toBe('perfect');
		expect(topLayer(result.state).width).toBeGreaterThan(30);
		expect(topLayer(result.state).width).toBeLessThanOrEqual(START_WIDTH);
		expect(topLayer(result.state).left).toBeGreaterThanOrEqual(0);
	});

	it('fails the wafer on a complete miss and then ignores further drops', () => {
		const state = stackerWith(0, {
			layers: [{ left: 70, width: 20 }],
			slab: { x: 0, width: 20, dir: 1 }
		});
		const result = dropSlab(state, random);
		expect(result.kind).toBe('miss');
		expect(result.state.status).toBe('failed');
		expect(result.points).toBe(0);
		expect(result.cut).toEqual({ left: 0, width: 20 });
		const again = dropSlab(result.state, random);
		expect(again.state).toBe(result.state);
		expect(stackedLayers(again.state)).toBe(0);
	});

	it('completes the wafer when the target height is reached', () => {
		const state = stackerWith(baseLeft, { target: 1 });
		const result = dropSlab(state, random);
		expect(result.complete).toBe(true);
		expect(result.state.status).toBe('complete');
	});

	it('is deterministic for a seed', () => {
		const a = createStacker(createRandom(99), 3);
		const b = createStacker(createRandom(99), 3);
		expect(a).toEqual(b);
	});
});

describe('waferOutput', () => {
	it('gives the minimum supply for a wafer that fell at once', () => {
		const output = waferOutput(createStacker(createRandom(1), 1));
		expect(output.supply).toBe(MIN_SUPPLY);
		expect(output.quality).toBe(0);
	});

	it('rewards layers and perfect drops', () => {
		const base = createStacker(createRandom(1), 1);
		const layers = Array.from({ length: 11 }, () => ({ left: 30, width: 40 }));
		const plain = waferOutput({ ...base, layers });
		const perfect = waferOutput({ ...base, layers, perfects: 10 });
		expect(plain.supply).toBe(40);
		expect(perfect.supply).toBe(80);
		expect(perfect.quality).toBe(1);
	});
});

describe('stackerParams', () => {
	it('gets harder with the level but stays bounded', () => {
		const first = stackerParams(1);
		const later = stackerParams(6);
		expect(later.speed).toBeGreaterThan(first.speed);
		expect(later.tolerance).toBeLessThan(first.tolerance);
		expect(later.layers).toBeGreaterThan(first.layers);
		const extreme = stackerParams(500);
		expect(extreme.speed).toBeLessThanOrEqual(95);
		expect(extreme.tolerance).toBeGreaterThanOrEqual(1);
		expect(extreme.layers).toBeLessThanOrEqual(14);
	});
});

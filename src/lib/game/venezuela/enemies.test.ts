import { describe, expect, it } from 'vitest';
import { JUMPER_PERIOD, STEP } from './config';
import {
	HELI_CLIMB_AT,
	HELI_CYCLE,
	HELI_DIVE_AT,
	HELI_DIVE_DEPTH,
	HELI_HOLD_AT,
	HELI_RANGE,
	HELI_TELEGRAPH_AT,
	createHelicopter,
	createWalker,
	helicopterAt,
	helicopterBox,
	helicopterSweepBox,
	stepWalker
} from './enemies';
import { levelFrom } from './testLevel';

const FLOOR = '####################';

function run(
	walker: ReturnType<typeof createWalker>,
	level: ReturnType<typeof levelFrom>,
	seconds: number
) {
	const xs: number[] = [];
	for (let i = 0; i < seconds / STEP; i++) {
		stepWalker(walker, level);
		xs.push(walker.x);
	}
	return xs;
}

describe('goon patrol', () => {
	it('settles onto the ground and walks', () => {
		const level = levelFrom(['.....e..............', FLOOR, FLOOR]);
		const goon = createWalker(0, 'goon', { x: 5, y: 7 });
		const xs = run(goon, level, 1);
		expect(goon.onGround).toBe(true);
		expect(xs[xs.length - 1]).toBeLessThan(xs[0]);
	});

	it('turns around at a wall', () => {
		// Wall (crate) at column 3, rows 6 and 7; the goon starts at column 8 walking left
		const level = levelFrom(['...W................', '...W................', FLOOR, FLOOR]);
		const goon = createWalker(0, 'goon', { x: 8, y: 7 });
		const xs = run(goon, level, 6);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(4 - 1e-3);
		// It came back: walking right at the end or at some point
		expect(xs[xs.length - 1]).toBeGreaterThan(Math.min(...xs));
	});

	it('turns around at an edge instead of falling off', () => {
		// Ground only from column 4 to 11
		const level = levelFrom([
			'....e...............',
			'....########........',
			'....########........'
		]);
		const goon = createWalker(0, 'goon', { x: 8, y: 7 });
		const xs = run(goon, level, 20);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(3.9);
		expect(Math.max(...xs) + goon.w).toBeLessThanOrEqual(12.1);
		expect(goon.y + goon.h).toBeCloseTo(8, 1);
	});

	it('turns around in front of a barricade', () => {
		const level = levelFrom(
			['....................', '.....^..............', FLOOR, FLOOR].slice(0, 4)
		);
		const goon = createWalker(0, 'goon', { x: 9, y: 7 });
		const xs = run(goon, level, 8);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(5.9);
	});

	it('keeps a constant walking speed', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const goon = createWalker(0, 'goon', { x: 15, y: 7 });
		stepWalker(goon, level);
		const before = goon.x;
		stepWalker(goon, level);
		expect(Math.abs(goon.x - before)).toBeCloseTo(1.6 * STEP, 3);
	});

	it('a stomped goon stops and only counts up its squash timer', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const goon = createWalker(0, 'goon', { x: 10, y: 7 });
		stepWalker(goon, level);
		goon.alive = false;
		const x = goon.x;
		for (let i = 0; i < 10; i++) stepWalker(goon, level);
		expect(goon.x).toBe(x);
		expect(goon.squashed).toBeCloseTo(10 * STEP, 5);
	});
});

describe('hopping goon', () => {
	it('hops about once per period and comes back down', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const jumper = createWalker(0, 'jumper', { x: 10, y: 7 });
		let hops = 0;
		let wasGround = true;
		let highest = jumper.y;
		for (let i = 0; i < (JUMPER_PERIOD * 3.5) / STEP; i++) {
			stepWalker(jumper, level);
			if (wasGround && !jumper.onGround && jumper.vy < 0) hops++;
			wasGround = jumper.onGround;
			highest = Math.min(highest, jumper.y);
		}
		expect(hops).toBe(3);
		expect(highest).toBeLessThan(6.5);
		expect(jumper.y + jumper.h).toBeLessThanOrEqual(8.01);
	});

	it('never hops while stomped', () => {
		const level = levelFrom([FLOOR, FLOOR]);
		const jumper = createWalker(0, 'jumper', { x: 10, y: 7 });
		stepWalker(jumper, level);
		jumper.alive = false;
		for (let i = 0; i < (JUMPER_PERIOD * 2) / STEP; i++) stepWalker(jumper, level);
		expect(jumper.vy).toBeLessThanOrEqual(1);
	});
});

describe('helicopter pattern', () => {
	const heli = createHelicopter(0, { x: 20, y: 3 });
	const base = { ...heli, phase: 0 };

	it('starts centered on its spot', () => {
		expect(base.x).toBe(20.5);
		expect(base.y).toBe(3.5);
	});

	it('sweeps sideways within its range, both ways', () => {
		const xs: number[] = [];
		for (let t = 0; t < 12; t += 0.05) xs.push(helicopterAt(base, t).x);
		expect(Math.max(...xs)).toBeGreaterThan(base.x + HELI_RANGE - 0.3);
		expect(Math.min(...xs)).toBeLessThan(base.x - HELI_RANGE + 0.3);
		expect(Math.max(...xs)).toBeLessThanOrEqual(base.x + HELI_RANGE + 0.1);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(base.x - HELI_RANGE - 0.1);
	});

	it('goes through sweep, telegraph, dive and climb in order every cycle', () => {
		expect(helicopterAt(base, 1).mode).toBe('sweep');
		expect(helicopterAt(base, (HELI_TELEGRAPH_AT + HELI_DIVE_AT) / 2).mode).toBe('telegraph');
		expect(helicopterAt(base, (HELI_DIVE_AT + HELI_HOLD_AT) / 2).mode).toBe('dive');
		expect(helicopterAt(base, (HELI_CLIMB_AT + HELI_CYCLE) / 2).mode).toBe('climb');
		expect(helicopterAt(base, HELI_CYCLE + 1).mode).toBe('sweep');
	});

	it('dives by its full depth and is back up by the end of the cycle', () => {
		const level = (t: number) => helicopterAt(base, t).y;
		const bobTolerance = 0.2;
		expect(level(HELI_HOLD_AT + 0.1) - base.y).toBeGreaterThan(HELI_DIVE_DEPTH - bobTolerance);
		expect(Math.abs(level(HELI_CYCLE + 0.01) - base.y)).toBeLessThan(bobTolerance + 0.01);
		expect(Math.abs(level(1) - base.y)).toBeLessThan(bobTolerance);
	});

	it('shakes while telegraphing, without diving yet, so the swoop can be seen coming', () => {
		const pure = (t: number) => base.x + base.range * Math.sin((2 * Math.PI * t) / base.period);
		let shake = 0;
		for (let t = HELI_TELEGRAPH_AT + 0.01; t < HELI_DIVE_AT - 0.01; t += 0.02) {
			const position = helicopterAt(base, t);
			shake = Math.max(shake, Math.abs(position.x - pure(t)));
			expect(position.y - base.y).toBeLessThan(0.2);
		}
		expect(shake).toBeGreaterThan(0.03);
		expect(Math.abs(helicopterAt(base, 2).x - pure(2))).toBe(0);
	});

	it('is deterministic: the same time always gives the same place', () => {
		expect(helicopterAt(base, 7.3)).toEqual(helicopterAt(base, 7.3));
	});

	it('gives neighbouring helicopters different phases', () => {
		const other = createHelicopter(1, { x: 25, y: 3 });
		expect(other.phase).not.toBe(heli.phase);
	});

	it('hurts with a box around its position, and the sweep box contains every position', () => {
		const sweep = helicopterSweepBox(base);
		for (let t = 0; t < 12; t += 0.1) {
			const box = helicopterBox(helicopterAt(base, t));
			expect(box.x).toBeGreaterThanOrEqual(sweep.x - 0.1);
			expect(box.x + box.w).toBeLessThanOrEqual(sweep.x + sweep.w + 0.1);
			expect(box.y).toBeGreaterThanOrEqual(sweep.y - 0.05);
			expect(box.y + box.h).toBeLessThanOrEqual(sweep.y + sweep.h + 0.05);
		}
	});
});

import { describe, expect, it } from 'vitest';
import {
	approach,
	criticalDamping,
	easeOutBack,
	easeOutCubic,
	Particles,
	Popups,
	springStep
} from './fx.js';

function settle(stiffness: number, damping: number): { peak: number; end: number } {
	let pos = 0;
	let vel = 0;
	let peak = 0;
	for (let i = 0; i < 600; i++) {
		[pos, vel] = springStep(pos, vel, 10, stiffness, damping, 1 / 60);
		peak = Math.max(peak, pos);
	}
	return { peak, end: pos };
}

describe('Falklands fx maths', () => {
	it('settles an underdamped spring on its target with a small overshoot', () => {
		const { peak, end } = settle(40, 9);
		expect(end).toBeCloseTo(10, 2);
		expect(peak).toBeGreaterThan(10);
		expect(peak).toBeLessThan(11.5);
	});

	it('does not overshoot with critical damping', () => {
		const { peak, end } = settle(80, criticalDamping(80));
		expect(end).toBeCloseTo(10, 2);
		expect(peak).toBeLessThanOrEqual(10.01);
	});

	it('eases from 0 to 1', () => {
		expect(easeOutBack(0)).toBeCloseTo(0, 5);
		expect(easeOutBack(1)).toBeCloseTo(1, 5);
		expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
		expect(approach(0, 10, 4, 10)).toBeCloseTo(10, 3);
	});

	it('keeps the particle pool capped and lets particles expire', () => {
		const pool = new Particles(5);
		for (let i = 0; i < 20; i++) pool.spawn({ x: 0, y: 0, color: '#fff', life: 0.3, vx: 10 });
		expect(pool.list).toHaveLength(5);
		pool.update(0.1);
		expect(pool.list[0].x).toBeGreaterThan(0);
		pool.update(0.5);
		expect(pool.list).toHaveLength(0);
	});

	it('stacks overlapping popups and removes them after their life', () => {
		const popups = new Popups();
		popups.add(50, 100, 'a', '#fff');
		popups.add(52, 100, 'b', '#fff');
		expect(popups.list[1].y).toBeLessThan(popups.list[0].y);
		popups.update(2);
		expect(popups.list).toHaveLength(0);
	});
});

import { describe, expect, it } from 'vitest';
import { burst, pushHeadline, springStep, stepParticles } from './fx.js';

describe('War Room effects', () => {
	it('bursts with a kind-specific number of particles around the origin', () => {
		const particles = burst('capture', 40, 30, () => 0.5);
		expect(particles).toHaveLength(26);
		expect(particles.every((p) => p.x === 40 && p.y === 30 && p.life === p.span)).toBe(true);
	});

	it('pulls particles down, slows them and drops the dead ones', () => {
		const [first] = burst('held', 0, 0, () => 0.5);
		const [next] = stepParticles([{ ...first, vx: 10, vy: 0 }], 0.1);
		expect(next.x).toBeGreaterThan(0);
		expect(next.vx).toBeLessThan(10);
		expect(next.vy).toBeGreaterThan(0);
		expect(stepParticles([{ ...first, life: 0.05 }], 0.1)).toEqual([]);
	});

	it('settles a spring on its target and overshoots on the way', () => {
		let state = { value: 0, velocity: 0 };
		let peak = 0;
		for (let step = 0; step < 600; step++) {
			state = springStep(state.value, state.velocity, 100, 1 / 60);
			peak = Math.max(peak, state.value);
		}
		expect(peak).toBeGreaterThan(100);
		expect(state.value).toBeCloseTo(100, 1);
	});

	it('keeps the newest headlines first and caps the list', () => {
		let list: ReturnType<typeof pushHeadline> = [];
		for (let id = 1; id <= 15; id++) list = pushHeadline(list, { id, text: 'x', tone: 'neutral' });
		expect(list).toHaveLength(12);
		expect(list[0].id).toBe(15);
	});
});

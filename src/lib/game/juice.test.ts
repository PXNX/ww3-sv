import { describe, expect, it } from 'vitest';
import {
	makeBurst,
	makeFloat,
	rng,
	stepFloats,
	stepParticles,
	stepShake,
	type Particle
} from './juice.js';

const bounds = { width: 400, height: 800, floor: 600 };

describe('juice physics', () => {
	it('makes a reproducible burst', () => {
		let next = 0;
		const id = () => ++next;
		const a = makeBurst(id, 100, 200, 'spark', 6, rng(42));
		next = 0;
		const b = makeBurst(id, 100, 200, 'spark', 6, rng(42));
		expect(a.map((p) => [p.x, p.y, p.vx, p.color])).toEqual(
			b.map((p) => [p.x, p.y, p.vx, p.color])
		);
		expect(a).toHaveLength(6);
		expect(a.every((p) => p.x === 100 && p.y === 200)).toBe(true);
		expect(a.every((p) => p.life > 0)).toBe(true);
	});

	it('pulls sparks down and lets smoke rise', () => {
		let next = 0;
		const id = () => ++next;
		const spark = makeBurst(id, 100, 200, 'spark', 1, rng(1))[0];
		const smoke = makeBurst(id, 100, 200, 'smoke', 1, rng(1))[0];
		spark.vx = smoke.vx = 0;
		spark.vy = smoke.vy = 0;
		stepParticles([spark], 0.1, bounds);
		stepParticles([smoke], 0.1, bounds);
		expect(spark.y).toBeGreaterThan(200);
		expect(smoke.y).toBeLessThan(200);
	});

	it('bounces off the floor and loses energy', () => {
		const p: Particle = {
			id: 1,
			x: 50,
			y: 599,
			vx: 60,
			vy: 200,
			life: 1,
			maxLife: 1,
			size: 5,
			color: '#fff',
			spin: 0,
			angle: 0,
			shape: 'spark'
		};
		const [bounced] = stepParticles([p], 0.1, bounds);
		expect(bounced.y).toBeLessThanOrEqual(bounds.floor);
		expect(bounced.vy).toBeLessThan(200);
		expect(bounced.vx).toBeLessThan(60);
	});

	it('retires particles and score numbers when their life runs out', () => {
		const particle = makeBurst(() => 1, 0, 0, 'spark', 1, rng(3))[0];
		const float = makeFloat(() => 2, 0, 0, '+100');
		expect(stepParticles([particle], 2, bounds)).toEqual([]);
		expect(stepFloats([float], 2)).toEqual([]);
	});

	it('floats score numbers upwards and decays the shake to nothing', () => {
		const float = makeFloat(() => 1, 10, 100, '+10');
		stepFloats([float], 0.2);
		expect(float.y).toBeLessThan(100);
		let shake = { amplitude: 8, x: 0, y: 0 };
		for (let i = 0; i < 20; i++) shake = stepShake(shake, 0.05, i * 50);
		expect(shake.amplitude).toBe(0);
		expect(shake.x).toBe(0);
	});
});

import { describe, expect, it } from 'vitest';
import { createPhysicsWorld } from './physics.js';

describe('shared physics world', () => {
	it('falls onto the ground and settles to rest', () => {
		const physics = createPhysicsWorld({ seed: 7 });
		physics.addGround(0);
		const box = physics.addBox(0, 8, 2, 2, { friction: 0.8, restitution: 0.05 });
		const start = box.body.getPosition().y;
		for (let i = 0; i < 300; i++) physics.step(1000 / 60);
		const position = box.body.getPosition();
		expect(position.y).toBeLessThan(start);
		expect(position.y).toBeCloseTo(1, 1);
		expect(Math.abs(box.body.getLinearVelocity().y)).toBeLessThan(0.1);
		expect(box.body.isAwake()).toBe(false);
		physics.destroy();
	});

	it('advances with a fixed step regardless of frame rate', () => {
		function run(frames: number, ms: number) {
			const physics = createPhysicsWorld();
			const ball = physics.addCircle(0, 10, 1);
			for (let i = 0; i < frames; i++) physics.step(ms);
			const y = ball.body.getPosition().y;
			physics.destroy();
			return y;
		}
		// One second of simulated time at 60 Hz and at 30 Hz lands in the same place
		expect(run(60, 1000 / 60)).toBeCloseTo(run(30, 1000 / 30), 5);
	});

	it('clamps catch-up work after a long pause', () => {
		const physics = createPhysicsWorld({ stepSeconds: 1 / 60, maxSteps: 3 });
		expect(physics.step(5000)).toBe(3);
		expect(physics.step(1000 / 60)).toBe(1);
		physics.destroy();
	});

	it('removes bodies and provides repeatable random values', () => {
		const physics = createPhysicsWorld({ seed: 99 });
		const a = physics.addBox(0, 0, 1, 1);
		physics.addBox(2, 0, 1, 1);
		expect(physics.bodies).toHaveLength(2);
		physics.remove(a);
		expect(physics.bodies).toHaveLength(1);
		const first = physics.random();
		const other = createPhysicsWorld({ seed: 99 });
		expect(other.random()).toBe(first);
		physics.destroy();
		other.destroy();
	});
});

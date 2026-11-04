import { describe, expect, it } from 'vitest';
import { GROUND_Y, TARGETS } from './config.js';
import {
	createFx,
	fieldFx,
	flashScreen,
	impactFx,
	interceptFx,
	launchFx,
	MAX_PARTICLES,
	shakeScreen,
	splashFx,
	stepFx,
	trailFx,
	WOBBLE_MS,
	wobbleBuilding
} from './fx.js';

/** A seeded random, so a test can rely on the same spread of particles every run */
function seeded(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

const STEP = 1000 / 60;

function run(fx: ReturnType<typeof createFx>, ms: number) {
	for (let t = 0; t < ms; t += STEP) stepFx(fx, STEP);
}

describe('createFx', () => {
	it('starts empty, at rest and with one wobble slot per building', () => {
		const fx = createFx();
		expect(fx.particles).toEqual([]);
		expect(fx.rings).toEqual([]);
		expect(fx.recoil).toBe(0);
		expect(fx.shakeMs).toBe(0);
		expect(fx.wobble).toHaveLength(TARGETS.length);
		expect(fx.wobble.every((left) => left === 0)).toBe(true);
	});
});

describe('particles', () => {
	it('throws sparks, smoke and a ring from an intercept', () => {
		const fx = createFx();
		interceptFx(fx, 320, 200, true, seeded(3));
		expect(fx.particles.length).toBeGreaterThan(10);
		expect(fx.particles.some((p) => p.kind === 'spark')).toBe(true);
		expect(fx.particles.some((p) => p.kind === 'smoke')).toBe(true);
		expect(fx.rings).toHaveLength(1);
	});

	it('makes fewer particles and no shake or flash with reduced motion', () => {
		const fast = createFx();
		const calm = createFx(true);
		interceptFx(fast, 320, 200, true, seeded(1));
		interceptFx(calm, 320, 200, true, seeded(1));
		expect(calm.particles.length).toBeLessThan(fast.particles.length);
		expect(fast.shakeStrength).toBeGreaterThan(0);
		expect(calm.shakeStrength).toBe(0);
		flashScreen(calm);
		impactFx(calm, 320, 300, 2, seeded(2));
		expect(calm.flashMs).toBe(0);
	});

	it('pulls debris down with gravity and lands it on the grass', () => {
		const fx = createFx();
		impactFx(fx, 300, 250, 2, seeded(4));
		const debris = fx.particles.find((p) => p.kind === 'debris')!;
		const startY = debris.y;
		run(fx, 300);
		expect(debris.y).toBeGreaterThan(startY);
	});

	it('bounces debris off the land but lets it sink in the water', () => {
		const fx = createFx();
		const debris = {
			kind: 'debris' as const,
			x: 400,
			y: GROUND_Y - 2,
			vx: 20,
			vy: 120,
			gravity: 360,
			drag: 0,
			ageMs: 0,
			lifeMs: 5000,
			size: 3,
			grow: 0,
			rot: 0,
			vr: 0,
			color: '#3a3f47'
		};
		fx.particles.push({ ...debris });
		stepFx(fx, STEP);
		expect(fx.particles[0].vy).toBeLessThan(0);

		fx.particles = [{ ...debris, x: 40 }];
		stepFx(fx, STEP);
		expect(fx.particles).toHaveLength(0);
	});

	it('lets smoke spread as it rises and clears every particle with time', () => {
		const fx = createFx();
		trailFx(fx, 300, 200, 'rocket', seeded(5));
		const smoke = fx.particles.find((p) => p.kind === 'smoke')!;
		const size = smoke.size;
		const y = smoke.y;
		run(fx, 200);
		expect(smoke.size).toBeGreaterThan(size);
		expect(smoke.y).toBeLessThan(y + 1);
		run(fx, 4000);
		expect(fx.particles).toHaveLength(0);
		expect(fx.rings).toHaveLength(0);
	});

	it('caps the pool so a busy wave cannot choke the canvas', () => {
		const fx = createFx();
		const random = seeded(6);
		for (let i = 0; i < 60; i++) impactFx(fx, 300, 250, 2, random);
		expect(fx.particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
	});

	it('throws water up from the sea and grass from the field', () => {
		const sea = createFx();
		splashFx(sea, 60, GROUND_Y, 1, seeded(7));
		expect(sea.particles.every((p) => p.kind === 'drop')).toBe(true);

		const field = createFx();
		fieldFx(field, 560, GROUND_Y, seeded(8));
		expect(field.particles.some((p) => p.kind === 'debris')).toBe(true);
	});
});

describe('the battery and the camera', () => {
	it('kicks the battery down and springs it back to rest', () => {
		const fx = createFx();
		launchFx(fx, 326, 314, -0.4, seeded(9));
		expect(fx.recoilV).toBeGreaterThan(0);
		stepFx(fx, STEP);
		expect(fx.recoil).toBeGreaterThan(0);
		run(fx, 2000);
		expect(Math.abs(fx.recoil)).toBeLessThan(0.5);
		expect(Math.abs(fx.recoilV)).toBeLessThan(5);
	});

	it('shakes, flashes, wobbles a building and then calms down', () => {
		const fx = createFx();
		shakeScreen(fx, 10, 300);
		flashScreen(fx, 160);
		wobbleBuilding(fx, 2);
		expect(fx.shakeStrength).toBe(10);
		expect(fx.flashMs).toBe(160);
		expect(fx.wobble[2]).toBe(WOBBLE_MS);

		run(fx, WOBBLE_MS + 200);
		expect(fx.shakeMs).toBe(0);
		expect(fx.shakeStrength).toBe(0);
		expect(fx.flashMs).toBe(0);
		expect(fx.wobble[2]).toBe(0);
	});

	it('ignores a wobble for a building that does not exist', () => {
		const fx = createFx();
		wobbleBuilding(fx, null);
		wobbleBuilding(fx, TARGETS.length + 3);
		expect(fx.wobble.every((left) => left === 0)).toBe(true);
	});
});

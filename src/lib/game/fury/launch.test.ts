import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { FuryWorld } from './furyWorld';
import {
	DEFAULT_AIM,
	MAX_ANGLE,
	MAX_LAUNCH_SPEED,
	MAX_PULL,
	MIN_ANGLE,
	POUCH,
	PREVIEW_SECONDS,
	STEP_SECONDS,
	adjustAim,
	aimFromPull,
	ballisticPosition,
	clampAngle,
	launchVelocity,
	previewSeconds,
	pullFromAim,
	trajectoryPoints
} from './launch';
import type { LevelData } from './levels/schema';

const deg = (degrees: number) => (degrees * Math.PI) / 180;

describe('aiming', () => {
	it('launches opposite to the pull, with power growing with the pull length', () => {
		const aim = aimFromPull({ x: -MAX_PULL / 2, y: 0 });
		expect(aim.angle).toBeCloseTo(0);
		expect(aim.power).toBeCloseTo(0.5);

		const upwards = aimFromPull({ x: -1, y: -1 });
		expect(upwards.angle).toBeCloseTo(deg(45));
	});

	it('caps the power at a full pull', () => {
		expect(aimFromPull({ x: -MAX_PULL * 3, y: 0 }).power).toBe(1);
	});

	it('gives zero power for no pull', () => {
		expect(aimFromPull({ x: 0, y: 0 }).power).toBe(0);
	});

	it('keeps the angle inside the allowed range, snapping to the nearer end', () => {
		expect(clampAngle(deg(30))).toBeCloseTo(deg(30));
		expect(clampAngle(deg(120))).toBe(MAX_ANGLE);
		expect(clampAngle(deg(-80))).toBe(MIN_ANGLE);
		// Pulling forwards (launching backwards) snaps to the steepest angle
		expect(aimFromPull({ x: 1, y: 0.2 }).angle).toBe(MAX_ANGLE);
	});

	it('turns an aim back into the same pull', () => {
		const aim = { angle: deg(27), power: 0.63 };
		const back = aimFromPull(pullFromAim(aim));
		expect(back.angle).toBeCloseTo(aim.angle);
		expect(back.power).toBeCloseTo(aim.power);
	});

	it('scales the launch speed with power and the bird speed factor', () => {
		const full = launchVelocity({ angle: 0, power: 1 });
		expect(full.x).toBeCloseTo(MAX_LAUNCH_SPEED);
		expect(full.y).toBeCloseTo(0);
		const slow = launchVelocity({ angle: deg(60), power: 0.5 }, 0.8);
		expect(Math.hypot(slow.x, slow.y)).toBeCloseTo(MAX_LAUNCH_SPEED * 0.4);
	});

	it('adjusts the aim by keyboard steps and clamps both values', () => {
		expect(adjustAim(DEFAULT_AIM, deg(5), 0.1).angle).toBeCloseTo(DEFAULT_AIM.angle + deg(5));
		expect(adjustAim({ angle: MAX_ANGLE, power: 1 }, deg(10), 0.5)).toEqual({
			angle: MAX_ANGLE,
			power: 1
		});
		expect(adjustAim({ angle: MIN_ANGLE, power: 0 }, -deg(10), -0.5)).toEqual({
			angle: MIN_ANGLE,
			power: 0
		});
	});
});

describe('trajectory preview', () => {
	const start = { x: 3, y: 2 };
	const velocity = { x: 10, y: 8 };

	it('stays close to the ideal parabola', () => {
		const points = trajectoryPoints(start, velocity, 1, 1);
		expect(points).toHaveLength(60);
		const last = points[points.length - 1];
		const ideal = ballisticPosition(start, velocity, 1);
		expect(last.x).toBeCloseTo(ideal.x, 6);
		// Semi-implicit Euler is off from the exact curve by g * t * dt / 2
		expect(Math.abs(last.y - ideal.y)).toBeLessThan(0.1);
	});

	it('reaches further with the accessibility setting', () => {
		expect(previewSeconds(false)).toBe(PREVIEW_SECONDS.normal);
		expect(previewSeconds(true)).toBe(PREVIEW_SECONDS.long);
		const short = trajectoryPoints(start, velocity, previewSeconds(false));
		const long = trajectoryPoints(start, velocity, previewSeconds(true));
		expect(long.length).toBeGreaterThan(short.length * 2);
		expect(long.slice(0, short.length)).toEqual(short);
	});

	it('matches the physics engine step for step', () => {
		// An empty field with one far-away dome, so nothing is in the bird's way
		const level: LevelData = {
			version: 1,
			id: 'level-99',
			width: 30,
			birds: ['flamingo'],
			blocks: [],
			domes: [{ x: 29, y: 0, size: 1 }]
		};
		const world = new FuryWorld(level, createRandom(1));
		const launch = launchVelocity({ angle: deg(40), power: 0.8 });
		const bird = world.launch('flamingo', launch);
		const expected = trajectoryPoints(POUCH, launch, 30 * STEP_SECONDS, 1);
		for (const point of expected) {
			world.step();
			const position = bird.body.getPosition();
			expect(position.x).toBeCloseTo(point.x, 6);
			expect(position.y).toBeCloseTo(point.y, 6);
		}
	});
});

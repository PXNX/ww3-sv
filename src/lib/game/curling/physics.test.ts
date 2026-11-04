import { describe, expect, it } from 'vitest';
import { HACK, HOUSE, MAX_ANGLE, SHEET_BACK, STONE_R } from './config';
import {
	clampAngle,
	collideObstacle,
	collideStones,
	launchVelocity,
	onSheet,
	predictPath,
	stepStone,
	trimPath
} from './physics';

const calm = { wind: 0, drift: null, sweeping: false };

function slide(
	power: number,
	options: { sweeping?: boolean; spin?: number; angle?: number; wind?: number } = {}
) {
	const { vx, vy } = launchVelocity(options.angle ?? 0, power);
	const stone = { x: HACK.x, y: HACK.y, vx, vy, spin: options.spin ?? 1 };
	let steps = 0;
	while (steps < 60 * 30 && onSheet(stone)) {
		const moving = stepStone(stone, 1 / 60, {
			wind: options.wind ?? 0,
			drift: null,
			sweeping: options.sweeping ?? false
		});
		steps++;
		if (!moving) break;
	}
	return { stone, seconds: steps / 60 };
}

describe('stone sliding', () => {
	it('slows down and stops with friction', () => {
		const { stone, seconds } = slide(0.4);
		expect(stone.vx).toBe(0);
		expect(stone.vy).toBe(0);
		expect(seconds).toBeGreaterThan(1);
	});

	it('reaches the house at a medium throw and overshoots the back of the sheet at full power', () => {
		const medium = slide(0.66).stone;
		expect(Math.abs(medium.y - HOUSE.y)).toBeLessThan(40);
		expect(slide(1).stone.y).toBeLessThan(SHEET_BACK);
	});

	it('goes further when it is swept', () => {
		const plain = slide(0.5).stone;
		const swept = slide(0.5, { sweeping: true }).stone;
		expect(swept.y).toBeLessThan(plain.y - 40);
	});

	it('curls to the right with positive spin and to the left with negative spin', () => {
		expect(slide(0.62, { spin: 1 }).stone.x).toBeGreaterThan(HACK.x + 30);
		expect(slide(0.62, { spin: -1 }).stone.x).toBeLessThan(HACK.x - 30);
	});

	it('curls less when swept', () => {
		const plain = Math.abs(slide(0.62, { spin: 1 }).stone.x - HACK.x);
		const swept = Math.abs(slide(0.62, { spin: 1, sweeping: true }).stone.x - HACK.x);
		expect(swept).toBeLessThan(plain);
	});

	it('is pushed along by the wind', () => {
		const plain = slide(0.62, { spin: 1 }).stone.x;
		expect(slide(0.62, { spin: 1, wind: 6 }).stone.x).toBeGreaterThan(plain + 10);
		expect(slide(0.62, { spin: 1, wind: -6 }).stone.x).toBeLessThan(plain - 10);
	});

	it('throws at an angle clamped to the allowed range', () => {
		expect(clampAngle(90)).toBe(MAX_ANGLE);
		expect(launchVelocity(20, 0.5).vx).toBeGreaterThan(0);
		expect(launchVelocity(-20, 0.5).vx).toBeLessThan(0);
	});
});

describe('collisions', () => {
	it('passes momentum between equal stones', () => {
		const a = { x: 0, y: 0, vx: 0, vy: -100 };
		const b = { x: 0, y: -STONE_R * 2 + 2, vx: 0, vy: 0 };
		const strength = collideStones(a, b, 0.92);
		expect(strength).toBeGreaterThan(0.5);
		expect(b.vy).toBeLessThan(-80);
		expect(Math.abs(a.vy)).toBeLessThan(10);
		expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(STONE_R * 2 - 0.001);
	});

	it('ignores stones that are apart or already separating', () => {
		expect(collideStones({ x: 0, y: 0, vx: 0, vy: 0 }, { x: 40, y: 0, vx: 0, vy: 0 }, 1)).toBe(0);
		const a = { x: 0, y: 0, vx: -10, vy: 0 };
		const b = { x: 15, y: 0, vx: 10, vy: 0 };
		expect(collideStones(a, b, 1)).toBe(0);
	});

	it('bounces a stone off a seal and pushes it out of the seal', () => {
		const stone = { x: 0, y: 20, vx: 0, vy: -80 };
		const strength = collideObstacle(stone, { x: 0, y: 0 }, 16, 0.6);
		expect(strength).toBeGreaterThan(0.3);
		expect(stone.vy).toBeGreaterThan(0);
		expect(stone.y).toBeGreaterThanOrEqual(STONE_R + 16 - 0.001);
	});
});

describe('aiming hint', () => {
	it('predicts the unswept path from the hack to where the stone stops', () => {
		const path = predictPath({ angle: 0, power: 0.66, spin: 1, ...calm });
		expect(path[0]).toEqual({ x: HACK.x, y: HACK.y });
		const end = path[path.length - 1];
		const real = slide(0.66, { spin: 1 }).stone;
		expect(Math.abs(end.x - real.x)).toBeLessThan(3);
		expect(Math.abs(end.y - real.y)).toBeLessThan(3);
	});

	it('shows only the asked fraction of the path', () => {
		const path = predictPath({ angle: 0, power: 0.66, spin: 1, ...calm });
		const half = trimPath(path, 0.5);
		expect(half.length).toBeLessThan(path.length);
		expect(half.length).toBeGreaterThan(1);
		expect(trimPath(path, 1)).toBe(path);
		expect(trimPath(path, 0)).toHaveLength(1);
	});
});

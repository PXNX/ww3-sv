import { describe, expect, it } from 'vitest';
import { createIsoView, depthOf, shade } from './iso';
import { BATTLE_VIEW } from './render';
import { HOME_VIEW, stageOf } from './baseArt';

describe('isometric view', () => {
	it('puts the grid corners where a 2:1 diamond expects them', () => {
		const view = createIsoView(12, 8, { halfW: 1, halfH: 0.5, pad: 0, headroom: 0, depth: 0 });
		expect(view.project(0, 0)).toEqual({ x: 8, y: 0 });
		expect(view.project(12, 0)).toEqual({ x: 20, y: 6 });
		expect(view.project(0, 8)).toEqual({ x: 0, y: 4 });
		expect(view.project(12, 8)).toEqual({ x: 12, y: 10 });
		expect(view.width).toBe(20);
		expect(view.height).toBe(10);
	});

	it('lifts things above the ground by their height', () => {
		const view = createIsoView(12, 8);
		const ground = view.project(5, 4);
		const raised = view.project(5, 4, 1.25);
		expect(raised.x).toBe(ground.x);
		expect(raised.y).toBeCloseTo(ground.y - 1.25, 10);
	});

	it('turns a screen position back into the grid cell it came from', () => {
		for (const view of [BATTLE_VIEW, HOME_VIEW]) {
			for (const [x, y] of [
				[0, 0],
				[3.5, 2.25],
				[11.9, 7.1],
				[6, 6]
			]) {
				const screen = view.project(x, y);
				const back = view.unproject(screen.x, screen.y);
				expect(back.x).toBeCloseTo(x, 8);
				expect(back.y).toBeCloseTo(y, 8);
			}
		}
	});

	it('keeps the whole battle grid, plus headroom for tall buildings, inside the picture', () => {
		const corners = [
			[0, 0],
			[12, 0],
			[0, 8],
			[12, 8]
		];
		for (const [x, y] of corners) {
			const point = BATTLE_VIEW.project(x, y);
			expect(point.x).toBeGreaterThan(0);
			expect(point.x).toBeLessThan(BATTLE_VIEW.width);
			expect(point.y - 1.5).toBeGreaterThan(0);
			expect(point.y).toBeLessThan(BATTLE_VIEW.height);
		}
	});

	it('sorts things further down the screen later', () => {
		expect(depthOf(5, 5)).toBeGreaterThan(depthOf(2, 3));
	});

	it('darkens and lightens colours', () => {
		expect(shade('#808080', -0.5)).toBe('rgb(64,64,64)');
		expect(shade('#000000', 1)).toBe('rgb(255,255,255)');
	});
});

describe('building stages', () => {
	it('moves through four looks over the levels and never past them', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((level) => stageOf(level, 8))).toEqual([
			0, 0, 1, 1, 2, 2, 3, 3
		]);
		expect([1, 2, 3, 4].map((level) => stageOf(level, 4))).toEqual([0, 1, 2, 3]);
		expect(stageOf(1, 6)).toBe(0);
		expect(stageOf(6, 6)).toBe(3);
		expect(stageOf(99, 6)).toBe(3);
		expect(stageOf(0, 6)).toBe(0);
	});
});

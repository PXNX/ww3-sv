import { expect, it } from 'vitest';
import { LEVELS } from './levels.js';
import { drawWarehousePreview } from './preview.js';
import { createGame } from './state.js';

it('draws the warehouse onto the score card for every level', () => {
	for (const level of LEVELS) {
		const calls: string[] = [];
		const context = new Proxy(
			{},
			{
				get: (_target, name: string) => () => void calls.push(name),
				set: () => true
			}
		) as unknown as CanvasRenderingContext2D;
		drawWarehousePreview(context, createGame(level), 0, 0, 300);
		expect(calls, level.id).toContain('fillRect');
		expect(calls.filter((name) => name === 'arc').length, level.id).toBe(
			level.barrels.length + level.guards.length
		);
	}
});

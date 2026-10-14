import { describe, expect, it } from 'vitest';
import { NO_LIE } from './lie';
import type { Level } from './level';
import { levelAt } from './levels';
import { drawChartPreview, drawScene } from './render';
import { createGame, crossCheck, setSteer, step } from './state';

/** A context that accepts every drawing call, so the drawing code can run without a canvas */
function fakeContext() {
	const calls: string[] = [];
	const context = new Proxy(
		{},
		{
			get: (_target, name: string) => {
				if (name === 'measureText') return () => ({ width: 80 });
				if (name === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
				return () => void calls.push(name);
			},
			set: () => true
		}
	);
	return { context: context as unknown as CanvasRenderingContext2D, calls };
}

describe('drawScene', () => {
	it('draws a whole run of the busiest level without errors', () => {
		const level = levelAt(11);
		const state = createGame(level);
		const { context, calls } = fakeContext();
		setSteer(state, 0.6, -0.8);
		for (let i = 0; i < 1200; i++) {
			step(state, 1 / 60);
			if (i % 60 === 0) drawScene(context, state);
		}
		crossCheck(state);
		drawScene(context, state, {
			reducedMotion: false,
			effects: [
				{ kind: 'popup', x: 10, y: 10, text: 'Hi', big: true, ageMs: 10, durationMs: 1000 },
				{ kind: 'ring', x: 10, y: 10, ageMs: 10, durationMs: 1000 }
			]
		});
		expect(calls.length).toBeGreaterThan(500);
	});

	it('draws every level on every coast', () => {
		const { context } = fakeContext();
		for (let index = 0; index < 12; index++) drawScene(context, createGame(levelAt(index)));
	});

	it('draws a level without a tanker, lighthouses or lie, and a sea smaller than the view', () => {
		const level: Level = {
			...levelAt(0),
			width: 10,
			height: 8,
			start: { x: 5, y: 5 },
			stops: [{ x: 5, y: 3, cargo: 'stones' }],
			rocks: [],
			shallows: [],
			buoys: [],
			lighthouses: [],
			tanker: null,
			lie: NO_LIE
		};
		const { context } = fakeContext();
		drawScene(context, createGame(level));
	});

	it('draws the chart for the score card', () => {
		const { context, calls } = fakeContext();
		drawChartPreview(context, createGame(levelAt(3)), 0, 0, 400);
		expect(calls).toContain('clip');
	});
});

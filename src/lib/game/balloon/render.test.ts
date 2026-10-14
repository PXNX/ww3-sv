import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { drawScene, drawScenePreview } from './render.js';
import { createGame, setBurner, step } from './state.js';

/** A context that accepts every drawing call, so the drawing code can run without a canvas */
function fakeContext() {
	const calls: string[] = [];
	const context = new Proxy(
		{},
		{
			get: (_target, name: string) => {
				if (name === 'measureText') return () => ({ width: 80 });
				return () => void calls.push(name);
			},
			set: () => true
		}
	);
	return { context: context as unknown as CanvasRenderingContext2D, calls };
}

describe('drawScene', () => {
	it('draws every phase of a run without errors', () => {
		const random = createRandom(4);
		const state = createGame(random, 4);
		const { context, calls } = fakeContext();
		setBurner(state, true);
		for (let i = 0; i < 1800; i++) {
			step(state, 1000 / 60, random);
			if (i % 60 === 0) drawScene(context, state);
		}
		state.phase = 'finale';
		drawScene(context, state, { reducedMotion: false, effects: [] });
		state.phase = 'over';
		drawScene(context, state, {
			reducedMotion: true,
			effects: [
				{ kind: 'popup', x: 100, y: 100, text: 'Hi', big: true, ageMs: 10, durationMs: 1000 },
				{ kind: 'bubble', x: 100, y: 60, text: 'Hello', ageMs: 10, durationMs: 1000 }
			]
		});
		expect(calls.length).toBeGreaterThan(500);
	});

	it('draws a jet warning and a jet in flight', () => {
		const random = createRandom(9);
		const state = createGame(random, 9);
		const { context } = fakeContext();
		state.jets = [{ layer: 2, ageMs: 100, x: 700, spent: false }];
		drawScene(context, state);
		state.jets = [{ layer: 2, ageMs: 2500, x: 300, spent: false }];
		drawScene(context, state);
	});

	it('draws the preview for the score card', () => {
		const { context, calls } = fakeContext();
		drawScenePreview(context, createGame(createRandom(1), 1), 0, 0, 400);
		expect(calls).toContain('clip');
	});
});

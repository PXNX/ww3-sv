import { describe, expect, it } from 'vitest';
import { createRandom } from '#lib/game/random.js';
import { drawScene, drawScenePreview } from './render.js';
import { createGame, rocketPosition, step, tap } from './state.js';

/** A context that accepts every drawing call, so the drawing code can run without a canvas */
function fakeContext() {
	const calls: string[] = [];
	const context = new Proxy(
		{},
		{
			get: (_target, name: string) => {
				if (name === 'measureText') return () => ({ width: 40 });
				return () => void calls.push(name);
			},
			set: () => true
		}
	);
	return { context: context as unknown as CanvasRenderingContext2D, calls };
}

describe('drawScene', () => {
	it('draws a whole run with rockets, interceptors, ruins and effects without errors', () => {
		const random = createRandom(4);
		const state = createGame();
		const { context, calls } = fakeContext();
		for (let i = 0; i < 1500; i++) {
			step(state, 1000 / 60, random);
			if (i % 20 === 0 && state.rockets.length > 0) tap(state, rocketPosition(state.rockets[0]));
			if (i % 60 === 0)
				drawScene(context, state, { reducedMotion: false, timeMs: i * 16, effects: [] });
		}
		state.ruined = state.ruined.map(() => true);
		state.blackoutMs = 3000;
		drawScene(context, state, {
			reducedMotion: true,
			timeMs: 0,
			effects: [
				{
					kind: 'popup',
					x: 100,
					y: 100,
					text: 'Hi',
					big: true,
					color: '#fff',
					ageMs: 10,
					durationMs: 1000
				},
				{ kind: 'burst', x: 200, y: 120, radius: 30, color: '#f5c83a', ageMs: 10, durationMs: 400 }
			]
		});
		expect(calls.length).toBeGreaterThan(500);
	});

	it('draws the preview for the score card', () => {
		const { context, calls } = fakeContext();
		drawScenePreview(context, createGame(), 0, 0, 400);
		expect(calls).toContain('clip');
	});
});

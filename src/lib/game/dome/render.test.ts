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
				{ kind: 'burst', x: 200, y: 120, radius: 30, color: '#f5c83a', ageMs: 10, durationMs: 400 },
				{
					kind: 'banner',
					text: 'Wave 2',
					sub: '6 incoming',
					color: '#f5c83a',
					ageMs: 120,
					durationMs: 1500
				}
			]
		});
		expect(calls.length).toBeGreaterThan(500);
	});

	it('draws particles, rings, a rocking building and a recoiling battery', () => {
		const { context, calls } = fakeContext();
		drawScene(context, createGame(), {
			reducedMotion: false,
			timeMs: 500,
			effects: [],
			particles: [
				{
					kind: 'smoke',
					x: 320,
					y: 250,
					vx: 4,
					vy: -12,
					gravity: 0,
					drag: 0.6,
					ageMs: 200,
					lifeMs: 900,
					size: 6,
					grow: 8,
					rot: 0,
					vr: 0,
					color: '#6d7482'
				},
				{
					kind: 'debris',
					x: 280,
					y: 240,
					vx: -30,
					vy: -60,
					gravity: 360,
					drag: 0.15,
					ageMs: 100,
					lifeMs: 1200,
					size: 4,
					grow: 0,
					rot: 0.4,
					vr: 6,
					color: '#3a3f47'
				},
				{
					kind: 'spark',
					x: 300,
					y: 230,
					vx: 40,
					vy: 20,
					gravity: 200,
					drag: 0.8,
					ageMs: 60,
					lifeMs: 400,
					size: 2,
					grow: 0,
					rot: 0,
					vr: 0,
					color: '#ffd23f'
				}
			],
			rings: [{ x: 300, y: 300, radius: 40, width: 3, ageMs: 80, lifeMs: 500, color: '#ffb347' }],
			wobble: [0, 0, 300, 0, 0],
			recoil: 4
		});
		expect(calls).toContain('rotate');
		expect(calls).toContain('ellipse');
		expect(calls).toContain('strokeRect');
	});

	it('draws the preview for the score card', () => {
		const { context, calls } = fakeContext();
		drawScenePreview(context, createGame(), 0, 0, 400);
		expect(calls).toContain('clip');
	});
});

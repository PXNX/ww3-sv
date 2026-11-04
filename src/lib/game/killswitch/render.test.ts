import { describe, expect, it } from 'vitest';
import { createGame, type Target, type TargetKind } from './state';
import { drawScene, drawScenePreview, type Effect } from './render';

/** A canvas context that accepts every call, records the method names and returns gradients */
function fakeContext() {
	const calls = new Set<string>();
	const store: Record<string, unknown> = {};
	const context = new Proxy(store, {
		get(target, key: string) {
			if (key in target) return target[key];
			return (...args: unknown[]) => {
				calls.add(key);
				if (key === 'createLinearGradient') return { addColorStop() {} };
				void args;
				return undefined;
			};
		},
		set(target, key: string, value) {
			target[key] = value;
			return true;
		}
	}) as unknown as CanvasRenderingContext2D;
	return { context, calls };
}

const KINDS: TargetKind[] = [
	'drone',
	'fast',
	'swarm',
	'hardened',
	'van',
	'tractor',
	'bus',
	'boat',
	'heli'
];

const EFFECTS: Effect[] = [
	{ kind: 'burst', x: 100, y: 100, size: 40, ageMs: 100, durationMs: 400 },
	{ kind: 'splash', x: 100, ageMs: 100, durationMs: 400 },
	{
		kind: 'popup',
		x: 100,
		y: 100,
		text: '+10',
		color: '#fff',
		size: 24,
		ageMs: 100,
		durationMs: 800
	},
	{ kind: 'ping', x: 100, y: 100, color: '#f00', ageMs: 100, durationMs: 400 },
	{ kind: 'snap', x1: 10, y1: 20, x2: 100, y2: 100, ageMs: 100, durationMs: 400 },
	{ kind: 'ring', x: 100, y: 100, size: 40, color: '#ff0', ageMs: 100, durationMs: 400 },
	{
		kind: 'sparks',
		x: 100,
		y: 100,
		size: 40,
		color: '#0ff',
		count: 8,
		seed: 1,
		ageMs: 100,
		durationMs: 400
	},
	{ kind: 'flash', color: '#f00', strength: 0.4, ageMs: 100, durationMs: 400 }
];

function sceneWithEverything() {
	const state = createGame();
	state.lives = 1;
	state.fence = { x1: 300, y1: 50, x2: 300, y2: 250, leftMs: 3000 };
	KINDS.forEach((kind, i) => {
		const civilian = !['drone', 'fast', 'swarm', 'hardened'].includes(kind);
		const target: Target = {
			id: i + 1,
			civilian,
			kind,
			x: 60 + i * 55,
			y: civilian ? 316 : 120,
			prevX: 0,
			prevY: 0,
			vx: i % 2 ? 60 : -60,
			vy: 10,
			state: i === 3 ? 'flying' : i === 8 ? 'offline' : 'flying',
			stateMs: 500,
			spin: 1,
			hp: 1,
			flashMs: 100
		};
		state.targets.push(target);
	});
	state.targets.push({ ...state.targets[0], id: 50, state: 'falling', stateMs: 300 });
	state.targets.push({ ...state.targets[4], id: 51, state: 'stalled' });
	return state;
}

describe('rendering', () => {
	it('draws every kind of target and effect, with and without reduced motion', () => {
		for (const reducedMotion of [false, true]) {
			const { context, calls } = fakeContext();
			drawScene(context, sceneWithEverything(), {
				effects: EFFECTS,
				timeMs: 12345,
				shakeX: 1,
				shakeY: 2,
				reducedMotion,
				preview: { x1: 0, y1: 0, x2: 100, y2: 100 }
			});
			expect(calls.has('fillRect')).toBe(true);
		}
	});

	it('draws the score card preview', () => {
		const { context } = fakeContext();
		expect(() =>
			drawScenePreview(
				context,
				sceneWithEverything(),
				{ effects: [], timeMs: 0, shakeX: 0, shakeY: 0, preview: null },
				0,
				0,
				300
			)
		).not.toThrow();
	});
});
